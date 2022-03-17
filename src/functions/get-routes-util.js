const { logger } = require("../configs/config");
const sequelize = require("../db/database");
const { getNearby } = require("../functions/get-nearby");
const { QueryTypes } = require("sequelize");
const Translation = require("../models/Translation");
const Stop = require("../models/Stop");
const dayjs = require("dayjs");
const { getGTFSFormattedCurrentTime } = require("./get-gtfs-formatted-current-time");


exports.calculateFare = async function (origin, destination, fare_options) {
    const prices = await sequelize.query(
        `
        SELECT fare_type,price
        FROM fare_attributes
        WHERE fare_id = (SELECT fare_id
                        FROM fare_rules
                        WHERE origin_id = '${origin}' and destination_id = '${destination}');
        `,
        {
            type: QueryTypes.SELECT,
        },
    );
    let fare = { currency: "THB" };
    for (const [key, value] of Object.entries(fare_options)) {
        if (value) {
            for (const price of prices) {
                if (price && price.fare_type && price.price && price.fare_type.trim() === key)
                    fare[key] = parseFloat(price.price);
            }
        }
    }
    return fare;
};

exports.addFares = function (currentFare, fare) {
    for (const [key, value] of Object.entries(currentFare)) {
        if (key != "currency") {
            currentFare[key] += fare[key];
        }
    }

    return currentFare;
};

exports.resetTotalFares = function (fare_options) {
    let result = { currency: "THB" };
    for (const [key, value] of Object.entries(fare_options)) {
        if (fare_options[key]) result[key] = 0;
    }
    return result;
};

exports.getStationId = async function (stationArray) {
    const RADIUS_STEP = 5000;
    const MAX_RADIUS = 30000;
    const MAX_NEARBY_STATIONS = 3;
    if (stationArray[0] === "coordinates") {
        let coordinates = stationArray[1].split(",");
        let lat = coordinates[0];
        let lng = coordinates[1];
        logger.info(lat + " " + lng);

        try {
            for (let r = RADIUS_STEP; r < MAX_RADIUS; r += RADIUS_STEP) {
                let station = (await getNearby(lat, lng, r, MAX_NEARBY_STATIONS)) || [];

                console.log('found',station);

                if (station.length === 0) continue;
                else return station[0].stop_id;
            }
        } catch (error) {
            logger.error(error);
            throw error;
        }
    } else if (stationArray[0] === "station") {
        let station = stationArray[1];
        logger.info(station);
        return station;
    } // else if (stationArray[0] === "google") {
    //  let google = stationArray[1];
    // logger.info(or_google);
    //}
    return "";
};

// exports.groupByRoute = function (realRoutes) {
//     //console.log("groupByRoute_input: ",realRoutes)
//     let firstStation;
//     let lastStation;
//     let currentRoute;
//     let result = [];
//     let subResult = [];
//     let superResult = [];
//     for (let i = 0; i < realRoutes.length; i++) {
//         //iterate through each path generated from algorithm
//         firstStation = realRoutes[i][0].stop_id; //stop_id of the first station in path[i]
//         lastStation = realRoutes[i][0].stop_id;
//         currentRoute = realRoutes[i][0].route_id; //set currentRoute to route_id of first station

//         for (let j = 1; j < realRoutes[i].length; j++) {
//             //iterate through each stops in each path
//             subResult.push(lastStation); //push stop to subResult
//             //console.log("pathNo:",i,"Add:",lastStation);
//             if (currentRoute === realRoutes[i][j].route_id) {
//                 //if route_id of the current stop matches with lastStation
//                 lastStation = realRoutes[i][j].stop_id;
//                 //console.log("ADD: ",lastStation);
//                 if (j === realRoutes[i].length - 1) {
//                     // if last node of path
//                     subResult.push(lastStation); //push last node
//                     result.push({ stops: subResult, type: "board" });
//                     //console.log("pathNo:",i,"AddLAST:",lastStation);
//                 }
//             } else {
//                 // currentRoute != current node route_id
//                 result.push({ stops: subResult, type: "board" }); //push all the stops type board
//                 result.push({
//                     stops: [realRoutes[i][j - 1].stop_id, realRoutes[i][j].stop_id],
//                     type: "transfer",
//                 }); //push transfer nodes
//                 subResult = []; //reset
//                 firstStation = realRoutes[i][j].stop_id; //reset
//                 lastStation = realRoutes[i][j].stop_id; //reset
//                 currentRoute = realRoutes[i][j].route_id; //set to the current route_id
//                 //console.log("pathNo:",i,"Changed currentRoute to:",currentRoute);
//             }
//         }
//         //console.log("groupByRoute - pathNo:",i,"Path of:",realRoutes[i], "Result:",result);
//         superResult.push(result); //agregate everything
//         result = []; //reset
//     }
//     logger.info(superResult);
//     return superResult;
// };

