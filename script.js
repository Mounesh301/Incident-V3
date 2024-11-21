// Import necessary libraries
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { sankey } from "https://cdn.jsdelivr.net/npm/@gramex/sankey@1";
import { network } from "https://cdn.jsdelivr.net/npm/@gramex/network@2/dist/network.js";
import { kpartite } from "https://cdn.jsdelivr.net/npm/@gramex/network@2/dist/kpartite.js";
import { num0, num2 } from "https://cdn.jsdelivr.net/npm/@gramex/ui@0.3/dist/format.js";
import { Marked } from "https://cdn.jsdelivr.net/npm/marked@13/+esm";
import { asyncLLM } from "https://cdn.jsdelivr.net/npm/asyncllm@1";

// Get references to DOM elements
const $upload = document.getElementById("upload");
const $filters = document.getElementById("filters");
const $result = document.getElementById("result");
const $showLinks = document.getElementById("show-links");
const $threshold = document.getElementById("threshold");
const $thresholdDisplay = document.getElementById("threshold-display");
const $sankey = document.getElementById("sankey");
const $network = document.getElementById("network");
const $summarize = document.getElementById("summarize");
const $summary = document.getElementById("summary");
const $userQuestion = document.getElementById("user-question");
const $askQuestion = document.getElementById("ask-question");
const $resetFilters = document.getElementById("reset-filters");

// Initialize variables and constants
const data = {};
const graphs = {};
const minDuration = 0;
const maxDuration = 10;
let threshold = parseFloat($threshold.value) || 3;
let colorScale;
const marked = new Marked();
const filters = {};

// Constants for filters and pre-selected services and Regions
const filterKeys = ["Region", "Shift", "Team", "Service"];
const preSelectedServices = [
  "CTR",
  "LOGAN",
  "VaR",
  "GRT",
  "LIQ",
  "RWH",
  "Argos",
  "PXV",
  "TLM",
  "K2",
  "TARDIS",
];
const preSelectedRegions = ["Canada", "Ireland", "USA", "UK", "Global", "Singapore", "LATAM"];

// --- Addition 1: Create a separate function for rounded counts ---
function num0Rounded(value) {
  return Math.ceil(value).toLocaleString(); // Round up and format with commas
}
// --- End Addition 1 ---

// Function to read and parse CSV files
async function readCSV(file) {
  const text = await file.text();
  return d3.csvParse(text, (d) => {
    // Automatically infer data types using d3.autoType
    const row = d3.autoType(d);

    // Split 'Incident Data' into separate fields if it exists
    if (row["Incident Data"]) {
      const [Incident, DescriptionCleaned, ImpactCleaned, ResolutionDetails] = row[
        "Incident Data"
      ].split("|");
      Object.assign(row, { Incident, DescriptionCleaned, ImpactCleaned, ResolutionDetails });
    }

    // Ensure 'Time of Day' field exists
    row["Time of Day"] = row["Time of Day"] || "";

    return row;
  });
}

// Event listener for file uploads
$upload.addEventListener("change", async (e) => {
  const name = e.target.getAttribute("name");
  data[name] = await readCSV(e.target.files[0]);
  draw();
});

// Main function to initialize the application after data is loaded
function draw() {
  if (!data.incidents) return;
  $result.classList.remove("d-none");
  initializeFilters();
  drawFilters();
  update();
}

// Update function to refresh visualizations
function update() {
  updateColorScale();
  drawSankey();
  drawNetwork();
}

// Function to initialize filters to default values
function initializeFilters() {
  for (const key of filterKeys) {
    const values = [...new Set(data.incidents.map((d) => d[key]))].sort();
    filters[key] = values.map((v, index) => ({
      value: v,
      selected:
        key === "Service"
          ? preSelectedServices.includes(v)
          : key === "Region"
          ? preSelectedRegions.includes(v)
          : key === "Team"
          ? false
          : true,
      index,
    }));
  }
}

// Event listener for resetting filters
$resetFilters.addEventListener("click", resetFilters);

// Function to reset filters and update visualizations
function resetFilters() {
  initializeFilters();
  drawFilters();
  update();
}

