const Stop = require("../../models/Stop");
const sequelize = require("../../db/database");
const APIStatus = require("../../configs/api-errors");
const { Op } = require("sequelize");
const { logger } = require("../../configs/config");

const STOP_LAT_COL = "stop_lat";
const STOP_LNG_COL = "stop_lon";

exports.getNearbyStations = async function (req, res) {
    logger.info(`${req.method} ${req.baseUrl + req.path}`);

    const lat = parseFloat(req.query.lat) || undefined;
    const lng = parseFloat(req.query.lng) || undefined;
    const radiusMetres = parseFloat(req.query.radius) || 500;
    const maxResult = parseInt(req.query.max_result) || 999;

    if (!lat || !lng)
        return res.send({
            status: APIStatus.BAD_REQUEST.status,
            message: "Latitude or longitude should be a number and is required.",
        });

    try {
        let attributes = Object.keys(await Stop.getAttributes());

        const distance = await sequelize.literal(
            `6371000 * acos (cos (radians(${lat})) * cos(radians(${STOP_LAT_COL})) * cos(radians(${STOP_LNG_COL}) - radians(${lng})) + sin(radians(${lat})) * sin(radians(${STOP_LAT_COL})))`,
        );

        attributes.push([distance, "distance"]);

        const nearbyStations = await Stop.findAll({
            attributes: attributes,
            order: distance,
            limit: maxResult,
            where: sequelize.where(distance, { [Op.lte]: radiusMetres }),
        });

        let formattedNearbyStations = [];

        Object.keys(nearbyStations).map((key) => {
            formattedNearbyStations.push({
                name: nearbyStations[key].stop_name.trim(),
                uid: nearbyStations[key].stop_id,
                code: nearbyStations[key].stop_code,
                coordinates: {
                    lat: nearbyStations[key].stop_lat,
                    lng: nearbyStations[key].stop_lon,
                },
                distance: nearbyStations[key].distance,
            });
        });

        return res
            .send({ status: APIStatus.OK, data: formattedNearbyStations })
            .status(APIStatus.OK.status);
    } catch (error) {
        console.error(error);
        return res
            .send({ status: APIStatus.INTERNAL.SERVER_ERROR, error: error })
            .status(APIStatus.INTERNAL.SERVER_ERROR.status);
    }
};
