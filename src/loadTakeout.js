const { ipcRenderer } = window.ipcRenderer;

var path = "";

var loading = document.getElementById("loading");
var importForm = document.getElementById("importForm");
var success = document.getElementById("success");

function checkTakeout() {
  var files = document.getElementById("takeoutInput").files;
  rootPath = files[0].webkitRelativePath.split("/")[0];
  path = files[0].path.split(rootPath)[0] + rootPath;

  document.getElementById("rootPath").innerHTML = path;
  document.getElementById("submitBtn").removeAttribute("disabled");
}

function openHome() {
  ipcRenderer.send("openHome", "");
}

function importTakeout() {
  if (path == "") {
    console.log("Path cant be empty");
    return;
  }
  loading.style.display = "block";
  importForm.style.display = "none";
  ipcRenderer.send("importTakeout", path);
}

ipcRenderer.on("importTakeout-reply", (event, response, type) => {
  console.log(response);
  loading.style.display = "none";
  success.style.display = "block";
});

function openLink(link) {
  ipcRenderer.send("openLink", link);
}