exports.groupByRoute = function (realRoutes) {
    //console.log("groupByRoute_input: ",realRoutes)
    let firstStation;
    let lastStation;
    let currentRoute;
    let result = [];
    let subResult = [];
    let superResult = [];
    //iterate through each path generated from algorithm
    firstStation = realRoutes[0].stop_id; //stop_id of the first station in path[i]
    lastStation = realRoutes[0].stop_id;
    currentRoute = realRoutes[0].route_id; //set currentRoute to route_id of first station

    for (let j = 1; j < realRoutes.length; j++) {
        //iterate through each stops in each path
        subResult.push(lastStation); //push stop to subResult
        //console.log("pathNo:",i,"Add:",lastStation);
        if (currentRoute === realRoutes[j].route_id) {
            //if route_id of the current stop matches with lastStation
            lastStation = realRoutes[j].stop_id;
            //console.log("ADD: ",lastStation);
            if (j === realRoutes.length - 1) {
                // if last node of path
                subResult.push(lastStation); //push last node
                result.push({ stops: subResult, type: "board", line: currentRoute });
                //console.log("pathNo:",i,"AddLAST:",lastStation);
            }
        } else {
            // currentRoute != current node route_id
            result.push({ stops: subResult, type: "board", line: currentRoute }); //push all the stops type board
            result.push({
                stops: [realRoutes[j - 1].stop_id, realRoutes[j].stop_id],
                type: "transfer",
            }); //push transfer nodes
            subResult = []; //reset
            firstStation = realRoutes[j].stop_id; //reset
            lastStation = realRoutes[j].stop_id; //reset
            currentRoute = realRoutes[j].route_id; //set to the current route_id
            //console.log("pathNo:",i,"Changed currentRoute to:",currentRoute);
        }
    }
    //console.log("groupByRoute - pathNo:",i,"Path of:",realRoutes[i], "Result:",result);
    superResult.push(result); //agregate everything
    //result = []; //reset

    //logger.info(superResult);
    return superResult;
};

exports.getStationDetails = async function (stop_id, type) {
    //handle google place id in the stop_id arg
    const tmpStation = await Stop.findOne({ where: { stop_id: stop_id } });
    let stop_code = tmpStation.stop_code;
    let en_name = tmpStation.stop_name;
    let th_name = await Translation.findOne({
        where: { record_id: stop_id, table_name: "stops", field_name: "stop_name" },
    });
    let tmpStrDetails = { station: {} };
    if (isFromStation(type)) {
        tmpStrDetails.station.id = stop_id;
        tmpStrDetails.station.code = stop_code;
        tmpStrDetails.station.name = {
            en: en_name.trim(),
            th: th_name.translation.trim(),
        };
    } else if (isFromGoogle(type)) {
        tmpStrDetails.station.id =
            "Do cillum duis laboris, aliquip reprehenderit quis aute aute minim. Sunt nostrud nostrud aute in sed. Velit aute dolor incididunt nostrud aute, laboris aliquip quis nisi elit cupidatat. Fugiat ullamco consectetur proident tempor lorem ullamco dolore, anim elit elit culpa, dolor culpa ex enim velit do ea. Qui irure officia ea et ut qui, nostrud pariatur ad dolore sed lorem consectetur consequat.";
        tmpStrDetails.station.name = {
            short_name: "kuy",
            long_name: "long kuy",
        };
    }
    tmpStrDetails.coordinates = {
        lat: tmpStation.stop_lat,
        lng: tmpStation.stop_lon,
    };

    return tmpStrDetails;
};

function isFromGoogle(originType) {
    return originType === "google";
}

function isFromStation(originType) {
    return originType === "station";
}

exports.getNextTrainTime = async function (origin, dest, routeArrivalTime) {
    //routeArrivalTime and return are in dayjs format
    let now = dayjs();
    let todaysDay = now.day();
    let timeNowString = await getGTFSFormattedCurrentTime(routeArrivalTime);

    let trips;
    try {
        trips = await sequelize.query(
            `
            SELECT trip_id,start_time,headway_secs
            FROM frequencies
            WHERE trip_id IN (select trips.trip_id from stop_times current
                                inner join stop_times head on head.stop_sequence=1 and current.trip_id=head.trip_id and current.stop_id='${origin}' and head.stop_id='${dest}'
                                inner join (select trip_id, stop_id, max(stop_sequence) as max_sequence from stop_times group by trip_id) as destination_sequence on current.trip_id=destination_sequence.trip_id
                                inner join stop_times destination on destination_sequence.max_sequence=destination.stop_sequence and current.trip_id=destination.trip_id
                                inner join stops destination_details on destination.stop_id=destination_details.stop_id
                                inner join trips on current.trip_id = trips.trip_id
                                inner join calendar on trips.service_id = calendar.service_id and calendar.${WEEKDAYS[todaysDay]} = '1'
                                inner join routes on trips.route_id = routes.route_id
                                inner join frequencies on frequencies.trip_id=current.trip_id and time_to_sec(time('${timeNowString}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) < time_to_sec(time(frequencies.end_time)) + frequencies.headway_secs and time_to_sec(time('${timeNowString}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) >= time_to_sec(time(frequencies.start_time)));
            `,
            {
                type: QueryTypes.SELECT,
            },
        );
    } catch (error) {
        logger.error(error);
        trips = [];
    }
    //select closest time then add until pass 'now'
    let lowestDiffTime; //in min
    let lowestTime;
    let headway;
    for (trip in trips) {
        let dayjsTime = toDayJSFormat(trip.start_time);
        let time = routeArrivalTime.diff(dayjsTime, "minute");
        if (!lowestDiffTime || lowestDiffTime > time) {
            lowestDiffTime = time;
            lowestTime = dayjsTime;
            headway = trip.headway;
        } else {
            continue;
        }
    }
    while (lowestTime.diff(now) >= 0) {
        lowestTime.add(headway, "second");
    }

    return lowestTime;
};

