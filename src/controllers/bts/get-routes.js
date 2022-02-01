const axios = require("axios");

exports.getRoutes = async function getRoutes(req, res) {
    try {
        const data = await axios.post(
            "https://btsapp1.bts.co.th/webservice/api/getRoute",
            formUrlEncoded({
                Origin: req.params.id1,
                Destination: req.params.id2,
            }),
        );
        const payload = {
            StartingStation: data.data.OriginName,
            DestinationStation: data.data.DestinationName,
            TotalKm: data.data.TotalKm,
            ExpectedTrainWaitingTime: "2 min",
            TotalTime: data.data.TotalTime,
        };
        res.send({ data: payload });
    } catch (error) {
        res.status(500).send(error);
    }
};