// Function to draw filter dropdowns
function drawFilters() {
  // Generate HTML for filter dropdowns
  $filters.innerHTML = filterKeys
    .map(
      (key) => `
      <div class="col-md-3">
        <div class="dropdown">
          <button class="btn btn-secondary dropdown-toggle w-100" type="button" data-bs-toggle="dropdown" data-bs-auto-close="outside">
            ${key}
          </button>
          <div class="dropdown-menu w-100" id="dropdown-menu-${key}">
            <div class="dropdown-search">
              <input type="text" placeholder="Search ${key}..." class="search-filter">
            </div>
            <div class="dropdown-item">
              <input type="checkbox" class="select-all" id="all-${key}" ${
        key !== "Service" && key !== "Team" && key !== "Region" ? "checked" : ""
      }>
              <label for="all-${key}" class="flex-grow-1">Select All</label>
            </div>
            ${
              key === "Service"
                ? `
            <div class="dropdown-item">
              <input type="checkbox" class="top-10" id="top-10-${key}">
              <label for="top-10-${key}" class="flex-grow-1">Top 10</label>
            </div>
            `
                : ""
            }
            <div id="filter-options-${key}">
              <!-- Options will be rendered here -->
            </div>
          </div>
        </div>
      </div>
    `
    )
    .join("");

  // Render options for each filter
  for (const key of filterKeys) {
    renderFilterOptions(key);
  }

  // Add event listeners to filter components
  addFilterEventListeners();

  // Select top teams based on selected services
  selectTopTeams();
}

// Function to render filter options within each dropdown
function renderFilterOptions(key) {
  const optionsContainer = document.getElementById(`filter-options-${key}`);
  const options = filters[key];

  // Sort options: selected at the top, then unselected
  options.sort((a, b) => b.selected - a.selected || a.index - b.index);

  // Generate HTML for each option
  const optionsHTML = options
    .map(
      (option) => `
      <div class="dropdown-item">
        <input type="checkbox" class="filter-checkbox" name="${key}" value="${option.value}" id="${key}-${option.value}" ${
        option.selected ? "checked" : ""
      }>
        <label for="${key}-${option.value}" class="flex-grow-1">${option.value}</label>
      </div>
    `
    )
    .join("");

  // Update the options container
  optionsContainer.innerHTML = optionsHTML;

  // Add event listeners to checkboxes
  optionsContainer.querySelectorAll(".filter-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const value = checkbox.value;
      const option = filters[key].find((opt) => opt.value === value);
      if (option) option.selected = checkbox.checked;
      if (key === "Service") selectTopTeams();
      renderFilterOptions(key);
      update();
    });
  });
}

// Function to add event listeners for filter interactions
function addFilterEventListeners() {
  // Search functionality within filters
  document.querySelectorAll(".search-filter").forEach((input) => {
    input.addEventListener("input", (e) => {
      const searchText = e.target.value.toLowerCase();
      const dropdownMenu = e.target.closest(".dropdown-menu");
      dropdownMenu.querySelectorAll(".dropdown-item").forEach((item) => {
        const label = item.querySelector("label");
        if (label) {
          const text = label.textContent.toLowerCase();
          item.style.display = text.includes(searchText) ? "" : "none";
        }
      });
    });
  });

  // 'Select All' functionality
  document.querySelectorAll(".select-all").forEach((checkbox) => {
    checkbox.addEventListener("change", (e) => {
      const key = e.target.id.replace("all-", "");
      const checked = e.target.checked;
      filters[key].forEach((option) => (option.selected = checked));
      if (key === "Service") selectTopTeams();
      renderFilterOptions(key);
      update();
    });
  });

  // 'Top 10' services functionality
  document.querySelectorAll(".top-10").forEach((checkbox) => {
    checkbox.addEventListener("change", (e) => {
      const key = e.target.id.replace("top-10-", "");
      const checked = e.target.checked;
      filters[key].forEach((option) => {
        option.selected = preSelectedServices.includes(option.value) ? checked : false;
      });
      document.getElementById(`all-${key}`).checked = false; // Uncheck 'Select All'
      selectTopTeams();
      renderFilterOptions(key);
      update();
    });
  });

  // Prevent dropdown from closing on click inside
  document.querySelectorAll(".dropdown-menu").forEach((menu) => {
    menu.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  });
}

