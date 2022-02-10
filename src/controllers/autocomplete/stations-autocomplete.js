const Stop = require("../../models/Stop");
const Fuzzy = require("../../functions/Fuzzy");
const StationDetails = require("../../functions/StationDetails");
const APIStatus = require("../../configs/api-errors");
const { logger } = require("../../configs/config");
const sequelize = require("../../db/database");
const { Op, QueryTypes } = require("sequelize");

exports.getStationAutocomplete = async function getStationAutocomplete(req, res) {
    logger.info(`${req.method} ${req.baseUrl + req.path}`);

    const query = req.query.query;
    const max_result = parseInt(req.query.max_result) || 6;

    if (!query) return res.send(APIStatus.BAD_REQUEST).status(APIStatus.BAD_REQUEST.status);

    let stationDetailsResult = [];

    try {
        let stations = await sequelize.query(
            `
            select stops.stop_id, stops.stop_name as stop_name_en, translations.translation as stop_name_th, stops.stop_lat, stops.stop_lon from stops
                inner join translations on soundex(stops.stop_name)=soundex('${query}') and translations.record_id=stops.stop_id and translations.table_name='stops' and translations.field_name='stop_name'
        `,
            {
                type: QueryTypes.SELECT,
            },
        );

        for (station of stations) {
            let tripsOfStation = await sequelize.query(
                `
                select routes.route_id, routes.route_long_name, routes.route_short_name, routes.route_type, trips.trip_id, trips.trip_headsign from (select * from stop_times where stop_times.stop_id='${station.stop_id}') stop_times
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
                    en: station.stop_name_en.trim(),
                    th: station.stop_name_th.trim(),
                },
                location: {
                    lat: station.stop_lat,
                    lng: station.stop_lon,
                },
                trips: formattedTripsOfStation,
            });
        }

        // const stations = await Stop.findAll({
        //     attributes: ["stop_name"],
        // });

        // let stationArr = stations.map((x) => {
        //     return x["stop_name"];
        // });

        // const result = Fuzzy(stationArr, query, max_result);
        // const stationDetailsResult = await StationDetails(result);
        return res.status(APIStatus.OK.status).send({ data: stationDetailsResult });
    } catch (error) {
        return res.send(error).status(APIStatus.INTERNAL.SERVER_ERROR.status);
    }
};
