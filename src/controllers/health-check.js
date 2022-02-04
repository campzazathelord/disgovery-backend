const { logger } = require("../configs/config");

exports.healthCheck = async function healthCheck(req, res) {
    logger.info(`${req.method} ${req.baseUrl + req.path}`);

    res.status(200).send("okay");
};
