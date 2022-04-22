const { QueryTypes } = require("sequelize");
const sequelize = require("../db/database");

exports.getAllTransfers = async function () {
    const allTransfers = await sequelize.query(
        `
        select fromStop.from_stop_id,from_parent,fromStop.to_stop_id,to_parent,fromStop.min_transfer_time,fromStop.transfer_type,fromStop.shape_id
        from (
            select t.*, parent_station as from_parent
            from transfers as t
            inner join(
                select stop_id, parent_station
                from stops
            ) as s
            on t.from_stop_id = s.stop_id
        ) as fromStop
        inner join(
            select t.*,parent_station as to_parent
            from transfers as t
            inner join(
                select stop_id, parent_station
                from stops
            ) as s
            on t.to_stop_id = s.stop_id
        ) as toStop
        on fromStop.from_stop_id=toStop.from_stop_id and fromStop.to_stop_id=toStop.to_stop_id;
        `,
        {
            type: QueryTypes.SELECT,
        },
    );

    let formattedTransfers = {};

    for (let transfer of allTransfers) {
        formattedTransfers[`${transfer.from_stop_id}__${transfer.to_stop_id}`] = {
            from_stop_id: transfer.from_stop_id,
            to_stop_id: transfer.to_stop_id,
            transfer_type: transfer.transfer_type,
            min_transfer_time: transfer.min_transfer_time,
            shape_id: transfer.shape_id,
            parent_from:transfer.from_parent,
            parent_to:transfer.to_parent,
        };
    }

    return formattedTransfers;
};
