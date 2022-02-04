require("dotenv").config();

const Sequelize = require("sequelize");
const { logger } = require("../configs/config");

logger.info("Connecting to the database...");

const sequelize = new Sequelize(
    process.env.MYSQL_DATABASE || "database",
    process.env.MYSQL_USER || "undefined",
    process.env.MYSQL_PASSWORD || "undefined",
    {
        dialect: "mysql",
        host:
            process.env.MYSQL_HOST ||
            "http://localhost:3301",
        logging: (msg) => logger.info(`[DATABASE] ${msg}`),
    },
);
module.exports = sequelize;
