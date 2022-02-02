const express = require("express");
const Translation = require("../models/Translation");
const router = new express.Router();
const axios = require("axios");
const { getRoutes } = require("../controllers/bts/get-routes");
const { getFareRates } = require("../controllers/bts/get-fare-rates");
const { healthCheck } = require("../controllers/health-check");

const formUrlEncoded = (x) =>
    Object.keys(x).reduce((p, c) => p + `&${c}=${encodeURIComponent(x[c])}`, "");

router.get("/healthcheck", healthCheck);

router.get("/getroutes/:id1/:id2", getRoutes);
router.get("/getfarerates/:id1/:id2", getFareRates);

module.exports = router;
