const Stop = require("../models/Stop");
const sequelize = require("../db/database");
const { logger } = require("../configs/config");
const { Op } = require("sequelize");
const { QueryTypes } = require("sequelize");

const STOP_LAT_COL = "stop_lat";
const STOP_LNG_COL = "stop_lon";

const DEFAULT_MAX_RESULT = 999;
const DEFAULT_MAX_RADIUS = 1000;

exports.getNearby = async function (lat, lng, maxRadius = DEFAULT_MAX_RADIUS, maxResult = DEFAULT_MAX_RESULT) {
    try {
        let attributes = Object.keys(await Stop.getAttributes());

        const distance = await sequelize.literal(
            `6371000 * acos (cos (radians(${lat})) * cos(radians(${STOP_LAT_COL})) * cos(radians(${STOP_LNG_COL}) - radians(${lng})) + sin(radians(${lat})) * sin(radians(${STOP_LAT_COL})))`,
        );

        attributes.push([distance, "distance"]);

        // const nearbyStations = await Stop.findAll({
        //     attributes: attributes,
        //     order: distance,
        //     limit: maxResult || DEFAULT_MAX_RESULT,
        //     where: sequelize.where(distance, { [Op.lte]: maxRadius || DEFAULT_MAX_RADIUS }),
        // });
        console.log(lat, lng,"lat, lng")
        const nearbyStations = await sequelize.query(
           `SELECT *
            FROM
                (SELECT *, (6371000 * acos (cos (radians(${lat})) * cos(radians(${STOP_LAT_COL})) * cos(radians(${STOP_LNG_COL}) - radians(${lng})) + sin(radians(${lat})) * sin(radians(${STOP_LAT_COL})))) as dist
                from stops) as s
            WHERE dist <= ${maxRadius} AND parent_station IS NULL
            ORDER BY dist
            LIMIT ${maxResult};`,
            {
                type: QueryTypes.SELECT,
            },
        );


        return nearbyStations;
    } catch (error) {
        logger.error(error);
        return {};
    }
};
