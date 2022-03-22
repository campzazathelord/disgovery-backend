const { QueryTypes } = require("sequelize");
const APIStatus = require("../../configs/api-errors");
const { logger } = require("../../configs/config");
const sequelize = require("../../db/database");

exports.getAllRoutes = async function (req, res) {
    logger.info(`${req.method} ${req.baseUrl + req.path}`);

    try {
        const allRoutes = await sequelize.query(`select * from routes`, {
            type: QueryTypes.SELECT,
        });

        let response = [];

        Object.keys(allRoutes).map((key) => {
            response.push({
                route_id: allRoutes[key].route_id,
                route_name: allRoutes[key].route_long_name,
            });
        });

        return res.status(APIStatus.OK.status).send({ status: APIStatus.OK, data: response });
    } catch (error) {
        return res
            .status(APIStatus.INTERNAL.SERVER_ERROR.status)
            .send({ status: { status: APIStatus.INTERNAL.SERVER_ERROR.status, message: error } });
    }
};
