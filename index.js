const express = require("express");
const cai = require("./routes/cai");
const ai = require("./routes/ai");

const app = express();

app.use(express.json());
app.use("", ai);
app.use("", cai);

async function main(){
  app.listen(8080)
}

main()
