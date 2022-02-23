const fs = require("fs");
const { logger } = require("../configs/config");

const maxReturnArr = 6;

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

    DijkstraFastest(start, finish) {
        let finalResults = [];

        for (let i = 0; i < maxReturnArr; i++) {
            const nodes = new PriorityQueue();
            const distances = {};
            const previous = {};
            let path = [];
            let smallest;
            let tmpArr;
            for (let vertex in this.adjacencyList) {
                if (vertex === start) {
                    distances[vertex] = 0;
                    nodes.enqueue(vertex, 0);
                } else {
                    distances[vertex] = Infinity;
                }
                previous[vertex] = null;
            }
            while (nodes.values.length) {
                smallest = nodes.dequeue().val;
                if (smallest === finish) {
                    while (previous[smallest]) {
                        path.push(smallest);
                        smallest = previous[smallest];
                    }
                    break;
                }
                if (smallest || distances[smallest] !== Infinity) {
                    for (let neighbor in this.adjacencyList[smallest]) {
                        let nextNode = this.adjacencyList[smallest][neighbor];
                        let candidate = distances[smallest] + nextNode.weight;
                        let nextNeighbor = nextNode.node;
                        if (candidate < distances[nextNeighbor]) {
                            distances[nextNeighbor] = candidate;
                            previous[nextNeighbor] = smallest;
                            nodes.enqueue(nextNeighbor, candidate);
                        }
                    }
                }
            }
            let finalArr = path.concat(smallest).reverse();
            let tmpFinalArr = [...finalArr];
            tmpFinalArr.shift();
            tmpFinalArr.pop();
            for (let interChange of transferArr) {
                if (tmpFinalArr.includes(interChange)) {
                    delete this.adjacencyList[interChange];
                    break;
                }
            }
            tmpArr = [...finalArr, distances[finish]];
            if (tmpArr[tmpArr.length - 1] !== Infinity) {
                finalResults.push(tmpArr);
            }
        }

        return finalResults;
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

class Node {
    constructor(val, priority) {
        this.val = val;
        this.priority = priority;
    }
}

exports.generateRoute = (origin, destination) => {
    let rawdata;

    try {
        rawdata = fs.readFileSync("./src/db/adjacent-matrix.json");
    } catch (error) {
        logger.error("Error reading adjacency-matrix.json: No such file.");
        rawdata = "{}";
    }

    let data = JSON.parse(rawdata);
    let transferArr = [];

    for (let station of Object.keys(data)) {
        if (data[station].length > 2) {
            transferArr.push(station);
        }
    }

    const graph = new WeightedGraph();

    return graph.DijkstraFastest(origin, destination);
};