// Function to select top teams based on selected services
function selectTopTeams() {
  const selectedServices = filters["Service"]
    .filter((opt) => opt.selected)
    .map((opt) => opt.value);

  // Unselect all teams initially
  filters["Team"].forEach((option) => (option.selected = false));

  if (selectedServices.length === 0) {
    renderFilterOptions("Team");
    return;
  }

  // Calculate top 2 teams for each selected service
  const incidentsByTeamService = d3.rollups(
    data.incidents,
    (v) => d3.sum(v, (d) => d.Count),
    (d) => d["Service"], // Ensure correct property name
    (d) => d["Team"] // Ensure correct property name
  );

  const topTeams = new Set();

  for (const [service, teams] of incidentsByTeamService) {
    if (selectedServices.includes(service)) {
      teams
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .forEach(([team]) => topTeams.add(team));
    }
  }

  // Select only the top teams
  filters["Team"].forEach((option) => {
    if (topTeams.has(option.value)) option.selected = true;
  });

  // Re-render team options
  renderFilterOptions("Team");
}

// Function to filter incidents based on selected filters
function filteredIncidents() {
  const selectedValues = {};
  for (const key of filterKeys) {
    selectedValues[key] = filters[key]
      .filter((opt) => opt.selected)
      .map((opt) => opt.value);
  }

  return data.incidents.filter((row) =>
    filterKeys.every(
      (key) => selectedValues[key].length === 0 || selectedValues[key].includes(row[key])
    )
  );
}

// --- Addition 2: Update computeStats to round up and exclude zero counts ---
function computeStats(dataArray, groupByKey) {
  return d3
    .rollups(
      dataArray,
      (v) => ({
        Count: Math.ceil(d3.sum(v, (d) => d.Count)), // Round up the count
        Hours: d3.sum(v, (d) => d.Hours * d.Count),
      }),
      (d) => d[groupByKey]
    )
    .map(([key, stats]) => ({
      [groupByKey]: key,
      Count: stats.Count,
      AvgHours: stats.Count > 0 ? stats.Hours / stats.Count : 0, // Prevent division by zero
    }))
    .filter((stat) => stat.Count > 0); // Exclude groups with zero incidents
}
// --- End Addition 2 ---

// Function to draw the Sankey diagram
function drawSankey() {
  const incidents = filteredIncidents();
  const graph = sankey($sankey, {
    data: incidents,
    labelWidth: 100,
    categories: ["Shift", "Region", "Team", "Service"],
    size: (d) => d.Count,
    text: (d) => (d.key.length * 9 < d.width ? d.key : null),
    d3,
  });
  graphs.sankey = graph;

  // Adjust 'Hours' and 'size' for nodes and links
  adjustHoursAndSize(graph.nodeData);
  adjustHoursAndSize(graph.linkData);

  // Add tooltips
  graph.nodes
    .attr("data-bs-toggle", "tooltip")
    .attr("title", (d) => `${d.key}: ${num2(d.Hours)} hours`);
  graph.links
    .attr("data-bs-toggle", "tooltip")
    .attr("title", (d) => `${d.source.key} - ${d.target.key}: ${num2(d.Hours)} hours`);

  // Style text labels
  graph.texts.attr("fill", "black");
  colorSankey();
}

// Function to adjust 'Hours' and 'size' properties for nodes and links
function adjustHoursAndSize(items) {
  items.forEach((d) => {
    const totalAdjustedHours = d3.sum(d.group, (d) => d.Hours * d.Count);
    const totalCount = d3.sum(d.group, (d) => d.Count);
    d.Hours = totalCount > 0 ? totalAdjustedHours / totalCount : 0;
    d.size = totalCount;
  });
}

// Function to update color scale based on threshold
function updateColorScale() {
  colorScale = d3
    .scaleLinear()
    .domain([minDuration, 2, threshold, 4, maxDuration])
    .range(["green", "green", "yellow", "red", "red"])
    .interpolate(d3.interpolateLab)
    .clamp(true);
}