exports.timeBetweenStation = async function (stop1, stop2) {
    const timeBtwStation = await sequelize.query(
        `
        SELECT trip_id,fromStopID,toStopID,timeInSec
        FROM (SELECT route_id, trip_id ,fromStopID,stop_id AS toStopID , (timeInSec - prevTimeInSec) AS timeInSec, stop_sequence
        FROM    (SELECT route_id, stop_times.trip_id AS trip_id, stop_id, TIME_TO_SEC(arrival_time) AS timeInSec,
                    LAG(TIME_TO_SEC(arrival_time)) OVER (PARTITION BY route_id ORDER BY stop_sequence) AS prevTimeInSec,
                    LAG(stop_id) OVER (PARTITION BY route_id ORDER BY stop_sequence) AS fromStopID, stop_sequence
                FROM (  SELECT trip_id, route_id, maxStopSequence
                        FROM (  SELECT trips.trip_id, route_id , maxStopSequence, ROW_NUMBER() over (PARTITION BY route_id ORDER BY maxStopSequence DESC ) AS rowNumber
                                FROM (  SELECT trip_id, MAX(stop_sequence) AS maxStopSequence
                                        FROM stop_times
                                        GROUP BY trip_id) AS trip_id_maxstopseq
                                INNER JOIN trips
                                ON trips.trip_id = trip_id_maxstopseq.trip_id) AS trips_route_maxstopseq
                        WHERE rowNumber = 1) AS trip_route_maxstopseq
                INNER JOIN stop_times
                ON trip_route_maxstopseq.trip_id = stop_times.trip_id) AS all_stops_with_time
        ORDER BY trip_id,stop_sequence) AS timeBtwEachSuccesiveStop
        WHERE fromStopID = '${stop1}' and toStopID = '${stop2}';
        `,
        {
            type: QueryTypes.SELECT,
        },
    );
    return timeBtwStation.timeInSec;
};

exports.getTransferTime = async function (stop1, stop2) {
    const transferTime = await sequelize.query(
        `
        SELECT min_transfer_time
        FROM transfers
        WHERE from_stop_id = '${stop1}' and to_stop_id = '${stop2}';
        `,
        {
            type: QueryTypes.SELECT,
        },
    );
    return transferTime.min_transfer_time;
};

async function toDayJSFormat(input) {
    let splittedTime = {
        hours: 0,
        minutes: 0,
        seconds: 0,
    };

    try {
        const time = input.split(":");
        splittedTime = {
            hours: parseInt(time[0]),
            minutes: parseInt(time[1]),
            seconds: parseInt(time[2]),
        };
    } catch (error) {
        return "INVALID TIME: INPUT IS NOT FORMATTED AS HH:mm:ss";
    }

    let date = dayjs().set("hour", 0).set("minute", 0).set("second", 0);
    if (splittedTime.hours >= 24) {
        if (!maxTime)
            try {
                maxTime = (await fetchMaxTime()) || [];
            } catch (error) {
                return `${error}`;
            }

        if (maxTime.length === 0) {
            const splittedMaxTime = {
                hours: 48,
                minutes: 0,
                seconds: 0,
            };
        } else {
            try {
                const mts = maxTime[0].max_time.split(":");

                const splittedMaxTime = {
                    hours: parseInt(mts[0]),
                    minutes: parseInt(mts[1]),
                    seconds: parseInt(mts[2]),
                };
            } catch (error) {
                return "INVALID MAX TIME";
            }
        }

        if (
            splittedTime.hours > splittedMaxTime.hours ||
            (splittedTime.minutes > splittedMaxTime.minutes &&
                splittedTime.hours === splittedMaxTime.hours) ||
            (splittedTime.seconds > splittedMaxTime.seconds &&
                splittedTime.minutes === splittedMaxTime.minutes &&
                splittedTime.hours === splittedMaxTime.hours)
        ) {
            return "INVALID TIME";
        }
        splittedTime.hours = splittedTime.hours - 24;
    }

    return date
        .add(splittedTime.hours, "hour")
        .add(splittedTime.minutes, "minute")
        .add(splittedTime.seconds, "second")
        .format();
}
