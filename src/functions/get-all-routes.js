const { QueryTypes } = require("sequelize");
const sequelize = require("../db/database");

exports.getAllRoutes = async function () {
    const allRoutes = await sequelize.query(
        `
        select * from routes
        natural join (select record_id route_id, translation route_short_name_th from translations where field_name='route_short_name' and table_name='routes') route_short_name_translation
        natural join (select record_id route_id, translation route_long_name_th from translations where field_name='route_long_name' and table_name='routes') route_long_name_translation
        `,
        {
            type: QueryTypes.SELECT,
        },
    );

    let formattedRoutes = [];

    for (route of allRoutes) {
        formattedRoutes.push({
            route_id: route.route_id,
            agency_id: route.agency_id,
            route_short_name: route.route_short_name,
            route_long_name: route.route_long_name,
            route_short_name_th: route.route_short_name_th,
            route_long_name_th: route.route_long_name_th,
            route_desc: route.route_desc,
            route_type: route.route_type,
            route_url: route.route_url,
            route_color: route.route_color,
            route_text_color: route.route_text_color,
            route_sort_order: route.route_sort_order,
            continuous_pickup: route.continuous_pickup,
            continuous_drop_off: route.continuous_drop_off,
            shape_id: route.shape_id,
        });
    }

    return formattedRoutes;
};
