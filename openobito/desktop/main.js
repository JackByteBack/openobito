const { app, BrowserWindow, Menu, shell } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let mainWindow = null;
let agentProcess = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "OpenAgent",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));

  const menu = Menu.buildFromTemplate([
    {
      label: "OpenAgent",
      submenu: [
        { label: "About OpenAgent", role: "about" },
        { type: "separator" },
        { label: "Quit", accelerator: "CmdOrCtrl+Q", click: () => app.quit() },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function startAgent() {
  const agentPath = path.join(__dirname, "..", "bin", "openagent.js");
  agentProcess = spawn(process.execPath, [agentPath, "chat"], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, OPENAGENT_NO_TUI: "1" },
  });

  agentProcess.stdout.on("data", (data) => {
    if (mainWindow) mainWindow.webContents.send("agent-output", data.toString());
  });

  agentProcess.stderr.on("data", (data) => {
    if (mainWindow) mainWindow.webContents.send("agent-error", data.toString());
  });

  agentProcess.on("close", (code) => {
    if (mainWindow) mainWindow.webContents.send("agent-exit", code);
    agentProcess = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  startAgent();
});

app.on("window-all-closed", () => {
  if (agentProcess) agentProcess.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});
