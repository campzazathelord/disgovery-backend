const Sequelize = require("sequelize");
const sequelize = require("../db/database");

const Translation = sequelize.define(
    "translations",
    {
        table_name: {
            type: Sequelize.ENUM,
            values: [
                "agencies",
                "stops",
                "routes",
                "trips",
                "stop_times",
                "feed_info",
                "pathways",
                "levels",
                "attributions",
            ],
            allowNull: false,
        },
        field_name: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        language: {
            type: Sequelize.STRING(10),
            allowNull: false,
        },
        translation: {
            type: Sequelize.TEXT,
            allowNull: false,
        },
        record_id: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        record_sub_id: Sequelize.STRING,
    },
    {
        timestamps: false,
        createdAt: false,
        updatedAt: false,
    },
);
module.exports = Translation;
