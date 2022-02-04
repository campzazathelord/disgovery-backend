require("dotenv").config();
const express = require("express");
const sequelize = require("../src/db/database");
const { checkStructEnv, logger } = require("./configs/config");
const config = require("./configs/config");
const btsRouter = require("./routers/bts");

checkStructEnv();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(btsRouter);
sequelize
    .sync()
    .then(() => {
        app.listen(process.env.PORT || 3000, () => {
            logger.info("Server is up on port " + process.env.PORT || 3000);
        });
    })
    .catch((e) => {
        logger.error("ERROR: " + e);
    });
