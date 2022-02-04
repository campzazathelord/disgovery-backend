require("dotenv").config();

const Sequelize = require("sequelize");
const { logger } = require("../configs/config");

logger.info("Connecting to the database...");

const sequelize = new Sequelize(
    process.env.MYSQL_DATABASE || "DisgoveryDatabase",
    process.env.MYSQL_USER || "admin",
    process.env.MYSQL_PASSWORD || "disgovery",
    {
        dialect: "mysql",
        host:
            process.env.MYSQL_HOST ||
            "disgovery-database.cg25477elnau.ap-southeast-1.rds.amazonaws.com",
        logging: (msg) => logger.info(`[DATABASE] ${msg}`),
    },
);
module.exports = sequelize;
