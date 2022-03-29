const { logger } = require("../../configs/config");
const sequelize = require("../../db/database");
const Sequelize = require("sequelize");
const { Op, QueryTypes } = require("sequelize");
const APIStatus = require("../../configs/api-errors");
const Stop = require("../../models/Stop");
const Route = require("../../models/Route");
const Trip = require("../../models/Trip");
const StopTime = require("../../models/StopTime");
const dayjs = require("dayjs");
const { getGTFSFormattedCurrentTime } = require("../../functions/get-gtfs-formatted-current-time");

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

exports.getStationDetails = async function getStationDetails(req, res) {
    logger.info(`${req.method} ${req.baseUrl + req.path}`);

    if (!req.params.id)
        return res
            .status(APIStatus.BAD_REQUEST.status)
            .send({ status: APIStatus.BAD_REQUEST.status, message: "Station ID is required." });

    let stationId = req.params.id;
    let options = req.query.options;
    let textArray = [];

    if (options) {
        textArray = options.split(",");
        for (let element of textArray) {
            if (
                !(
                    element === "name" ||
                    element === "code" ||
                    element === "coordinates" ||
                    element === "lines" ||
                    element === "transfers" ||
                    element === "routes"
                )
            ) {
                return res
                    .status(APIStatus.BAD_REQUEST.status)
                    .send({ status: APIStatus.BAD_REQUEST.status, message: "Incorrect options" });
            }
        }
    } else {
        textArray = ["name", "code", "coordinates", "lines", "transfers", "routes"];
    }

    const allStops = req.app.get("stops");

    let resultStop,
        resultRoutes,
        data,
        translation,
        linesInStation,
        transfersInStation,
        routesOfStation,
        lines = [],
        transfers = [],
        routes = [];

    let now = dayjs();
    let todaysDay = now.day();
    let timeNowString = await getGTFSFormattedCurrentTime(now);

    resultStop = allStops[stationId];
    let childrenStops = getChildrenStops(stationId, allStops);

    if (!resultStop)
        return res.status(APIStatus.OK.status).send({ status: APIStatus.OK, data: {} });

    try {
        let resultQueryString = `SELECT DISTINCT * FROM routes WHERE route_id IN (SELECT DISTINCT route_id FROM trips WHERE trip_id IN (SELECT DISTINCT trip_id FROM stop_times WHERE (stop_id = '${stationId}')))`;
        let lineQueryString = `select trips.trip_id, trips.trip_headsign, trips.route_id, routes.route_short_name, routes.route_long_name, routes.route_color, routes.route_type, destination.stop_id as destination_id, destination_details.stop_name as destination_name, translations.translation as destination_name_th, destination_details.stop_code as destination_code, frequencies.headway_secs, sec_to_time(time_to_sec(time(frequencies.end_time)) + time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) as scheduled_until, (headway_secs * ceiling((time_to_sec(time('${timeNowString}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) - time_to_sec(time(start_time))) / headway_secs)) - (time_to_sec(time('${timeNowString}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) - time_to_sec(time(start_time))) as arriving_in from stop_times current
                inner join stop_times head on head.stop_sequence=1 and current.trip_id=head.trip_id and current.stop_id='${stationId}'
                inner join (select trip_id, stop_id, max(stop_sequence) as max_sequence from stop_times group by trip_id) as destination_sequence on current.trip_id=destination_sequence.trip_id
                inner join stop_times destination on destination_sequence.max_sequence=destination.stop_sequence and current.trip_id=destination.trip_id
                inner join stops destination_details on destination.stop_id=destination_details.stop_id
                inner join trips on current.trip_id = trips.trip_id
                inner join calendar on trips.service_id = calendar.service_id and calendar.${WEEKDAYS[todaysDay]} = '1'
                inner join routes on trips.route_id = routes.route_id
                inner join frequencies on frequencies.trip_id=current.trip_id and time_to_sec(time('${timeNowString}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) < time_to_sec(time(frequencies.end_time)) + frequencies.headway_secs and time_to_sec(time('${timeNowString}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) >= time_to_sec(time(frequencies.start_time))
                inner join translations on translations.table_name='stops' and translations.field_name='stop_name' and translations.record_id=destination.stop_id`;
        let routeQueryString = `select routes.route_id, route_short_name, route_long_name, route_color, route_type from (select stop_id, stop_name, stop_code from stops where stop_id='${stationId}') as stops
                inner join translations on translations.table_name='stops' and translations.field_name='stop_name' and translations.record_id=stops.stop_id
                inner join (select trip_id, stop_id from stop_times) as all_trips_with_stops on stops.stop_id=all_trips_with_stops.stop_id
                inner join (select route_id, trip_id from trips) as trips on trips.trip_id=all_trips_with_stops.trip_id
                inner join routes on trips.route_id=routes.route_id
                group by route_id`;
        let transferOrQueryString = "";

        for (let child of childrenStops) {
            resultQueryString += ` UNION SELECT DISTINCT * FROM routes WHERE route_id IN (SELECT DISTINCT route_id FROM trips WHERE trip_id IN (SELECT DISTINCT trip_id FROM stop_times WHERE (stop_id = '${child}')))`;
            lineQueryString += ` union select trips.trip_id, trips.trip_headsign, trips.route_id, routes.route_short_name, routes.route_long_name, routes.route_color, routes.route_type, destination.stop_id as destination_id, destination_details.stop_name as destination_name, translations.translation as destination_name_th, destination_details.stop_code as destination_code, frequencies.headway_secs, sec_to_time(time_to_sec(time(frequencies.end_time)) + time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) as scheduled_until, (headway_secs * ceiling((time_to_sec(time('${timeNowString}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) - time_to_sec(time(start_time))) / headway_secs)) - (time_to_sec(time('${timeNowString}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) - time_to_sec(time(start_time))) as arriving_in from stop_times current
                inner join stop_times head on head.stop_sequence=1 and current.trip_id=head.trip_id and current.stop_id='${child}'
                inner join (select trip_id, stop_id, max(stop_sequence) as max_sequence from stop_times group by trip_id) as destination_sequence on current.trip_id=destination_sequence.trip_id
                inner join stop_times destination on destination_sequence.max_sequence=destination.stop_sequence and current.trip_id=destination.trip_id
                inner join stops destination_details on destination.stop_id=destination_details.stop_id
                inner join trips on current.trip_id = trips.trip_id
                inner join calendar on trips.service_id = calendar.service_id and calendar.${WEEKDAYS[todaysDay]} = '1'
                inner join routes on trips.route_id = routes.route_id
                inner join frequencies on frequencies.trip_id=current.trip_id and time_to_sec(time('${timeNowString}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) < time_to_sec(time(frequencies.end_time)) + frequencies.headway_secs and time_to_sec(time('${timeNowString}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) >= time_to_sec(time(frequencies.start_time))
                inner join translations on translations.table_name='stops' and translations.field_name='stop_name' and translations.record_id=destination.stop_id`;
            routeQueryString += ` union select routes.route_id, route_short_name, route_long_name, route_color, route_type from (select stop_id, stop_name, stop_code from stops where stop_id='${child}') as stops
                inner join translations on translations.table_name='stops' and translations.field_name='stop_name' and translations.record_id=stops.stop_id
                inner join (select trip_id, stop_id from stop_times) as all_trips_with_stops on stops.stop_id=all_trips_with_stops.stop_id
                inner join (select route_id, trip_id from trips) as trips on trips.trip_id=all_trips_with_stops.trip_id
                inner join routes on trips.route_id=routes.route_id
                group by route_id`;
            transferOrQueryString += ` or from_stop_id='${child}'`;
        }

        resultRoutes = await sequelize.query(resultQueryString, {
            type: QueryTypes.SELECT,
        });

        if (textArray.includes("lines")) {
            linesInStation = await sequelize.query(lineQueryString, {
                type: QueryTypes.SELECT,
            });
        }

        routesOfStation = await sequelize.query(routeQueryString, {
            type: QueryTypes.SELECT,
        });

        if (textArray.includes("transfers")) {
            transfersInStation = await sequelize.query(
                `
                select stop_name, stops.stop_id as stop_id, stop_code, translation as stop_name_th, trips.route_id, route_short_name, route_long_name, route_color, route_type, min_transfer_time from (select stop_code, stop_name, stop_id from stops where stop_id in (select to_stop_id from transfers where from_stop_id='${stationId}'${transferOrQueryString})) as stops
                    inner join translations on translations.table_name='stops' and translations.field_name='stop_name' and translations.record_id=stops.stop_id
                    inner join (select trip_id, stop_id from stop_times) as all_trips_with_stops on stops.stop_id=all_trips_with_stops.stop_id
                    inner join (select route_id, trip_id from trips) as trips on trips.trip_id=all_trips_with_stops.trip_id
                    inner join routes on trips.route_id=routes.route_id
                    natural join (select from_stop_id, to_stop_id as stops, min_transfer_time from transfers where from_stop_id='${stationId}'${transferOrQueryString}) as transfers
                    group by route_id;
                `,
                {
                    type: QueryTypes.SELECT,
                },
            );
        }
    } catch (error) {
        logger.error(`At fetching routes: ${error}`);
        return res
            .status(APIStatus.BAD_REQUEST.status)
            .send({ status: APIStatus.BAD_REQUEST.status, message: error });
    }

    if (linesInStation)
        linesInStation.sort(function (a, b) {
            return a.arriving_in - b.arriving_in;
        });

    Object.keys(linesInStation).map((key) => {
        lines.push({
            route_id: linesInStation[key].route_id,
            route_name: {
                short_name: linesInStation[key].route_short_name,
                long_name: linesInStation[key].route_long_name,
            },
            route_color: linesInStation[key].route_color,
            route_type: linesInStation[key].route_type,
            trip_id: linesInStation[key].trip_id,
            headsign: linesInStation[key].headsign,
            headway_secs: linesInStation[key].headway_secs,
            scheduled_until: linesInStation[key].scheduled_until,
            arriving_in: linesInStation[key].arriving_in,
            destination: formatPlatform(
                allStops[linesInStation[key].destination_id],
                allStops,
                false,
            ),
        });
    });

    Object.keys(routesOfStation).map((key) => {
        routes.push({
            route_id: routesOfStation[key].route_id,
            route_name: {
                short_name: routesOfStation[key].route_short_name,
                long_name: routesOfStation[key].route_long_name,
            },
            route_type: routesOfStation[key].route_type,
            route_color: routesOfStation[key].route_color,
        });
    });

    Object.keys(transfersInStation).map((key) => {
        if (routes.length > 0 && routes[0].route_id !== transfersInStation[key].route_id) {
            transfers.push({
                ...formatPlatform(allStops[transfersInStation[key].stop_id], allStops, true),
                duration: transfersInStation[key].min_transfer_time,
                route: {
                    route_id: transfersInStation[key].route_id,
                    route_name: {
                        short_name: transfersInStation[key].route_short_name,
                        long_name: transfersInStation[key].route_long_name,
                    },
                    route_color: transfersInStation[key].route_color,
                    route_type: transfersInStation[key].route_type,
                },
            });
        }
    });

    if (!options) {
        data = {
            name: { en: resultStop.stop_name_en.trim(), th: resultStop.stop_name_th.trim() },
            id: stationId,
            code: resultStop.stop_code,
            lines: lines,
            transfers: transfers,
            routes: routes,
            coordinates: {
                lat: resultStop.stop_lat,
                lng: resultStop.stop_lon,
            },
        };
    } else {
        data = { id: stationId };

        textArray.forEach((element) => {
            if (element === "name") data.name = resultStop.stop_name_en.trim();
            else if (element === "lines") data.lines = lines;
            else if (element === "code") data.code = resultStop.stop_code;
            else if (element === "coordinates") {
                data.coordinates = {
                    lat: resultStop.stop_lat,
                    lng: resultStop.stop_lon,
                };
            } else if (element === "transfers") data.transfers = transfers;
            else if (element === "routes") data.routes = routes;
        });
    }

    return res.status(APIStatus.OK.status).send({ status: APIStatus.OK, data: data });
};

function getChildrenStops(stop_id, allStops) {
    let childrenStops = [];

    Object.keys(allStops).map((key) => {
        if (allStops[key].parent_station === stop_id) {
            childrenStops.push(allStops[key].stop_id);
        }
    });

    return childrenStops;
}

function formatPlatform(stopObject, allStops, removePlatform) {
    let platform = undefined;
    if (!removePlatform) removePlatform = false;

    if (stopObject.parent_station !== null) {
        if (allStops[stopObject.parent_station]) {
            if (!removePlatform) {
                platform = {
                    id: stopObject.stop_id,
                    name: {
                        en: stopObject.stop_name_en,
                        th: stopObject.stop_name_th,
                    },
                    code: stopObject.platform_code,
                };
            }

            stopObject = allStops[stopObject.parent_station];
        }
    }

    let formatted = {
        id: stopObject.stop_id,
        name: {
            en: stopObject.stop_name_en,
            th: stopObject.stop_name_th,
        },
        code: stopObject.stop_code,
        platform: platform,
    };

    return formatted;
}
