const { QueryTypes } = require("sequelize");
const APIStatus = require("../../configs/api-errors");
const { logger } = require("../../configs/config");
const sequelize = require("../../db/database");
const Stop = require("../../models/Stop");
const Translation = require("../../models/Translation");

exports.addPlatform = async function (req, res) {
    logger.info(`${req.method} ${req.baseUrl + req.path}`);

    const tripsToUpdate = req.body.trips_to_update || [];
    console.log(tripsToUpdate);

    if (tripsToUpdate.length === 0) {
        return res.send(APIStatus.BAD_REQUEST).status(APIStatus.BAD_REQUEST.status);
    }

    const parentStationId = req.body.parent_station;
    const platformId = req.body.stop_id;
    const platformName = req.body.stop_name;
    const platformNameTH = req.body.stop_name_th;
    const lat = parseFloat(req.body.lat) || undefined;
    const lng = parseFloat(req.body.lng) || undefined;
    const stopCode = req.body.stop_code;
    const zoneId = req.body.zone_id;

    const locationType = "1";
    const stopTimezone = null;
    const wheelchairBoarding = null;
    const levelId = null;
    const platformCode = req.body.platform_code || null;

    if (
        !parentStationId ||
        !platformId ||
        !platformName ||
        !platformNameTH ||
        !lat ||
        !lng ||
        !stopCode ||
        !zoneId
    ) {
        return res.send(APIStatus.BAD_REQUEST).status(APIStatus.BAD_REQUEST.status);
    }

    try {
        let platform = await Stop.create({
            stop_id: platformId,
            stop_code: stopCode,
            stop_name: platformName,
            stop_desc: null,
            stop_lat: lat,
            stop_lon: lng,
            zone_id: zoneId,
            stop_url: null,
            location_type: locationType,
            parent_station: parentStationId,
            stop_timezone: stopTimezone,
            wheelchair_boarding: wheelchairBoarding,
            level_id: levelId,
            platform_code: platformCode,
        });

        logger.info("PLATFORM ADDED");

        let translation = await Translation.create({
            table_name: "stops",
            field_name: "stop_name",
            language: "th",
            translation: platformNameTH,
            record_id: platformId,
            record_sub_id: null,
        });

        logger.info("TRANSLATION ADDED");

        let updateResponses = [];

        for (let trip of tripsToUpdate) {
            updateResponses.push(
                await sequelize.query(
                    `
                update stop_times
                set stop_id='${platformId}'
                where trip_id='${trip}' and stop_id='${parentStationId}';
            `,
                    { type: QueryTypes.UPDATE },
                ),
            );
        }

        logger.info("TRIPS UPDATED");

        return res.status(APIStatus.OK.status).send({
            status: APIStatus.OK,
            data: {
                platform: platform,
                translation: translation,
                update: updateResponses,
            },
        });
    } catch (error) {
        logger.error(error.message);
        return res
            .status(APIStatus.INTERNAL.SERVER_ERROR.status)
            .send({
                status: { status: APIStatus.INTERNAL.SERVER_ERROR.status, message: error.message },
            });
    }
};
