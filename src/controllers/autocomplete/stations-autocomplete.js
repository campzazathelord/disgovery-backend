const Stop = require("../../models/Stop");
const Fuzzy = require("../../functions/Fuzzy");
const StationDetails = require("../../functions/StationDetails");
const APIStatus = require("../../configs/api-errors");
const { logger } = require("../../configs/config");

exports.getStationAutocomplete = async function getStationAutocomplete(req, res) {
    logger.info(`${req.method} ${req.baseUrl + req.path}`);

    const query = req.query.query;
    const max_result = parseInt(req.query.max_result) || 6;

    if (!query) return res.send(APIStatus.BAD_REQUEST).status(APIStatus.BAD_REQUEST.status);

    try {
        let tmpStations = [];
        const stations = await Stop.findAll();
        const result = Fuzzy(stations, query, max_result);

        const stationDetailsResult = await StationDetails(result);
        return res.status(APIStatus.OK.status).send({ data: stationDetailsResult });
    } catch (error) {
        return res.send(error).status(APIStatus.INTERNAL.SERVER_ERROR.status);
    }
};
