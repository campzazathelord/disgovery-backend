const { logger } = require("../../configs/config");
const APIStatus = require("../../configs/api-errors");
const Stop = require("../../models/Stop");
const Route = require("../../models/Route");
const sequelize = require("../../db/database");
const { Op } = require("sequelize");
const { getNearby } = require("../../functions/get-nearby");
const { generateRoute } = require("../../functions/algorithms");
const dayjs = require("dayjs");
const { QueryTypes } = require("sequelize");
const { jointFareRules } = require("../../db/joint-fare-rules");
const {
    calculateFare,
    addFares,
    resetTotalFares,
    getStationId,
    groupByRoute,
    getStationDetails,
    getArrayOfStationDetails,
    getNextTrainTime,
    timeBetweenStation,
    getTransferTime,
    toISOString,
    getArrayOfFares,
    getTotalFares,
} = require("../../functions/get-routes-util");

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

    let or_station = await getStationId(origin);
    let des_station = await getStationId(destination);
    let orType = origin[0];
    let desType = destination[0];

    if (!or_station || !des_station)
        return res.status(APIStatus.BAD_REQUEST.status).send({
            status: APIStatus.OK.status,
            message: "Unable to find nearby stations from the origin or the destination.",
        });

    let fare_options = [];

    if (req.body.fare_options) {
        fare_options = req.body.fare_options.split(",") || [];
    }

    const allRoutes = generateRoute(or_station, des_station);

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
    let totalTime = {};
    let breakToMainLoop = false;

    for (let i = 0; i < realRoutes.length; i++) {
        result = {};

        let now = performance.now();
        groupedRoutes = groupByRoute(realRoutes[i]);
        console.log("GROUP BY ROUTE", performance.now() - now);
        let direction_result = [];

        now = performance.now();
        for (let groupedRoute of groupedRoutes) {
            let stopsStationDetails = [];
            let line;
            console.log("groupedRoute", groupedRoute);

            let routeArrivalTime = dayjs().add(1, "minute");
            let totalDuration = 0;

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

                //schedule implementation
                tmpResult.schedule = {};
                tmpResult.schedule.departing_at = routeArrivalTime.format();
                let stopsArr = individualRoute.stops;
                //console.log(individualRoute.stops);

                let duration;
                if (individualRoute.type === "board") {
                    try {
                        let { waitTime, tripId } = await getNextTrainTime(
                            stopsArr[0],
                            stopsArr[stopsArr.length - 1],
                            routeArrivalTime,
                        );

                        // console.log(waitTime, tripId);

                        let lineDuration = await timeBetweenStation(
                            stopsArr[0],
                            stopsArr[stopsArr.length - 1],
                            tripId,
                        );

                        duration = waitTime + lineDuration;
                        totalDuration += duration;
                    } catch (error) {
                        logger.error(
                            `No routes from ${stopsArr[0]} to ${
                                stopsArr[stopsArr.length - 1]
                            } are available right now.`,
                        );
                        breakToMainLoop = true;
                        break;
                    }
                    // console.log(duration, "duration");
                } else if (individualRoute.type === "transfer") {
                    let transferDuration = await getTransferTime(stopsArr[0], stopsArr[1]);
                    totalDuration += transferDuration;
                    duration = transferDuration;
                    // console.log(duration, "duration");
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

        console.log("FIND SCHEDULE", performance.now() - now);

        now = performance.now();

        let firstStationOfRoute = realRoutes[i][0].stop_id;
        let lastStationOfRoute = realRoutes[i][0].stop_id;
        let currentRouteId = realRoutes[i][0].route_id;
        let separateFares,
            totalFares = {};
        totalTime = {};

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

        console.log("FIND FARES", performance.now() - now);

        now = performance.now();

        // result.schedule = getNextTrainTime(
        //     or_station,
        //     des_station,
        //     dayjs(await toISOString("07:30:00")),
        // );
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
        // result.fares = fareResult;
        result.fares = separateFares;
        result.directions = direction_result;

        result.origin = direction_result[0].from;
        result.destination = direction_result[direction_result.length - 1].to;
        console.log("FINAL FORMATTING", performance.now() - now);

        resultArr.push(result);
    }

    // console.log(getNextTrainTime(or_station,des_station,"07:30:00"));
    return res.status(APIStatus.OK.status).send({ status: APIStatus.OK, data: resultArr });
};

/*MAIN SCHEDULE
totaltime = {
    depart : now,
    arrival : ???,
    duration : 0, 
};

routeArrivalTime = now
for in
    nextTrainTime = getNextTrainTime(stop_id,routeArrivalTime)
    
    waitTime = nextTrainTime - routeArrivalTime
    
    duration += waitTime
    duration += transferTime*
    for stations
        if i===1 continue
        time = getTime(station[i],station[i-1])
        duration += time

    routeArrivalTime = now+duration    

arrival = depart.add(duration)
*/
