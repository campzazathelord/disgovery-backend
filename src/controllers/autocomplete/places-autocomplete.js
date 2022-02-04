const APIStatus = require("../../configs/api-errors");
const { placesAutoComplete, placeCoords } = require("../../functions/PlacesDetails");

exports.getPlacesAutocomplete = async function getPlacesAutocomplete(req, res) {
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
