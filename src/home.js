require = require("esm")(module);
const { ipcRenderer } = window.ipcRenderer;
const visData = require("vis-data");
const visTimeline = require("vis-timeline/peer");
var L = require('leaflet');
require('leaflet.heat');

var menuItems = ["timeline", "search", "Total", "about"];
var sections = ["timeline", "search", "summary", "about"];

var results;
var map;
var heat;

map = L.map('mapid').setView([0, 0], 2);

var tiles = L.tileLayer( 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors.',
}).addTo(map);

function loadHeatMap(summary) {

  if (heat) {
    map.removeLayer(heat);
  }

  var heatArr = []

  summary.locationdata.forEach(loc => {
    heatArr.push([loc.latitude/ 10000000, loc.longitude / 10000000, 1])
  });

  if (heatArr.length > 0) {
      map.setView([heatArr[0][0], heatArr[0][1]], 4)
  } else {
    map.setView([0, 0], 2)
  }

  heat = L.heatLayer(heatArr, {radius: 25}).addTo(map);
}

ipcRenderer.send("getYears", "");

ipcRenderer.on("getCount-reply", (event, count, type) => {
  console.log(type);
  var countEl = document.getElementById(type + "Count");

  countEl.innerText = type.toUpperCase() + ": " + count;
});

function formatDate(date) {
  var d = new Date(date),
    month = "" + (d.getMonth() + 1),
    day = "" + d.getDate(),
    year = d.getFullYear();

  if (month.length < 2) month = "0" + month;
  if (day.length < 2) day = "0" + day;

  return [year, month, day].join("-");
}

function populateTable(items) {
  var searchControl = document.getElementById("searchControl");
  searchControl.classList.remove("is-loading");

  document.getElementById("resultTable").style.display = "table";

  results = items;

  var resultList = document.getElementById("resultList");
  resultList.innerHTML = "";

  var count = 1;
  results.forEach(result => {
    var row = document.createElement("tr");
    var th = document.createElement("th");
    th.innerText = count;
    th.classList.add("indexColumn");
    var type = document.createElement("td");
    type.innerText = result.title;
    type.classList.add("typeColumn");
    var action = document.createElement("td");
    action.innerText = result.action;
    action.classList.add("actionColumn");
    var item = document.createElement("td");
    item.innerText = result.item;
    item.classList.add("itemColumn");
    var date = document.createElement("td");
    date.innerText = formatDate(result.date);
    date.classList.add("dateColumn");

    row.appendChild(th);
    row.appendChild(type);
    row.appendChild(action);
    row.appendChild(item);
    row.appendChild(date);

    resultList.appendChild(row);

    count++;
  });
}

ipcRenderer.on("searchItems-reply", (event, items, type) => {
  populateTable(items);
});

ipcRenderer.on("getYears-reply", (event, years, type) => {
  var yearsDiv = document.getElementById("yearsList");
  years.forEach(year => {
    menuItems.push(year);

    var anchor = document.createElement("a");
    var yearEl = document.createElement("li");
    anchor.setAttribute("id", year + "MenuItem");
    anchor.setAttribute("onclick", "activateSummarySection(" + year + ")");
    anchor.innerText = year;
    yearEl.appendChild(anchor);
    yearsDiv.appendChild(yearEl);
  });
});

function searchItem() {
  var searchField = document.getElementById("searchField");
  var searchControl = document.getElementById("searchControl");
  console.log(searchField.value);
  if (searchField.value !== "") {
    ipcRenderer.send("searchItems", searchField.value);
    searchControl.classList.add("is-loading");
  } else {
    document.getElementById("resultList").innerHTML = "";
    document.getElementById("resultTable").style.display = "none";
    results = [];
  }
}

function clearSections() {
  sections.forEach(section => {
    var sec = document.getElementById(section + "Section");
    sec.style.display = "none";
  });
}

