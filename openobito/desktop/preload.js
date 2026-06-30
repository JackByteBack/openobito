const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("openagent", {
  onOutput: (callback) => ipcRenderer.on("agent-output", (_event, data) => callback(data)),
  onError: (callback) => ipcRenderer.on("agent-error", (_event, data) => callback(data)),
  onExit: (callback) => ipcRenderer.on("agent-exit", (_event, code) => callback(code)),
});
