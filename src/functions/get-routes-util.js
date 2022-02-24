const { logger } = require("../configs/config");
const sequelize = require("../db/database");
const { getNearby } = require("../functions/get-nearby");
const { QueryTypes } = require("sequelize");
const Translation = require("../models/Translation");
const Stop = require("../models/Stop");

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
    // console.log(currentFare);
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
    if (stationArray[0] === "coordinates") {
        let coordinates = stationArray[1].split(",");
        let lat = coordinates[0];
        let lng = coordinates[1];
        logger.info(lat + " " + lng);

        try {
            for (let r = RADIUS_STEP; r < MAX_RADIUS; r += RADIUS_STEP) {
                let station = (await getNearby(lat, lng, r, MAX_NEARBY_STATIONS)) || [];

                console.log(station);

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
