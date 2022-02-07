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
                //lines will be added later
                return res
                    .status(APIStatus.BAD_REQUEST.status)
                    .send({ status: APIStatus.BAD_REQUEST.status, message: "Incorrect options" });
            }
        }
    }

    // let resultStop;
    // let resultStopTime;
    // let resultTrip;
    // let resultRoute;

    let resultStop = await Stop.findOne({ where: { stop_id: "BTS_CEN" } });

    if (!resultStop)
        return res.status(APIStatus.OK.status).send({ status: APIStatus.OK, data: {} });

    logger.info(resultStop);

    // let resultStopTime = await StopTime.findAll({
    //     attributes: [Sequelize.fn("DISTINCT", Sequelize.col("trip_id")), "trip_id"],
    //     where: { stop_id: resultStop.stop_id },
    // });

    // let tripIds = [];

    // Object.keys(resultStopTime).map((key) => {
    //     tripIds.push(resultStopTime[key].trip_id);
    // });

    let resultTrip = await sequelize.query(
        `SELECT DISTINCT * FROM routes WHERE route_id IN (SELECT DISTINCT route_id FROM trips WHERE trip_id IN (SELECT DISTINCT trip_id FROM stop_times WHERE (stop_id = 'BTS_CEN')))`,
        {
            type: QueryTypes.SELECT,
        },
    );

    logger.info("LDFKJ:SLDKJDKLS:J:", resultTrip);

    // resultTrip = await Trip.findAll({
    //     // attributes: ["route_id"],
    //     where: { trip_id: resultStopTime.trip_id },
    // });
    // resultRoute = await Route.findAll({ where: { route_id: resultTrip.route_id } });

    // SELECT DISTINCT * FROM routes WHERE route_id IN (SELECT DISTINCT route_id FROM trips WHERE trip_id IN (SELECT DISTINCT trip_id FROM stop_times WHERE (stop_id = 'BTS_CEN')))

    //logger.info(resultRoute);

    let data;

    if (!options) {
        data = {
            name: resultStop.stop_name.trim(),
            uid: stationId,
            code: resultStop.stop_code,
            // lines: {
            //     name: ,
            //     color: ,
            //     destinations: {
            //         to: ,
            //         schedule: ,
            //     }
            // }
            coordinates: {
                lat: resultStop.stop_lat,
                lng: resultStop.stop_lon,
            },
        };
    } else {
        data = { uid: stationId };

        textArray.forEach((element) => {
            if (element === "name") data.name = resultStop.stop_name.trim();
            //else if (element === "lines") data.name = resultStop.stop_name;
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

function throwError(error, res) {
    logger.error(error);
    return res.status(APIStatus.INTERNAL.SERVER_ERROR.status).send({
        status: APIStatus.INTERNAL.SERVER_ERROR,
        error: error,
    });
}
