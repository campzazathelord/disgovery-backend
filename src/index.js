require("dotenv").config();

const express = require("express");
const btsRouter = require("./routers/bts");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(btsRouter);

app.listen(process.env.PORT, () => {
    console.log(`The server is running on port ${process.env.PORT}`);
});
