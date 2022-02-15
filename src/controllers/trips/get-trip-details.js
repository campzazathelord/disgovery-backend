const sequelize = require("../../db/database");
const { QueryTypes } = require("sequelize");
const dayjs = require("dayjs");
const { logger } = require("../../configs/config");
const APIStatus = require("../../configs/api-errors");
const { getGTFSFormattedCurrentTime } = require("../../functions/get-gtfs-formatted-current-time");
const Stop = require("../../models/Stop");

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MAX_DEPARTED_STATIONS = 5;

exports.getTripDetails = async function (req, res) {
    logger.info(`${req.method} ${req.baseUrl + req.path}`);

    if (!req.params.id || !req.query.origin)
        return res
            .send({
                status: APIStatus.BAD_REQUEST.status,
                message: "Trip ID and station of origin is required.",
            })
            .status(APIStatus.BAD_REQUEST.status);

    const tripId = req.params.id;
    const originId = req.query.origin;
    const forceMode = req.query.force ? req.query.force === "true" : false || false;

    let now = dayjs();
    let todaysDay = WEEKDAYS[now.day()];

    if (!forceMode)
        if (!(await isTripAvailable(tripId, todaysDay)))
            return res
                .status(APIStatus.OK.status)
                .send({ status: APIStatus.OK, data: `The trip ${tripId} is not available today.` });

    const ignore = (req.query.ignore || "").split(",") || [];

    let ignoreOrigin = false;
    let ignoreDestination = false;
    let ignoreLine = false;

    for (option of ignore) {
        if (option === "line") {
            ignoreLine = true;
        } else if (option === "origin") {
            ignoreOrigin = true;
        } else if (option === "destination") {
            ignoreDestination = true;
        }
    }

    let tripDetails = [];
    let timeNowString = await getGTFSFormattedCurrentTime(now);
    let maxTime = (await fetchMaxTime()) || [];

    try {
        tripDetails = await findTripDetails(
            tripId,
            originId,
            timeNowString,
            ignoreOrigin,
            ignoreDestination,
            ignoreLine,
        );
    } catch (error) {
        logger.error(error);
        return res.send(error).status(APIStatus.INTERNAL.SERVER_ERROR.status);
    }

    if (tripDetails.length === 0)
        return res.status(APIStatus.OK.status).send({
            status: APIStatus.OK,
            data: `The trip ${tripId} is not available right now. This might be because the trip you queried doesn't contain the origin you specified, or because the trip is not in service at the moment.`,
        });

    tripDetails = tripDetails.splice(0, 1);

    let originParent, destinationParent;

    if (tripDetails[0].origin_parent_stop_id) {
        originParent = await findParent(tripDetails[0].origin_parent_stop_id);
    }

    if (tripDetails[0].destination_parent_stop_id) {
        destinationParent = await findParent(tripDetails[0].destination_parent_stop_id);
    }

    let formattedTripDetails = {};

    const headStopId = tripDetails[0].head_stop_id;
    const originDepartureTime = tripDetails[0].origin_departure_time;

    if (forceMode) formattedTripDetails.force = forceMode;

    formattedTripDetails.meta = {
        trip_id: tripDetails[0].trip_id,
        arriving_in: tripDetails[0].arriving_in,
        headway: {
            from: tripDetails[0].headway_starts,
            to: tripDetails[0].headway_ends,
            headway_secs: tripDetails[0].headway_secs,
        },
    };

    if (!ignoreLine)
        formattedTripDetails.meta.line = {
            name: {
                short_name: tripDetails[0].route_short_name,
                long_name: tripDetails[0].route_long_name,
            },
            color: tripDetails[0].route_color,
        };

    if (!ignoreOrigin) {
        formattedTripDetails.origin = setOriginOrDestination(
            originParent,
            tripDetails[0],
            "origin",
        );
    }

    if (!ignoreDestination) {
        formattedTripDetails.destination = setOriginOrDestination(
            destinationParent,
            tripDetails[0],
            "destination",
        );
    }

    formattedTripDetails.previous = [];

    try {
        for (
            let i = 0, originSequence = formattedTripDetails.origin.sequence - 1;
            i < MAX_DEPARTED_STATIONS && originSequence >= 1;
            i++, originSequence--
        ) {
            let previousStation = [];

            formattedTripDetails.previous = [
                ...formattedTripDetails.previous,
                await findOnePreviousStation(
                    timeNowString,
                    originDepartureTime,
                    originSequence,
                    tripId,
                    headStopId,
                    maxTime,
                ),
            ];
        }
    } catch (error) {
        logger.error(error);
        return res.send(error).status(APIStatus.INTERNAL.SERVER_ERROR.status);
    }

    formattedTripDetails.previous = formattedTripDetails.previous.sort(function (a, b) {
        return a.sequence - b.sequence;
    });

    formattedTripDetails.next = [];

    try {
        let nextStations = [];
        let originSequence = formattedTripDetails.origin.sequence;

        formattedTripDetails.next = await findAllNextStations(
            originDepartureTime,
            originSequence,
            timeNowString,
            tripId,
            headStopId,
            maxTime,
        );
    } catch (error) {
        logger.error(error);
        return res.send(error).status(APIStatus.INTERNAL.SERVER_ERROR.status);
    }

    return res.status(APIStatus.OK.status).send({ data: formattedTripDetails });
};

