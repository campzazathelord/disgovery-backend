const pino = require("pino");
const logger = pino({
    enabled: process.env.NODE_ENV === "development",
    transport: {
        target: "pino-pretty",
        options: {
            colorize: true,
            translateTime: true,
        },
    },
});

function checkStructEnv() {
    if (!process.env.GOOGLE_MAPS_API_KEY) {
        logger.error("FATAL: Google Maps API key is not accessible. Exiting.");
        process.exit(1);
    }

    if (!process.env.MONGODB_URL) {
        logger.error("FATAL: MongoDB URL is not accessible. Exiting.");
        process.exit(1);
    }

    if (
        !process.env.MYSQL_HOST ||
        !process.env.MYSQL_PASSWORD ||
        !process.env.MYSQL_USER ||
        !process.env.MYSQL_DATABASE
    ) {
        logger.error(
            "Missing MySQL environment variable(s). The database might not be read and written correctly.",
        );
        return;
    }

    logger.info(".env file is structured correctly. Starting the server...");
}

module.exports = {
    logger: logger,
    checkStructEnv,
};
