const { QueryTypes } = require("sequelize");
const APIStatus = require("../../configs/api-errors");
const { logger } = require("../../configs/config");
const sequelize = require("../../db/database");
const Stop = require("../../models/Stop");
const Translation = require("../../models/Translation");

exports.removePlatform = async function (req, res) {
    logger.info(`${req.method} ${req.baseUrl + req.path}`);

    const platformId = req.query.platform_id || "";
    const parentStationId = req.query.parent_station || "";

    if (!platformId || !parentStationId) {
        return res.send(APIStatus.BAD_REQUEST).status(APIStatus.BAD_REQUEST.status);
    }

    try {
        let deleteTranslationResponse = await sequelize.query(
            `delete from translations where table_name='stops' and field_name='stop_name' and record_id='${platformId}';`,
            {
                type: QueryTypes.DELETE,
            },
        );

        const tripsToUpdate = await sequelize.query(
            `
            select trip_id from stop_times where stop_id='${platformId}'
            `,
            {
                type: QueryTypes.SELECT,
            },
        );

        let tripsToUpdateArray = [];
        let updateResponses = [];

        for (let trip of tripsToUpdate) {
            tripsToUpdateArray.push(trip.trip_id);
        }

        for (let trip of tripsToUpdateArray) {
            updateResponses.push(
                await sequelize.query(
                    `
                        update stop_times
                        set stop_id='${parentStationId}'
                        where trip_id='${trip}' and stop_id='${platformId}';
            `,
                    { type: QueryTypes.UPDATE },
                ),
            );
        }

        let deleteTransfers = await sequelize.query(
            `delete from transfers where from_stop_id='${platformId}' or to_stop_id='${platformId}'`,
            {
                type: QueryTypes.DELETE,
            },
        );

        let deleteStopResponse = await sequelize.query(
            `delete from stops where stop_id='${platformId}' and parent_station='${parentStationId}';`,
            {
                type: QueryTypes.DELETE,
            },
        );

        logger.info("TRIPS UPDATED");

        return res.status(APIStatus.OK.status).send({
            status: APIStatus.OK,
            data: {
                trips_updated: tripsToUpdateArray,
                translation_response: deleteTranslationResponse,
                stop_response: deleteStopResponse,
                transfers_response: deleteTransfers,
            },
        });
    } catch (error) {
        logger.error(error.message);
        return res.status(APIStatus.INTERNAL.SERVER_ERROR.status).send({
            status: { status: APIStatus.INTERNAL.SERVER_ERROR.status, message: error.message },
        });
    }
};