async function fetchMaxTime() {
    return await sequelize.query(`select max(time(departure_time)) as max_time from stop_times`, {
        type: QueryTypes.SELECT,
        maxResult: 1,
    });
}

async function parseTime(input, maxTime) {
    let splittedTime = {
        hours: 0,
        minutes: 0,
        seconds: 0,
    };

    try {
        const time = input.split(":");
        splittedTime = {
            hours: parseInt(time[0]),
            minutes: parseInt(time[1]),
            seconds: parseInt(time[2]),
        };
    } catch (error) {
        return "INVALID TIME: INPUT IS NOT FORMATTED AS HH:mm:ss";
    }

    let date = dayjs().set("hour", 0).set("minute", 0).set("second", 0);
    if (splittedTime.hours >= 24) {
        if (!maxTime)
            try {
                maxTime = (await fetchMaxTime()) || [];
            } catch (error) {
                return `${error}`;
            }

        if (maxTime.length === 0) {
            const splittedMaxTime = {
                hours: 48,
                minutes: 0,
                seconds: 0,
            };
        } else {
            try {
                const mts = maxTime[0].max_time.split(":");

                const splittedMaxTime = {
                    hours: parseInt(mts[0]),
                    minutes: parseInt(mts[1]),
                    seconds: parseInt(mts[2]),
                };
            } catch (error) {
                return "INVALID MAX TIME";
            }
        }

        if (
            splittedTime.hours > splittedMaxTime.hours ||
            (splittedTime.minutes > splittedMaxTime.minutes &&
                splittedTime.hours === splittedMaxTime.hours) ||
            (splittedTime.seconds > splittedMaxTime.seconds &&
                splittedTime.minutes === splittedMaxTime.minutes &&
                splittedTime.hours === splittedMaxTime.hours)
        ) {
            return "INVALID TIME";
        }
        splittedTime.hours = splittedTime.hours - 24;
    }

    return date
        .add(splittedTime.hours, "hour")
        .add(splittedTime.minutes, "minute")
        .add(splittedTime.seconds, "second")
        .format();
}

async function isTripAvailable(tripId, dayName) {
    let tripAvailability = [];

    try {
        tripAvailability = await sequelize.query(
            `select ${dayName} from calendar natural join (select service_id from trips where trip_id='${tripId}') as trips`,
            { type: QueryTypes.SELECT, maxResult: 1 },
        );
    } catch (error) {
        logger.error(error);
        logger.error(
            `Unable to fetch trip availability right now with an error: ${error}. Neglecting trip availibility.`,
        );
        return true;
    }

    if (tripAvailability.length === 0 || !tripAvailability[0][dayName]) {
        logger.error("Unable to fetch trip availability right now. Neglecting trip availibility.");
        return true;
    }

    return tripAvailability[0][dayName] === "1";
}

async function findParent(stopId) {
    let parent = [];

    try {
        parent = await sequelize.query(
            `
            select * from (select stop_id, stop_name as stop_name_en, stop_code, stop_lat, stop_lon from stops where stop_id='${stopId}') stops
                inner join (select translation as stop_name_th from translations where table_name='stops' and field_name='stop_name' and record_id='${stopId}') translation
        `,
            {
                type: QueryTypes.SELECT,
                maxResult: 1,
            },
        );

        if (parent.length !== 0) return parent[0];
        else {
            logger.error(`Cannot find the parent with stop_id ${stopId}.`);
            return;
        }
    } catch (error) {
        logger.error(error);
        return;
    }
}

