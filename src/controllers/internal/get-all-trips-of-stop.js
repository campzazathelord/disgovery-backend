const { QueryTypes } = require("sequelize");
const APIStatus = require("../../configs/api-errors");
const { logger } = require("../../configs/config");
const sequelize = require("../../db/database");

exports.getAllTripsOfStop = async function (req, res) {
    logger.info(`${req.method} ${req.baseUrl + req.path}`);

    const stopId = req.query.stop_id;
    if (!stopId) {
        return res.send(APIStatus.BAD_REQUEST).status(APIStatus.BAD_REQUEST.status);
    }

    try {
        const allTrips = await sequelize.query(
            `select * from stop_times where stop_id='${stopId}'`,
            {
                type: QueryTypes.SELECT,
            },
        );

        return res.status(APIStatus.OK.status).send({ status: APIStatus.OK, data: allTrips });
    } catch (error) {
        return res
            .status(APIStatus.INTERNAL.SERVER_ERROR.status)
            .send({ status: { status: APIStatus.INTERNAL.SERVER_ERROR.status, message: error } });
    }
};
