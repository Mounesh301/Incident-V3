// Your existing imports remain unchanged
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { sankey } from "https://cdn.jsdelivr.net/npm/@gramex/sankey@1";
import { network } from "https://cdn.jsdelivr.net/npm/@gramex/network@2/dist/network.js";
import { kpartite } from "https://cdn.jsdelivr.net/npm/@gramex/network@2/dist/kpartite.js";
import { num0, num2 } from "https://cdn.jsdelivr.net/npm/@gramex/ui@0.3/dist/format.js";
import { Marked } from "https://cdn.jsdelivr.net/npm/marked@13/+esm";
import { asyncLLM } from "https://cdn.jsdelivr.net/npm/asyncllm@1";

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

// New part added: reference to the user question textarea
const $userQuestion = document.getElementById("user-question");

const data = {};
const graphs = {};
const minDuration = 0;
const maxDuration = 10;
let threshold = parseFloat($threshold.value) || 3;
let colorScale;
const marked = new Marked();

// Global filters object to maintain selection status
const filters = {};

// Use modern file reading with file.text()
async function readCSV(file) {
  const text = await file.text();
  return d3.csvParse(text, (d) => {
    // Use d3.autoType to automatically infer data types
    const row = d3.autoType(d);

    // If 'Incident Data' exists, split it into separate fields
    if (row["Incident Data"]) {
      const incidentDataParts = row["Incident Data"].split("|");
      [row.Incident, row.DescriptionCleaned, row.ImpactCleaned, row.ResolutionDetails] = incidentDataParts;
    }

    // Ensure 'Time of Day' is included
    row["Time of Day"] = row["Time of Day"] || "";

    return row;
  });
}

// When incidents or network are uploaded, read and parse the CSV
$upload.addEventListener("change", async (e) => {
  const name = e.target.getAttribute("name");
  data[name] = await readCSV(e.target.files[0]);
  draw();
});

function draw() {
  if (!data.incidents) return;
  $result.classList.remove("d-none");
  drawFilters();
  update();
}

function update() {
  updateColorScale();
  drawSankey();
  drawNetwork();
}

// Helper function to adjust Hours and size for nodes and links
function adjustHoursAndSize(items) {
  items.forEach((d) => {
    const totalAdjustedHours = d3.sum(d.group, (d) => d.Hours * d.Count);
    const totalCount = d3.sum(d.group, (d) => d.Count);
    d.Hours = totalAdjustedHours / totalCount;
    d.size = totalCount;
  });
}

function updateColorScale() {
  colorScale = d3
    .scaleLinear()
    .domain([minDuration, 2, threshold, 4, maxDuration])
    .range(["green", "green", "yellow", "red", "red"])
    .interpolate(d3.interpolateLab)
    .clamp(true);
}

