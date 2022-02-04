const { logger } = require("../../configs/config");
const APIStatus = require("../../configs/api-errors");
const Stop = require("../../models/Stop");

exports.getStationDetails = async function getStationDetails(req, res) {
    logger.info(`${req.method} ${req.baseUrl + req.path}`);
    if (!req.params.uid) return res.status(APIStatus.BAD_REQUEST.status).send({ status: APIStatus.BAD_REQUEST.status, message: "Station UID is required." });

    let stationId = req.params.uid;
    let result;
    
    try {
        result = await Stop.findOne({ where: { stop_id: stationId } });
    } catch (error) {
        logger.error(error);
        return res.status(APIStatus.INTERNAL.SERVER_ERROR.status).send({ status: APIStatus.INTERNAL.SERVER_ERROR, error: error });
    }

    if (!result) return res.status(APIStatus.OK.status).send({status: APIStatus.OK, data: {}})

    let options = req.query.options;
    let data;

    if (!options) {
            data = {
                name: result.stop_name.trim(),
                uid: stationId,
                code: result.stop_code,
                //lines
                coordinates: {
                    lat: result.stop_lat,
                    lng: result.stop_lon,
                },
            };
    } else {
        let textArray = options.split(",");
        data = {uid:stationId};

        textArray.forEach((element) => {
            if (element === "name") data.name = result.stop_name.trim();
            //if (element === "lines") data.name = result.stop_name;
            else if (element === "code") data.code = result.stop_code;
            else if (element === "coordinates") {
                data.coordinates = {
                    lat: result.stop_lat,
                    lng: result.stop_lon,
                };
            }
        });

        if (Object.keys(data).length === 1) return res.status(APIStatus.BAD_REQUEST.status).send({ status: APIStatus.BAD_REQUEST.status, message: "Incorrect options" });        
    }

    return res.status(APIStatus.OK.status).send({status: APIStatus.OK, data: data});
};
