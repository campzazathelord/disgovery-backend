const Stop = require("../../models/Stop");
const Fuzzy = require("../../functions/Fuzzy");
const StationDetails = require("../../functions/StationDetails");

exports.getStationAutocomplete = async function getStationAutocomplete(req, res) {
    try {
        let tmpStations = [];
        const stations = await Stop.findAll();
        const result = Fuzzy(stations, req.query.query);

        const stationDetailsResult = await StationDetails(result);
        res.status(200).send({ data: stationDetailsResult });
    } catch (error) {
        res.send(error).status(500);
    }
};
