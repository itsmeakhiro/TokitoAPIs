const { spawn } = require("child_process");
const express = require("express");
const path = require("path");
const net = require("net");
const cors = require("cors");

const app = express();
const isVercel = !!process.env.VERCEL;
const generateRandomPort = () =>
  Math.floor(Math.random() * (65535 - 1024) + 1024);
let activePort = generateRandomPort();

app.use(cors());
app.use(express.static(path.join(__dirname, "views")));

async function isPortInUse(port) {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once("error", () => resolve(true))
      .once("listening", () => {
        tester.once("close", () => resolve(false)).close();
      })
      .listen(port, "127.0.0.1");
  });
}

async function initializeServer(port) {
  try {
    const isAvailable = !(await isPortInUse(port));
    if (!isAvailable) {
      const newPort = generateRandomPort();
      activePort = newPort;
      return initializeServer(newPort);
    }

    app.listen(port, () => {
      console.log(`Server is running on port: ${port}`);
    });
  } catch (error) {
    console.error(`Failed to start the server: ${error}`);
  }
}

function launchProcess(instanceIndex) {
  if (isVercel) return;

  const childProcess = spawn(
    "node",
    ["--trace-warnings", "--async-stack-traces", "main.js"],
    {
      cwd: __dirname,
      stdio: "inherit",
      env: {
        ...process.env,
        INSTANCE_INDEX: instanceIndex,
      },
    }
  );

  childProcess.on("close", (exitCode) => {
    if (exitCode !== 0) {
      launchProcess(instanceIndex);
    }
  });

  childProcess.on("error", (error) => {
    console.error(`Error with child process: ${error}`);
  });
}

async function startApp() {
  await initializeServer(activePort);
  if (!isVercel) {
    launchProcess(1);
  }
}

startApp();

module.exports = app;