function clearMenuItems() {
  menuItems.forEach(item => {
    var secMenu = document.getElementById(item + "MenuItem");
    secMenu.classList.remove("active-menu");
  });
}

function activateSearch() {
  clearSections();
  clearMenuItems();
  var search = document.getElementById("searchSection");
  search.style.display = "block";

  var searchMenu = document.getElementById("searchMenuItem");
  searchMenu.classList.add("active-menu");
}

function activateAbout() {
  clearSections();
  clearMenuItems();
  var about = document.getElementById("aboutSection");
  about.style.display = "block";

  var aboutMenu = document.getElementById("aboutMenuItem");
  aboutMenu.classList.add("active-menu");
}

function activateTimeline() {
  clearSections();
  clearMenuItems();
  var timeline = document.getElementById("timelineSection");
  timeline.style.display = "block";

  var timelineMenu = document.getElementById("timelineMenuItem");
  timelineMenu.classList.add("active-menu");

  var noResults = document.getElementById("noResultsTimeline");

  const container = document.getElementById("visualization");
  container.innerHTML = "";

  if (results.length !== 0) {
    ipcRenderer.send("getTimeline", results);
    noResults.style.display = "none";
  } else {
    noResults.style.display = "block";
  }
}

function activateSummarySection(year) {
  clearSections();
  clearMenuItems();
  var summary = document.getElementById("summarySection");
  summary.style.display = "block";

  var summaryMenu = document.getElementById(year + "MenuItem");
  summaryMenu.classList.add("active-menu");

  var summaryTitle = document.getElementById("summaryTitle");
  summaryTitle.innerText = year;

  ipcRenderer.send("getYearlySummary", year);
}

ipcRenderer.on("getYearlySummary-reply", (event, summary, type) => {
  console.log(summary);
  loadHeatMap(summary);
  var totalPoints = document.getElementById("totalPoints");
  totalPoints.innerText = summary.total;

  var mostCommon = document.getElementById("mostCommon");
  mostCommon.innerText = summary.mostcommon[0].name;

  var youtubeCount = document.getElementById("youtubeCount");
  youtubeCount.innerText = summary.youtubetotal;

  var commonList = document.getElementById("commonList");
  commonList.innerHTML = "";
  var count = 1;
  summary.mostcommon.forEach(item => {
    var row = document.createElement("tr");
    var th = document.createElement("th");
    th.innerText = count;
    th.classList.add("indexColumn");
    var itemEl = document.createElement("td");
    itemEl.innerText = item.name;
    itemEl.classList.add("itemCommonColumn");
    var freqEl = document.createElement("td");
    freqEl.innerText = item.count;
    freqEl.classList.add("itemFreqColumn");

    row.appendChild(th);
    row.appendChild(itemEl);
    row.appendChild(freqEl);

    commonList.appendChild(row);

    count++;
  });

  var commonYoutubList = document.getElementById("commonYoutubeList");
  commonYoutubeList.innerHTML = "";
  var count = 1;
  summary.channelcommon.forEach(item => {
    var row = document.createElement("tr");
    var th = document.createElement("th");
    th.innerText = count;
    th.classList.add("indexColumn");
    var itemEl = document.createElement("td");
    itemEl.innerText = item.name;
    itemEl.classList.add("itemCommonColumn");
    var freqEl = document.createElement("td");
    freqEl.innerText = item.count;
    freqEl.classList.add("itemFreqColumn");

    row.appendChild(th);
    row.appendChild(itemEl);
    row.appendChild(freqEl);

    commonYoutubeList.appendChild(row);

    count++;
  });

  generateYearChart(summary);
  map.invalidateSize()
});

