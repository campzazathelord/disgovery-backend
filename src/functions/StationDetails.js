const Stop = require("../models/Stop");

const StationDetails = async (arr) => {
    let tmpArr = [];

    for (let x of arr) {
        const tmpStation = await Stop.findOne({ where: { stop_name: x.item } });
        let tmpStrDetails = {
            station_id: tmpStation.stop_id,
            name: {
                en: tmpStation.stop_name,
                th: "ไม่มีข้อมูล",
            },
            location: {
                coords: {
                    lat: tmpStation.stop_lat,
                    lon: tmpStation.stop_lon,
                },
            },
        };
        tmpArr.push(tmpStrDetails);
    }

    return tmpArr;
};
module.exports = StationDetails;
