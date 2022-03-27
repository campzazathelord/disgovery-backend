const { QueryTypes } = require("sequelize");
const sequelize = require("../db/database");
const fs = require("fs");

exports.getAdjacency = async function () {
    const adjacencyListMatrix = {};
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

    const allTransfers = await sequelize.query(`SELECT * FROM transfers;`, {
        type: QueryTypes.SELECT,
    });

    for (let station of allStations) {
        adjacencyListMatrix[station.stop_id] = [];

        for (let i = 0; i < allStations.length; i++) {
            if (allStations[i].stop_id !== station.stop_id) continue;

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
                adjacencyListMatrix[station.stop_id] = [
                    ...adjacencyListMatrix[station.stop_id],
                    {
                        node: allStations[i - 1].stop_id,
                        weight: allStations[i].timeFromPrevStopSeqInSec,
                    },
                ];

                if (i !== allStations.length - 1) {
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

                break;
            }
        }
    }

    for (let transfer of allTransfers) {
        if (!Object.keys(adjacencyListMatrix).includes(transfer.from_stop_id)) continue;

        adjacencyListMatrix[transfer.from_stop_id] = [
            ...adjacencyListMatrix[transfer.from_stop_id],
            {
                node: transfer.to_stop_id,
                weight: transfer.min_transfer_time,
            },
        ];
    }

    fs.writeFileSync("./src/db/adjacency-matrix.json", JSON.stringify(adjacencyListMatrix));
};
