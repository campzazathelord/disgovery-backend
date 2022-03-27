const { QueryTypes } = require("sequelize");
const APIStatus = require("../../configs/api-errors");
const { logger } = require("../../configs/config");
const sequelize = require("../../db/database");
const Stop = require("../../models/Stop");
const Translation = require("../../models/Translation");

exports.addTransfers = async function (req, res) {
    logger.info(`${req.method} ${req.baseUrl + req.path}`);

    if (!req.body.transfers)
        return res.send(APIStatus.BAD_REQUEST).status(APIStatus.BAD_REQUEST.status);

    const transfers = req.body.transfers;
    logger.info(transfers);

    if (transfers.length === 0) {
        return res.send(APIStatus.BAD_REQUEST).status(APIStatus.BAD_REQUEST.status);
    }

    try {
        let insertValues = "";

        for (let transfer of transfers) {
            if (
                transfer.from_stop_id &&
                transfer.to_stop_id &&
                parseInt(transfer.min_transfer_time)
            ) {
                insertValues += `('${transfer.from_stop_id}', '${transfer.to_stop_id}', '${
                    transfer.transfer_type || "0"
                }', ${parseInt(transfer.min_transfer_time)}),`;
            }
        }

        insertValues = insertValues.slice(0, -1);

        console.log(insertValues);

        let response = await sequelize.query(
            `
            insert into transfers (from_stop_id, to_stop_id, transfer_type, min_transfer_time) values ${insertValues};
        `,
            { type: QueryTypes.INSERT },
        );

        return res.status(APIStatus.OK.status).send({
            status: APIStatus.OK,
        });
    } catch (error) {
        logger.error(error.message);
        return res.status(APIStatus.INTERNAL.SERVER_ERROR.status).send({
            status: { status: APIStatus.INTERNAL.SERVER_ERROR.status, message: error.message },
        });
    }
};
