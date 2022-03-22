const Stop = require("../../models/Stop");
const Fuzzy = require("../../functions/Fuzzy");
const StationDetails = require("../../functions/StationDetails");
const APIStatus = require("../../configs/api-errors");
const { logger } = require("../../configs/config");
const sequelize = require("../../db/database");
const Fuse = require("fuse.js");
const { Op, QueryTypes } = require("sequelize");
exports.getStationAutocomplete = async function getStationAutocomplete(req, res) {
    logger.info(`${req.method} ${req.baseUrl + req.path}`);

    const query = req.query.query;
    const max_result = parseInt(req.query.max_result) || 6;

    if (!query) return res.send(APIStatus.BAD_REQUEST).status(APIStatus.BAD_REQUEST.status);
        const stationData = await sequelize.query(
        `
        select stop_id, stop_name, stop_lat, stop_lon, translation
            from (select stop_id, stop_name, stop_lat, stop_lon from stops) as stops
            INNER JOIN translations ON table_name='stops' AND field_name='stop_name' AND record_id=stop_id;
        `,
        {
            type: QueryTypes.SELECT,
        },
    );

    let allStationIDs = [];
    let allStations = {};
    let nameofStation = []
    for(let items of Object.values(stationData)) {
        
        allStationIDs.push(items['stop_id']);
        nameofStation.push(items['stop_name']);

        let key = items['stop_id'];
        
        let stopName = items['stop_name'];
        let stopLat = items['stop_lat'];
        let stopLng = items['stop_lon'];
        let translation = items['translation']

        allStations[stopName] = {
            stopName,stopLat,stopLng,translation,key
        };
    }
    const resultFuzzy = Fuzzy(nameofStation,query,max_result)
    for(let {item:data} of resultFuzzy){
        let queryString = `select routes.route_id, routes.route_long_name, routes.route_short_name, routes.route_type, routes.route_color, trips.trip_id, trips.trip_headsign from (select * from stop_times where stop_times.stop_id='${allStations[data].key}') stop_times
        inner join trips on stop_times.trip_id=trips.trip_id
        inner join routes on trips.route_id = routes.route_id`
        const stationTrips = await sequelize.query(
            queryString,
            {
                type: QueryTypes.SELECT,
            },
        );
        let formattedTrips = []
        for(let trips of stationTrips){
            formattedTrips.push({
                id: trips[`trip_id`],
                route_id:trips[`route_id`],
                route_name: {
                    long_name:trips[`route_long_name`],
                    short_name:trips[`route_short_name`],
                },
                type:trips[`route_type`],
                color:trips[`route_color`],
                headsign:trips[`trip_headsign`]
                
            })
        }
        allStations[data] = {...allStations[data],trips:formattedTrips}
    }
    const returnedData = []
    for(let {item:stationName} of resultFuzzy){
        returnedData.push({
            station_id:allStations[stationName].key,
            name:{
                en:allStations[stationName].stopName,
                th:allStations[stationName].translation
            },
            location:{
                coords:{
                    lat:allStations[stationName].stopLat,
                    lng:allStations[stationName].stopLng
                }
            },
            trips:allStations[stationName].trips
        })
    }
    res.send(returnedData)
}
