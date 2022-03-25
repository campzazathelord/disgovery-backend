const { QueryTypes } = require("sequelize");
const APIStatus = require("../../configs/api-errors");
const { logger } = require("../../configs/config");
const sequelize = require("../../db/database");

exports.getRawStopDetails = async function (req, res) {
    logger.info(`${req.method} ${req.baseUrl + req.path}`);

    const stopId = req.query.stop_id;
    if (!stopId) {
        return res.send(APIStatus.BAD_REQUEST).status(APIStatus.BAD_REQUEST.status);
    }

    try {
        const stopDetails = await sequelize.query(`select * from stops where stop_id='${stopId}'`, {
            type: QueryTypes.SELECT,
            maxResult: 1,
        });

        return res.status(APIStatus.OK.status).send({ status: APIStatus.OK, data: stopDetails[0] });
    } catch (error) {
        return res
            .status(APIStatus.INTERNAL.SERVER_ERROR.status)
            .send({ status: { status: APIStatus.INTERNAL.SERVER_ERROR.status, message: error } });
    }
};
