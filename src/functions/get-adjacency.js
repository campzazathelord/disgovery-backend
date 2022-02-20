const { QueryTypes } = require("sequelize");
const sequelize = require("../db/database");
const fs = require("fs");

exports.getAdjacency = async function () {
    // const adjacencyListMatrix = {};
    // const kuy1 = performance.now()
    // const allStations = await sequelize.query(
    //     `
    //     SELECT route_id, trip_id ,stop_id , (timeInSec - prevTimeInSec) AS timeFromPrevStopSeqInSec, stop_sequence
    //     FROM    (SELECT route_id, stop_times.trip_id AS trip_id, stop_id, TIME_TO_SEC(arrival_time) AS timeInSec,
    //                 LAG(TIME_TO_SEC(arrival_time)) OVER (PARTITION BY route_id ORDER BY stop_sequence) AS prevTimeInSec , stop_sequence
    //             FROM (  SELECT trip_id, route_id, maxStopSequence
    //                     FROM (  SELECT trips.trip_id, route_id , maxStopSequence, ROW_NUMBER() over (PARTITION BY route_id ORDER BY maxStopSequence DESC ) AS rowNumber
    //                             FROM (  SELECT trip_id, MAX(stop_sequence) AS maxStopSequence
    //                                     FROM stop_times
    //                                     GROUP BY trip_id) AS trip_id_maxstopseq
    //                             INNER JOIN trips
    //                             ON trips.trip_id = trip_id_maxstopseq.trip_id) AS trips_route_maxstopseq
    //                     WHERE rowNumber = 1) AS trip_route_maxstopseq
    //             INNER JOIN stop_times
    //             ON trip_route_maxstopseq.trip_id = stop_times.trip_id) AS all_stops_with_time
    //     ORDER BY trip_id,stop_sequence;
    //     `,
    //     {
    //         type: QueryTypes.SELECT,
    //     },
    // );

    // const allTransfers = await sequelize.query(`SELECT * FROM transfers;`, {
    //     type: QueryTypes.SELECT,
    // });

    // for (let station of allStations) {
    //     adjacencyListMatrix[station.stop_id] = [];

    //     for (let i = 0; i < allStations.length; i++) {
    //         if (allStations[i].stop_id !== station.stop_id) continue;

    //         if (allStations[i].timeFromPrevStopSeqInSec === null) {
    //             adjacencyListMatrix[station.stop_id] = [
    //                 ...adjacencyListMatrix[station.stop_id],
    //                 {
    //                     node: allStations[i + 1].stop_id,
    //                     weight: allStations[i + 1].timeFromPrevStopSeqInSec,
    //                 },
    //             ];

    //             break;
    //         } else {
    //             adjacencyListMatrix[station.stop_id] = [
    //                 ...adjacencyListMatrix[station.stop_id],
    //                 {
    //                     node: allStations[i - 1].stop_id,
    //                     weight: allStations[i].timeFromPrevStopSeqInSec,
    //                 },
    //             ];

    //             if (i !== allStations.length - 1) {
    //                 if (allStations[i].trip_id === allStations[i + 1].trip_id) {
    //                     adjacencyListMatrix[station.stop_id] = [
    //                         ...adjacencyListMatrix[station.stop_id],
    //                         {
    //                             node: allStations[i + 1].stop_id,
    //                             weight: station.timeFromPrevStopSeqInSec,
    //                         },
    //                     ];
    //                 }
    //             }

    //             break;
    //         }
    //     }
    // }

    // for (let transfer of allTransfers){
    //     if (!Object.keys(adjacencyListMatrix).includes(transfer.from_stop_id)) continue;

    //     adjacencyListMatrix[transfer.from_stop_id] = [
    //         ...adjacencyListMatrix[transfer.from_stop_id],
    //         {
    //             node: transfer.to_stop_id,
    //             weight: transfer.min_transfer_time * 60
    //         },
    //     ]
    // }

    // const kuy2 = performance.now()
    // console.log(kuy2 - kuy1)
    // fs.writeFileSync('adjacentMatrix.json',JSON.stringify(adjacencyListMatrix));

    let rawdata = fs.readFileSync("adjacentMatrix.json");
    let data = JSON.parse(rawdata);
    class Node {
        constructor(val, priority) {
            this.val = val;
            this.priority = priority;
        }
    }
    class PriorityQueue {
        constructor() {
            this.values = [];
        }
        enqueue(val, priority) {
            let newNode = new Node(val, priority);
            this.values.push(newNode);
            this.bubbleUp();
        }
        bubbleUp() {
            let idx = this.values.length - 1;
            const element = this.values[idx];
            while (idx > 0) {
                let parentIdx = Math.floor((idx - 1) / 2);
                let parent = this.values[parentIdx];
                if (element.priority >= parent.priority) break;
                this.values[parentIdx] = element;
                this.values[idx] = parent;
                idx = parentIdx;
            }
        }
        dequeue() {
            const min = this.values[0];
            const end = this.values.pop();
            if (this.values.length > 0) {
                this.values[0] = end;
                this.sinkDown();
            }
            return min;
        }
        sinkDown() {
            let idx = 0;
            const length = this.values.length;
            const element = this.values[0];
            while (true) {
                let leftChildIdx = 2 * idx + 1;
                let rightChildIdx = 2 * idx + 2;
                let leftChild, rightChild;
                let swap = null;

                if (leftChildIdx < length) {
                    leftChild = this.values[leftChildIdx];
                    if (leftChild.priority < element.priority) {
                        swap = leftChildIdx;
                    }
                }
                if (rightChildIdx < length) {
                    rightChild = this.values[rightChildIdx];
                    if (
                        (swap === null && rightChild.priority < element.priority) ||
                        (swap !== null && rightChild.priority < leftChild.priority)
                    ) {
                        swap = rightChildIdx;
                    }
                }
                if (swap === null) break;
                this.values[idx] = this.values[swap];
                this.values[swap] = element;
                idx = swap;
            }
        }
    }
    class WeightedGraph {
        constructor() {
            this.adjacencyList = data;
        }
        addVertex(vertex) {
            if (!this.adjacencyList[vertex]) this.adjacencyList[vertex] = [];
        }
        addEdge(vertex1, vertex2, weight) {
            this.adjacencyList[vertex1].push({ node: vertex2, weight });
            this.adjacencyList[vertex2].push({ node: vertex1, weight });
        }
        Dijkstra(start, finish) {
            const nodes = new PriorityQueue();
            const distances = {};
            const previous = {};
            let directions = [];
            let smallest;
            for (let vertex of Object.keys(this.adjacencyList)) {
                if (vertex === start) {
                    distances[vertex] = 0;
                    nodes.enqueue(vertex, 0);
                } else {
                    distances[vertex] = Infinity;
                    nodes.enqueue(vertex, Infinity);
                }
                previous[vertex] = null;
            }
            while (nodes.values.length !== 0) {
                smallest = nodes.dequeue().val;
                if (smallest == finish) {
                    directions.push({ ...previous, time: distances[finish] });
                    break;
                }
                if (smallest || distances[smallest] != Infinity) {
                    for (let nearNode of this.adjacencyList[smallest]) {
                        let nextNode = nearNode.node;
                        let nextNodeWeight = nearNode.weight;
                        if (nextNodeWeight + distances[smallest] < distances[nextNode]) {
                            distances[nextNode] = nextNodeWeight + distances[smallest];
                            previous[nextNode] = smallest;
                            let tmpPrevious = { ...previous };
                            if (tmpPrevious[finish]) {
                                directions.push({ ...tmpPrevious, time: distances[finish] });
                            }
                            nodes.enqueue(nextNode, nextNodeWeight + distances[smallest]);
                        }
                    }
                }
            }
            return { directions, finish };
        }
        dijkstraToArray(start, end) {
            let pathArrFinal = [];
            let { directions } = this.Dijkstra(start, end);
            for (let items of directions) {
                let tempend = end;
                let pathArr = new Set();
                while (items[tempend]) {
                    pathArr.add(items["time"]);
                    pathArr.add(tempend);
                    tempend = items[tempend];
                    pathArr.add(tempend);
                }
                pathArrFinal.push([...pathArr].reverse());
            }
            const uniquePairs = (pairs) =>
                [...new Set(pairs.map((pair) => JSON.stringify(pair)))].map((pair) =>
                    JSON.parse(pair),
                );

            return uniquePairs(pathArrFinal);
        }
    }
    var graph = new WeightedGraph();

    console.log(graph.dijkstraToArray("BTS_N8", "BTS_E4"));
};
