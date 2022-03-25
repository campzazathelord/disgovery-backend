const { QueryTypes } = require("sequelize");
const APIStatus = require("../../configs/api-errors");
const { logger } = require("../../configs/config");
const sequelize = require("../../db/database");

exports.addPlatform = async function (req, res) {
    logger.info(`${req.method} ${req.baseUrl + req.path}`);

    const tripsToUpdate = req.body.trips_to_update || [];
    console.log(tripsToUpdate);

    if (tripsToUpdate.length === 0) {
        return res.send(APIStatus.BAD_REQUEST).status(APIStatus.BAD_REQUEST.status);
    }

    const parentStationId = req.body.parent_station;
    const platformId = req.body.platform_id;
    const platformName = req.body.platform_name;
    const platformNameTH = req.body.platform_name_th;
    const lat = req.body.lat;
    const lng = req.body.lng;
    const stopCode = req.body.stop_code;
    const zoneId = req.body.zone_id;

    const locationType = 1;
    const stopTimezone = null;
    const wheelchair_boarding = null;
    const levelId = null;
    const platformCode = req.query.platform_code || null;

    try {
        return res.status(APIStatus.OK.status).send({ status: APIStatus.OK, data: response });
    } catch (error) {
        return res
            .status(APIStatus.INTERNAL.SERVER_ERROR.status)
            .send({ status: { status: APIStatus.INTERNAL.SERVER_ERROR.status, message: error } });
    }
};
