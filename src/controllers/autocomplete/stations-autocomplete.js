const APIStatus = require("../../configs/api-errors");
const { logger } = require("../../configs/config");
const sequelize = require("../../db/database");
const Fuse = require("fuse.js");
const { QueryTypes } = require("sequelize");

exports.getStationAutocomplete = async function getStationAutocomplete(req, res) {
    logger.info(`${req.method} ${req.baseUrl + req.path}`);

    try {
        const query = req.query.query;
        const max_result = parseInt(req.query.max_result) || 6;

        if (!query) return res.send(APIStatus.BAD_REQUEST).status(APIStatus.BAD_REQUEST.status);

        const allStops = req.app.get("stops");
        const fuzzyResults = fuzzySearch(Object.values(allStops), query, max_result);

        let allChildrenStops = [];
        let queryString = "";

        let responseObject = {};

        Object.keys(fuzzyResults).map((key, index) => {
            responseObject[fuzzyResults[key].item.stop_id] = {
                station_id: fuzzyResults[key].item.stop_id,
                name: {
                    en: fuzzyResults[key].item.stop_name_en.trim(),
                    th: fuzzyResults[key].item.stop_name_th.trim(),
                },
                location: {
                    lat: fuzzyResults[key].item.stop_lat,
                    lng: fuzzyResults[key].item.stop_lon,
                },
                trips: [],
            };

            allChildrenStops.push(
                ...getChildrenStops(fuzzyResults[key].item.stop_id, Object.values(allStops)),
            );

            if (index === 0) {
                queryString += `select stop_id, routes.route_id, routes.route_long_name, routes.route_short_name, routes.route_type, routes.route_color, trips.trip_id, trips.trip_headsign from (select * from stop_times where stop_times.stop_id='${fuzzyResults[key].item.stop_id}') stop_times inner join trips on stop_times.trip_id=trips.trip_id inner join routes on trips.route_id = routes.route_id `;
            } else {
                queryString += `union select stop_id, routes.route_id, routes.route_long_name, routes.route_short_name, routes.route_type, routes.route_color, trips.trip_id, trips.trip_headsign from (select * from stop_times where stop_times.stop_id='${fuzzyResults[key].item.stop_id}') stop_times inner join trips on stop_times.trip_id=trips.trip_id inner join routes on trips.route_id = routes.route_id `;
            }
        });

        for (let children of allChildrenStops) {
            if (queryString === "") {
                queryString += `select stop_id, routes.route_id, routes.route_long_name, routes.route_short_name, routes.route_type, routes.route_color, trips.trip_id, trips.trip_headsign from (select * from stop_times where stop_times.stop_id='${children}') stop_times inner join trips on stop_times.trip_id=trips.trip_id inner join routes on trips.route_id = routes.route_id `;
            } else {
                queryString += `union select stop_id, routes.route_id, routes.route_long_name, routes.route_short_name, routes.route_type, routes.route_color, trips.trip_id, trips.trip_headsign from (select * from stop_times where stop_times.stop_id='${children}') stop_times inner join trips on stop_times.trip_id=trips.trip_id inner join routes on trips.route_id = routes.route_id `;
            }
        }

        allChildrenStops = [...new Set(allChildrenStops)];

        const queriedTrips = await sequelize.query(queryString, { type: QueryTypes.SELECT });

        for (let trip of queriedTrips) {
            if (responseObject[trip.stop_id]) {
                responseObject[trip.stop_id].trips = [
                    ...responseObject[trip.stop_id].trips,
                    {
                        route_id: trip[`route_id`],
                        route_name: {
                            long_name: trip[`route_long_name`],
                            short_name: trip[`route_short_name`],
                        },
                        type: trip[`route_type`],
                        color: trip[`route_color`],
                        headsign: trip[`trip_headsign`],
                    },
                ];
            } else {
                if (allStops[trip.stop_id].parent_station) {
                    if (responseObject[allStops[trip.stop_id].parent_station]) {
                        responseObject[allStops[trip.stop_id].parent_station].trips = [
                            ...responseObject[allStops[trip.stop_id].parent_station].trips,
                            {
                                route_id: trip[`route_id`],
                                route_name: {
                                    long_name: trip[`route_long_name`],
                                    short_name: trip[`route_short_name`],
                                },
                                type: trip[`route_type`],
                                color: trip[`route_color`],
                                headsign: trip[`trip_headsign`],
                            },
                        ];
                    }
                }
            }
        }

        return res
            .status(APIStatus.OK.status)
            .send({ status: APIStatus.OK, data: Object.values(responseObject) });
    } catch (error) {
        return res.status(APIStatus.INTERNAL.SERVER_ERROR.status).send({
            status: { status: APIStatus.INTERNAL.SERVER_ERROR.status, message: error.message },
        });
    }
};

function fuzzySearch(arr, str, max_result) {
    const options = {
        includeScore: true,
        keys: ["stop_name_en", "stop_name_th"],
    };

    const fuse = new Fuse(arr, options);

    const results = fuse.search(str);

    const filteredResults = results.filter((result) => {
        return result.item.parent_station === null;
    });

    return filteredResults.slice(0, max_result);
}

function getChildrenStops(parentStation, allStops) {
    let childrenStops = [];

    for (let stop of allStops) {
        if (stop.parent_station === parentStation) {
            childrenStops.push(stop.stop_id);
        }
    }

    return childrenStops;
}
