const Stop = require("../../models/Stop");
const sequelize = require("../../db/database");
const APIStatus = require("../../configs/api-errors");
const { Op, QueryTypes } = require("sequelize");
const { logger } = require("../../configs/config");
const dayjs = require("dayjs");
const { getGTFSFormattedCurrentTime } = require("../../functions/get-gtfs-formatted-current-time");

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const STOP_LAT_COL = "stop_lat";
const STOP_LNG_COL = "stop_lon";

exports.getNearbyStations = async function (req, res) {
    logger.info(`${req.method} ${req.baseUrl + req.path}`);

    const lat = parseFloat(req.query.lat) || undefined;
    const lng = parseFloat(req.query.lng) || undefined;
    const radiusMetres = parseFloat(req.query.radius) || 500;
    const maxResult = parseInt(req.query.max_result) || 999;

    if (!lat || !lng)
        return res.send({
            status: APIStatus.BAD_REQUEST.status,
            message: "Latitude or longitude should be a number and is required.",
        });

    try {
        let attributes = Object.keys(await Stop.getAttributes());

        const distance = await sequelize.literal(
            `6371000 * acos (cos (radians(${lat})) * cos(radians(${STOP_LAT_COL})) * cos(radians(${STOP_LNG_COL}) - radians(${lng})) + sin(radians(${lat})) * sin(radians(${STOP_LAT_COL})))`,
        );

        attributes.push([distance, "distance"]);

        const nearbyStations = await Stop.findAll({
            attributes: attributes,
            order: distance,
            limit: maxResult,
            where: sequelize.where(distance, { [Op.lte]: radiusMetres }),
        });

        if (nearbyStations.length === 0)
            return res
                .send({ status: APIStatus.OK, data: nearbyStations })
                .status(APIStatus.OK.status);

        let formattedNearbyStations = [];

        let now = dayjs();
        let todaysDay = now.day();
        let timeNowString = await getGTFSFormattedCurrentTime(now);

        await Object.keys(nearbyStations).map(async (key, iteration) => {
            let nearbyStationLines;

            try {
                nearbyStationLines = await sequelize.query(
                    `
                    select trips.trip_id, trips.trip_headsign, trips.route_id, routes.route_short_name, routes.route_long_name, routes.route_color, routes.route_type, destination.stop_id as destination_id, destination_details.stop_name as destination_name, destination_details.stop_code as destination_code, (headway_secs * ceiling((time_to_sec(time('${timeNowString}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) - time_to_sec(time(start_time))) / headway_secs)) - (time_to_sec(time('${timeNowString}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) - time_to_sec(time(start_time))) as arriving_in from stop_times current
                        inner join stop_times head on head.stop_sequence=1 and current.trip_id=head.trip_id and current.stop_id='${nearbyStations[key].stop_id}'
                        inner join (select trip_id, stop_id, max(stop_sequence) as max_sequence from stop_times group by trip_id) as destination_sequence on current.trip_id=destination_sequence.trip_id
                        inner join stop_times destination on destination_sequence.max_sequence=destination.stop_sequence and current.trip_id=destination.trip_id
                        inner join stops destination_details on destination.stop_id=destination_details.stop_id
                        inner join trips on current.trip_id = trips.trip_id
                        inner join calendar on trips.service_id = calendar.service_id and calendar.${WEEKDAYS[todaysDay]} = '1'
                        inner join routes on trips.route_id = routes.route_id
                        inner join frequencies on frequencies.trip_id=current.trip_id and time_to_sec(time('${timeNowString}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) < time_to_sec(time(frequencies.end_time)) + frequencies.headway_secs and time_to_sec(time('${timeNowString}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) >= time_to_sec(time(frequencies.start_time));
                    `,
                    {
                        type: QueryTypes.SELECT,
                    },
                );
            } catch (error) {
                logger.error(error);
                nearbyStationLines = [];
            }

            let formattedNearbyStationLines = [];

            if (nearbyStationLines) {
                Object.keys(nearbyStationLines).map((key) => {
                    formattedNearbyStationLines.push({
                        id: nearbyStationLines[key].route_id,
                        trip_id: nearbyStationLines[key].trip_id,
                        name: {
                            short_name: nearbyStationLines[key].route_short_name,
                            long_name: nearbyStationLines[key].route_long_name,
                        },
                        route_type: nearbyStationLines[key].route_type,
                        headsign: nearbyStationLines[key].trip_headsign,
                        color: nearbyStationLines[key].route_color,
                        destination: {
                            uid: nearbyStationLines[key].destination_id,
                            name: nearbyStationLines[key].destination_name,
                            code: nearbyStationLines[key].destination_code,
                        },
                        arriving_in: nearbyStationLines[key].arriving_in,
                    });
                });
            }

            formattedNearbyStations.push({
                name: nearbyStations[key].stop_name.trim(),
                uid: nearbyStations[key].stop_id,
                code: nearbyStations[key].stop_code,
                coordinates: {
                    lat: nearbyStations[key].stop_lat,
                    lng: nearbyStations[key].stop_lon,
                },
                lines: formattedNearbyStationLines,
                distance: nearbyStations[key].dataValues.distance,
            });

            if (nearbyStations.length - 1 === iteration) {
                return res
                    .send({ status: APIStatus.OK, data: formattedNearbyStations })
                    .status(APIStatus.OK.status);
            }
        });
    } catch (error) {
        logger.error(error);
        return res
            .send({ status: APIStatus.INTERNAL.SERVER_ERROR, error: error })
            .status(APIStatus.INTERNAL.SERVER_ERROR.status);
    }
};