function setOriginOrDestination(parent, stop, mode) {
    if (mode !== "origin" && mode !== "destination") {
        logger.error("mode should be origin or destination");
        return;
    }

    if (parent) {
        return {
            sequence: stop[`${mode}_stop_sequence`],
            id: parent.stop_id,
            name: {
                en: parent.stop_name_en,
                th: parent.stop_name_th,
            },
            code: parent.stop_code,
            platform: {
                id: stop[`${mode}_stop_id`],
                name: {
                    en: stop[`${mode}_stop_name_en`],
                    th: stop[`${mode}_stop_name_th`],
                },
                code: stop[`${mode}_stop_code`],
                coordinates: {
                    lat: stop[`${mode}_stop_lat`],
                    lng: stop[`${mode}_stop_lon`],
                },
            },
            coordinates: {
                lat: parent.stop_lat,
                lng: parent.stop_lon,
            },
        };
    } else {
        return {
            sequence: stop[`${mode}_stop_sequence`],
            id: stop[`${mode}_stop_id`],
            name: {
                en: stop[`${mode}_stop_name_en`],
                th: stop[`${mode}_stop_name_th`],
            },
            code: stop[`${mode}_stop_code`],
            coordinates: {
                lat: stop[`${mode}_stop_lat`],
                lng: stop[`${mode}_stop_lon`],
            },
        };
    }
}

async function findTripDetails(
    tripId,
    originId,
    timeNowString,
    ignoreOrigin,
    ignoreDestination,
    ignoreLine,
) {
    return await sequelize.query(
        `select distinct trips.trip_id, ${
            !ignoreLine
                ? `routes.route_long_name, routes.route_short_name, routes.route_color,`
                : ""
        } (headway_secs * ceiling((time_to_sec(time('${timeNowString}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) - time_to_sec(time(start_time))) / headway_secs)) - (time_to_sec(time('${timeNowString}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) - time_to_sec(time(start_time))) as arriving_in,
            frequencies.headway_secs, ${
                !ignoreOrigin
                    ? `current.stop_sequence as origin_stop_sequence, current.stop_id as origin_stop_id, current_stop.stop_name as origin_stop_name_en, current_translation.translation as origin_stop_name_th, current_stop.stop_code as origin_stop_code, current_stop.stop_lat as origin_stop_lat, current_stop.stop_lon as origin_stop_lon,`
                    : ""
            }
            ${
                !ignoreDestination
                    ? `destination.stop_sequence as destination_stop_sequence, destination.stop_id as destination_stop_id, destination_stop.stop_name as destination_stop_name_en, destination_translation.translation as destination_stop_name_th, destination_stop.stop_code as destination_stop_code, destination_stop.stop_lat as destination_stop_lat, destination_stop.stop_lon as destination_stop_lon,`
                    : ""
            }
            frequencies.start_time as headway_starts, sec_to_time(time_to_sec(time(frequencies.end_time)) + frequencies.headway_secs) as headway_ends,
            head.stop_id as head_stop_id, current.departure_time as origin_departure_time, current_stop.parent_station as origin_parent_stop_id, destination_stop.parent_station as destination_parent_stop_id
            from (select trip_id, route_id from trips where trips.trip_id='${tripId}') trips
            natural join stop_times current
            inner join stop_times head on head.stop_sequence=1 and current.trip_id=head.trip_id and current.stop_id='${originId}'
            ${!ignoreLine ? `inner join routes on trips.route_id = routes.route_id` : ""}
            ${
                !ignoreDestination
                    ? `inner join (select trip_id, stop_id, stop_sequence, max(stop_sequence) as max_sequence from stop_times group by trip_id) as destination_sequence on current.trip_id=destination_sequence.trip_id`
                    : ""
            }
            ${
                !ignoreOrigin
                    ? `inner join (select stop_name, stop_code, stop_lat, stop_lon, parent_station from stops where stop_id='${originId}') as current_stop`
                    : ""
            }
            ${
                !ignoreDestination
                    ? `inner join stop_times destination on destination_sequence.max_sequence=destination.stop_sequence and current.trip_id=destination.trip_id`
                    : ""
            }
            ${
                !ignoreDestination
                    ? `inner join stops destination_stop on destination.stop_id = destination_stop.stop_id`
                    : ""
            }
            inner join frequencies on frequencies.trip_id=current.trip_id and time_to_sec(time('${timeNowString}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) < time_to_sec(time(frequencies.end_time)) + frequencies.headway_secs and time_to_sec(time('${timeNowString}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) >= time_to_sec(time(frequencies.start_time))
            ${
                !ignoreOrigin
                    ? `inner join translations current_translation on current.stop_id=current_translation.record_id and current_translation.field_name='stop_name' and current_translation.table_name='stops'`
                    : ""
            }
            ${
                !ignoreDestination
                    ? `inner join translations destination_translation on destination.stop_id=destination_translation.record_id and destination_translation.field_name='stop_name' and destination_translation.table_name='stops'`
                    : ""
            }`,
        {
            type: QueryTypes.SELECT,
            maxResult: 1,
        },
    );
}

