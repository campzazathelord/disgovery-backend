const { QueryTypes } = require("sequelize");
const sequelize = require("../db/database");

exports.getAllTransfers = async function () {
    const allTransfers = await sequelize.query(
        `
        select * from transfers
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
        };
    }

    return formattedTransfers;
};
