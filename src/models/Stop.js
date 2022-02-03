const Sequelize = require("sequelize");
const sequelize = require("../db/database");

const Stop = sequelize.define(
    "stops",
    {
        stop_id: {
            type: Sequelize.STRING,
            primaryKey: true,
        },
        stop_code: {
            type: Sequelize.STRING,
        },
        stop_name: {
            type: Sequelize.TEXT,
        },
        stop_desc: {
            type: Sequelize.TEXT,
        },
        stop_lat: {
            type: Sequelize.DECIMAL(18, 15),
        },
        stop_lon: {
            type: Sequelize.DECIMAL(18, 15),
        },
        zone_id: {
            type: Sequelize.STRING,
        },
        stop_url: {
            type: Sequelize.TEXT,
        },
        location_type: {
            type: Sequelize.ENUM,
            values: ["0", "1", "2", "3", "4"],
        },
        parent_station: {
            type: Sequelize.STRING,
        },
        stop_timezone: {
            type: Sequelize.STRING,
        },
        wheelchair_boarding: {
            type: Sequelize.ENUM,
            values: ["0", "1", "2"],
        },
        level_id: {
            type: Sequelize.STRING,
        },
        platform_code: {
            type: Sequelize.STRING,
        },
    },
    {
        timestamps: false,
        createdAt: false,
        updatedAt: false,
    },
);
Stop.removeAttribute("id");
module.exports = Stop;
