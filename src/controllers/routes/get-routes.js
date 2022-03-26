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
    getNextTrainTime,
    timeBetweenStation,
    getTransferTime,
    getArrayOfFares,
    getTotalFares,
} = require("../../functions/get-routes-util");
const { getDirectionsFromGoogle } = require("../../functions/google-directions-api");

exports.getRoutes = async function (req, res) {
    logger.info(`${req.method} ${req.baseUrl + req.path}`);

    try {
        if (!req.body.origin || !req.body.destination)
            return res.status(APIStatus.BAD_REQUEST.status).send({
                status: APIStatus.BAD_REQUEST.status,
                message: "Origin and destination are required",
            });

        let origin, destination;
        const allStops = req.app.get("stops");

        try {
            origin = req.body.origin.split(":");
            destination = req.body.destination.split(":");
            time = dayjs(req.body.time);

            if (origin.length <= 1 || destination.length <= 1)
                return res.status(APIStatus.BAD_REQUEST.status).send({
                    status: APIStatus.BAD_REQUEST.status,
                    message: "Invalid origin or destination strings",
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
        let googleDirections = {};

        console.log(originStationIds, destinationStationIds);

        if (!originStationIds || !destinationStationIds)
            return res.status(APIStatus.INTERNAL.SERVER_ERROR.status).send({
                status: APIStatus.INTERNAL.SERVER_ERROR.status,
                message: "Unable to find nearby stations from the origin or the destination.",
            });

        if (originType === "coordinates") {
            for (let originId of originStationIds) {
                let originCoordinates = origin[1].split(",");
                let perf = performance.now();
                googleDirections[originId] = await getDirectionsFromGoogle(
                    {
                        type: "coordinates",
                        coordinates: {
                            lat: parseFloat(originCoordinates[0]),
                            lng: parseFloat(originCoordinates[1]),
                        },
                    },
                    {
                        type: "coordinates",
                        coordinates: {
                            lat: parseFloat(allStops[originId].stop_lat),
                            lng: parseFloat(allStops[originId].stop_lon),
                        },
                    },
                );
                console.log("GOOGLE ORIGIN", performance.now() - perf);
            }
        }

        if (destinationType === "coordinates") {
            for (let destinationId of destinationStationIds) {
                let destinationCoordinates = destination[1].split(",");
                let perf = performance.now();

                googleDirections[destinationId] = await getDirectionsFromGoogle(
                    {
                        type: "coordinates",
                        coordinates: {
                            lat: parseFloat(allStops[destinationId].stop_lat),
                            lng: parseFloat(allStops[destinationId].stop_lon),
                        },
                    },
                    {
                        type: "coordinates",
                        coordinates: {
                            lat: parseFloat(destinationCoordinates[0]),
                            lng: parseFloat(destinationCoordinates[1]),
                        },
                    },
                );
                console.log("GOOGLE DEST", performance.now() - perf);
            }
        }

        let fare_options = ["adult"];

        if (req.body.fare_options) {
            if (req.body.fare_options.includes("all"))
                fare_options = ["adult", "elder", "child", "disabled", "student"];
            else fare_options = req.body.fare_options.split(",") || [];
        }

        let response = [];

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

        for (let originStationId of originStationIds) {
            for (let destinationStationId of destinationStationIds) {
                perf = performance.now();
                response.push(
                    ...(await getRoutes(
                        originStationId,
                        destinationStationId,
                        fare_options,
                        googleDirections
                            ? googleDirections[originStationId]
                                ? googleDirections[originStationId].schedule.arriving_at
                                : undefined
                            : undefined || undefined,
                        allStops,
                        routeOfStation,
                    )),
                );
                console.log("----- FOUND ROUTE IN", performance.now() - perf);
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

        // Add origin and destination walk directions if available
        for (let i in response) {
            if (!googleDirections) break;

            // Origin
            if (googleDirections[response[i].directions[0].from.station.id]) {
                if (googleDirections[response[i].directions[0].from.station.id].schedule) {
                    let googleDirection = JSON.parse(
                        JSON.stringify(googleDirections[response[i].directions[0].from.station.id]),
                    );

                    response[i].directions.unshift(googleDirection);
                    response[i].schedule.departing_at =
                        response[i].directions[0].schedule.departing_at;
                    response[i].schedule.duration = dayjs(response[i].schedule.arriving_at).diff(
                        dayjs(response[i].schedule.departing_at),
                        "second",
                    );
                }
            }

            // Destination
            if (
                googleDirections[
                    response[i].directions[response[i].directions.length - 1].to.station.id
                ]
            ) {
                if (
                    googleDirections[
                        response[i].directions[response[i].directions.length - 1].to.station.id
                    ].schedule
                ) {
                    let googleDirection = JSON.parse(
                        JSON.stringify(
                            googleDirections[
                                response[i].directions[response[i].directions.length - 1].to.station
                                    .id
                            ],
                        ),
                    );

                    googleDirection.schedule = {
                        departing_at:
                            response[i].directions[response[i].directions.length - 1].schedule
                                .arriving_at,
                        arriving_at: dayjs(
                            response[i].directions[response[i].directions.length - 1].schedule
                                .arriving_at,
                        )
                            .add(googleDirection.schedule.duration, "second")
                            .format(),
                        duration: googleDirection.schedule.duration,
                    };

                    response[i].directions.push(googleDirection);
                    response[i].schedule.arriving_at =
                        response[i].directions[
                            response[i].directions.length - 1
                        ].schedule.arriving_at;
                    response[i].schedule.duration = dayjs(response[i].schedule.arriving_at).diff(
                        dayjs(response[i].schedule.departing_at),
                        "second",
                    );
                }
            }
        }

        return res.status(APIStatus.OK.status).send({ status: APIStatus.OK, data: response });
    } catch (error) {
        logger.error(error.message);
        return res.status(APIStatus.INTERNAL.SERVER_ERROR.status).send({
            status: APIStatus.INTERNAL.SERVER_ERROR.status,
            message: "Something went wrong",
        });
    }
};

let cachedTimeBetweenStations = {};
let cachedNextTrainTime = {};
let cachedFares = {};
let cachedTransfers = {};

async function getRoutes(
    originId,
    destinationId,
    fare_options,
    departingAt,
    allStops,
    routeOfStation,
) {
    let now = performance.now();
    const allRoutes = await generateRoute(originId, destinationId);
    console.log("------- GEN ROUTE", performance.now() - now);

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

            let routeArrivalTime = dayjs(departingAt || undefined).add(1, "minute");

            for (let individualRoute of groupedRoute) {
                stopsStationDetails = [];
                if (individualRoute.type !== "transfer")
                    line = await Route.findOne({ where: { route_id: individualRoute.line } });

                let tmpResult = {};
                tmpResult.type = individualRoute.type;

                now = performance.now();
                for (let stopId of individualRoute.stops) {
                    stopsStationDetails.push(formatStop(allStops[stopId]));
                }
                console.log("FIND STOPS", performance.now() - now);

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
                let waitDuration = 0;
                let departingTime, arrivalTime, duration;

                if (individualRoute.type === "board") {
                    try {
                        let perf = performance.now();
                        let tripIdAvailable = "";
                        let formattedRouteArrivalTime = routeArrivalTime.format();

                        if (
                            !cachedNextTrainTime[
                                `${stopsArr[0]}__${
                                    stopsArr[stopsArr.length - 1]
                                }_AT_${formattedRouteArrivalTime}`
                            ]
                        ) {
                            let { waitTime, tripId } = await getNextTrainTime(
                                stopsArr[0],
                                stopsArr[stopsArr.length - 1],
                                routeArrivalTime,
                            );

                            tripIdAvailable = tripId;
                            waitDuration = waitTime;

                            cachedNextTrainTime[
                                `${stopsArr[0]}__${
                                    stopsArr[stopsArr.length - 1]
                                }_AT_${formattedRouteArrivalTime}`
                            ] = { trip_id: tripId, wait_time: waitDuration };
                        } else {
                            tripIdAvailable =
                                cachedNextTrainTime[
                                    `${stopsArr[0]}__${
                                        stopsArr[stopsArr.length - 1]
                                    }_AT_${formattedRouteArrivalTime}`
                                ].trip_id;
                            waitDuration =
                                cachedNextTrainTime[
                                    `${stopsArr[0]}__${
                                        stopsArr[stopsArr.length - 1]
                                    }_AT_${formattedRouteArrivalTime}`
                                ].wait_time;
                        }

                        console.log("NEXT TRAIN TIME", performance.now() - perf);
                        perf = performance.now();

                        if (
                            !cachedTimeBetweenStations[
                                `${stopsArr[0]}__${stopsArr[stopsArr.length - 1]}`
                            ]
                        ) {
                            duration = await timeBetweenStation(
                                stopsArr[0],
                                stopsArr[stopsArr.length - 1],
                                tripIdAvailable,
                            );
                            cachedTimeBetweenStations[
                                `${stopsArr[0]}__${stopsArr[stopsArr.length - 1]}`
                            ] = duration;
                        } else {
                            duration =
                                cachedTimeBetweenStations[
                                    `${stopsArr[0]}__${stopsArr[stopsArr.length - 1]}`
                                ];
                        }

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

                    departingTime = routeArrivalTime.add(waitDuration, "second");
                    arrivalTime = departingTime.add(duration, "second");
                    tmpResult.schedule.departing_at = departingTime.format();
                    tmpResult.schedule.arriving_at = arrivalTime.format();
                    tmpResult.schedule.duration = duration;
                } else if (individualRoute.type === "transfer") {
                    let perf = performance.now();
                    let transferDuration = 0;

                    if (!cachedTransfers[`${stopsArr[0]}__${stopsArr[1]}`]) {
                        transferDuration = await getTransferTime(stopsArr[0], stopsArr[1]);
                        cachedTransfers[`${stopsArr[0]}__${stopsArr[1]}`] = transferDuration;
                    } else {
                        transferDuration = cachedTransfers[`${stopsArr[0]}__${stopsArr[1]}`];
                    }

                    console.log("TRANSFER TIME", performance.now() - perf);
                    duration = transferDuration;

                    departingTime = routeArrivalTime.add(waitDuration, "second");
                    arrivalTime = departingTime.add(duration, "second");
                    tmpResult.schedule.departing_at = departingTime.format();
                    tmpResult.schedule.arriving_at = arrivalTime.format();
                    tmpResult.schedule.duration = duration;
                }

                routeArrivalTime = arrivalTime;
                direction_result.push(tmpResult);
            }

            if (breakToMainLoop) break;
        }

        if (breakToMainLoop) {
            breakToMainLoop = false;
            continue;
        }

        let firstStationOfRoute = realRoutes[i][0].stop_id;
        let firstZoneOfRoute = realRoutes[i][0].zone_id;
        let lastStationOfRoute = realRoutes[i][0].stop_id;
        let lastZoneOfRoute = realRoutes[i][0].zone_id;
        let currentRouteId = realRoutes[i][0].route_id;
        let separateFares,
            totalFares = {};
        let faresToFind = [];

        for (let j = 0; j < realRoutes[i].length; j++) {
            if (j === realRoutes[i].length - 1) {
                if (
                    realRoutes[i][j].route_id === currentRouteId ||
                    (jointFareRules[realRoutes[i][j].route_id] &&
                        jointFareRules[realRoutes[i][j].route_id].includes(currentRouteId))
                ) {
                    lastStationOfRoute = realRoutes[i][j].stop_id;
                    lastZoneOfRoute = realRoutes[i][j].zone_id;

                    faresToFind.push({
                        origin_id: firstStationOfRoute,
                        destination_id: lastStationOfRoute,
                        origin_zone_id: firstZoneOfRoute,
                        destination_zone_id: lastZoneOfRoute,
                    });
                }
            }

            if (
                realRoutes[i][j].route_id === currentRouteId ||
                (jointFareRules[realRoutes[i][j].route_id] &&
                    jointFareRules[realRoutes[i][j].route_id].includes(currentRouteId))
            ) {
                lastStationOfRoute = realRoutes[i][j].stop_id;
                lastZoneOfRoute = realRoutes[i][j].zone_id;
            } else {
                faresToFind.push({
                    origin_id: firstStationOfRoute,
                    destination_id: lastStationOfRoute,
                    origin_zone_id: firstZoneOfRoute,
                    destination_zone_id: lastZoneOfRoute,
                });

                firstStationOfRoute = realRoutes[i][j].stop_id;
                firstZoneOfRoute = realRoutes[i][j].zone_id;
                lastStationOfRoute = realRoutes[i][j].stop_id;
                lastZoneOfRoute = realRoutes[i][j].zone_id;
                currentRouteId = realRoutes[i][j].route_id;
            }
        }

        now = performance.now();
        let uncachedFaresToFind = [];
        let order = [];

        for (let i in faresToFind) {
            if (!cachedFares[`${faresToFind[i].origin_id}__${faresToFind[i].destination_id}`]) {
                uncachedFaresToFind.push(faresToFind[i]);
            }

            order.push(`${faresToFind[i].origin_id}__${faresToFind[i].destination_id}`);
        }

        separateFares = await getArrayOfFares(
            uncachedFaresToFind,
            fare_options.length === 0 ? undefined : fare_options,
            allStops,
        );

        for (let fare of separateFares) {
            cachedFares[`${fare.from.station.id}__${fare.to.station.id}`] = fare;
        }

        let formattedFares = [];

        for (let key of order) {
            formattedFares.push(cachedFares[key]);
        }

        try {
            totalFares = getTotalFares(formattedFares);
        } catch (error) {
            logger.error(error.message);
            totalFares = {};
        }

        console.log("FARE FOUND IN", performance.now() - now);

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
        result.fares = formattedFares;
        result.directions = direction_result;
        result.origin = direction_result[0].from;
        result.destination = direction_result[direction_result.length - 1].to;

        console.log("FORMATTED IN", performance.now() - now);

        resultArr.push(result);
    }

    return resultArr;
}

function formatStop(stop) {
    try {
        return {
            station: {
                id: stop.stop_id,
                code: stop.stop_code,
                name: {
                    en: stop.stop_name_en,
                    th: stop.stop_name_th,
                },
            },
            coordinates: {
                lat: parseFloat(stop.stop_lat),
                lng: parseFloat(stop.stop_lon),
            },
        };
    } catch (error) {
        return {};
    }
}
