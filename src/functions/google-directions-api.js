const { default: axios } = require("axios");
const dayjs = require("dayjs");
const { logger } = require("../configs/config");

/**
 * @typedef {Object} Coordinates
 * @property {number} lat The latitude of the place.
 * @property {number} lng The longitude of the place.
 *
 * @typedef {Object} Place
 * @property {Object} place Place of the origin or the destination.
 * @property {string} [place.name] The name of the origin or the destination.
 * @property {string} place.address The address of the origin or the destination.
 * @property {string} [place.place_id] Google Place ID of the origin or the destination.
 * @property {Coordinates} coordinates The coordinates of the place.
 *
 * @typedef {Object} Distance
 * @property {string} text The distance string of the directions.
 * @property {number} value The distance in metres of the directions.
 *
 * @typedef {Object} Duration
 * @property {string} text The duration string of the directions.
 * @property {number} value The duration in seconds of the directions.
 *
 * @typedef {Object} GoogleDirectionsStep
 * @property {Distance} distance The distance of the step.
 * @property {Coordinates} end_location The coordinates of the destination.
 * @property {string} html_instructions The instructions of the step.
 * @property {Object} polyline
 * @property {string} polyline.points The polyline points of the steps.
 * @property {Coordinates} start_location The coordinates of the origin.
 * @property {"DRIVING"|"BYCICLING"|"TRANSIT"|"WALKING"} travel_mode The travel mode of the step
 *
 * @typedef {Object} GoogleFormattedDirections
 * @property {"walk"|"board"|"transfer"|"drive"|"bike"} type Type of the directions.
 * @property {Place} from The metadata of the origin.
 * @property {Place} to The metadata of the destination.
 * @property {Object} schedule The schedule of the directions.
 * @property {string} schedule.departing_at The departing time in ISO string.
 * @property {string} schedule.arriving_at The arriving time in ISO string.
 * @property {number} schedule.duration The duration in seconds of the directions.
 * @property {Object} route The metadata of the directions.
 * @property {Object} route.overview_polyline
 * @property {string} route.overview_polyline.points The polyline of the directions.
 * @property {string} route.summary The summary string of the directions.
 * @property {string} route.warnings The warnings for the directions.
 * @property {Distance} route.distance
 * @property {string} route.copyrights Google's copyrights string.
 * @property {GoogleDirectionsStep[]} route.steps The steps of the directions.
 *
 * @param {Object} origin The origin of the direction. It should either be a Google's place ID or a coordinates.
 * @param {"place_id"|"coordinates"} origin.type Type of the origin.
 * @param {Coordinates} [origin.coordinates] If the type is `coordinates`, `origin.coordinates` must be specified. If the type is not `coordinates`, this field is omitted.
 * @param {string} [origin.place_id] If the type is `place_id`, this field must be specified. If the type is not `place_id`, this field is omitted.
 *
 * @param {Object} destination The origin of the direction. It should either be a Google's place ID or a coordinates.
 * @param {"place_id"|"coordinates"} destination.type Type of the origin.
 * @param {Coordinates} [destination.coordinates] If the type is `coordinates`, `origin.coordinates` must be specified. If the type is not `coordinates`, this field is omitted.
 * @param {string} [destination.place_id] If the type is `place_id`, this field must be specified. If the type is not `place_id`, this field is omitted.
 *
 * @param {"walking"|"driving"|"bycicling"|"transit"} [mode] Choose travel mode for the directions. Defaults to `walking`
 * @param {"metric"|"imperial"} [units] Choose units for the directions. Defaults to `metric`.
 * @param {string} [departure_time] Departure time of the directions. Can either be `now` or string of UNIX time in second. Defaults to `now`.
 *
 * @returns {GoogleFormattedDirections}
 */
