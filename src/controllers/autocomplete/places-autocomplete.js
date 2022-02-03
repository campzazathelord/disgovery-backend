const {placesAutoComplete,placeCoords} = require('../../functions/PlacesDetails')
exports.getPlacesAutocomplete = async function getPlacesAutocomplete(req, res) {
    try {
        let dataStationAutoComplete = await placesAutoComplete(String(req.query.places))
        let placeDetail = await placeCoords(dataStationAutoComplete)
        res.send(placeDetail).status(200)
    } catch (error) {
        res.send(error).status(500)
        
    }
  };