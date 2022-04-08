const { QueryTypes } = require("sequelize");
const sequelize = require("../db/database");
const fs = require("fs");
const { getAllTransfers } = require("./get-all-transfers");

const TRANSFER_PENALTY = 1000000;

exports.getAdjacency = async function () {
    let adjacencyListMatrix = {};
    const allStations = await sequelize.query(
        `
        SELECT route_id, trip_id ,stop_id , (timeInSec - prevTimeInSec) AS timeFromPrevStopSeqInSec, stop_sequence
        FROM    (SELECT route_id, stop_times.trip_id AS trip_id, stop_id, TIME_TO_SEC(arrival_time) AS timeInSec,
                    LAG(TIME_TO_SEC(arrival_time)) OVER (PARTITION BY route_id,trip_id ORDER BY stop_sequence) AS prevTimeInSec , stop_sequence
                FROM (  SELECT trip_id, route_id, maxStopSequence
                        FROM (  SELECT trips.trip_id, route_id , maxStopSequence, ROW_NUMBER() over (PARTITION BY route_id ORDER BY maxStopSequence DESC ) AS rowNumber
                                FROM (  SELECT trip_id, MAX(stop_sequence) AS maxStopSequence
                                        FROM stop_times
                                        GROUP BY trip_id) AS trip_id_maxstopseq
                                INNER JOIN trips
                                ON trips.trip_id = trip_id_maxstopseq.trip_id) AS trips_route_maxstopseq
                        WHERE rowNumber = 1 OR rowNumber = 2) AS trip_route_maxstopseq
                INNER JOIN stop_times
                ON trip_route_maxstopseq.trip_id = stop_times.trip_id
                ORDER BY trip_id,stop_sequence) AS all_stops_with_time
        ORDER BY trip_id,stop_sequence;
        `,
        {
            type: QueryTypes.SELECT,
        },
    );
    //console.log(allStations,"allStations")
    let allStationsObject = {};

    for (let station of allStations) {
        allStationsObject[station.stop_id] = station;
    }

    const allTransfers = await getAllTransfers();

    for (let station of allStations) {
        if (!adjacencyListMatrix[station.stop_id]) adjacencyListMatrix[station.stop_id] = [];

        for (let i = 0; i < allStations.length; i++) {
            if (
                allStations[i].stop_id !== station.stop_id ||
                allStations[i].trip_id !== station.trip_id
            )
                continue;

            if (allStations[i].timeFromPrevStopSeqInSec === null) {
                adjacencyListMatrix[station.stop_id] = [
                    ...adjacencyListMatrix[station.stop_id],
                    {
                        node: allStations[i + 1].stop_id,
                        weight: allStations[i + 1].timeFromPrevStopSeqInSec,
                    },
                ];

                break;
            } else {
                let previousIsRepeated = false;

                for (let matrix of adjacencyListMatrix[station.stop_id]) {
                    if (allStations[i - 1].stop_id === matrix.node) previousIsRepeated = true;
                }

                // if (!previousIsRepeated)
                //     adjacencyListMatrix[station.stop_id] = [
                //         ...adjacencyListMatrix[station.stop_id],
                //         {
                //             node: allStations[i - 1].stop_id,
                //             weight: allStations[i].timeFromPrevStopSeqInSec,
                //         },
                //     ];

                if (i !== allStations.length - 1) {
                    let nextIsRepeated = false;

                    for (let matrix of adjacencyListMatrix[station.stop_id]) {
                        if (allStations[i + 1].stop_id === matrix.node) nextIsRepeated = true;
                    }

                    if (!nextIsRepeated) {
                        if (allStations[i].trip_id === allStations[i + 1].trip_id) {
                            adjacencyListMatrix[station.stop_id] = [
                                ...adjacencyListMatrix[station.stop_id],
                                {
                                    node: allStations[i + 1].stop_id,
                                    weight: station.timeFromPrevStopSeqInSec,
                                },
                            ];
                        }
                    }
                }

                break;
            }
        }
    }

    Object.keys(allTransfers).map((key) => {
        if (Object.keys(adjacencyListMatrix).includes(allTransfers[key].from_stop_id)) {
            adjacencyListMatrix[allTransfers[key].from_stop_id] = [
                ...adjacencyListMatrix[allTransfers[key].from_stop_id],
                {
                    node: allTransfers[key].to_stop_id,
                    weight:
                        allTransfers[key].min_transfer_time +
                        (allStationsObject[allTransfers[key].from_stop_id].route_id !==
                        allStationsObject[allTransfers[key].to_stop_id].route_id
                            ? 0
                            : TRANSFER_PENALTY),
                },
            ];
        }
    });

    fs.writeFileSync("./src/db/adjacency-matrix.json", JSON.stringify(adjacencyListMatrix));
};
