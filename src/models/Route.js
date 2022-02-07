const Sequelize = require("sequelize");
const sequelize = require("../db/database");

const Route = sequelize.define(
    "routes",
    {
        route_id: {
            type: Sequelize.STRING,
            primaryKey: true,
        },
        agency_id: {
            type: Sequelize.STRING,
        },
        route_short_name: {
            type: Sequelize.TEXT,
        },
        route_long_name: {
            type: Sequelize.TEXT,
        },
        route_desc: {
            type: Sequelize.TEXT,
        },
        route_type: {
            type: Sequelize.ENUM,
            values: ["0", "1", "2", "3", "4", "5", "6", "7", "11", "12"],
        },
        route_url: {
            type: Sequelize.TEXT,
        },
        route_color: {
            type: Sequelize.CHAR,
        },
        route_text_color: {
            type: Sequelize.CHAR,
        },
        route_sort_order: {
            type: Sequelize.INTEGER,
        },
        continuous_pickup: {
            type: Sequelize.ENUM,
            values: ["0", "1", "2", "3"],
        },
        continuous_drop_off: {
            type: Sequelize.ENUM,
            values: ["0", "1", "2", "3"],
        },
        shape_id: {
            type: Sequelize.STRING,
        },
    },
    {
        timestamps: false,
        createdAt: false,
        updatedAt: false,
    },
);

module.exports = Route;