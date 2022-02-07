const Sequelize = require("sequelize");
const sequelize = require("../db/database");

const StopTime  = sequelize.define(
    "stop_times",
    {
        trip_id: {
            type: Sequelize.STRING,
            primaryKey: true,
        },
        arrival_time: {
            type: Sequelize.STRING(8),
        },
        departure_time: {
            type: Sequelize.STRING(8),
        },
        stop_id: {
            type: Sequelize.STRING,
        },
        stop_sequence: {
            type: Sequelize.TEXT,
        },
        stop_headsign: {
            type: Sequelize.TEXT,
        },
        pickup_type: {
            type: Sequelize.ENUM,
            values:["0","1","2","3"],
        },
        timepoint: {
            type: Sequelize.ENUM,
            values:["0","1"],
        },
    },
    {
        timestamps: false,
        createdAt: false,
        updatedAt: false,
    },
);

module.exports = StopTime;