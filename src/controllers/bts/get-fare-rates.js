const axios = require("axios");
const { logger } = require("../../configs/config");

exports.getFareRates = async function getFareRates(req, res) {
    logger.info(`${req.method} ${req.baseUrl + req.path}`);

    try {
        const data = await axios.post(
            "https://btsapp1.bts.co.th/webservice/api/gatFareRate",
            formUrlEncoded({
                Origin: req.params.id1,
                Destination: req.params.id2,
            }),
        );
        const rateFares = {
            fareRates: data.data.FareRate,
        };
        res.status(200).send({ data: rateFares });
    } catch (error) {
        res.status(500).send(error);
    }
};
