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
const { getTripDetails } = require("../controllers/trips/get-trip-details");
const { getShape } = require("../controllers/trips/get-shape");
const { getRoutesAutocomplete } = require("../controllers/autocomplete/routes-autocomplete");
const { getAllRoutes } = require("../controllers/internal/get-all-routes");
const { getAllStationsFromRoute } = require("../controllers/internal/get-all-stations-from-route");
const { getAllTripsOfStop } = require("../controllers/internal/get-all-trips-of-stop");
const { getAllPlatformsOfStop } = require("../controllers/internal/get-platforms-of-stop");
const { getRawStopDetails } = require("../controllers/internal/get-raw-stop-details");
const { addPlatform } = require("../controllers/internal/add-platform");
const {
    getEmptyTransfersOfPlatform,
} = require("../controllers/internal/get-empty-transfers-of-platforms");
const { addTransfers } = require("../controllers/internal/add-transfers");

const formUrlEncoded = (x) =>
    Object.keys(x).reduce((p, c) => p + `&${c}=${encodeURIComponent(x[c])}`, "");

router.get("/healthcheck", healthCheck); // Health Check

router.get("/getroutes/:id1/:id2", getRoutes);
router.get("/getfarerates/:id1/:id2", getFareRates);

router.get("/station/nearby", getNearbyStations); // API 1-1
router.get("/station/id/:id", getStationDetails); // API 1-2
router.get("/shape/:route_id", getShape); // API 1-4
router.get("/trip/:id", getTripDetails); // API 1-5

router.get("/autocomplete/places", getPlacesAutocomplete); // API 2-1
router.get("/autocomplete/stations", getStationAutocomplete); // API 2-2
router.get("/autocomplete/lines", getRoutesAutocomplete); //API 2-3

router.get("/internal/get-all-routes", getAllRoutes); // INTERNAL GET ALL ROUTES
router.get("/internal/get-all-stations-from-route", getAllStationsFromRoute); // INTERNAL GET ALL STATIONS FROM ROUTE
router.get("/internal/get-all-trips-of-stop", getAllTripsOfStop); // INTERNAL GET ALL TRIPS OF STOP
router.get("/internal/get-all-platforms-of-stop", getAllPlatformsOfStop); // INTERNAL GET ALL PLATFORMS OF STOP
router.get("/internal/get-raw-stop-details", getRawStopDetails); // INTERNAL GET RAW STOP DETAILS
router.post("/internal/add-platform", addPlatform); // INTERNAL ADD PLATFORM
router.get("/internal/get-empty-transfers-of-platforms", getEmptyTransfersOfPlatform); // INTERNAL GET EMPTY TRANSFERS OF PLATFORMS
router.post("/internal/add-transfers", addTransfers); // INTERNAL ADD TRANSFERS

router.post("/:id/test", test);

module.exports = router;
