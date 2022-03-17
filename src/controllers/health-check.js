const { logger } = require("../configs/config");
const Stop = require("../models/Stop");
const { calculateFare } = require("../functions/get-routes-util");

exports.healthCheck = async function healthCheck(req, res) {
    logger.info(`${req.method} ${req.baseUrl + req.path}`);
    // resultStop = await Stop.findOne({ where: { stop_id: "BTS_CEN" } });
    // logger.info(resultStop)
    let fare = await calculateFare(
        "BRT_B1",
        "BRT_B12",
        {
            adult: true,
            elder: true,
            child: false,
            disabled: false,
        },
    );

    res.status(200).send({
        status: fare,
    });
};
