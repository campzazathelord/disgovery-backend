const { QueryTypes } = require("sequelize");
const APIStatus = require("../../configs/api-errors");
const { logger } = require("../../configs/config");
const sequelize = require("../../db/database");

exports.getEmptyTransfersOfPlatform = async function (req, res) {
    logger.info(`${req.method} ${req.baseUrl + req.path}`);

    const stopId = req.query.stop_id;
    if (!stopId) {
        return res.send(APIStatus.BAD_REQUEST).status(APIStatus.BAD_REQUEST.status);
    }

    try {
        let added = [];
        let notAdded = [];

        const allPlatformIds = await sequelize.query(
            `select stop_id from stops where parent_station='${stopId}'`,
            {
                type: QueryTypes.SELECT,
            },
        );

        console.log(allPlatformIds);

        for (let platform1 of allPlatformIds) {
            for (let platform2 of allPlatformIds) {
                if (platform1.stop_id !== platform2.stop_id) {
                    let transfer = await sequelize.query(
                        `
                        select * from transfers where from_stop_id='${platform1.stop_id}' and to_stop_id='${platform2.stop_id}'
                    `,
                        { type: QueryTypes.SELECT, maxResult: 1 },
                    );

                    if (transfer.length === 0) {
                        notAdded.push({
                            from_stop_id: platform1.stop_id,
                            to_stop_id: platform2.stop_id,
                            transfer_type: "0",
                            min_transfer_time: "",
                        });
                    } else {
                        added.push(...transfer);
                    }
                }
            }
        }

        return res.status(APIStatus.OK.status).send({
            status: APIStatus.OK,
            data: {
                added: added,
                not_added: notAdded,
            },
        });
    } catch (error) {
        logger.error(error.message);
        return res
            .status(APIStatus.INTERNAL.SERVER_ERROR.status)
            .send({ status: { status: APIStatus.INTERNAL.SERVER_ERROR.status, message: error } });
    }
};