function drawFilters() {
  const filterKeys = ["Area", "Shift", "Team", "Service"];
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

  // Initialize filters object
  for (const key of filterKeys) {
    const values = [...new Set(data.incidents.map((d) => d[key]))].sort();
    filters[key] = values.map((v, index) => ({
      value: v,
      selected:
        key === "Service"
          ? preSelectedServices.includes(v)
          : key === "Team"
          ? false
          : true,
      index,
    }));
  }

  // Generate the HTML for the filters
  $filters.innerHTML = filterKeys
    .map(
      (key) => `
          <div class="col-md-3">
            <div class="dropdown">
              <button class="btn btn-secondary dropdown-toggle w-100" type="button" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">
                ${key}
              </button>
              <div class="dropdown-menu w-100" id="dropdown-menu-${key}">
                <div class="dropdown-search">
                  <input type="text" placeholder="Search ${key}..." class="search-filter">
                </div>
                <div class="dropdown-item">
                  <input type="checkbox" class="select-all" id="all-${key}" ${
        key !== "Service" && key !== "Team" ? "checked" : ""
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

  // Render the options for each filter
  for (const key of filterKeys) {
    renderFilterOptions(key);
  }

  // Add event listeners
  addFilterEventListeners();

  // Initially select top 2 teams per selected service
  selectTopTeams();
}

function renderFilterOptions(key) {
  const optionsContainer = document.getElementById(`filter-options-${key}`);

  // Get options from filters[key]
  const options = filters[key];

  // Sort options: selected options at the top, unselected below, maintaining original order among them
  options.sort((a, b) => {
    if (a.selected === b.selected) {
      return a.index - b.index; // Maintain original order
    } else if (a.selected) {
      return -1; // a is selected, so it comes before b
    } else {
      return 1; // b is selected, so a comes after b
    }
  });

  // Generate HTML for options
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

  // Update the HTML
  optionsContainer.innerHTML = optionsHTML;

  // Add event listeners to the checkboxes
  optionsContainer.querySelectorAll(".filter-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const value = checkbox.value;
      // Update the selected status in filters[key]
      const option = filters[key].find((opt) => opt.value === value);
      if (option) {
        option.selected = checkbox.checked;
      }
      if (key === "Service") {
        selectTopTeams(); // Update teams when services change
      }
      // Re-render the options for this filter
      renderFilterOptions(key);
      update();
    });
  });
}

function addFilterEventListeners() {
  // Search functionality
  document.querySelectorAll(".search-filter").forEach((input) => {
    input.addEventListener("input", (e) => {
      const searchText = e.target.value.toLowerCase();
      const dropdownMenu = e.target.closest(".dropdown-menu");
      dropdownMenu.querySelectorAll(".dropdown-item").forEach((item) => {
        const label = item.querySelector("label");
        if (!label) return;
        const text = label.textContent.toLowerCase();
        item.style.display = text.includes(searchText) ? "" : "none";
      });
    });
  });

  // Select all functionality
  document.querySelectorAll(".select-all").forEach((checkbox) => {
    checkbox.addEventListener("change", (e) => {
      const key = e.target.id.replace("all-", "");
      const checked = e.target.checked;

      // Update filters[key]
      filters[key].forEach((option) => {
        option.selected = checked;
      });

      if (key === "Service") {
        selectTopTeams(); // Update teams when services change
      }

      // Re-render options
      renderFilterOptions(key);
      update();
    });
  });

  // Top 10 functionality
  document.querySelectorAll(".top-10").forEach((checkbox) => {
    checkbox.addEventListener("change", (e) => {
      const key = e.target.id.replace("top-10-", "");
      const checked = e.target.checked;
      const top10Services = [
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

      // Update filters[key]
      filters[key].forEach((option) => {
        option.selected = top10Services.includes(option.value) ? checked : false;
      });

      // Uncheck "Select All"
      const selectAll = document.getElementById(`all-${key}`);
      if (selectAll) selectAll.checked = false;

      selectTopTeams(); // Update teams when services change

      // Re-render options
      renderFilterOptions(key);
      update();
    });
  });

  // Prevent dropdown from closing when clicking inside
  document.querySelectorAll(".dropdown-menu").forEach((menu) => {
    menu.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  });
}

function selectTopTeams() {
  // Get selected services
  const selectedServices = filters["Service"]
    .filter((opt) => opt.selected)
    .map((opt) => opt.value);

  // Unselect all teams first
  filters["Team"].forEach((option) => {
    option.selected = false;
  });

  if (selectedServices.length === 0) {
    renderFilterOptions("Team");
    return;
  }

  // Calculate top 2 teams per selected service
  const incidentsByTeamService = d3.rollups(
    data.incidents,
    (v) => d3.sum(v, (d) => d.Count), // Sum Counts to get accurate incident counts
    (d) => d.Service,
    (d) => d.Team
  );

  const topTeams = new Set();

  for (const [service, teams] of incidentsByTeamService) {
    if (selectedServices.includes(service)) {
      const sortedTeams = teams.sort((a, b) => b[1] - a[1]);
      const top2Teams = sortedTeams.slice(0, 2).map((d) => d[0]);
      top2Teams.forEach((team) => topTeams.add(team));
    }
  }

  // Select only top teams
  filters["Team"].forEach((option) => {
    if (topTeams.has(option.value)) {
      option.selected = true;
    }
  });

  // Re-render team options
  renderFilterOptions("Team");
}

function filteredIncidents() {
  const selectedValues = {};
  const filterKeys = ["Area", "Shift", "Team", "Service"];
  for (const key of filterKeys) {
    selectedValues[key] = filters[key]
      .filter((opt) => opt.selected)
      .map((opt) => opt.value);
  }

  return data.incidents.filter((row) => {
    return filterKeys.every((key) => {
      return (
        selectedValues[key].length === 0 ||
        selectedValues[key].includes(row[key])
      );
    });
  });
}

function drawSankey() {
  const incidents = filteredIncidents();
  const graph = sankey($sankey, {
    data: incidents,
    labelWidth: 100,
    categories: ["Shift", "Area", "Team", "Service"],
    size: (d) => d.Count, // Use Count to size the nodes
    text: (d) => {
      const textWidth = d.key.length * 9;
      return textWidth < d.width ? d.key : null;
    },
    d3,
  });
  graphs.sankey = graph;

  // Adjust Hours and size for nodes and links
  adjustHoursAndSize(graph.nodeData);
  adjustHoursAndSize(graph.linkData);

  // Add tooltips
  graph.nodes
    .attr("data-bs-toggle", "tooltip")
    .attr("title", (d) => `${d.key}: ${num2(d.Hours)} hours`);
  graph.links
    .attr("data-bs-toggle", "tooltip")
    .attr(
      "title",
      (d) => `${d.source.key} - ${d.target.key}: ${num2(d.Hours)} hours`
    );

  // Style text labels
  graph.texts.attr("fill", "black");
  colorSankey();
}

function colorSankey() {
  // Update the threshold display
  $thresholdDisplay.textContent = num2(threshold);

  graphs.sankey.nodes.attr("fill", (d) => colorScale(d.Hours));
  graphs.sankey.links.attr("fill", (d) => colorScale(d.Hours));
}

$showLinks.addEventListener("change", () => {
  graphs.sankey.links.classed("show", $showLinks.checked);
});

$threshold.addEventListener("input", () => {
  threshold = parseFloat($threshold.value);
  updateColorScale();
  colorSankey();
});

function drawNetwork() {
  // Use all incidents data, regardless of filters
  const incidents = data.incidents;

  // Calculate service statistics with adjusted Counts and Hours
  const serviceStats = d3.rollup(
    incidents,
    (v) => ({
      TotalHours: d3.sum(v, (d) => d.Hours * d.Count),
      Count: d3.sum(v, (d) => d.Count),
    }),
    (d) => d.Service
  );

  const { nodes, links } = kpartite(
    data.relations,
    [
      ["name", "Source"],
      ["name", "Target"],
    ],
    { count: 1 }
  );

  for (const node of nodes) {
    Object.assign(node, serviceStats.get(node.value) || { TotalHours: 0, Count: 0 });
    node.Hours = node.TotalHours / node.Count || 0;
  }

  const forces = {
    charge: () => d3.forceManyBody().strength(-200),
  };
  const graph = network($network, { nodes, links, forces, d3 });
  graphs.network = graph;
  const rScale = d3
    .scaleSqrt()
    .domain([0, d3.max(nodes, (d) => d.Count)])
    .range([1, 30]);

  graph.nodes
    .attr("fill", (d) => colorScale(d.Hours))
    .attr("stroke", "white")
    .attr("r", (d) => rScale(d.Count))
    .attr("data-bs-toggle", "tooltip")
    .attr(
      "title",
      (d) => `${d.value}: ${num2(d.Hours)} hours, ${num0(d.Count)} incidents`
    );

  graph.links
    .attr("marker-end", "url(#triangle)")
    .attr("stroke", "rgba(var(--bs-body-color-rgb), 0.2)");
}

new bootstrap.Tooltip($sankey, { selector: "[data-bs-toggle='tooltip']" });
new bootstrap.Tooltip($network, { selector: "[data-bs-toggle='tooltip']" });

$summarize.addEventListener("click", summarize);

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

  // New part: get the user's question
  const userQuestion = $userQuestion.value.trim();

  // Prepare data for summarization
  const serviceData = {};

  for (const service of selectedServices) {
    // Filter incidents for the service
    const serviceIncidents = incidents.filter((d) => d.Service === service);

    if (serviceIncidents.length === 0) continue;

    // Problematic times (Shifts and Time of Day)
    const shiftStats = d3
      .rollups(
        serviceIncidents,
        (v) => ({
          Count: d3.sum(v, (d) => d.Count),
          Hours: d3.sum(v, (d) => d.Hours * d.Count),
        }),
        (d) => d.Shift
      )
      .map(([shift, stats]) => ({
        Shift: shift,
        Count: stats.Count,
        AvgHours: stats.Hours / stats.Count,
      }));

    const timeOfDayStats = d3
      .rollups(
        serviceIncidents,
        (v) => ({
          Count: d3.sum(v, (d) => d.Count),
          Hours: d3.sum(v, (d) => d.Hours * d.Count),
        }),
        (d) => d["Time of Day"]
      )
      .map(([timeOfDay, stats]) => ({
        TimeOfDay: timeOfDay,
        Count: stats.Count,
        AvgHours: stats.Hours / stats.Count,
      }));

    // Problematic areas
    const areaStats = d3
      .rollups(
        serviceIncidents,
        (v) => ({
          Count: d3.sum(v, (d) => d.Count),
          Hours: d3.sum(v, (d) => d.Hours * d.Count),
        }),
        (d) => d.Area
      )
      .map(([area, stats]) => ({
        Area: area,
        Count: stats.Count,
        AvgHours: stats.Hours / stats.Count,
      }));

    // Problematic teams
    const teamStats = d3
      .rollups(
        serviceIncidents,
        (v) => ({
          Count: d3.sum(v, (d) => d.Count),
          Hours: d3.sum(v, (d) => d.Hours * d.Count),
        }),
        (d) => d.Team
      )
      .map(([team, stats]) => ({
        Team: team,
        Count: stats.Count,
        AvgHours: stats.Hours / stats.Count,
      }));

    // Aggregate frequent issues from 'Description Cleaned'
    const descriptionStats = d3
      .rollups(
        serviceIncidents,
        (v) => d3.sum(v, (d) => d.Count),
        (d) => d.DescriptionCleaned
      )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([description, count]) => ({
        Description: description,
        Count: count,
      }));

    // Connections with other services
    const relatedServices = data.relations
      .filter((rel) => rel.Source === service || rel.Target === service)
      .map((rel) => (rel.Source === service ? rel.Target : rel.Source));

    serviceData[service] = {
      shiftStats,
      timeOfDayStats,
      areaStats,
      teamStats,
      descriptionStats,
      relatedServices,
    };
  }

  // **Compute Overall Statistics**

  // Problematic Services
  const overallServiceStats = d3
    .rollups(
      incidents,
      (v) => ({
        Count: d3.sum(v, (d) => d.Count),
        Hours: d3.sum(v, (d) => d.Hours * d.Count),
      }),
      (d) => d.Service
    )
    .map(([service, stats]) => ({
      Service: service,
      Count: stats.Count,
      AvgHours: stats.Hours / stats.Count,
    }));

  // Problematic Teams
  const overallTeamStats = d3
    .rollups(
      incidents,
      (v) => ({
        Count: d3.sum(v, (d) => d.Count),
        Hours: d3.sum(v, (d) => d.Hours * d.Count),
      }),
      (d) => d.Team
    )
    .map(([team, stats]) => ({
      Team: team,
      Count: stats.Count,
      AvgHours: stats.Hours / stats.Count,
    }));

  // Problematic Areas
  const overallAreaStats = d3
    .rollups(
      incidents,
      (v) => ({
        Count: d3.sum(v, (d) => d.Count),
        Hours: d3.sum(v, (d) => d.Hours * d.Count),
      }),
      (d) => d.Area
    )
    .map(([area, stats]) => ({
      Area: area,
      Count: stats.Count,
      AvgHours: stats.Hours / stats.Count,
    }));

  // Problematic Shifts
  const overallShiftStats = d3
    .rollups(
      incidents,
      (v) => ({
        Count: d3.sum(v, (d) => d.Count),
        Hours: d3.sum(v, (d) => d.Hours * d.Count),
      }),
      (d) => d.Shift
    )
    .map(([shift, stats]) => ({
      Shift: shift,
      Count: stats.Count,
      AvgHours: stats.Hours / stats.Count,
    }));

  // The System Message
  // Modified to include instruction to answer the user's question first
  const system = `As an expert analyst in financial application's incident management.
  1.First answer the user's question based on the data provided.
    a. Give examples from the data, to validate your answer.
  2. Then provide a concise overall summary for the selected services, focusing on:
    a. Overall problematic services, along with teams, areas and shifts (only top 2 or 3).
    b. Services, teams, areas and shifts which are way beyond threshold duration (only top 2 or 3).
    c. Narrate story flow linking services, teams, areas and shifts with sub heading 'Analysis' (in 4 points).
  3. Then provide concise Recommendations for the problems in overall summary, which focuses on:  
    a. Connections with other services that might have impacted problematic services.
    b. Recommendations specific to the current data provided.

  Present the information concisely using bullet points under each section. Ensure that the summary is directly based on the data provided and is actionable.`;
  // Prepare the Message with Aggregated Data
  let message = `Selected Services:\n${selectedServices.join(", ")}\n\n`;

  // Include the user's question at the beginning of the message
  if (userQuestion) {
    message += `User Question:\n${userQuestion}\n\n`;
  }

  message += `Overall Summary:\n`;

  const topServices = overallServiceStats
    .sort((a, b) => b.Count - a.Count)
    .slice(0, 5);
  if (topServices.length > 0) {
    message += `- Problematic services:\n`;
    message += topServices
      .map(
        (service) =>
          `  ${service.Service}: ${num0(service.Count)} incidents (Avg ${num2(
            service.AvgHours
          )} hrs)`
      )
      .join("\n");
    message += `\n`;
  }

  // Problematic Teams
  const topTeams = overallTeamStats.sort((a, b) => b.Count - a.Count).slice(0, 5);
  if (topTeams.length > 0) {
    message += `- Problematic teams:\n`;
    message += topTeams
      .map(
        (team) =>
          `  ${team.Team}: ${num0(team.Count)} incidents (Avg ${num2(
            team.AvgHours
          )} hrs)`
      )
      .join("\n");
    message += `\n`;
  }

  // Problematic Areas
  const topAreas = overallAreaStats.sort((a, b) => b.Count - a.Count).slice(0, 5);
  if (topAreas.length > 0) {
    message += `- Problematic areas:\n`;
    message += topAreas
      .map(
        (area) =>
          `  ${area.Area}: ${num0(area.Count)} incidents (Avg ${num2(
            area.AvgHours
          )} hrs)`
      )
      .join("\n");
    message += `\n`;
  }

  // Problematic Shifts
  const topShifts = overallShiftStats
    .sort((a, b) => b.Count - a.Count)
    .slice(0, 5);
  if (topShifts.length > 0) {
    message += `- Problematic shifts:\n`;
    message += topShifts
      .map(
        (shift) =>
          `  ${shift.Shift}: ${num0(shift.Count)} incidents (Avg ${num2(
            shift.AvgHours
          )} hrs)`
      )
      .join("\n");
    message += `\n`;
  }

  // Add a separator
  message += `\n`;

  // **Per-Service Summaries**

  for (const service of selectedServices) {
    const data = serviceData[service];
    if (!data) continue;

    message += `Service: ${service}\n`;

    // Problematic Times
    const topShifts = data.shiftStats.sort((a, b) => b.Count - a.Count).slice(0, 2);
    const topTimesOfDay = data.timeOfDayStats
      .sort((a, b) => b.Count - a.Count)
      .slice(0, 2);
    if (topShifts.length > 0 || topTimesOfDay.length > 0) {
      message += `- Problematic times:\n`;
      if (topShifts.length > 0) {
        message += `  Shifts:\n`;
        message += topShifts
          .map(
            (shift) =>
              `    ${shift.Shift}: ${num0(shift.Count)} incidents (Avg ${num2(
                shift.AvgHours
              )} hrs)`
          )
          .join("\n");
        message += "\n";
      }
      if (topTimesOfDay.length > 0) {
        message += `  Time of Day:\n`;
        message += topTimesOfDay
          .map(
            (time) =>
              `    ${time.TimeOfDay}: ${num0(time.Count)} incidents (Avg ${num2(
                time.AvgHours
              )} hrs)`
          )
          .join("\n");
        message += "\n";
      }
    }

    // Problematic Areas
    const topAreas = data.areaStats.sort((a, b) => b.Count - a.Count).slice(0, 2);
    if (topAreas.length > 0) {
      message += `- Problematic areas:\n`;
      message += topAreas
        .map(
          (area) =>
            `  ${area.Area}: ${num0(area.Count)} incidents (Avg ${num2(
              area.AvgHours
            )} hrs)`
        )
        .join("\n");
      message += "\n";
    }

    // Problematic Teams
    const topTeams = data.teamStats.sort((a, b) => b.Count - a.Count).slice(0, 2);
    if (topTeams.length > 0) {
      message += `- Problematic teams:\n`;
      message += topTeams
        .map(
          (team) =>
            `  ${team.Team}: ${num0(team.Count)} incidents (Avg ${num2(
              team.AvgHours
            )} hrs)`
        )
        .join("\n");
      message += "\n";
    }

    // Frequent Issues
    if (data.descriptionStats.length > 0) {
      message += `- Frequent issues:\n`;
      message += data.descriptionStats
        .map(
          (desc) => `  ${desc.Description}: ${num0(desc.Count)} occurrences`
        )
        .join("\n");
      message += "\n";
    }

    // Impacting Connections
    if (data.relatedServices.length > 0) {
      message += `- Impacting connections:\n  ${data.relatedServices.join(", ")}\n`;
    } else {
      message += `- Impacting connections: None\n`;
    }

    // Add a separator between services
    message += `\n`;
  }
  // Display a loading spinner
  $summary.innerHTML = /* html */ `<div class="spinner-border" role="status">
    <span class="visually-hidden">Loading...</span>
  </div>`;

  let fullContent = "";
  let lastContent = "";

  try {
    // Process the streamed response
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
        lastContent = content; // Track last seen content to avoid duplication
        fullContent = content; // Replace with the latest chunk
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

// Rest of your code remains unchanged
