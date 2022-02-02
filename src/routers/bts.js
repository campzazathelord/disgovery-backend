const express = require("express");
const router = new express.Router();
const { getRoutes } = require("../controllers/bts/get-routes");
const { getFareRates } = require("../controllers/bts/get-fare-rates");
const { healthCheck } = require("../controllers/health-check");
const {getStationDetails} = require('../controllers/bts/get-station-details')
const {getStationAutoComplete} = require('../controllers/bts/get-station-autocomplete');
const { getStationAutocomplete } = require("../controllers/bts/get-station-autocomplete");

const formUrlEncoded = (x) =>
    Object.keys(x).reduce((p, c) => p + `&${c}=${encodeURIComponent(x[c])}`, "");

router.get("/healthcheck", healthCheck);

router.get("/getroutes/:id1/:id2", getRoutes);
router.get("/getfarerates/:id1/:id2", getFareRates);
router.get('/getstationdetails',getStationDetails)
router.get('/getstationautocomplete',getStationAutocomplete)

module.exports = router;
