const { logger } = require("../../configs/config");
const sequelize = require("../../db/database");
const Sequelize = require("sequelize");
const { Op, QueryTypes } = require("sequelize");
const APIStatus = require("../../configs/api-errors");
const Stop = require("../../models/Stop");
const Route = require("../../models/Route");
const Trip = require("../../models/Trip");
const StopTime = require("../../models/StopTime");

exports.getStationDetails = async function getStationDetails(req, res) {
    logger.info(`${req.method} ${req.baseUrl + req.path}`);

    if (!req.params.uid)
        return res
            .status(APIStatus.BAD_REQUEST.status)
            .send({ status: APIStatus.BAD_REQUEST.status, message: "Station UID is required." });

    let stationId = req.params.uid;
    let options = req.query.options;
    let textArray;

    if (options) {
        textArray = options.split(",");
        for (let element of textArray) {
            if (
                !(
                    element === "name" ||
                    element === "code" ||
                    element === "coordinates" ||
                    element === "lines"
                )
            ) {
                return res
                    .status(APIStatus.BAD_REQUEST.status)
                    .send({ status: APIStatus.BAD_REQUEST.status, message: "Incorrect options" });
            }
        }
    }

    let resultStop,
        resultRoutes,
        data,
        lines = [];

    try {
        resultStop = await Stop.findOne({ where: { stop_id: stationId } });
    } catch (error) {
        logger.error(`At fetching stops: ${error}`);
        return res
            .status(APIStatus.BAD_REQUEST.status)
            .send({ status: APIStatus.BAD_REQUEST.status, message: error });
    }

    if (!resultStop)
        return res.status(APIStatus.OK.status).send({ status: APIStatus.OK, data: {} });

    try {
        resultRoutes = await sequelize.query(
            `SELECT DISTINCT * FROM routes WHERE route_id IN (SELECT DISTINCT route_id FROM trips WHERE trip_id IN (SELECT DISTINCT trip_id FROM stop_times WHERE (stop_id = '${stationId}')))`,
            {
                type: QueryTypes.SELECT,
            },
        );
    } catch (error) {
        logger.error(`At fetching routes: ${error}`);
        return res
            .status(APIStatus.BAD_REQUEST.status)
            .send({ status: APIStatus.BAD_REQUEST.status, message: error });
    }

    Object.keys(resultRoutes).map((key) => {
        let destinations = [];

        lines.push({
            name: {
                short_name: resultRoutes[key].route_short_name,
                long_name: resultRoutes[key].route_long_name,
            },
            color: resultRoutes[key].route_color,
        });
    });

    if (!options) {
        data = {
            name: resultStop.stop_name.trim(),
            uid: stationId,
            code: resultStop.stop_code,
            lines: lines,
            coordinates: {
                lat: resultStop.stop_lat,
                lng: resultStop.stop_lon,
            },
        };
    } else {
        data = { uid: stationId };

        textArray.forEach((element) => {
            if (element === "name") data.name = resultStop.stop_name.trim();
            else if (element === "lines") data.lines = lines;
            else if (element === "code") data.code = resultStop.stop_code;
            else if (element === "coordinates") {
                data.coordinates = {
                    lat: resultStop.stop_lat,
                    lng: resultStop.stop_lon,
                };
            }
        });
    }

    return res.status(APIStatus.OK.status).send({ status: APIStatus.OK, data: data });
};
