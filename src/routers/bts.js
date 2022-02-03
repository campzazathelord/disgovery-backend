const express = require("express");
const Translation = require("../models/Translation");
const router = new express.Router();
const axios = require("axios");
const { getRoutes } = require("../controllers/bts/get-routes");
const { getFareRates } = require("../controllers/bts/get-fare-rates");
const { getPlacesAutocomplete } = require('../controllers/autocomplete/places-autocomplete')
const { healthCheck } = require("../controllers/health-check");
const { test } = require("../controllers/test");

const formUrlEncoded = (x) =>
    Object.keys(x).reduce((p, c) => p + `&${c}=${encodeURIComponent(x[c])}`, "");

router.get("/healthcheck", healthCheck);

router.get("/getroutes/:id1/:id2", getRoutes);
router.get("/getfarerates/:id1/:id2", getFareRates);
router.get('/getplacesautocomplete',getPlacesAutocomplete)
router.post("/:id/test", test);

module.exports = router;