// Function to color the Sankey diagram based on 'Hours'
function colorSankey() {
  $thresholdDisplay.textContent = num2(threshold);
  graphs.sankey.nodes.attr("fill", (d) => colorScale(d.Hours));
  graphs.sankey.links.attr("fill", (d) => colorScale(d.Hours));
}

// Event listener to toggle links in Sankey diagram
$showLinks.addEventListener("change", () => {
  graphs.sankey.links.classed("show", $showLinks.checked);
});

// Event listener for threshold slider
$threshold.addEventListener("input", () => {
  threshold = parseFloat($threshold.value);
  updateColorScale();
  colorSankey();
});

// Function to draw the network graph
function drawNetwork() {
  const incidents = filteredIncidents();

  // Calculate service statistics
  const serviceStats = d3.rollup(
    incidents,
    (v) => ({
      TotalHours: d3.sum(v, (d) => d.Hours * d.Count),
      Count: d3.sum(v, (d) => d.Count),
    }),
    (d) => d["Service"]
  );

  const { nodes, links } = kpartite(
    data.relations,
    [
      ["name", "Source"],
      ["name", "Target"],
    ],
    { count: 1 }
  );

  // Assign statistics to nodes
  for (const node of nodes) {
    Object.assign(node, serviceStats.get(node.value) || { TotalHours: 0, Count: 0 });
    node.Hours = node.Count > 0 ? node.TotalHours / node.Count : 0;
  }

  // Define forces for the network layout
  const forces = {
    charge: () => d3.forceManyBody().strength(-200),
  };

  const graph = network($network, { nodes, links, forces, d3 });
  graphs.network = graph;

  // Define radius scale based on incident count
  const rScale = d3
    .scaleSqrt()
    .domain([0, d3.max(nodes, (d) => d.Count)])
    .range([1, 30]);

  // Style nodes
  graph.nodes
    .attr("fill", (d) => colorScale(d.Hours))
    .attr("stroke", "white")
    .attr("stroke-width", 1)
    .attr("r", (d) => rScale(d.Count))
    .attr("data-bs-toggle", "tooltip")
    .attr("title", (d) => `${d.value}: ${num2(d.Hours)} hours, ${num0Rounded(d.Count)} incidents`); // Use num0Rounded

  // Style links
  graph.links
    .attr("marker-end", "url(#triangle)")
    .attr("stroke", "rgba(var(--bs-body-color-rgb), 0.2)");
}

// Initialize tooltips for visualizations
new bootstrap.Tooltip($sankey, { selector: "[data-bs-toggle='tooltip']" });
new bootstrap.Tooltip($network, { selector: "[data-bs-toggle='tooltip']" });

// --- Addition 3: Update event listeners for buttons ---
$summarize.addEventListener("click", summarize);
$askQuestion.addEventListener("click", answerQuestion);
// --- End Addition 3 ---

