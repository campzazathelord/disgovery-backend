const Sequelize = require("sequelize");
const sequelize = require("../db/database");

const Shape = sequelize.define(
    "shapes",
    {
        shape_id: {
            type: Sequelize.STRING,
            primaryKey: true,
        },
        shape_encoded: {
            type: Sequelize.TEXT,
        },
        shape_encoded_level: {
            type: Sequelize.TEXT,
        },
    },
    {
        timestamps: false,
        createdAt: false,
        updatedAt: false,
    },
);

module.exports = Shape;
