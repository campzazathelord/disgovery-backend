const { QueryTypes, where, or } = require("sequelize");
const APIStatus = require("../../configs/api-errors");
const { logger } = require("../../configs/config");
const sequelize = require("../../db/database");

exports.getAllStationsFromRoute = async function (req, res) {
    logger.info(`${req.method} ${req.baseUrl + req.path}`);

    const routeId = req.query.route_id || "";
    if (!routeId) {
        return res.send(APIStatus.BAD_REQUEST).status(APIStatus.BAD_REQUEST.status);
    }

    try {
        const allStationsOfRoute = await sequelize.query(
            `
        select * from (SELECT trip_id, route_id
            FROM (SELECT trips.trip_id, route_id , maxStopSequence, ROW_NUMBER() over (PARTITION BY route_id ORDER BY maxStopSequence DESC) AS rowNumber
                    FROM (SELECT trip_id, MAX(stop_sequence) AS maxStopSequence
                            FROM stop_times
                            GROUP BY trip_id) AS trip_id_maxstopseq
                    INNER JOIN trips
                    ON trips.trip_id = trip_id_maxstopseq.trip_id) AS trip_route_maxstopseq
            WHERE rowNumber = 1 and route_id='${routeId}') as trip_with_max_stops
            natural join (select trip_id, stop_id from stop_times) as stop_times
        `,
            {
                type: QueryTypes.SELECT,
            },
        );

        let response = await getArrayOfStationDetails(allStationsOfRoute);

        return res.status(APIStatus.OK.status).send({ status: APIStatus.OK, data: response });
    } catch (error) {
        return res
            .status(APIStatus.INTERNAL.SERVER_ERROR.status)
            .send({ status: { status: APIStatus.INTERNAL.SERVER_ERROR.status, message: error } });
    }
};

async function getArrayOfStationDetails(stopIdObject) {
    let whereQuery = "";
    let orderQuery = "";

    Object.keys(stopIdObject).map((key, index) => {
        if (index === 0) {
            whereQuery += `stop_id='${stopIdObject[key].stop_id}' `;
        } else {
            whereQuery += `or stop_id='${stopIdObject[key].stop_id}' `;
        }

        orderQuery += `'${stopIdObject[key].stop_id}', `;
    });

    orderQuery = orderQuery.substring(0, orderQuery.length - 2);

    return await sequelize.query(
        `
        select stop_id, stop_code, stop_name, stop_desc, stop_lat, stop_lon, zone_id, stop_url, location_type, parent_station, stop_timezone, wheelchair_boarding, level_id, platform_code, translation as stop_name_th from (select * from stops
            where ${whereQuery}) as stops
        inner join translations on translations.field_name='stop_name' and translations.table_name='stops' and translations.record_id=stops.stop_id
        order by field(stop_id, ${orderQuery})
    `,
        {
            type: QueryTypes.SELECT,
        },
    );
}