// Function to summarize data and display analysis
async function summarize() {
  const selectedServices = filters["Service"]
    .filter((opt) => opt.selected)
    .map((opt) => opt.value);

  if (selectedServices.length === 0) {
    $summary.innerHTML = `<div class="alert alert-warning" role="alert">
      No services selected for summarization.
    </div>`;
    return;
  }

  const incidents = filteredIncidents();
  const serviceData = {};

  // Prepare data for each selected service
  for (const service of selectedServices) {
    const serviceIncidents = incidents.filter((d) => d.Service === service);
    if (serviceIncidents.length === 0) continue;

    // Calculate statistics
    const shiftStats = computeStats(serviceIncidents, "Shift");
    const timeOfDayStats = computeStats(serviceIncidents, "Time of Day");
    const RegionStats = computeStats(serviceIncidents, "Region");
    const teamStats = computeStats(serviceIncidents, "Team");

    // Aggregate frequent issues
    const descriptionStats = d3
      .rollups(
        serviceIncidents,
        (v) => d3.sum(v, (d) => d.Count),
        (d) => d.DescriptionCleaned
      )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([description, count]) => ({ Description: description, Count: count }));

    // Identify related services from network data
    const relatedServices = data.relations
      .filter((rel) => rel.Source === service || rel.Target === service)
      .map((rel) => (rel.Source === service ? rel.Target : rel.Source));

    serviceData[service] = {
      shiftStats,
      timeOfDayStats,
      RegionStats,
      teamStats,
      descriptionStats,
      relatedServices,
    };
  }

  // Compute overall statistics
  const overallServiceStats = computeStats(incidents, "Service");
  const overallTeamStats = computeStats(incidents, "Team");
  const overallRegionStats = computeStats(incidents, "Region");
  const overallShiftStats = computeStats(incidents, "Shift");
  const overallTimeOfDayStats = computeStats(incidents, "Time of Day"); // --- Addition 4: Include Time of Day Stats ---

  // --- Addition 4: Check for non-zero counts before proceeding ---
  if (
    overallServiceStats.length === 0 &&
    overallTeamStats.length === 0 &&
    overallRegionStats.length === 0 &&
    overallShiftStats.length === 0 &&
    overallTimeOfDayStats.length === 0 // Include Time of Day
  ) {
    $summary.innerHTML = `<div class="alert alert-warning" role="alert">
      No incidents to summarize based on the current filters.
    </div>`;
    return;
  }
  // --- End Addition 4 ---

  // Compute network data summary
  const networkSummary = prepareNetworkSummary(selectedServices);

  // --- Addition 5: Update system message with instructions to highlight Time of Day ---
  const system = `As an expert analyst in financial application's incident management, provide a structured and concise summary for the selected services, focusing on:
  
1. **Overall Summary:**
   - Identify overall problematic services, along with teams, Regions, shifts, and times of day (only top 2 or 3 in each category).
   - Highlight services, teams, Regions, shifts, and times of day which are significantly beyond the threshold duration (only top 2 or 3 in each category).

2. **Analysis:**
   - Narrate a story flow linking services, teams, Regions, shifts, and times of day in 4 key points under the subheading 'Analysis'.

3. **Recommendations:**
   - Highlight connections with other services that might have impacted the problematic services.
   - Provide specific recommendations based on the current data provided.

**Important Instructions:**
- **Whole Numbers:** All incident counts should be presented as whole numbers (integers).
- **Rounding Up:** If any incident counts are fractional, they should be rounded up to the nearest whole number.
- **No Zero Incidents:** Do not mention or include any groups (services, teams, Regions, shifts, times of day) that have zero incidents.

Include both incident data and network data in your analysis.

Present the information concisely using bullet points under each section. Ensure that the summary is directly based on the data provided and is actionable.`;
  // --- End Addition 5 ---

  // Prepare the message with aggregated data
  let message = `Selected Services:\n${selectedServices.join(", ")}\n\nOverall Summary:\n`;

  // --- Addition 6: Include Time of Day in Top Stats ---
  message += formatTopStats("Problematic services", overallServiceStats, "Service");
  message += formatTopStats("Problematic teams", overallTeamStats, "Team");
  message += formatTopStats("Problematic Regions", overallRegionStats, "Region");
  message += formatTopStats("Problematic shifts", overallShiftStats, "Shift");
  message += formatTopStats("Problematic times of day", overallTimeOfDayStats, "Time of Day"); // --- Addition 6 ---
  // --- End Addition 6 ---

  // Append network data summary
  message += `\nNetwork Data Summary:\n${networkSummary}\n`;

  // Append per-service summaries
  for (const service of selectedServices) {
    const data = serviceData[service];
    if (!data) continue;

    message += `\nService: ${service}\n`;
    message += formatServiceStats(data);
  }

  // Display a loading spinner
  $summary.innerHTML = `<div class="spinner-border" role="status">
    <span class="visually-hidden">Loading...</span>
  </div>`;

  // Fetch and display the summary from the AI assistant
  try {
    let fullContent = "";
    let lastContent = "";
    for await (const { content } of asyncLLM(
      "https://llmfoundry.straive.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          model: "gpt-4o-mini",
          stream: true,
          messages: [
            { role: "system", content: system },
            { role: "user", content: message },
          ],
        }),
      }
    )) {
      if (content && content !== lastContent) {
        lastContent = content;
        fullContent = content;
        $summary.innerHTML = marked.parse(fullContent);
      }
    }
  } catch (error) {
    console.error("Error in summarize function:", error);
    $summary.innerHTML = `<div class="alert alert-danger" role="alert">
      An error occurred while generating the summary: ${error.message}
    </div>`;
  }
}

