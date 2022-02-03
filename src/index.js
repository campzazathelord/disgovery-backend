require("dotenv").config();
const express = require("express");
const sequelize = require("../src/db/database");
const btsRouter = require("./routers/bts");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(btsRouter);
sequelize
    .sync()
    .then(() => {
        app.listen(process.env.PORT || 3000, () => {
            console.log("Server is up on port " + process.env.PORT || 3000);
        });
    })
    .catch(() => {
        console.log("error");
    });
