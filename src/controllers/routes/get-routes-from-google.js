const APIStatus = require("../../configs/api-errors");
const { getDirectionsFromGoogle } = require("../../functions/google-directions-api");

exports.getRoutesFromGoogle = async function (req, res) {
    let origin = {
        type: "place_id",
        place_id: "ChIJdf4y6N2c4jARHMhJjt81dX4",
    };

    let destination = {
        type: "coordinates",
        coordinates: {
            lat: 13.8450887,
            lng: 100.5778583,
        },
    };

    let data = await getDirectionsFromGoogle(origin, destination);

    if (!data) res.send({ status: APIStatus.BAD_REQUEST });

    return res.send({ data: data }).status(200);
};