// Function to answer user's question based on the data
async function answerQuestion() {
  const userQuestion = $userQuestion.value.trim();
  if (!userQuestion) {
    $summary.innerHTML = `<div class="alert alert-warning" role="alert">
      Please enter a question to ask.
    </div>`;
    return;
  }

  const incidents = filteredIncidents();

  // Compute overall statistics with rounded counts and no zeros
  const overallStats = computeStats(incidents, "Service");
  const overallTimeOfDayStats = computeStats(incidents, "Time of Day"); // --- Addition 7: Include Time of Day Stats ---

  // --- Addition 7: Check for non-zero counts before proceeding ---
  if (overallStats.length === 0 && overallTimeOfDayStats.length === 0) {
    $summary.innerHTML = `<div class="alert alert-warning" role="alert">
      No incidents available to answer the question based on the current filters.
    </div>`;
    return;
  }
  // --- End Addition 7 ---

  // Compute network data summary
  const selectedServices = filters["Service"]
    .filter((opt) => opt.selected)
    .map((opt) => opt.value);

  const networkSummary = prepareNetworkSummary(selectedServices);

  // --- Addition 8: Update system message with instructions to highlight Time of Day ---
  const system = `As an expert analyst in financial application's incident management, answer the user's question based on the data provided.

**Important Instructions:**
- **Whole Numbers:** All incident counts should be presented as whole numbers (integers).
- **Rounding Up:** If any incident counts are fractional, they should be rounded up to the nearest whole number.
- **No Zero Incidents:** Do not mention or include any groups (services, teams, Regions, shifts, times of day) that have zero incidents.

Provide examples from both the incident data and network data to support your answer. Ensure that you highlight which time of day has experienced a higher number of incidents. Present the information concisely and ensure that the answer is directly based on the data provided and is actionable.`;
  // --- End Addition 8 ---

  // Prepare the message with user's question and data summary
  let message = `User Question:\n${userQuestion}\n\nData Summary:\n`;

  // --- Addition 9: Include Time of Day in Overall Statistics ---
  message += `Overall Service Statistics:\n`;
  overallStats.forEach((stat) => {
    message += `- Service ${stat.Service}: ${num0Rounded(stat.Count)} incidents, Avg Duration: ${num2(
      stat.AvgHours
    )} hours\n`;
  });

  message += `\nOverall Time of Day Statistics:\n`;
  overallTimeOfDayStats.forEach((stat) => {
    message += `- ${stat["Time of Day"]}: ${num0Rounded(stat.Count)} incidents, Avg Duration: ${num2(
      stat.AvgHours
    )} hours\n`;
  });
  // --- End Addition 9 ---

  // Include network data summary
  message += `\nNetwork Data Summary:\n${networkSummary}\n`;

  // Display a loading spinner
  $summary.innerHTML = `<div class="spinner-border" role="status">
    <span class="visually-hidden">Loading...</span>
  </div>`;

  // Fetch and display the answer from the AI assistant
  try {
    let fullContent = "";
    let lastContent = "";
    for await (const { content } of asyncLLM(
      "https://llmfoundry.straive.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          model: "gpt-4o-mini",
          stream: true,
          messages: [
            { role: "system", content: system },
            { role: "user", content: message },
          ],
        }),
      }
    )) {
      if (content && content !== lastContent) {
        lastContent = content;
        fullContent = content;
        $summary.innerHTML = marked.parse(fullContent);
      }
    }
  } catch (error) {
    console.error("Error in answerQuestion function:", error);
    $summary.innerHTML = `<div class="alert alert-danger" role="alert">
      An error occurred while answering the question: ${error.message}
    </div>`;
  }
}

