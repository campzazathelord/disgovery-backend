const { logger } = require("../../configs/config");
const APIStatus = require("../../configs/api-errors");
const Fuse = require("fuse.js");

exports.getRoutesAutocomplete = async function getRoutesAutocomplete(req, res) {
    logger.info(`${req.method} ${req.baseUrl + req.path}`);

    try {
        const query = req.query.query;
        const max_result = req.query.max_result || 6;

        if (!query) return res.send(APIStatus.BAD_REQUEST).status(APIStatus.BAD_REQUEST.status);

        const routes = req.app.get("routes");
        const allStops = req.app.get("stops");

        const fuzzyResults = fuzzySearch(routes, query, max_result);

        let response = [];

        if (fuzzyResults.length !== 0) {
            let allStopsOfRoutes = req.app.get("allStopsOfRoutes");
            Object.keys(fuzzyResults).map((key) => {
                response.push({
                    route_id: fuzzyResults[key].item.route_id,
                    type: fuzzyResults[key].item.route_type,
                    name: {
                        short_name: fuzzyResults[key].item.route_short_name,
                        long_name: fuzzyResults[key].item.route_long_name,
                    },
                    color: fuzzyResults[key].item.route_color,
                    stations: allStopsOfRoutes[fuzzyResults[key].item.route_id],
                });
            });
        }

        console.log(response[0].stations);

        for (let i in response) {
            let formattedStations = [];

            for (let stop of response[i].stations) {
                let formattedStop = formatStop(allStops[stop.id], allStops);

                formattedStations.push({
                    id: formattedStop.station.id,
                    code: formattedStop.station.code,
                    name: formattedStop.station.name,
                    platform: formattedStop.station.platform,
                    coordinates: formattedStop.coordinates,
                });
            }

            response[i].stations = formattedStations;
        }

        return res.send({ status: APIStatus.OK, data: response }).status(APIStatus.OK.status);
    } catch (error) {
        logger.error(error.message);
        return res
            .status(APIStatus.INTERNAL.SERVER_ERROR.status)
            .send({ status: { status: APIStatus.INTERNAL.SERVER_ERROR.status, message: error } });
    }
};

function fuzzySearch(arr, str, max_result) {
    const options = {
        includeScore: true,
        keys: ["route_short_name_th", "route_long_name_th", "route_short_name", "route_long_name"],
    };

    const fuse = new Fuse(arr, options);

    const result = fuse.search(str, { limit: max_result || 6 });
    return result;
}

function formatStop(stop, allStops) {
    try {
        let platform = undefined;

        if (stop.parent_station !== null) {
            platform = {
                id: stop.stop_id,
                name: {
                    en: stop.stop_name_en,
                    th: stop.stop_name_th,
                },
                code: stop.platform_code,
            };

            stop = allStops[stop.parent_station];
        }

        data = {
            station: {
                id: stop.stop_id,
                code: stop.stop_code,
                name: {
                    en: stop.stop_name_en,
                    th: stop.stop_name_th,
                },
                platform: platform,
            },
            coordinates: {
                lat: parseFloat(stop.stop_lat),
                lng: parseFloat(stop.stop_lon),
            },
        };

        return data;
    } catch (error) {
        return {};
    }
}
