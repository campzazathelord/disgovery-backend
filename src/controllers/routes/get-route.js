const { logger } = require("../../configs/config");
const APIStatus = require("../../configs/api-errors");
const Stop = require("../../models/Stop");
const sequelize = require("../../db/database");
const { Op } = require("sequelize");
const { getNearby } = require("../../functions/get-nearby");

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

    let origin, destination;

    try {
        origin = req.body.origin.split(":");
        destination = req.body.destination.split(":");
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

    let result = await calculateRoutes(
        or_station,
        des_station,
        includeAdultFares,
        includeElderFares,
        includeChildFares,
        includeDisabledFares,
    );

    return res.status(APIStatus.OK.status).send({ status: APIStatus.OK, data: result });
};

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

async function calculateRoutes(
    originId,
    destinationId,
    includeAdultFares,
    includeElderFares,
    includeChildFares,
    includeDisabledFares,
) {
    return [];
}