// --- Addition 10: Update formatServiceStats to ensure inclusion of Time of Day ---
function formatServiceStats(data) {
  let result = "";

  // Problematic times
  const topShifts = data.shiftStats.sort((a, b) => b.Count - a.Count).slice(0, 2);
  const topTimesOfDay = data.timeOfDayStats.sort((a, b) => b.Count - a.Count).slice(0, 2);
  if (topShifts.length > 0 || topTimesOfDay.length > 0) {
    result += `- Problematic times:\n`;
    if (topShifts.length > 0) {
      result += `  Shifts:\n`;
      result += topShifts
        .map(
          (shift) =>
            `    ${shift.Shift}: ${num0Rounded(shift.Count)} incidents (Avg ${num2(
              shift.AvgHours
            )} hrs)`
        )
        .join("\n");
      result += "\n";
    }
    if (topTimesOfDay.length > 0) {
      result += `  Time of Day:\n`;
      result += topTimesOfDay
        .map(
          (time) =>
            `    ${time["Time of Day"]}: ${num0Rounded(time.Count)} incidents (Avg ${num2(
              time.AvgHours
            )} hrs)`
        )
        .join("\n");
      result += "\n";
    }
  }

  // Problematic Regions
  const topRegions = data.RegionStats.sort((a, b) => b.Count - a.Count).slice(0, 2);
  if (topRegions.length > 0) {
    result += `- Problematic Regions:\n`;
    result += topRegions
      .map(
        (Region) =>
          `  ${Region.Region}: ${num0Rounded(Region.Count)} incidents (Avg ${num2(
            Region.AvgHours
          )} hrs)`
      )
      .join("\n");
    result += "\n";
  }

  // Problematic teams
  const topTeams = data.teamStats.sort((a, b) => b.Count - a.Count).slice(0, 2);
  if (topTeams.length > 0) {
    result += `- Problematic teams:\n`;
    result += topTeams
      .map(
        (team) =>
          `  ${team.Team}: ${num0Rounded(team.Count)} incidents (Avg ${num2(
            team.AvgHours
          )} hrs)`
      )
      .join("\n");
    result += "\n";
  }

  // Frequent issues
  if (data.descriptionStats.length > 0) {
    result += `- Frequent issues:\n`;
    result += data.descriptionStats
      .map((desc) => `  ${desc.Description}: ${num0Rounded(desc.Count)} occurrences`)
      .join("\n");
    result += "\n";
  }

  // Impacting connections
  result += `- Impacting connections:\n  ${data.relatedServices.join(", ") || "None"}\n`;

  return result;
}
// --- End Addition 10 ---

// Helper function to format top statistics for the message
function formatTopStats(title, statsArray, keyName) {
  const topStats = statsArray.sort((a, b) => b.Count - a.Count).slice(0, 5);
  if (topStats.length === 0) return "";
  let result = `- ${title}:\n`;
  result += topStats
    .map(
      (item) =>
        `  ${item[keyName]}: ${num0Rounded(item.Count)} incidents (Avg ${num2(item.AvgHours)} hrs)`
    )
    .join("\n");
  return result + "\n\n";
}

// Helper function to prepare network data summary
function prepareNetworkSummary(selectedServices) {
  // Filter network relations based on selected services
  const relevantRelations = data.relations.filter(
    (rel) =>
      selectedServices.includes(rel.Source) || selectedServices.includes(rel.Target)
  );

  // Count the number of connections for each service
  const connectionCounts = {};
  relevantRelations.forEach((rel) => {
    const source = rel.Source;
    const target = rel.Target;

    if (!connectionCounts[source]) connectionCounts[source] = new Set();
    if (!connectionCounts[target]) connectionCounts[target] = new Set();

    connectionCounts[source].add(target);
    connectionCounts[target].add(source);
  });

  // Prepare summary lines
  let summary = "";
  for (const service of selectedServices) {
    const connections = connectionCounts[service]
      ? Array.from(connectionCounts[service])
      : [];
    summary += `- ${service} connections: ${connections.join(", ") || "None"}\n`;
  }

  return summary;
}


