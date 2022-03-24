const { QueryTypes } = require("sequelize");
const sequelize = require("../db/database");

exports.getAllStopsOfRoutes = async function () {
    const allStopsOfRoutes = await sequelize.query(
        `
        SELECT route_id, stop_id, stop_code, stop_name, translation as stop_name_th, stop_lon, stop_lat
        from (SELECT routes.route_id,stop_times.stop_id, stop_code, stop_name, stop_times.trip_id, stop_times.stop_sequence, stop_lon, stop_lat
            FROM (  SELECT trip_id, route_id, maxStopSequence
                    FROM (  SELECT trips.trip_id, route_id , maxStopSequence, ROW_NUMBER() over (PARTITION BY route_id ORDER BY maxStopSequence DESC ) AS rowNumber
                            FROM (  SELECT trip_id, MAX(stop_sequence) AS maxStopSequence
                                    FROM stop_times
                                    GROUP BY trip_id) AS trip_id_maxstopseq
                            INNER JOIN trips
                            ON trips.trip_id = trip_id_maxstopseq.trip_id) AS trips_route_maxstopseq
                    WHERE rowNumber = 1) AS trip_route_maxstopseq
            INNER JOIN stop_times
            ON trip_route_maxstopseq.trip_id = stop_times.trip_id
            INNER JOIN stops ON stop_times.stop_id = stops.stop_id
            INNER JOIN routes ON trip_route_maxstopseq.route_id = routes.route_id) withTranslations
            INNER JOIN translations ON table_name='stops' AND field_name='stop_name' AND record_id=stop_id
        `,
        {
            type: QueryTypes.SELECT,
        },
    );

    let formattedStopsOfRoutes = {};

    for (let stop of allStopsOfRoutes) {
        if (!formattedStopsOfRoutes[stop.route_id]) {
            formattedStopsOfRoutes[stop.route_id] = [
                {
                    id: stop.stop_id,
                    name: {
                        en: stop.stop_name,
                        th: stop.stop_name_th,
                    },
                    code: stop.stop_code,
                    coordinates: {
                        lat: parseFloat(stop.stop_lat),
                        lng: parseFloat(stop.stop_lon),
                    },
                },
            ];
        } else {
            formattedStopsOfRoutes[stop.route_id] = [
                ...formattedStopsOfRoutes[stop.route_id],
                {
                    id: stop.stop_id,
                    name: {
                        en: stop.stop_name,
                        th: stop.stop_name_th,
                    },
                    code: stop.stop_code,
                    coordinates: {
                        lat: parseFloat(stop.stop_lat),
                        lng: parseFloat(stop.stop_lon),
                    },
                },
            ];
        }
    }

    return formattedStopsOfRoutes;
};
