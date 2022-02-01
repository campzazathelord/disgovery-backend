exports.healthCheck = async function healthCheck(req, res) {
    res.status(200).send({
        status: "running",
    });
};
