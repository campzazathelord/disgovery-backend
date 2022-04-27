const { logger } = require("../configs/config");
const sequelize = require("../db/database");
const { getNearby } = require("../functions/get-nearby");
const { QueryTypes } = require("sequelize");
const Translation = require("../models/Translation");
const Stop = require("../models/Stop");
const dayjs = require("dayjs");
const { getGTFSFormattedCurrentTime } = require("./get-gtfs-formatted-current-time");
const { default: axios } = require("axios");

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/**
 *
 * @typedef {Object} OriginToDestinationObject
 * @property {string} origin_id
 * @property {string} destination_id
 *
 * @param {OriginToDestinationObject[]} arrayOfOriginsToDestinations
 * @param {Array} fareOptions
 */
exports.getArrayOfFares = async function (arrayOfOriginsToDestinations, fareOptions, allStops) {
    let unionFaresString = "";
    Object.keys(arrayOfOriginsToDestinations).map((key, iteration) => {
        if (iteration === 0) {
            unionFaresString += `select origin_id, destination_id, fare_id from fare_rules where origin_id='${arrayOfOriginsToDestinations[key].origin_zone_id}' and destination_id='${arrayOfOriginsToDestinations[key].destination_zone_id}'`;
        } else {
            unionFaresString += ` union select origin_id, destination_id, fare_id from fare_rules where origin_id='${arrayOfOriginsToDestinations[key].origin_zone_id}' and destination_id='${arrayOfOriginsToDestinations[key].destination_zone_id}'`;
        }
    });

    if (!unionFaresString) return [];

    const allFares = await sequelize.query(
        `
        select origin_id, destination_id, fare_id, fare_type, price from (${unionFaresString}) as all_fares natural join fare_attributes;
        `,
        {
            type: QueryTypes.SELECT,
        },
    );

    let allStations = [];

    Object.keys(arrayOfOriginsToDestinations).map((key) => {
        if (!allStations.includes(arrayOfOriginsToDestinations[key].origin_id))
            allStations.push(arrayOfOriginsToDestinations[key].origin_id);
        if (!allStations.includes(arrayOfOriginsToDestinations[key].destination_id))
            allStations.push(arrayOfOriginsToDestinations[key].destination_id);
    });

    let allStationsDetailsObject = {};

    if (!allStops) {
        let allStationsDetails = await getArrayOfStationDetails(allStations);

        Object.keys(allStationsDetails).map((key) => {
            allStationsDetailsObject[allStationsDetails[key].station.id] = allStationsDetails[key];
        });
    } else {
        for (let station of allStations) {
            allStationsDetailsObject[station] = formatStop(allStops[station], allStops);
        }
    }

    let currentOrigin = "",
        currentDestination = "",
        currentOriginZone = "",
        currentDestinationZone = "";
    let currentFare = { currency: "THB" };
    let faresAdded = [];
    let response = [];
    let overallIteration = 0;

    Object.keys(allFares).map((key) => {
        if (faresAdded.includes(`${allFares[key].origin_id}___${allFares[key].destination_id}`)) {
            if (
                (Array.isArray(fareOptions) && fareOptions.includes(allFares[key].fare_type)) ||
                !Array.isArray(fareOptions)
            ) {
                let price = parseFloat(allFares[key].price);
                if (!isNaN(price) || price)
                    currentFare[allFares[key].fare_type] = parseFloat(allFares[key].price);
            }
        } else {
            if (
                currentOriginZone &&
                currentDestinationZone &&
                currentDestination &&
                currentOrigin
            ) {
                response.push({
                    from: allStationsDetailsObject[currentOrigin],
                    to: allStationsDetailsObject[currentDestination],
                    fare: currentFare,
                });
            }

            currentOriginZone = allFares[key].origin_id;
            currentDestinationZone = allFares[key].destination_id;
            currentOrigin = arrayOfOriginsToDestinations[overallIteration].origin_id;
            currentDestination = arrayOfOriginsToDestinations[overallIteration].destination_id;
            overallIteration++;

            currentFare = {
                currency: "THB",
            };

            faresAdded.push(`${allFares[key].origin_id}___${allFares[key].destination_id}`);

            if (
                (Array.isArray(fareOptions) && fareOptions.includes(allFares[key].fare_type)) ||
                !Array.isArray(fareOptions)
            ) {
                let price = parseFloat(allFares[key].price);
                if (!isNaN(price) || price)
                    currentFare[allFares[key].fare_type] = parseFloat(allFares[key].price);
            }
        }
    });

    if (currentOriginZone && currentDestinationZone && currentDestination && currentOrigin) {
        response.push({
            from: allStationsDetailsObject[currentOrigin],
            to: allStationsDetailsObject[currentDestination],
            fare: currentFare,
        });
    }

    return response;
};

