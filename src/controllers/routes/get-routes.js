const APIStatus = require("../../configs/api-errors");
const Route = require("../../models/Route");
const sequelize = require("../../db/database");
const dayjs = require("dayjs");

const { logger } = require("../../configs/config");
const { generateRoute } = require("../../functions/algorithms");
const { QueryTypes } = require("sequelize");
const { jointFareRules } = require("../../db/joint-fare-rules");
const {
    getNearbyStations,
    groupByRoute,
    getArrayOfStationDetails,
    getNextTrainTime,
    timeBetweenStation,
    getTransferTime,
    getArrayOfFares,
    getTotalFares,
} = require("../../functions/get-routes-util");
const { getDirectionsFromGoogle } = require("../../functions/google-directions-api");

exports.getRoutes = async function (req, res) {
    logger.info(`${req.method} ${req.baseUrl + req.path}`);

    logger.info(req.body || !req.body.destination);

    if (!req.body.origin || !req.body.destination)
        return res.status(APIStatus.BAD_REQUEST.status).send({
            status: APIStatus.BAD_REQUEST.status,
            message: "Origin and destination are required",
        });

    let origin, destination, time;

    try {
        origin = req.body.origin.split(":");
        destination = req.body.destination.split(":");
        time = dayjs(req.body.time);

        if (origin.length <= 1 || destination.length <= 1)
            return res.status(APIStatus.BAD_REQUEST.status).send({
                status: APIStatus.BAD_REQUEST.status,
                message: "หัดใส่ข้อมูลให้ถูกๆดิไอ้หน้าเหี้ย",
            });
    } catch (error) {
        logger.error(error);
        return res.status(APIStatus.BAD_REQUEST.status).send({
            status: APIStatus.BAD_REQUEST.status,
            message: "An origin should be a string.",
        });
    }

    let originStationIds = await getNearbyStations(origin);
    let destinationStationIds = await getNearbyStations(destination);
    let originType = origin[0];
    let destinationType = destination[0];

    if (!originStationIds || !destinationStationIds)
        return res.status(APIStatus.INTERNAL.SERVER_ERROR.status).send({
            status: APIStatus.INTERNAL.SERVER_ERROR.status,
            message: "Unable to find nearby stations from the origin or the destination.",
        });

    let fare_options = ["adult"];

    if (req.body.fare_options) {
        if (req.body.fare_options.includes("all"))
            fare_options = ["adult", "elder", "child", "disabled", "student"];
        else fare_options = req.body.fare_options.split(",") || [];
    }

    let response = [];

    for (let originStationId of originStationIds) {
        for (let destinationStationId of destinationStationIds) {
            response.push(
                ...(await getRoutes(originStationId, destinationStationId, fare_options)),
            );
        }
    }

    let directionsNumber = Math.round(
        response.length / (originStationIds.length * destinationStationIds.length),
    );

    response.sort(function (a, b) {
        return a.schedule.duration - b.schedule.duration;
    });

    for (let i = response.length; i > directionsNumber; i--) {
        response.pop();
    }
    
    //checks for dupe route (same Directions) and removes it
    for (let i = 0; i<response.length;i++){
        for(let j = i+1; j<response.length;j++){
            if(checkDirections(response[i],response[j])){
                console.log('SameDirections');
                response.splice(j,1);
                j--
            } 
        }
    }

    //console.log(response,'RESPONSE BEFORE');
    response = await addDirectionsFromGoogle(response, originType, destinationType, origin, destination);
    //console.log(response,'RESPONSE AFTER');

    return res.status(APIStatus.OK.status).send({ status: APIStatus.OK, data: response });
};

