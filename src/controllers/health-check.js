const { logger } = require("../configs/config");
const Stop = require("../models/Stop");
const { calculateFare, getArrayOfFares, getTotalFares } = require("../functions/get-routes-util");

exports.healthCheck = async function healthCheck(req, res) {
    logger.info(`${req.method} ${req.baseUrl + req.path}`);
    // resultStop = await Stop.findOne({ where: { stop_id: "BTS_CEN" } });
    // logger.info(resultStop)
    let now = performance.now();
    let fares = getTotalFares(
        await getArrayOfFares([
            {
                origin_id: "BTS_N9",
                destination_id: "BTS_CEN",
            },
            {
                origin_id: "MRT_BL16",
                destination_id: "MRT_PP10",
            },
            {
                origin_id: "BRT_B5",
                destination_id: "BRT_B12",
            },
        ]),
    );
    console.log(performance.now() - now, "PERF");

    res.status(200).send({
        status: fares,
    });
};
