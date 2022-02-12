const sequelize = require("../../db/database");
const { QueryTypes } = require("sequelize");
const dayjs = require("dayjs");
const { logger } = require("../../configs/config");
const APIStatus = require("../../configs/api-errors");

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

    const options = (req.query.options || "").split(",") || [];

    let ignoreOrigin = false;
    let ignoreDestination = false;
    let ignoreLine = false;

    for (option of options) {
        if (option === "line") {
            ignoreLine = true;
        } else if (option === "origin") {
            ignoreOrigin = true;
        } else if (option === "destination") {
            ignoreDestination = true;
        }
    }

    let tripDetails = [];

    let now = dayjs();
    let todaysDay = now.day();
    let timeNowString = now.format("HH:mm:ss");

    try {
        tripDetails = await sequelize.query(
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
                head.stop_id as head_stop_id
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
                        ? `inner join (select stop_name, stop_code, stop_lat, stop_lon from stops where stop_id='${originId}') as current_stop`
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
    } catch (error) {
        logger.error(error);
        return res.send(error).status(APIStatus.INTERNAL.SERVER_ERROR.status);
    }

    if (tripDetails.length === 0)
        return res
            .status(APIStatus.OK.status)
            .send({ status: APIStatus.OK, data: "That trip is not available right now :(" });

    tripDetails = tripDetails.splice(0, 1);
    let formattedTripDetails = {};

    console.log(tripDetails);

    const headStopId = tripDetails[0].head_stop_id;

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
        formattedTripDetails.origin = {
            sequence: tripDetails[0].origin_stop_sequence,
            id: tripDetails[0].origin_stop_id,
            name: {
                en: tripDetails[0].origin_stop_name_en,
                th: tripDetails[0].origin_stop_name_th,
            },
            code: tripDetails[0].origin_stop_code,
            coordinates: {
                lat: tripDetails[0].origin_stop_lat,
                lng: tripDetails[0].origin_stop_lon,
            },
        };
    }

    if (!ignoreDestination) {
        formattedTripDetails.destination = {
            sequence: tripDetails[0].destination_stop_sequence,
            id: tripDetails[0].destination_stop_id,
            name: {
                en: tripDetails[0].destination_stop_name_en,
                th: tripDetails[0].destination_stop_name_th,
            },
            code: tripDetails[0].destination_stop_code,
            coordinates: {
                lat: tripDetails[0].destination_stop_lat,
                lng: tripDetails[0].destination_stop_lon,
            },
        };
    }

    formattedTripDetails.previous = [];

    try {
        for (
            let i = 0, originSequence = formattedTripDetails.origin.sequence - 1;
            i < MAX_DEPARTED_STATIONS && originSequence >= 1;
            i++, originSequence--
        ) {
            let previousStation = [];

            previousStation = await sequelize.query(
                `
                select current.stop_sequence as stop_sequence, current_stops.stop_id as stop_id, current_stops.stop_code as stop_code, current_stops.stop_name as stop_name_en, translations.translation as stop_name_th, current_stops.stop_lat, current_stops.stop_lon,
                    sec_to_time((headway_secs * ceiling((time_to_sec(time('${timeNowString}')) - (time_to_sec(time(current.departure_time)) - time_to_sec(time(head.departure_time))) - time_to_sec(time(start_time))) / headway_secs)) - ( - (time_to_sec(time(current.departure_time)) - time_to_sec(time(head.arrival_time))) - time_to_sec(time(start_time)))) as time,
                    current.timepoint
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

            if (previousStation.length === 0) continue;

            previousStation = previousStation.splice(0, 1);

            formattedTripDetails.previous = [
                ...formattedTripDetails.previous,
                {
                    sequence: previousStation[0].stop_sequence,
                    id: previousStation[0].stop_id,
                    code: previousStation[0].stop_code,
                    name: {
                        en: previousStation[0].stop_name_en,
                        th: previousStation[0].stop_name_th,
                    },
                    coordinates: {
                        lat: previousStation[0].stop_lat,
                        lng: previousStation[0].stop_lon,
                    },
                    time: previousStation[0].time,
                    approximate_time: previousStation[0].timepoint === "0",
                },
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

        nextStations = await sequelize.query(
            `
            select current.stop_sequence as stop_sequence, current_stops.stop_id as stop_id, current_stops.stop_code as stop_code, current_stops.stop_name as stop_name_en, translations.translation as stop_name_th, current_stops.stop_lat, current_stops.stop_lon,
                sec_to_time((headway_secs * ceiling((time_to_sec(time('${timeNowString}')) - (time_to_sec(time(current.departure_time)) - time_to_sec(time(head.departure_time))) - time_to_sec(time(start_time))) / headway_secs)) - ( - (time_to_sec(time(current.departure_time)) - time_to_sec(time(head.arrival_time))) - time_to_sec(time(start_time)))) as time,
                current.timepoint
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

        for (station of nextStations) {
            formattedTripDetails.next = [
                ...formattedTripDetails.next,
                {
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
                    time: station.time,
                    approximate_time: station.timepoint === "0",
                },
            ];
        }
    } catch (error) {
        logger.error(error);
        return res.send(error).status(APIStatus.INTERNAL.SERVER_ERROR.status);
    }

    return res.status(APIStatus.OK.status).send({ data: formattedTripDetails });
};