const APIStatus = require("../configs/api-errors");
const { logger } = require("../configs/config");

exports.test = function (req, res) {
    logger.info(`${req.method} ${req.baseUrl + req.path}`);

    logger.info(req.params.id);
    logger.info(req.query.name);

    return res.status(APIStatus.OK.status).send(APIStatus.OK);
};
