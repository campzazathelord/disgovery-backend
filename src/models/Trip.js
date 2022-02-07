const Sequelize = require("sequelize");
const sequelize = require("../db/database");

const Trip = sequelize.define(
    "trips",
    {
        route_id: {
            type: Sequelize.STRING,
            primaryKey: true,
        },
        service_id: {
            type: Sequelize.STRING,
        },
        trip_id: {
            type: Sequelize.STRING,
        },
        trip_headsign: {
            type: Sequelize.TEXT,
        },
        trip_short_name: {
            type: Sequelize.TEXT,
        },
        direction_id: {
            type: Sequelize.ENUM,
            values: ["0", "1", "2", "3", "4", "5", "6", "7", "11", "12"],
        },
        block_id: {
            type: Sequelize.TEXT,
        },
        shape_id: {
            type: Sequelize.CHAR,
        },
        wheelchair_accessible: {
            type: Sequelize.ENUM,
            values: ["0", "1", "2"],
        },
        bikes_allowed: {
            type: Sequelize.ENUM,
            values: ["0", "1", "2"],
        },
    },
    {
        timestamps: false,
        createdAt: false,
        updatedAt: false,
    },
);

module.exports = Trip;
