Certainly! Here is the content of the **`README.md`** file for you to copy:

---

# Incident Demo 

This project is an **Incident Analysis and Visualization Tool** designed to help analysts visualize incident data using interactive Sankey diagrams and network graphs. The tool allows users to upload incident data, apply filters, adjust thresholds, and generate summaries to identify problematic areas, services, teams, and shifts.

---

## Table of Contents

- [Features](#features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Usage](#usage)
  - [Uploading Data](#uploading-data)
  - [Applying Filters](#applying-filters)
  - [Adjusting Thresholds](#adjusting-thresholds)
  - [Generating Summaries](#generating-summaries)
- [Project Structure](#project-structure)
- [Code Overview](#code-overview)
  - [Index.html](#indexhtml)
  - [Script.js](#scriptjs)
  - [Style.css](#stylecss)
- [Dependencies](#dependencies)
- [License](#license)
- [Contact](#contact)
- [Data Format](#data-format)
- [Troubleshooting](#troubleshooting)

---

## Features

- **Data Upload:** Easily upload incident data in CSV format.
- **Interactive Sankey Diagram:** Visualize the flow of incidents across different categories (Shift, Area, Team, Service).
- **Network Graph:** Display relationships between services based on incident data.
- **Dynamic Filters:** Apply filters on Area, Shift, Team, and Service to focus on specific data subsets.
- **Threshold Adjustment:** Adjust thresholds to highlight incidents based on duration.
- **Color Coding:** Nodes and links are color-coded based on incident duration.
- **Summarization:** Generate detailed summaries, including an overall summary and per-service analyses.
- **Tooltips:** Hover over nodes and links to get detailed information.

---
## Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Edge, Safari).
- Internet connection (for fetching dependencies via CDN).

### Installation

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/Mounesh301/Incident-Demo-V2.git
   ```

2. **Navigate to the Project Directory:**

   ```bash
   cd Incident-Demo-V2
   ```

3. **Open the Application:**

   Open `index.html` in your preferred web browser.

---

## Usage

### Uploading Data

- Click on the **"Upload"** button to select and upload your incident data CSV file.
- Ensure your data file adheres to the required format (see [Data Format](#data-format)).

### Applying Filters

- Use the filter dropdowns for **Area**, **Shift**, **Team**, and **Service** to refine the data.
- **Select All** and **Top 10** options are available for quick selections.
- Search within filters using the search input at the top of each dropdown.

### Adjusting Thresholds

- Use the threshold slider to set a duration threshold between **0** and **10** hours.
- Nodes with incident durations above this threshold will be highlighted in **red**.
- Nodes with durations below **2** hours will appear **green**.

### Generating Summaries

- Click on the **"Summarize"** button to generate a detailed summary of the selected data.
- The summary includes an overall analysis and per-service breakdowns.
- Recommendations and actionable insights are provided based on the data.

---

## Project Structure

```
incident-analysis-tool/
├── index.html
├── script.js
├── style.css
└── README.md
```

- **index.html**: The main HTML file containing the structure of the application.
- **script.js**: The JavaScript file handling data processing, visualization, and interactions.
- **style.css**: The CSS file for styling the application.
---

## Code Overview

### Index.html

The HTML structure includes:

- **File Upload:** Allows users to upload CSV files.
- **Filter Section:** Contains dropdowns for filtering data.
- **Threshold Slider:** Lets users adjust the duration threshold.
- **Visualization Containers:** Div elements for the Sankey diagram and network graph.
- **Summarize Button:** Triggers the summary generation.
- **Summary Section:** Displays the generated summary.

**Key Elements:**

```html
<!-- File Upload -->
<input type="file" id="upload" name="incidents" accept=".csv" />

<!-- Filters -->
<div id="filters" class="row"></div>

<!-- Threshold Slider -->
<input type="range" id="threshold" min="0" max="10" value="3" step="0.1" />

<!-- Visualization Containers -->
<div id="sankey"></div>
<div id="network"></div>

<!-- Summarize Button -->
<button id="summarize">Summarize</button>

<!-- Summary Section -->
<div id="summary"></div>
```

### Script.js

Handles:

- **Data Reading and Parsing:**
  - Uses `d3.csvParse` to parse uploaded CSV files.
  - Processes incident data and splits 'Incident Data' into separate fields.

- **Filter Management:**
  - Initializes filters for Area, Shift, Team, and Service.
  - Provides search and select all functionalities within filters.
  - Automatically selects top teams based on selected services.

- **Visualization:**
  - **Sankey Diagram:**
    - Created using the `sankey` function from the `@gramex/sankey` library.
    - Nodes and links are color-coded based on incident durations.
  - **Network Graph:**
    - Built using the `network` function from the `@gramex/network` library.
    - Visualizes relationships between services.

- **Threshold Adjustment:**
  - Updates the color scale whenever the threshold changes.
  - The `colorScale` maps incident durations to colors.

- **Summarization:**
  - Aggregates data to generate overall and per-service summaries.
  - Utilizes an async function to fetch summaries from an AI assistant.

**Key Functions:**

- `readCSV(file)`: Reads and parses the CSV file.
- `draw()`: Initiates the drawing process after data is loaded.
- `update()`: Updates the visualizations and color scales.
- `drawFilters()`: Initializes and renders filter dropdowns.
- `renderFilterOptions(key)`: Renders options for a specific filter.
- `addFilterEventListeners()`: Adds event listeners to filter elements.
- `selectTopTeams()`: Automatically selects top teams based on services.
- `filteredIncidents()`: Returns incidents filtered based on selections.
- `drawSankey()`: Creates the Sankey diagram.
- `drawNetwork()`: Creates the network graph.
- `summarize()`: Generates the summary.

### Style.css

Defines the styling for the application, including:

- Layout adjustments for responsive design.
- Styling for dropdown filters and search inputs.
- Custom styles for the Sankey diagram and network graph.
- Tooltip styles and spinner for loading states.

**Key Styles:**

```css
/* Filter Dropdowns */
.dropdown {
  position: relative;
}

/* Visualization Containers */
#sankey, #network {
  width: 100%;
  height: 600px;
}

/* Summary Section */
#summary {
  padding: 20px;
  background-color: #f9f9f9;
}
```

---

## Dependencies

The project relies on the following libraries and frameworks:

- **D3.js**: For data manipulation and visualization.
- **@gramex/sankey**: For creating Sankey diagrams.
- **@gramex/network**: For building network graphs.
- **Marked.js**: For parsing and rendering Markdown content.
- **Bootstrap 5**: For UI components and styling.
- **asyncLLM**: For handling asynchronous interactions with the AI assistant.

All dependencies are loaded via CDN for ease of use.


---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Contact

- **Project Maintainer:** [Mounesh Kalimisetty](https://github.com/Mounesh301/)
- **Email:** mounesh.kalimisetty@straive.com
- **GitHub Issues:** Please open an issue for any questions or feedback.

---

## Data Format

For the tool to function correctly, your incident data CSV file should have the following structure:

- **Required Columns:**
  - `Incident Data` (Format: `Incident|DescriptionCleaned|ImpactCleaned|ResolutionDetails`)
  - `Time of Day`
  - `Area`
  - `Shift`
  - `Team`
  - `Service`
  - `Count`
  - `Hours`

- **Notes:**
  - The `Incident Data` column should contain pipe-separated values.
  - Ensure that numerical values in `Count` and `Hours` are correctly formatted.

---

## Troubleshooting

- **Visualizations Not Displaying:**
  - Ensure that you have uploaded the correct CSV file with the required format.
  - Check the browser console for any error messages.

- **Filters Not Working:**
  - Make sure that you have selected at least one option in the filters.
  - Try refreshing the page and re-uploading your data.

- **Summary Not Generating:**
  - Confirm that you have selected services and clicked the "Summarize" button.
  - Check for any error messages in the summary section.

---

## Acknowledgments

- **D3.js Community:** For the powerful data visualization library.
- **Bootstrap Team:** For the responsive and modern UI components.
- **OpenAI GPT Models:** For enabling advanced summarization features.

---