function generateYearChart(summary) {
  xVals = [];
  sums = [];
  if (typeof summary.yearly !== "undefined") {
    summary.yearly.forEach(year => {
      xVals.push(year.year);
      sums.push(year.total);
    });
  } else {
    summary.monthly.forEach(month => {
      xVals.push(month.name);
      sums.push(month.total);
    });
  }

  var ctx = document.getElementById("yearChart").getContext("2d");
  var chart = new Chart(ctx, {
    // The type of chart we want to create
    type: "line",

    // The data for our dataset
    data: {
      labels: xVals,
      datasets: [
        {
          label: "Data Points",
          borderColor: "#73897B",
          backgroundColor: "#9DC3A9",
          data: sums
        }
      ]
    },

    // Configuration options go here
    options: {}
  });
}

ipcRenderer.on("getTimeline-reply", (event, dataset) => {
  console.log(dataset);
  // DOM element where the Timeline will be attached
  const container = document.getElementById("visualization");
  container.innerHTML = "";

  // note that months are zero-based in the JavaScript Date object
  var items = new visData.DataSet(dataset);

  var options = {
    // zoomMin: 1000 * 60 * 60, // a hour
    // zoomMax: 1000 * 60 * 60 * 24 * 30 * 1, // 1 months
    type: "box",
    cluster: {
      showStipes: true,
      maxItems: 1
    }
  };

  // Create a Timeline
  const timeline = new visTimeline.Timeline(container, items, options);
});

function openLink(link) {
  ipcRenderer.send("openLink", link);
}

function sortByColumn(column) {
  switch (column) {
    case 'typeColumn':
      if (results[0].title.toLowerCase() < results[results.length - 1].title.toLowerCase() === true) {
          results.sort((a, b) => (a.title.toLowerCase() < b.title.toLowerCase()) ? 1 : (a.title.toLowerCase() === b.title.toLowerCase()) ? ((a.unixtime > b.unixtime) ? 1 : -1) : -1 )
      } else {
        results.sort((a, b) => (b.title.toLowerCase() < a.title.toLowerCase()) ? 1 : (a.title.toLowerCase() === b.title.toLowerCase()) ? ((a.unixtime > b.unixtime) ? 1 : -1) : -1 )
      }
      break;
    case 'actionColumn':
      if (results[0].action.toLowerCase() < results[results.length - 1].action.toLowerCase() === true) {
          results.sort((a, b) => (a.action.toLowerCase() < b.action.toLowerCase()) ? 1 : (a.action.toLowerCase() === b.action.toLowerCase()) ? ((a.unixtime > b.unixtime) ? 1 : -1) : -1 )
      } else {
        results.sort((a, b) => (b.action.toLowerCase() < a.action.toLowerCase()) ? 1 : (a.action.toLowerCase() === b.action.toLowerCase()) ? ((a.unixtime > b.unixtime) ? 1 : -1) : -1 )
      }
      break;
    case 'itemColumn':
      if (results[0].item.toLowerCase() < results[results.length - 1].item.toLowerCase() === true) {
          results.sort((a, b) => (a.item.toLowerCase() < b.item.toLowerCase()) ? 1 : (a.item.toLowerCase() === b.item.toLowerCase()) ? ((a.unixtime > b.unixtime) ? 1 : -1) : -1 )
      } else {
        results.sort((a, b) => (b.item.toLowerCase() < a.item.toLowerCase()) ? 1 : (a.item.toLowerCase() === b.item.toLowerCase()) ? ((a.unixtime > b.unixtime) ? 1 : -1) : -1 )
      }
      break;
    case 'dateColumn':
      if (results[0].unixtime < results[results.length - 1].unixtime) {
          results.sort((a, b) => (a.unixtime < b.unixtime) ? 1 : (a.unixtime === b.unixtime) ? ((a.item.toLowerCase() > b.item.toLowerCase()) ? 1 : -1) : -1 )
      } else {
        results.sort((a, b) => (b.unixtime < a.unixtime) ? 1 : (a.unixtime === b.unixtime) ? ((a.item.toLowerCase() > b.item.toLowerCase()) ? 1 : -1) : -1 )
      }
      break;
    default:

  }
  populateTable(results);
}
