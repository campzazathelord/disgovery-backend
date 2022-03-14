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
    getNextTrainTime,
} = require("../../functions/get-routes-util");
const { getGTFSFormattedCurrentTime } = require("../../functions/get-gtfs-formatted-current-time");

const MAX_RADIUS = 30000;
const RADIUS_STEP = 5000;
const MAX_NEARBY_STATIONS = 3;

exports.getRoute = async function (req, res) {
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

    console.log(or_station, des_station);

    if (!or_station || !des_station)
        return res.status(APIStatus.BAD_REQUEST.status).send({
            status: APIStatus.OK.status,
            message: "Unable to find nearby stations from the origin or the destination.",
        });

    let fare_options = req.body.fare_options || "";

    let includeAdultFares = true,
        includeElderFares = false,
        includeChildFares = false,
        includeDisabledFares = false;

    if (fare_options.includes("all")) {
        includeAdultFares = true;
        includeChildFares = true;
        includeDisabledFares = true;
        includeElderFares = true;
    } else {
        includeAdultFares = fare_options.includes("adult");
        includeElderFares = fare_options.includes("elder");
        includeChildFares = fare_options.includes("child");
        includeDisabledFares = fare_options.includes("disabled");
    }

    fare_options = {
        adult: includeAdultFares,
        elder: includeElderFares,
        child: includeChildFares,
        disabled: includeDisabledFares,
    };

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

    let tmp = [];
    let realRoutes = [];
    for (let avaliableRoutes of allRoutes) {
        tmp = [];
        avaliableRoutes.pop();

        const haha = avaliableRoutes.map((station) => {
            let findRoute = routeOfStation.filter((x) => {
                return x.zone_id == station;
            });

            tmp.push(...findRoute);
        });

        realRoutes.push(tmp);
    }
    console.log("kaufsdfgsgsdf");
    console.log(realRoutes);
    console.log("kaufsdfgsgsdf");
    let totalFares = resetTotalFares(fare_options);
    let result = {};
    let resultArr = [];
    let totalTime = {};

    for (let i = 0; i < realRoutes.length; i++) {
        console.log(realRoutes[i]);

        let firstStationOfRoute = realRoutes[i][0].stop_id;
        let lastStationOfRoute = realRoutes[i][0].stop_id;
        let currentRouteId = realRoutes[i][0].route_id;
        totalFares = resetTotalFares(fare_options);
        totalTime = {};
        //let previousFare = 0;

        for (let j = 0; j < realRoutes[i].length; j++) {
            // if (j === realRoutes[i].length - 1) {
            //     lastStationOfRoute = realRoutes[i][j].stop_id;
            //     totalFares += await calculateFare(firstStationOfRoute, lastStationOfRoute);
            //     previousFare = 0;
            // }

            // let fare = await calculateFare(firstStationOfRoute, lastStationOfRoute);

            // if (!fare || j === realRoutes[i].length - 1) {
            //     firstStationOfRoute = lastStationOfRoute;
            //     totalFares += previousFare;
            //     previousFare = 0;
            // } else {
            //     lastStationOfRoute = realRoutes[i][j].stop_id;
            //     previousFare = fare || 0;
            // }

            if (j === realRoutes[i].length - 1) {
                lastStationOfRoute = realRoutes[i][j].stop_id;
                totalFares = addFares(
                    await totalFares,
                    await calculateFare(firstStationOfRoute, lastStationOfRoute, fare_options),
                );
                // {adult: 10 , elder : 20}
            }

            if (
                realRoutes[i][j].route_id === currentRouteId ||
                jointFareRules[realRoutes[i][j].route_id].includes(currentRouteId)
            ) {
                lastStationOfRoute = realRoutes[i][j].stop_id;
            } else {
                totalFares = addFares(
                    await totalFares,
                    await calculateFare(firstStationOfRoute, lastStationOfRoute, fare_options),
                );

                firstStationOfRoute = realRoutes[i][j].stop_id;
                lastStationOfRoute = realRoutes[i][j].stop_id;
                currentRouteId = realRoutes[i][j].route_id;
            }
        }

        console.log("totalFares=", totalFares);

        groupedRoutes = groupByRoute(realRoutes[i]);
        let direction_result = [];
        for (let groupedRoute of groupedRoutes) {
            let stopsStationDetails = [];
            for (let stop of groupedRoute[0].stops) {
                let detailResult = await getStationDetails(stop, "station");
                stopsStationDetails.push(detailResult);
            }

            let line = await Route.findOne({ where: { route_id: groupedRoute[0].line } });

            let tmpResult = {};
            tmpResult.type = groupedRoute[0].type;
            //fix type
            tmpResult.from = await getStationDetails(groupedRoute[0].stops[0], orType);
            if (tmpResult.type === "board") tmpResult.fare = totalFares;
            tmpResult.to = await getStationDetails(
                groupedRoute[0].stops[groupedRoute[0].stops.length - 1],
                desType,
            );
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
            //         from: await getStationDetails(groupedRoute[0].stops[0]),
            //         fare: totalFares,
            //         to: await getStationDetails(
            //             groupedRoute[0].stops[groupedRoute[0].stops.length - 1],
            //         ),
            //         via_line: {
            //             name: {
            //                 short_name: line.route_short_name,
            //                 long_name: line.route_long_name,
            //             },
            //             color: line.route_color,
            //         },
            //         passing: stopsStationDetails,
            //     };
            direction_result.push(tmpResult);
        }

        result.schedule = 0;
        result.fares = totalFares;
        result.origin = await getStationDetails(or_station, orType);
        result.destination = await getStationDetails(des_station, desType);
        (result.directions = direction_result), resultArr.push(result);
    }

    console.log(resultArr);

    return res.status(APIStatus.OK.status).send({ status: APIStatus.OK, data: resultArr });
};

/*
totaltime = {
    depart = now
    arrival
    duration = 0 
}
routeArrivalTime = now
for transfers
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

getNextTrainTime(stop_id,routeArrivalTime){
    nowDateNumber = now.get(date)
    const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    nowDate = WEEKDAYS[nowDateNumber]
    e <- select service_id from trips where route_id = route_id
    a <- select trip_id from stop_times where stop_id = stop_id //check first and last station in trip
    b <- select service_id from calendar where ${nowDate} = 1
    z <- e join b
    c <- select trip_id from stop_times where service_id = z
    a join c
}
timeBetweenStation(stop1,stop2){
    ...
}
*/
