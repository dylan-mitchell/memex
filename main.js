// Modules to control application life and create native browser window
require = require("esm")(module);
const { app, BrowserWindow, ipcMain, shell, globalShortcut } = require("electron");
const path = require("path");
var fs = require("fs");
http = require("http");
var os = require('os');
let spawn = require("child_process").spawn;

var mainWindow;
const appData = app.getPath('appData')
// These are stored in memory for faster loading
var years = []
var yearlySummarys = []


var os = os.type()

switch (os) {
  case "Linux":
    var dbPath = path.join(path.dirname(__dirname), 'memex', 'dataserver' ,'dataserver-Linux')
    break;
  case "Darwin":
    var dbPath = path.join(path.dirname(__dirname), 'memex', 'dataserver' ,'dataserver-Darwin')
    break;
  case "Windows_NT":
    var dbPath = path.join(path.dirname(__dirname), 'memex', 'dataserver' ,'dataserver-Windows')
    break;
  default:

}
console.log(dbPath);

let server = spawn(dbPath, ['-db', path.join(appData, 'takeout.db')]);

server.stdout.on("data", data => {
  // Handle data...
  console.log(data.toString());
});

server.stderr.on("data", err => {
  // Handle error...
  console.log(err.toString());
});

server.on("exit", code => {
  // Handle exit
  console.log(code.toString());
});

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
  //First check if the object is cached, if not ask the dataserver for it
  var cached = false
  if (years.length !== 0) {
    event.reply("getYears-reply", years, "");
    cached = true
  }

  // Not in cache so ask dataserver
  if (!cached) {
    var message = {
      type: "getYears"
    };
    messageStr = JSON.stringify(message);

    req = createRequest(event, "getYears-reply", "");
    req.write(messageStr);
    req.end();
  }

});

ipcMain.on("getYearlySummary", (event, arg) => {
  //First check if the object is cached, if not ask the dataserver for it
  var cached = false
  yearlySummarys.forEach(yearSum => {
    if (arg === "Total") {
      //Check for yearly
      if (typeof yearSum.yearly !== 'undefined') {
        event.reply("getYearlySummary-reply", yearSum, "");
        cached = true
      }
    } else {
      if (yearSum.year === arg) {
        event.reply("getYearlySummary-reply", yearSum, "");
        cached = true
      }
    }
  });

  // Not in cache so ask dataserver
  if (!cached) {
    var message = {
      type: "getYearlySummary",
      payload: arg.toString()
    };
    messageStr = JSON.stringify(message);

    req = createRequest(event, "getYearlySummary-reply", "");
    req.write(messageStr);
    req.end();
  }

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
  cacheYears()
  mainWindow.loadFile(path.join(__dirname, "src", "home.html"));
});

ipcMain.on("openLink", (event, arg) => {
  shell.openExternal(arg);
});
// *************

function cacheYears() {
  var message = {
    type: "getYears"
  };
  messageStr = JSON.stringify(message);

  console.log("Caching years");
  req = createRequestToLoad("years");
  req.write(messageStr);
  req.end();

  console.log("Finished caching years");

}

function cacheSummaries() {
  console.log("Caching Summaries");
  years.forEach(year => {
    var message = {
      type: "getYearlySummary",
      payload: year
    };
    messageStr = JSON.stringify(message);

    req = createRequestToLoad("summary");
    req.write(messageStr);
    req.end();
  });
  var message = {
    type: "getYearlySummary",
    payload: "Total"
  };
  messageStr = JSON.stringify(message);

  req = createRequestToLoad("summary");
  req.write(messageStr);
  req.end();
  console.log("Finished caching Summaries");
}

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

function createRequestToLoad(type) {
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
      if (type === 'years') {
        //Set global var
        years = payload;
        cacheSummaries()
      } else if (type === 'summary') {
        yearlySummarys.push(payload)
      }
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

	mainWindow.setMenu(null);

  if (fs.existsSync(path.join(appData, 'takeout.db'))) {
    cacheYears()
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
	server.kill(0)
});

app.on("activate", function() {

});
