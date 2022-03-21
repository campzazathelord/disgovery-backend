const APIStatus = require("../../configs/api-errors");
const { logger } = require("../../configs/config");
const sequelize = require("../../db/database");
const Fuse = require("fuse.js");
const { QueryTypes } = require("sequelize");

exports.getStationAutocomplete = async function getStationAutocomplete(req, res) {
    logger.info(`${req.method} ${req.baseUrl + req.path}`);

    const query = req.query.query;
    const max_result = parseInt(req.query.max_result) || 6;

    if (!query) return res.send(APIStatus.BAD_REQUEST).status(APIStatus.BAD_REQUEST.status);

    let stationDetailsResult = [];

    try {
        const stations = search(query, req, max_result);

        for (station of stations) {
            let tripsOfStation = await sequelize.query(
                `
                select routes.route_id, routes.route_long_name, routes.route_short_name, routes.route_type, routes.route_color, trips.trip_id, trips.trip_headsign from (select * from stop_times where stop_times.stop_id='${station.item.stop_id}') stop_times
                    inner join trips on stop_times.trip_id=trips.trip_id
                    inner join routes on trips.route_id = routes.route_id
                `,
                {
                    type: QueryTypes.SELECT,
                },
            );

            let formattedTripsOfStation = [];

            for (trip of tripsOfStation) {
                formattedTripsOfStation.push({
                    id: trip.trip_id,
                    route_id: trip.route_id,
                    color: trip.route_color,
                    route_name: {
                        short_name: trip.route_short_name,
                        long_name: trip.route_long_name,
                    },
                    headsign: trip.trip_headsign,
                    type: trip.route_type,
                });
            }

            stationDetailsResult.push({
                station_id: station.stop_id,
                name: {
                    en: station.item.stop_name_en.trim(),
                    th: station.item.stop_name_th.trim(),
                },
                location: {
                    lat: station.item.stop_lat,
                    lng: station.item.stop_lon,
                },
                trips: formattedTripsOfStation,
            });
        }

        return res.status(APIStatus.OK.status).send({ data: stationDetailsResult });
    } catch (error) {
        return res.send(error).status(APIStatus.INTERNAL.SERVER_ERROR.status);
    }
};

function search(query, req, max_result) {
    if (!query) return [];

    const options = {
        includeScore: true,
        keys: ["stop_name_en", "stop_name_th"],
    };

    const fuse = new Fuse(req.app.get("stops"), options);
    return fuse.search(query, { limit: max_result });
}
