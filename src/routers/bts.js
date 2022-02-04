const express = require("express");
const router = new express.Router();
const { getRoutes } = require("../controllers/bts/get-routes");
const { getFareRates } = require("../controllers/bts/get-fare-rates");
const { getPlacesAutocomplete } = require("../controllers/autocomplete/places-autocomplete");
const { healthCheck } = require("../controllers/health-check");
const { getStationDetails } = require("../controllers/stations/get-station-details");
const { getStationAutocomplete } = require("../controllers/autocomplete/stations-autocomplete");
const { test } = require("../controllers/test");
const { getNearbyStations } = require("../controllers/stations/get-nearby-stations");

const formUrlEncoded = (x) =>
    Object.keys(x).reduce((p, c) => p + `&${c}=${encodeURIComponent(x[c])}`, "");

router.get("/healthcheck", healthCheck); // Health Check

router.get("/getroutes/:id1/:id2", getRoutes);
router.get("/getfarerates/:id1/:id2", getFareRates);
router.get("/station/:uid", getStationDetails);

router.get("/station/nearby", getNearbyStations); // API 1-1

router.get("/autocomplete/places", getPlacesAutocomplete); // API 2-1
router.get("/autocomplete/stations", getStationAutocomplete); // API 2-2

router.post("/:id/test", test);

module.exports = router;
