const APIStatus = require("../../configs/api-errors");
const { logger } = require("../../configs/config");
const { placesAutoComplete, placeCoords } = require("../../functions/PlacesDetails");

exports.getPlacesAutocomplete = async function getPlacesAutocomplete(req, res) {
    logger.info(`${req.method} ${req.baseUrl + req.path}`);

    const query = req.query.query;

    if (!query) return res.send(APIStatus.BAD_REQUEST).status(APIStatus.BAD_REQUEST.status);

    try {
        let dataStationAutoComplete = await placesAutoComplete(String(query));
        let placeDetail = await placeCoords(dataStationAutoComplete);

        return res.send(placeDetail).status(APIStatus.OK.status);
    } catch (error) {
        return res.send(error).status(APIStatus.INTERNAL.SERVER_ERROR.status);
    }
};
