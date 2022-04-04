const jwt = require("jsonwebtoken");
const APIStatus = require("../configs/api-errors");
const User = require("../models/User");

const authentication = async (req, res, next) => {
    try {
        const token = req.header("Authorization").replace("Bearer ", "");
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({
            _id: decoded._id,
            "tokens.token": token,
        });
        if (!user) {
            throw new Error();
        }
        req.user = user;
        next();
    } catch (error) {
        res.status(APIStatus.UNAUTHORIZED.status).send(APIStatus.UNAUTHORIZED);
    }
};

module.exports = authentication;
