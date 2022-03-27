const { QueryTypes } = require("sequelize");
const sequelize = require("../db/database");

exports.getAllLinesOfNodes = async function () {
    const allLinesOfNodes = await sequelize.query(
        `
        SELECT DISTINCT stop_trip.route_id,stop_id
        FROM (SELECT *
            FROM stop_times
            NATURAL JOIN trips) AS stop_trip
        INNER JOIN routes ON stop_trip.route_id = routes.route_id
        `,
        {
            type: QueryTypes.SELECT,
        },
    );

    let formattedAllLinesOfNodes = {};

    for (let line of allLinesOfNodes) {
        formattedAllLinesOfNodes[line.stop_id] = {
            route_id: line.route_id,
            stop_id: line.stop_id,
        };
    }

    return formattedAllLinesOfNodes;
};
