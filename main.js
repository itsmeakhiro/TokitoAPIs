const express = require("express");
const ai = require("./routes/ai");
const app = express();

app.use(express.json());
app.use("", ai);

app.listen(8080)
module.exports = app;