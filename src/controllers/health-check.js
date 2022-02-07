const { logger } = require("../configs/config");
const Stop = require("../models/Stop");

exports.healthCheck = async function healthCheck(req, res) {
    logger.info(`${req.method} ${req.baseUrl + req.path}`);
    resultStop = await Stop.findOne({ where: { stop_id: "BTS_CEN" } });
    logger.info(resultStop)
    res.status(200).send({
        status: resultStop,
    });
};