async function findOnePreviousStation(
    timeNowString,
    originDepartureTime,
    originSequence,
    tripId,
    headStopId,
    maxTime,
) {
    let queriedPreviousStation = await sequelize.query(
        `
        select current.stop_sequence as stop_sequence, current_stops.stop_id as stop_id, current_stops.stop_code as stop_code, current_stops.stop_name as stop_name_en, translations.translation as stop_name_th, current_stops.stop_lat, current_stops.stop_lon,
            sec_to_time((time_to_sec(time(current.departure_time)) - (time_to_sec(time('${originDepartureTime}')))) + time_to_sec(time('${timeNowString}')) + 196) as time,
            current.timepoint, current_stops.parent_station
            from (select * from stop_times where stop_sequence='${originSequence}' and trip_id='${tripId}') as current
            natural join stops current_stops
            natural join trips
            inner join translations on current.stop_id=translations.record_id and translations.field_name='stop_name' and translations.table_name='stops'
            inner join (select * from stop_times where stop_id='${headStopId}') as head on head.trip_id=current.trip_id
            inner join frequencies on frequencies.trip_id=current.trip_id and time_to_sec(time('${timeNowString}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) < time_to_sec(time(frequencies.end_time)) + frequencies.headway_secs and time_to_sec(time('${timeNowString}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) >= time_to_sec(time(frequencies.start_time))
    `,
        {
            type: QueryTypes.SELECT,
            maxResult: 1,
        },
    );

    if (queriedPreviousStation.length === 0) return;

    let parent;

    if (queriedPreviousStation[0].parent_station) {
        parent = await findParent(queriedPreviousStation[0].parent_station);
    }

    return await formatParent(queriedPreviousStation[0], parent, maxTime);
}

async function findAllNextStations(
    originDepartureTime,
    originSequence,
    timeNowString,
    tripId,
    headStopId,
    maxTime,
) {
    let formattedNextStations = [];
    let nextStations = [];
    nextStations = await sequelize.query(
        `
        select current.stop_sequence as stop_sequence, current_stops.stop_id as stop_id, current_stops.stop_code as stop_code, current_stops.stop_name as stop_name_en, translations.translation as stop_name_th, current_stops.stop_lat, current_stops.stop_lon,
            sec_to_time((time_to_sec(time(current.departure_time)) - (time_to_sec(time('${originDepartureTime}')))) + time_to_sec(time('${timeNowString}')) + 196) as time,
            current.timepoint, current_stops.parent_station
            from (select * from stop_times where stop_sequence>='${originSequence}' and trip_id='${tripId}') as current
            natural join stops current_stops
            natural join trips
            inner join translations on current.stop_id=translations.record_id and translations.field_name='stop_name' and translations.table_name='stops'
            inner join (select * from stop_times where stop_id='${headStopId}') as head on head.trip_id=current.trip_id
            inner join frequencies on frequencies.trip_id=current.trip_id and time_to_sec(time('${timeNowString}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) < time_to_sec(time(frequencies.end_time)) + frequencies.headway_secs and time_to_sec(time('${timeNowString}')) - (time_to_sec(time(current.arrival_time)) - time_to_sec(time(head.arrival_time))) >= time_to_sec(time(frequencies.start_time))
            order by current.stop_sequence
        `,
        {
            type: QueryTypes.SELECT,
        },
    );

    if (nextStations.length === 0) return [];

    for (station of nextStations) {
        let parent;

        if (station.parent_station) {
            parent = await findParent(station.parent_station);
        }

        formattedNextStations.push(await formatParent(station, parent, maxTime));

        console.log(formattedNextStations);
    }

    return formattedNextStations;
}

async function formatParent(station, parent, maxTime) {
    if (parent)
        return {
            sequence: station.stop_sequence,
            id: parent.stop_id,
            code: parent.stop_code,
            name: {
                en: parent.stop_name_en,
                th: parent.stop_name_th,
            },
            platform: {
                id: station.stop_id,
                code: station.stop_code,
                name: {
                    en: station.stop_name_en,
                    th: station.stop_name_th,
                },
                coordinates: {
                    lat: station.stop_lat,
                    lng: station.stop_lon,
                },
            },
            coordinates: {
                lat: parent.stop_lat,
                lng: parent.stop_lon,
            },
            time: await parseTime(station.time, maxTime),
            approximate_time: station.timepoint === "0",
        };
    else
        return {
            sequence: station.stop_sequence,
            id: station.stop_id,
            code: station.stop_code,
            name: {
                en: station.stop_name_en,
                th: station.stop_name_th,
            },
            coordinates: {
                lat: station.stop_lat,
                lng: station.stop_lon,
            },
            time: await parseTime(station.time, maxTime),
            approximate_time: station.timepoint === "0",
        };
}
