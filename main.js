// Modules to control application life and create native browser window
require = require("esm")(module);
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
var fs = require("fs");
http = require("http");

var mainWindow;

// IPC *************
ipcMain.on("getTimeline", (event, arg) => {
  dataset = constructTimeline(arg);
  event.reply("getTimeline-reply", dataset);
});

ipcMain.on("getCount", (event, arg) => {
  var message = {
    type: "getCount",
    payload: arg
  };
  messageStr = JSON.stringify(message);

  req = createRequest(event, "getCount-reply", arg);
  req.write(messageStr);
  req.end();
});

ipcMain.on("getYears", (event, arg) => {
  var message = {
    type: "getYears"
  };
  messageStr = JSON.stringify(message);

  req = createRequest(event, "getYears-reply", "");
  req.write(messageStr);
  req.end();
});

ipcMain.on("importTakeout", (event, arg) => {
  var message = {
    type: "importTakeout",
    payload: arg
  };
  messageStr = JSON.stringify(message);

  req = createRequest(event, "importTakeout-reply", "");
  req.write(messageStr);
  req.end();
});

ipcMain.on("searchItems", (event, arg) => {
  var message = {
    type: "searchItems",
    payload: arg
  };
  console.log("Searching for " + arg);
  messageStr = JSON.stringify(message);

  req = createRequest(event, "searchItems-reply", "");
  req.write(messageStr);
  req.end();
});

ipcMain.on("openHome", (event, arg) => {
  mainWindow.loadFile(path.join(__dirname, "src", "home.html"));
});
// *************

function createRequest(event, destination, type) {
  var options = {
    hostname: "localhost",
    port: 40855,
    path: "/",
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    }
  };
  var totalBody = "";
  var req = http.request(options, function(res) {
    res.setEncoding("utf8");
    res.on("data", function(body) {
      totalBody = totalBody + body;
    });
    res.on("end", () => {
      message = JSON.parse(totalBody);
      payload = JSON.parse(message.payload);
      event.reply(destination, payload, type);
    });
  });
  req.on("error", function(e) {
    console.log("problem with request: " + e.message);
  });

  return req;
}

function constructTimeline(searches) {
  var dataset = [];
  for (var i = 0; i < searches.length; i++) {
    date = Date.parse(searches[i].date);
    if (!isNaN(date)) {
      if (searches[i].item.length < 50) {
        // dataset.push({ start: date, content: searches[i].item });
        var content = `
        <p>${searches[i].item}</p>
        `;
        dataset.push({ start: date, content: content });
      }
    }
  }
  return dataset;
}

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    // fullscreen: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true
    }
  });

  if (fs.existsSync(path.join(__dirname, "dataserver", "takeout.db"))) {
    mainWindow.loadFile(path.join(__dirname, "src", "home.html"));
  } else {
    mainWindow.loadFile(path.join(__dirname, "src", "loadTakeout.html"));
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed.
app.on("window-all-closed", function() {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", function() {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
