const { logger } = require("../../configs/config");
const APIStatus = require("../../configs/api-errors");
const Stop = require("../../models/Stop");
const sequelize = require("../../db/database");
const { Op } = require("sequelize");
const { getNearby } = require("../../functions/get-nearby");
const { generateRoute } = require("../../functions/algorithms");
const dayjs = require("dayjs");
const { QueryTypes } = require("sequelize");

const STOP_LAT_COL = "stop_lat";
const STOP_LNG_COL = "stop_lon";
const MAX_RADIUS = 30000;
const RADIUS_STEP = 5000;
const MAX_NEARBY_STATIONS = 3;

exports.getRoute = async function (req, res) {
    logger.info(`${req.method} ${req.baseUrl + req.path}`);

    logger.info(req.body || !req.body.destination);

    if (!req.body.origin || !req.body.destination)
        return res.status(APIStatus.BAD_REQUEST.status).send({
            status: APIStatus.BAD_REQUEST.status,
            message: "Origin and destination is required",
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

    // TODO - Get all the trips and routes that is available now at the origin station

    // Check those trips whether the destination station is available
    // TRUE - Return
    // FALSE -  Continue

    // Get all the trips and routess that is available now at the destination station
    // For each trips, find transfers
    // If transfers are available, find all the trips and routes that is available at the station of transfer
    // Remove all duplicate trips or routes that have been checked
    // For all transfers, check the transferring station's routes and trips that are the same as the origin station are available
    // Push to checked trips
    // TRUE - Push to returning array
    // FALSE - Discard and continue
    // Do this function again

    const allRoutes = generateRoute(or_station, des_station);
    console.log(allRoutes);

    const routeOfStation = await sequelize.query(
        `
        SELECT stop_id, route_id
        FROM ((SELECT trip_id,stop_id
               FROM stop_times
               GROUP BY stop_id) AS trip_ids
        INNER JOIN trips
        ON trips.trip_id = trip_ids.trip_id);
        `,
        {
            type: QueryTypes.SELECT,
        },
    );
    //console.log(routeOfStation);
    let tmp = [];
    let realRoutes = [];
    for (let avaliableRoutes of allRoutes) {
        tmp = [];
        avaliableRoutes.pop();

        const haha = avaliableRoutes.map((station) => {
            // console.log(station)
            let findRoute = routeOfStation.filter((x) => {
                return x.stop_id == station;
            });

            // console.log(findRoute)
            tmp.push(...findRoute);
        });

        realRoutes.push(tmp);
    }
    console.log("kuyy");
    console.log(realRoutes);
    let totalPrice;

    for (let i = 0; i < realRoutes.length; i++) {
        console.log(realRoutes[i]);

        let firstStationOfRoute = realRoutes[i][0].stop_id;
        let lastStationOfRoute = realRoutes[i][0].stop_id;
        let currentRoute = realRoutes[i][0].route_id;
        totalPrice = 0;

        for (let j = 0; j < realRoutes[i].length; j++) {
            if (j === realRoutes[i].length - 1) {
                lastStationOfRoute = realRoutes[i][j].stop_id;

                totalPrice += await calculatePrice(firstStationOfRoute, lastStationOfRoute);

                firstStationOfRoute = realRoutes[i][j].stop_id;
                lastStationOfRoute = realRoutes[i][j].stop_id;
                currentRoute = realRoutes[i][j].route_id;
                break;
            }

            if (
                realRoutes[i][j].route_id === currentRoute ||
                (currentRoute === "BTS_SUKHUMVIT" && realRoutes[i][j].route_id === "BTS_SILOM") ||
                (currentRoute === "BTS_SILOM" && realRoutes[i][j].route_id === "BTS_SUKHUMVIT") ||
                (currentRoute === "MRT_BLUE" && realRoutes[i][j].route_id === "MRT_PURPLE") ||
                (currentRoute === "MRT_PURPLE" && realRoutes[i][j].route_id === "MRT_BLUE") ||
                (currentRoute === "SRT_LIGHT_RED" &&
                    realRoutes[i][j].route_id === "SRT_DARK_RED") ||
                (currentRoute === "SRT_DARK_RED" && realRoutes[i][j].route_id === "SRT_LIGHT_RED")
            ) {
                lastStationOfRoute = realRoutes[i][j].stop_id;
                continue;
            } else {
                totalPrice += await calculatePrice(firstStationOfRoute, lastStationOfRoute);
                firstStationOfRoute = realRoutes[i][j].stop_id;
                lastStationOfRoute = realRoutes[i][j].stop_id;
                currentRoute = realRoutes[i][j].route_id;
            }
        }
        console.log(totalPrice);
    }

    let result = 1;

    return res.status(APIStatus.OK.status).send({ status: APIStatus.OK, data: result });
};

async function calculatePrice(origin, destination) {
    console.log(origin, destination);

    const price = await sequelize.query(
        `
        SELECT price
        FROM fare_attributes
        WHERE fare_id = (SELECT fare_id
                        FROM fare_rules
                        WHERE origin_id = '${origin}' and destination_id = '${destination}'
                        LIMIT 1)
        AND fare_type = 'adult';
        `,
        {
            type: QueryTypes.SELECT,
            maxResult: 1,
        },
    );

    console.log(price);

    return parseFloat(price[0].price) || 0;
}

async function getStationId(stationArray) {
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
}
