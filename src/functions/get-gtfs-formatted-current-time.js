const { logger } = require("../configs/config");
const sequelize = require("../db/database");
const { QueryTypes } = require("sequelize");

exports.getGTFSFormattedCurrentTime = async function (now) {
    let maxTime, mts, splittedMaxTime;

    try {
        try {
            maxTime = await sequelize.query(
                `select max(time(departure_time)) as max_time from stop_times`,
                {
                    type: QueryTypes.SELECT,
                    maxResult: 1,
                },
            );
        } catch (error) {
            logger.error(`Unable to fetch max time: ${error}`);
            return "00:00:00";
        }

        mts = maxTime[0].max_time.split(":");
        splittedMaxTime = {
            hours: parseInt(mts[0]),
            minutes: parseInt(mts[1]),
            seconds: parseInt(mts[2]),
        };

        if (
            now.hour() + 24 > splittedMaxTime.hours ||
            (now.hour() + 24 === splittedMaxTime.hours && now.minute() > splittedMaxTime.minutes) ||
            (now.hour() + 24 === splittedMaxTime.hours &&
                now.minute() > splittedMaxTime.minutes &&
                now.second > splittedMaxTime.seconds)
        ) {
            return `${now.format("HH")}:${now.format("mm")}:${now.format("ss")}`;
        }

        return `${now.hour() + 24}:${now.format("mm")}:${now.format("ss")}`;
    } catch (error) {
        logger.error(`Invalid max time: ${error}`);
        return "00:00:00";
    }
};
