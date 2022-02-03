const APIStatus = require("../configs/api-errors");

exports.test = function (req, res) {
    console.log(req.params.id);
    console.log(req.query.name);

    return res.status(APIStatus.OK.status).send(APIStatus.OK);
};
