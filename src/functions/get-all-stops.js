const Stop = require("../models/Stop");

exports.getAllStops = async function () {
    return await Stop.findAll({});
};
