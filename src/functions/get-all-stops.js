const { QueryTypes } = require("sequelize");
const sequelize = require("../db/database");

exports.getAllStops = async function () {
    const allStations = await sequelize.query(
        `
        select * from stops
            inner join translations on stops.stop_id=translations.record_id and translations.field_name='stop_name' and translations.table_name='stops'
        `,
        {
            type: QueryTypes.SELECT,
        },
    );

    let formattedStops = {};

    for (station of allStations) {
        formattedStops[station.stop_id] = {
            stop_id: station.stop_id,
            stop_code: station.stop_code,
            stop_name_en: station.stop_name,
            stop_name_th: station.translation,
            stop_desc: station.stop_desc,
            stop_lat: station.stop_lat,
            stop_lon: station.stop_lon,
            zone_id: station.zone_id,
            stop_url: station.stop_url,
            location_type: station.location_type,
            parent_station: station.parent_station,
            stop_timezone: station.stop_timezone,
            wheelchair_boarding: station.wheelchair_boarding,
            level_id: station.level_id,
            platform_code: station.platform_code,
        };
    }

    return formattedStops;
};