exports.getDirectionsFromGoogle = async function (
    origin,
    destination,
    mode,
    units,
    departure_time,
) {
    if (!process.env.GOOGLE_MAPS_API_KEY) {
        logger.error("At getDirectionsFromGoogle: No Google Maps API key is specified.");
        return;
    }

    if (!origin || !destination || !origin.type || !destination.type) {
        logger.error("At getDirectionsFromGoogle: Incorrect origin or destination format.");
        return;
    }

    const ORIGIN = checkFormat(origin),
        DESTINATION = checkFormat(destination);

    console.log(origin, destination);

    if (!ORIGIN || !DESTINATION) return;

    if (!mode) mode = "walking";
    if (mode !== "walking" && mode !== "driving" && mode !== "bycicling" && mode !== "transit")
        mode = "walking";

    if (!units) units = "metric";
    if (units !== "metric" && units !== "imperial") units = "metric";

    if (!departure_time) departure_time = "now";
    if (departure_time !== "now")
        if (dayjs(departure_time).isValid()) departure_time = dayjs(departure_time).unix();
        else departure_time = "now";

    let data = await axios.get(
        `https://maps.googleapis.com/maps/api/directions/json?destination=${DESTINATION}&origin=${ORIGIN}&mode=${mode}&units=${units}&departure_time=${departure_time}&language=en&key=${process.env.GOOGLE_MAPS_API_KEY}`,
    );

    let directions = data.data;
    let response = {};

    // FORMAT RETURNED RESPONSE
    if (mode === "walking") response.type = "walk";
    else if (mode === "driving") response.type = "drive";
    else if (mode === "bycicling") response.type = "bike";
    else if (mode === "transit") response.type = "board";
    else response.type = "walk";

    if (directions.routes[0].legs[0]) {
        response.from = {
            place: {
                address: directions.routes[0].legs[0].start_address,
                place_id:
                    directions.geocoded_waypoints[0].geocoder_status === "OK"
                        ? directions.geocoded_waypoints[0].place_id
                        : "",
            },
            coordinates: directions.routes[0].legs[0].start_location,
        };

        response.to = {
            place: {
                address: directions.routes[0].legs[0].end_address,
                place_id:
                    directions.geocoded_waypoints[1].geocoder_status === "OK"
                        ? directions.geocoded_waypoints[1].place_id
                        : "",
            },
            coordinates: directions.routes[0].legs[0].end_location,
        };

        let now = dayjs();

        response.schedule = {
            departing_at: departure_time === "now" ? now.format() : dayjs(departure_time).format(),
            arriving_at:
                departure_time === "now"
                    ? now.add(directions.routes[0].legs[0].duration.value, "second").format()
                    : dayjs(departure_time)
                          .add(directions.routes[0].legs[0].duration.value, "second")
                          .format(),
            duration: directions.routes[0].legs[0].duration.value,
        };

        response.route = {
            overview_polyline: directions.routes[0].overview_polyline,
            summary: directions.routes[0].summary,
            warnings: directions.routes[0].warnings,
            distance: directions.routes[0].legs[0].distance,
            steps: directions.routes[0].legs[0].steps,
            copyrights: directions.routes[0].copyrights,
        };
    } else {
        logger.error(
            `At getDirectionsFromGoogle: Couldn't find ${mode} routes[0] from ${ORIGIN} to ${DESTINATION}.`,
        );
    }

    return response;
};

function checkFormat(object) {
    if (object.type === "coordinates") {
        if (!object.coordinates) {
            logger.error(
                "At getDirectionsFromGoogle: Incorrect origin or destination format. Type specified as coordinates but no coordinates is supplied.",
            );
            return;
        } else {
            if (!object.coordinates.lat || !object.coordinates.lng) {
                logger.error(
                    "At getDirectionsFromGoogle: Incorrect origin or destination format. Type specified as coordinates but no latitude or longitude are supplied.",
                );
                return;
            }
        }

        return `${object.coordinates.lat},${object.coordinates.lng}`;
    } else if (object.type === "place_id") {
        if (!object.place_id) {
            logger.error(
                "At getDirectionsFromGoogle: Incorrect origin or destination format. Type specified as place_id but no place ID is supplied.",
            );
            return;
        }

        return `place_id:${object.place_id}`;
    }
}
