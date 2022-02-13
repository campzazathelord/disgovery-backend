const Stop = require("../models/Stop");
const sequelize = require("../db/database");
const { logger } = require("../configs/config");
const { Op } = require("sequelize");

const STOP_LAT_COL = "stop_lat";
const STOP_LNG_COL = "stop_lon";

const DEFAULT_MAX_RESULT = 999;
const DEFAULT_MAX_RADIUS = 1000;

exports.getNearby = async function (lat, lng, maxRadius, maxResult) {
    try {
        let attributes = Object.keys(await Stop.getAttributes());

        const distance = await sequelize.literal(
            `6371000 * acos (cos (radians(${lat})) * cos(radians(${STOP_LAT_COL})) * cos(radians(${STOP_LNG_COL}) - radians(${lng})) + sin(radians(${lat})) * sin(radians(${STOP_LAT_COL})))`,
        );

        attributes.push([distance, "distance"]);

        const nearbyStations = await Stop.findAll({
            attributes: attributes,
            order: distance,
            limit: maxResult || DEFAULT_MAX_RESULT,
            where: sequelize.where(distance, { [Op.lte]: maxRadius || DEFAULT_MAX_RADIUS }),
        });

        return nearbyStations;
    } catch (error) {
        logger.error(error);
        return {};
    }
};