async function addDirectionsFromGoogle(response, originType, destinationType, origin, destination) {

    for (let direction of response) {
        if (originType === "coordinates") {
            // console.log(formatLatLng(origin[1]),"formatLatLng(origin[1])");
            // console.log(direction.directions[0].from.coordinates,"direction.directions[0].from.coordinates");
            direction.directions.unshift(
                await getDirectionsFromGoogle(
                    {
                        type: "coordinates",
                        coordinates: formatLatLng(origin[1]),
                    },
                    {
                        type: "coordinates",
                        //coordinates: direction.destination.coordinates,
                        coordinates: direction.directions[0].from.coordinates,
                    },
                ),
            );
        } else if (originType === "google") {
            direction.directions.unshift(
                await getDirectionsFromGoogle(
                    {
                        type: "place_id",
                        place_id: direction.origin.place.place_id,
                    },
                    {
                        type: "place_id",
                        place_id: direction.destination.place.place_id,
                    },
                ),
            );
        }

        if(originType === "google" || originType === "coordinates"){
            let originWalkDuration = direction.directions[0].schedule.duration;
            console.log('originWalkDuration:',originWalkDuration);
            direction.schedule.duration += originWalkDuration;
            direction.schedule.arriving_at = dayjs(direction.schedule.arriving_at).add(originWalkDuration,"seconds").format();
        }

        if (destinationType === "coordinates") {
            //console.log(direction.directions[direction.directions.length-1].to.coordinates,"direction.directions[direction.directions.length-1].to.coordinates");
            //console.log(formatLatLng(destination[1]),"v");
            direction.directions.push(
                await getDirectionsFromGoogle(
                    {
                        type: "coordinates",
                        //coordinates: direction.origin.coordinates,
                        coordinates: direction.directions[direction.directions.length-1].to.coordinates,
                    },
                    {
                        type: "coordinates",
                        coordinates: formatLatLng(destination[1]),
                    },
                ),
            );
        } else if (destinationType === "google") {
            direction.directions.push(
                await getDirectionsFromGoogle(
                    {
                        type: "place_id",
                        place_id: direction.origin.place.place_id,
                    },
                    {
                        type: "place_id",
                        place_id: direction.destination.place.place_id,
                    },
                ),
            );
        }

        if(destinationType === "google" || destinationType === "coordinates"){
            let destinationWalkDuration = direction.directions[direction.directions.length-1].schedule.duration;
            console.log('destinationWalkDuration:',destinationWalkDuration);
            direction.schedule.duration += destinationWalkDuration;
            direction.schedule.arriving_at = dayjs(direction.schedule.arriving_at).add(destinationWalkDuration,"seconds").format();
        }
    }
    return response;
}