function formatStop(stop, allStops) {
    try {
        let platform = undefined;
        if (stop.parent_station !== null) {
            platform = {
                id: stop.stop_id,
                name: {
                    en: stop.stop_name_en,
                    th: stop.stop_name_th,
                },
                code: stop.platform_code,
            };

            stop = allStops[stop.parent_station];
        }

        return {
            station: {
                id: stop.stop_id,
                code: stop.stop_code,
                name: {
                    en: stop.stop_name_en,
                    th: stop.stop_name_th,
                },
                platform: platform,
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

exports.getTotalFares = function (allFares) {
    let totalFares = {};

    Object.keys(allFares).map((allFaresKey, iteration) => {
        if (iteration === 0) {
            totalFares = JSON.parse(JSON.stringify(allFares[allFaresKey].fare));
        } else {
            Object.keys(totalFares).map((totalFaresKey) => {
                if (totalFaresKey !== "currency") {
                    totalFares[totalFaresKey] =
                        totalFares[totalFaresKey] + allFares[allFaresKey].fare[totalFaresKey];
                }
            });
        }
    });

    return totalFares;
};

exports.getNearbyStations = async function (stationArray, allTransfers, allStops) {
    const RADIUS_STEP = 1000;
    const MAX_RADIUS = 30000;
    const MAX_NEARBY_STATIONS = 1;
    let result = [];

    if (stationArray[0] === "coordinates") {
        let coordinates = stationArray[1].split(",");
        let lat = coordinates[0];
        let lng = coordinates[1];

        try {
            for (let r = RADIUS_STEP; r < MAX_RADIUS; r += RADIUS_STEP) {
                let stations = (await getNearby(lat, lng, r, MAX_NEARBY_STATIONS)) || [];

                if (stations.length === 0) continue;
                else {
                    for (let station of stations) {
                        result.push(station.stop_id);
                    }

                    // for (let i = 0; i < result.length; i++) {
                    //     for (let j = i + 1; j < result.length; j++) {
                    //         let transferTime = await getTransferTime(
                    //             result[i],
                    //             result[j],
                    //             allTransfers,
                    //         );
                    //         // if (transferTime > 0) {
                    //         //     console.log("Transfer Detected");
                    //         //     result.splice(j, 1);
                    //         //     j--;
                    //         // }
                    //     }
                    // }

                    let childrenStops = [];
                    for (let i in result) {
                        childrenStops.push(...getChildrenStops(result[i], allStops));
                    }

                    childrenStops = [...new Set(childrenStops)];

                    return childrenStops;
                }
            }
        } catch (error) {
            logger.error(error);
            throw error;
        }
    } else if (stationArray[0] === "station") {
        let childrenStops = getChildrenStops(stationArray[1], allStops);

        return childrenStops;
    } else if (stationArray[0] === "google") {
        let location = await getCoordinatesFromGooglePlaceId(stationArray[1]);

        if (location) {
            for (let r = RADIUS_STEP; r < MAX_RADIUS; r += RADIUS_STEP) {
                let stations =
                    (await getNearby(location.lat, location.lng, r, MAX_NEARBY_STATIONS)) || [];

                if (stations.length === 0) continue;
                else {
                    for (let station of stations) {
                        result.push(station.stop_id);
                    }

                    let childrenStops = [];
                    for (let i in result) {
                        childrenStops.push(...getChildrenStops(result[i], allStops));
                    }

                    childrenStops = [...new Set(childrenStops)];

                    return childrenStops;
                }
            }
        }
    }

    return [];
};

async function getCoordinatesFromGooglePlaceId(place_id) {
    let response = await axios.get(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=geometry&key=${process.env.GOOGLE_MAPS_API_KEY}`,
    );
    let data = response.data;

    if (data.result.geometry) {
        return data.result.geometry.location;
    } else {
        throw new Error("bad google place id");
    }
}

function getChildrenStops(parentStation, allStops) {
    if (!allStops || !parentStation) return [];

    if (allStops[parentStation].parent_station !== null) {
        parentStation = allStops[parentStation].parent_station;
    }

    let childrenStops = [];

    for (let key in allStops) {
        if (allStops[key].parent_station === parentStation) {
            childrenStops.push(key);
        }
    }

    childrenStops = [...new Set(childrenStops)];

    return childrenStops;
}

exports.getChildrenStops = getChildrenStops;

exports.groupByRoute = function (realRoutes) {
    let firstStation, lastStation, currentRoute;
    let result = [];
    let subResult = [];
    let superResult = [];
    //iterate through each path generated from algorithm

    if (!realRoutes[0]) return [];

    firstStation = realRoutes[0].stop_id; //stop_id of the first station in path[i]
    lastStation = realRoutes[0].stop_id;
    currentRoute = realRoutes[0].route_id; //set currentRoute to route_id of first station

    for (let j = 1; j < realRoutes.length; j++) {
        //iterate through each stops in each path
        subResult.push(lastStation); //push stop to subResult
        if (
            !(currentRoute === realRoutes[j].route_id) ||
            (realRoutes[j].zone_id === realRoutes[j - 1].zone_id &&
                realRoutes[j].parent_station !== realRoutes[j - 1].parent_station)
        ) {
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
        } else {
            lastStation = realRoutes[j].stop_id;
            if (j === realRoutes.length - 1) {
                // if last node of path
                subResult.push(lastStation); //push last node
                result.push({ stops: subResult, type: "board", line: currentRoute });
            }
        }
    }

    superResult.push(result); //agregate everything
    return superResult;
};

/**
 *
 *
 * @param {string} origin_id
 * @param {string} destination_id
 * @param {dayjs} routeArrivalTime
 * @returns {number} arriving_in
 * @returns {string} trip_id
 */
exports.getNextTrainTime = async function (origin_id, destination_id, routeArrivalTime, time) {
    let now = time;
    let todaysDay = now.day();
    let routeArrivalTimeString = await getGTFSFormattedCurrentTime(routeArrivalTime);

    let trips = [];

    try {
        trips = await sequelize.query(
            `
            select trips.trip_id, (headway_secs * ceiling((time_to_sec(time('${routeArrivalTimeString}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) - time_to_sec(time(start_time))) / headway_secs)) - (time_to_sec(time('${routeArrivalTimeString}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) - time_to_sec(time(start_time))) as arriving_in from stop_times current
                inner join stop_times head on head.stop_sequence=1 and current.trip_id=head.trip_id and current.stop_id='${origin_id}'
                inner join stop_times destination on current.trip_id=destination.trip_id and destination.stop_id='${destination_id}' and destination.stop_sequence>current.stop_sequence
                inner join stops destination_details on destination.stop_id=destination_details.stop_id
                inner join trips on current.trip_id = trips.trip_id
                inner join calendar on trips.service_id = calendar.service_id and calendar.${WEEKDAYS[todaysDay]}='1'
                inner join routes on trips.route_id = routes.route_id
                inner join frequencies on frequencies.trip_id=current.trip_id and time_to_sec(time('${routeArrivalTimeString}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) < time_to_sec(time(frequencies.end_time)) + frequencies.headway_secs and time_to_sec(time('${routeArrivalTimeString}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) >= time_to_sec(time(frequencies.start_time))
                order by arriving_in asc
                limit 1;    
            `,
            {
                type: QueryTypes.SELECT,
                maxResult: 1,
            },
        );
    } catch (error) {
        logger.error(`At getNextTrainTime, getting trips: ${error}`);
    }

    return { waitTime: parseFloat(trips[0].arriving_in), tripId: trips[0].trip_id };
};

exports.getPolyline = async function (shapeIDs) {
    let queryString = ``;
    let polylines = [];

    Object.keys(shapeIDs).map((key, iteration) => {
        if (iteration === 0) {
            queryString += `SELECT shape_id,shape_encoded FROM shapes WHERE shape_id = '${shapeIDs[key]}' `;
        } else {
            queryString += `UNION SELECT shape_id,shape_encoded FROM shapes WHERE shape_id = '${shapeIDs[key]}' `;
        }
    });

    try {
        polylines = await sequelize.query(queryString, {
            type: QueryTypes.SELECT,
        });
    } catch (error) {
        logger.error(`${error}`);
    }

    return polylines;
};

exports.getArrayOfNextTrainTimes = async function (array) {
    let now = dayjs();
    let todaysDay = now.day();
    let queryString = ``;
    let trips = [];

    Object.keys(array).map((key, iteration) => {
        if (iteration === 0) {
            queryString += `
                select trips.trip_id, (headway_secs * ceiling((time_to_sec(time('${array[key][2]}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) - time_to_sec(time(start_time))) / headway_secs)) - (time_to_sec(time('${array[key][2]}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) - time_to_sec(time(start_time))) as arriving_in from stop_times current
                    inner join stop_times head on head.stop_sequence=1 and current.trip_id=head.trip_id and current.stop_id='${array[key][0]}'
                    inner join stop_times destination on current.trip_id=destination.trip_id and destination.stop_id='${array[key][1]}' and destination.stop_sequence>current.stop_sequence
                    inner join stops destination_details on destination.stop_id=destination_details.stop_id
                    inner join trips on current.trip_id = trips.trip_id
                    inner join calendar on trips.service_id = calendar.service_id and calendar.${WEEKDAYS[todaysDay]}='1'
                    inner join routes on trips.route_id = routes.route_id
                    inner join frequencies on frequencies.trip_id=current.trip_id and time_to_sec(time('${routeArrivalTimeString}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) < time_to_sec(time(frequencies.end_time)) + frequencies.headway_secs and time_to_sec(time('${array[key][2]}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) >= time_to_sec(time(frequencies.start_time))
                    order by arriving_in asc
                    limit 1 
            `;
        } else {
            queryString += `
                union select trips.trip_id, (headway_secs * ceiling((time_to_sec(time('${array[key][2]}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) - time_to_sec(time(start_time))) / headway_secs)) - (time_to_sec(time('${array[key][2]}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) - time_to_sec(time(start_time))) as arriving_in from stop_times current
                    inner join stop_times head on head.stop_sequence=1 and current.trip_id=head.trip_id and current.stop_id='${array[key][0]}'
                    inner join stop_times destination on current.trip_id=destination.trip_id and destination.stop_id='${array[key][1]}' and destination.stop_sequence>current.stop_sequence
                    inner join stops destination_details on destination.stop_id=destination_details.stop_id
                    inner join trips on current.trip_id = trips.trip_id
                    inner join calendar on trips.service_id = calendar.service_id and calendar.${WEEKDAYS[todaysDay]}='1'
                    inner join routes on trips.route_id = routes.route_id
                    inner join frequencies on frequencies.trip_id=current.trip_id and time_to_sec(time('${array[key][2]}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) < time_to_sec(time(frequencies.end_time)) + frequencies.headway_secs and time_to_sec(time('${routeArrivalTimeString}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) >= time_to_sec(time(frequencies.start_time))
                    order by arriving_in asc
                    limit 1 
            `;
        }
    });

    try {
        trips = await sequelize.query(queryString, {
            type: QueryTypes.SELECT,
        });
    } catch (error) {
        logger.error(`At getNextTrainTime, getting trips: ${error}`);
    }

    let response = [];

    try {
        Object.keys(trips).map((key) => {
            response.push({
                waitTime: parseFloat(trips[key].arriving_in),
                tripId: trips[key].trip_id,
            });
        });
    } catch (error) {
        throw error;
    }

    return response;
};

exports.timeBetweenStation = async function (stop1, stop2, tripId) {
    const timeBtwStation = await sequelize.query(
        `
        select abs(time_to_sec(time(first_stop_arrival_time)) - time_to_sec(time(second_stop_arrival_time))) as boarding_time from
            (select * from (select arrival_time as first_stop_arrival_time from stop_times where trip_id='${tripId}' and stop_id='${stop1}') as first_stop
                join (select arrival_time as second_stop_arrival_time from stop_times where trip_id='${tripId}' and stop_id='${stop2}') as second_stop) as two_stops;
        `,
        {
            type: QueryTypes.SELECT,
            maxResult: 1,
        },
    );

    return parseFloat(timeBtwStation[0].boarding_time);
};

async function getTransferTime(stop1, stop2, allTransfers) {
    let transferTime;

    if (!allTransfers) {
        transferTime = await sequelize.query(
            `
            SELECT min_transfer_time
            FROM transfers
            WHERE from_stop_id = '${stop1}' and to_stop_id = '${stop2}';
            `,
            {
                type: QueryTypes.SELECT,
                maxResult: 1,
            },
        );
        if (transferTime[0]) return transferTime[0].min_transfer_time || 0;
        else return 0;
    } else {
        transferTime = allTransfers[`${stop1}__${stop2}`];

        if (transferTime) return transferTime.min_transfer_time || 0;
        else return 0;
    }
}

exports.getTransferTime = async (input1, input2, allTransfers) =>
    await getTransferTime(input1, input2, allTransfers);

async function toISOString(input) {
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

exports.toISOString = async (input) => await toISOString(input);

async function getArrayOfStationDetails(stop_ids) {
    let whereQueryString = "";
    let orderByString = "";

    Object.keys(stop_ids).map((key, iteration) => {
        if (iteration === 0) {
            whereQueryString += `stop_id='${stop_ids[key]}' `;
            orderByString += `'${stop_ids[key]}'`;
        } else {
            whereQueryString += `or stop_id='${stop_ids[key]}'`;
            orderByString += `, '${stop_ids[key]}'`;
        }
    });

    let stationDetails = await sequelize.query(
        `
            select stop_id, stop_name, stop_name_th, stop_code, stop_lat, stop_lon from (select stop_id, stop_name, stop_code, stop_lat, stop_lon from stops where ${whereQueryString}) as stops
            natural join (select record_id as stop_id, translation as stop_name_th from translations where field_name='stop_name' and table_name='stops') as translation
            order by field(stop_id, ${orderByString});
        `,
        {
            type: QueryTypes.SELECT,
        },
    );

    let response = [];

    for (let station of stationDetails) {
        response.push({
            station: {
                id: station.stop_id,
                code: station.stop_code,
                name: {
                    en: station.stop_name,
                    th: station.stop_name_th,
                },
            },
            coordinates: {
                lat: station.stop_lat,
                lng: station.stop_lon,
            },
        });
    }

    return response;
}

exports.getArrayOfStationDetails = async (stop_ids) => await getArrayOfStationDetails(stop_ids);