async function getRoutes(originId, destinationId, fare_options) {
    const allRoutes = await generateRoute(originId, destinationId);

    const routeOfStation = await sequelize.query(
        `
            SELECT zone_id, stop_ids.stop_id, route_id FROM (
                    SELECT stop_id, route_id
                    FROM ((SELECT trip_id, stop_id
                        FROM stop_times
                        GROUP BY stop_id) AS trip_ids
                    INNER JOIN trips
                    ON trips.trip_id = trip_ids.trip_id)
            ) AS stop_ids
            INNER JOIN stops ON stops.stop_id=stop_ids.stop_id;
        `,
        {
            type: QueryTypes.SELECT,
        },
    );

    let routeOfStationObj = {};
    for (let routeObj of routeOfStation) {
        let stationName = routeObj.stop_id;
        routeOfStationObj[stationName] = routeObj;
    }

    let tmp = [];
    let realRoutes = [];
    for (let avaliableRoutes of allRoutes) {
        tmp = [];
        avaliableRoutes.pop();

        for (let station of avaliableRoutes) {
            tmp.push(routeOfStationObj[station]);
        }

        realRoutes.push(tmp);
    }

    let result;
    let resultArr = [];
    let breakToMainLoop = false;

    for (let i = 0; i < realRoutes.length; i++) {
        result = {};

        groupedRoutes = groupByRoute(realRoutes[i]);
        let direction_result = [];

        now = performance.now();
        for (let groupedRoute of groupedRoutes) {
            let stopsStationDetails = [];
            let line;

            let routeArrivalTime = dayjs("2022-03-22T12:40:00+0700").add(1, "minute");

            for (individualRoute of groupedRoute) {
                if (individualRoute.type !== "transfer")
                    line = await Route.findOne({ where: { route_id: individualRoute.line } });

                let tmpResult = {};
                tmpResult.type = individualRoute.type;
                stopsStationDetails = await getArrayOfStationDetails(individualRoute.stops);

                tmpResult.from = stopsStationDetails[0];
                tmpResult.to = stopsStationDetails[stopsStationDetails.length - 1];
                if (tmpResult.type === "board") {
                    tmpResult.via_line = {
                        name: {
                            short_name: line.route_short_name,
                            long_name: line.route_long_name,
                        },
                    };
                    tmpResult.via_line.color = line.route_color;
                }

                if (tmpResult.type === "board") {
                    tmpResult.passing = stopsStationDetails;
                }

                tmpResult.schedule = {};
                tmpResult.schedule.departing_at = routeArrivalTime.format();
                let stopsArr = individualRoute.stops;

                let duration;
                if (individualRoute.type === "board") {
                    try {
                        let perf = performance.now();
                        let { tripId } = await getNextTrainTime(
                            stopsArr[0],
                            stopsArr[stopsArr.length - 1],
                            routeArrivalTime,
                        );
                        console.log("NEXT TRAIN TIME", performance.now() - perf);
                        perf = performance.now();

                        duration = await timeBetweenStation(
                            stopsArr[0],
                            stopsArr[stopsArr.length - 1],
                            tripId,
                        );
                        console.log("TIME BTW STN", performance.now() - perf);
                    } catch (error) {
                        logger.error(
                            `No routes from ${stopsArr[0]} to ${
                                stopsArr[stopsArr.length - 1]
                            } are available right now: ${error}`,
                        );
                        breakToMainLoop = true;
                        break;
                    }
                } else if (individualRoute.type === "transfer") {
                    let transferDuration = await getTransferTime(stopsArr[0], stopsArr[1]);
                    duration = transferDuration;
                }

                routeArrivalTime = routeArrivalTime.add(duration, "second");
                tmpResult.schedule.arriving_at = routeArrivalTime.format();
                tmpResult.schedule.duration = duration;

                direction_result.push(tmpResult);
            }

            if (breakToMainLoop) break;
        }

        if (breakToMainLoop) {
            breakToMainLoop = false;
            continue;
        }

        let firstStationOfRoute = realRoutes[i][0].stop_id;
        let lastStationOfRoute = realRoutes[i][0].stop_id;
        let currentRouteId = realRoutes[i][0].route_id;
        let separateFares,
            totalFares = {};
        let faresToFind = [];

        for (let j = 0; j < realRoutes[i].length; j++) {
            if (j === realRoutes[i].length - 1) {
                lastStationOfRoute = realRoutes[i][j].stop_id;

                faresToFind.push({
                    origin_id: firstStationOfRoute,
                    destination_id: lastStationOfRoute,
                });
            }

            if (
                realRoutes[i][j].route_id === currentRouteId ||
                (jointFareRules[realRoutes[i][j].route_id] &&
                    jointFareRules[realRoutes[i][j].route_id].includes(currentRouteId))
            ) {
                lastStationOfRoute = realRoutes[i][j].stop_id;
            } else {
                faresToFind.push({
                    origin_id: firstStationOfRoute,
                    destination_id: lastStationOfRoute,
                });

                firstStationOfRoute = realRoutes[i][j].stop_id;
                lastStationOfRoute = realRoutes[i][j].stop_id;
                currentRouteId = realRoutes[i][j].route_id;
            }
        }

        separateFares = await getArrayOfFares(
            faresToFind,
            fare_options.length === 0 ? undefined : fare_options,
        );
        totalFares = getTotalFares(separateFares);

        now = performance.now();

        let overallDepartingTime = direction_result[0].schedule.departing_at;
        let overallArrivingTime =
            direction_result[direction_result.length - 1].schedule.arriving_at;

        result.schedule = Array.isArray(direction_result)
            ? {
                  departing_at: overallDepartingTime,
                  arriving_at: overallArrivingTime,
                  duration: dayjs(overallArrivingTime).diff(dayjs(overallDepartingTime), "second"),
              }
            : undefined;
        result.total_fares = totalFares;
        result.fares = separateFares;
        result.directions = direction_result;
        result.origin = direction_result[0].from;
        result.destination = direction_result[direction_result.length - 1].to;

        resultArr.push(result);
    }

    return resultArr;
}

function formatLatLng(unformatted){
    latLng = unformatted.split(',')
    return {
        lat:latLng[0],
        lng:latLng[1],
    };
}

function checkDirections(res1,res2) {return JSON.stringify(res1.directions) === JSON.stringify(res2.directions)}
