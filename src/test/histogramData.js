export const openaiConversationAnalysis = ` WorkflowInterpreter (first agent) must do Python-side ingestion and pre-analysis of the price CSV so downstream agents can compute an optimal histogram and handle outliers correctly.

**Objective for this agent**
- Support building a complete, validated, production-ready D3.js histogram of price distribution by (1) reading/cleaning the dataset and (2) generating *dynamic agent definitions* and analysis context that tell the next agent (HistogramAnalyzer) exactly how to bin and treat outliers for this specific distribution (majority in $30–$500, extreme values up to $9,502).

**Input data to read/analyze (verbatim file specifics)**
- Data type: csv_file
- Source path (verbatim): C:/repos/SAGAMiddleware/data/prices.csv
- Declared structure:
  - Columns: ["price"] (single-column numeric price data)
  - Row count: 1000
- File/data characteristics that must be explicitly handled in ingestion and analysis:
  - Excel export with **UTF-8 BOM**
  - CSV contains **2 header rows** (so parsing must skip/handle the extra header line, not just a standard single header)
  - Values range from **$23 to $9,502**
  - Contains **outliers**
  - Majority of values are **$30–$500**
  - Records are at **5-min intervals** (not a required field for histogram, but part of the dataset context)

**What WorkflowInterpreter must do (analysis deliverables)**
1. **Read and parse the CSV correctly**
   - Ensure the price column is extracted as numeric despite UTF-8 BOM and the presence of *two header rows*.
   - Clean/convert values to numeric (and track invalid/missing rows if they occur).

2. **Preliminary histogram-oriented analysis (to enable optimal downstream configuration)**
   - Provide inputs/justification needed for bin-count calculation approach (e.g., what rule candidates should be applied downstream and what dataset stats are needed).
   - Determine overall data range and also propose alternative visualization ranges appropriate for heavy right-tail/outliers (e.g., trimmed or winsorized ranges) so the histogram can be both truthful and readable.
   - Propose explicit outlier-handling strategy candidates suitable for this distribution (e.g., IQR-based fences and/or percentile-based thresholds), including the *parameters* to use downstream (what to compute and apply).

3. **Create dynamic agent definitions tailored to this dataset**
   - The agent must output concrete instructions/configuration for HistogramAnalyzer that reflect:
     - Distribution shape expectation (dense mass $30–$500, extreme outliers to $9,502)
     - Exact ingestion quirks (UTF-8 BOM, 2 header rows)
     - Which outlier and binning methods to run and what statistics to compute

**Required outputs (must match the agent’s output schema exactly)**
WorkflowInterpreter must output three dictionaries:
- agent_definitions (dict): downstream definitions/instructions/config for HistogramAnalyzer to run histogram analysis optimally for this file and distribution.
- analysis_context (dict): Python ingestion and cleaning context required downstream (encoding/BOM handling, header-row skip count, numeric conversion assumptions, candidate binning/outlier methods and parameters).
- data_summary (dict): dataset summary *extracted from the file* (not only the provided description), suitable for downstream use, including at least: observed count, min/max, confirmation of typical range, and counts/notes for missing or invalid price values and detected outliers.`

export const geminiConversationAnalysis = `The first agent, WorkflowInterpreter, is a Python coding agent tasked with reading and analyzing price data from a CSV file. The specific file to be processed 
is located at C:/repos/SAGAMiddleware/data/prices.csv. This input file contains 1000 rows of single-column price data. The data characteristics are: a price range of $23 to $9,502 with outliers, a majority of values between $30 and $500, and its format is an Excel export with a UTF-8 BOM, 2 header rows, and data recorded in 5-minute intervals. 
The agent will use this data to create dynamic agent definitions and Python code contexts for subsequent agents, which will define the strategies for optimal histogram bin count calculation, range determination, and outlier handling.`

export const histoRequirementsResultJSON = `{"CSV_FILE_PATH": "C:/repos/SAGAMiddleware/data/prices.csv"}
{"REQUIREMENTS": ["Data profiling.", "Excel export, UTF-8 BOM, 2 header rows, 5-min intervals", "The task is to provide a histogram based on the distribution of the prices in the CSV file.", "Examine the data to provide an optimal approach to the bin sizes.", "Provide a detailed analysis for a coding agent."]}`;

export const histoFlowDefineingAgentResult = `{
  agentName: 'FlowDefiningAgent',
  result:  <!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Agent Flow</title>
</head>
<body>
  <flow>A1 -> A2 -> A3</flow>
  <script type="application/json" id="toolUsers">
    {"toolUsers": ["Data Profiler and Statistical Analyzer", "Bin Strategy Calculator", "Histogram Generator, D3.js Output"]}
  </script>
</body>
</html>
`
export const dataProfilerError = `{
  "content": [
    {
      "type": "text",
      "text": "STDERR:\nTraceback (most recent call last):\r\n  File \"C:\\repos\\codeGen-mcp-server\\workspace\\script_1762895172801.py\", line 3, in <module>\r\n    from scipy import stats\r\nModuleNotFoundError: No module named 'scipy'"
    },
    {
      "type": "text",
      "text": "ERROR: Command failed: py \"C:\\repos\\codeGen-mcp-server\\workspace\\script_1762895172801.py\"\nTraceback (most recent call last):\r\n  File \"C:\\repos\\codeGen-mcp-server\\workspace\\script_1762895172801.py\", line 3, in <module>\r\n    from scipy import stats\r\nModuleNotFoundError: No module named 'scipy'\r\n"
    }
  ],
  "success": false,
  "stdout": "",
  "stderr": "Traceback (most recent call last):\r\n  File \"C:\\repos\\codeGen-mcp-server\\workspace\\script_1762895172801.py\", line 3, in <module>\r\n    from scipy import stats\r\nModuleNotFoundError: No module named 'scipy'",
  "error": "Command failed: py \"C:\\repos\\codeGen-mcp-server\\workspace\\script_1762895172801.py\"\nTraceback (most recent call last):\r\n  File \"C:\\repos\\codeGen-mcp-server\\workspace\\script_1762895172801.py\", line 3, in <module>\r\n    from scipy import stats\r\nModuleNotFoundError: No module named 'scipy'\r\n",
  "filename": "script_1762895172801.py"
}
`
export const fixedByValidationProcessDataProfilerPython = ` import pandas as pd
import numpy as np
import json


def compute_skewness(prices: np.ndarray) -> float:
    # Biased (population) skewness to mirror scipy.stats.skew default (bias=True)
    mean = np.mean(prices)
    m2 = np.mean((prices - mean) ** 2)
    if m2 == 0:
        return 0.0
    m3 = np.mean((prices - mean) ** 3)
    return m3 / (m2 ** 1.5)


def compute_kurtosis(prices: np.ndarray) -> float:
    # Fisher's definition (normal -> 0), biased estimator to mirror scipy.stats.kurtosis defaults
    mean = np.mean(prices)
    m2 = np.mean((prices - mean) ** 2)
    if m2 == 0:
        return 0.0
    m4 = np.mean((prices - mean) ** 4)
    return (m4 / (m2 ** 2)) - 3.0


def main():
    # 1. Read CSV and extract prices (column name is lowercase 'price')
    df = pd.read_csv('C:/repos/SAGAMiddleware/data/prices.csv')
    if 'price' not in df.columns:
        raise KeyError("Expected column 'price' not found in the CSV.")
    prices = df['price'].values

    # 2. Core statistics (use ddof=1 for sample std/variance)
    count = len(prices)
    min_val = np.min(prices)
    max_val = np.max(prices)
    mean_val = np.mean(prices)
    median_val = np.median(prices)
    std_val = np.std(prices, ddof=1)
    var_val = np.var(prices, ddof=1)

    # 3. Quartiles and IQR
    q1 = np.percentile(prices, 25)
    q2 = np.percentile(prices, 50)
    q3 = np.percentile(prices, 75)
    iqr = q3 - q1

    # 4. Distribution metrics (no scipy)
    skewness = compute_skewness(prices)
    kurtosis = compute_kurtosis(prices)

    # 5. Outliers via IQR method
    lower_bound = q1 - 1.5 * iqr
    upper_bound = q3 + 1.5 * iqr
    outliers = prices[(prices < lower_bound) | (prices > upper_bound)]
    outlier_count = len(outliers)
    outlier_percentage = (outlier_count / count) * 100 if count > 0 else 0.0

    stats_dict = {
        'count': int(count),
        'min': float(min_val),
        'max': float(max_val),
        'mean': float(mean_val),
        'median': float(median_val),
        'std': float(std_val),
        'variance': float(var_val),
        'q1': float(q1),
        'q2': float(q2),
        'q3': float(q3),
        'iqr': float(iqr),
        'skewness': float(skewness),
        'kurtosis': float(kurtosis),
        'outlier_count': int(outlier_count),
        'outlier_percentage': float(outlier_percentage),
        'lower_bound': float(lower_bound),
        'upper_bound': float(upper_bound),
        'prices': prices.tolist(),
    }

    # Optional: verify record count (as per instructions)
    # This will not raise, but could be enabled if strict validation is needed.
    # expected_count = 9998
    # if stats_dict['count'] != expected_count:
    #     print(f"Warning: Expected {expected_count} records, found {stats_dict['count']}.")

    print(json.dumps(stats_dict))


if __name__ == '__main__':
    main()`
export const pythonSuccessResult = `{
  "content": [
    {
      "type": "text",
      "text": "[MCP-SERVER] Auto-loaded previous result (dict) with keys: ['strategies', 'recommended', 'recommendation_reason', 'statistics', 'prices', 'distribution_characteristics']\r\nData profiling complete: 9995 valid prices analyzed\r\nPrice range: 11.00 to 17242.00\r\nMean: 179.39, Median: 103.00, Std: 420.97\r\n[MCP-SERVER] Persisted dictionary 'output' with keys: ['prices', 'statistics', 'data_quality']"
    }
  ],
  "success": true,
  "stdout": "[MCP-SERVER] Auto-loaded previous result (dict) with keys: ['strategies', 'recommended', 'recommendation_reason', 'statistics', 'prices', 'distribution_characteristics']\r\nData profiling complete: 9995 valid prices analyzed\r\nPrice range: 11.00 to 17242.00\r\nMean: 179.39, Median: 103.00, Std: 420.97\r\n[MCP-SERVER] Persisted dictionary 'output' with keys: ['prices', 'statistics', 'data_quality']",
  "stderr": "",
  "filename": "script_1763248878043.py"
}
`
export const pythonHistoAnalysis_1 = `{
  agentName: 'ValidatingAgent',
  result: 'For the d3.js coding agent: data-driven binning analysis and implementation guidance\n' +
    '\n' +
    'What’s in your JSON (key points to reuse in code)\n' +
    '- Sample size (after preprocessing): 992\n' +
    '- Domain (min, max): [46.887618140501345, 149.9440078317401] (range ≈ 103.0564)\n' +
    '- Mean: ≈ 99.21\n' +
    '- Preprocessing note: outliers_removed = 8, transformation_applied = "log" (log used in preprocessing; the d3_data values are still on the original linear scale)\n' +
    '- Existing histogram in context: 29 variable-width bins (bin widths grow with value, consistent with equal-width binning in log space).\n' +
    '- Densest region: roughly 100–114 (Bins 19–22), peaking at Bin 21 with 92 counts (~9.27%)\n' +
    '\n' +
    'Extracted current binning (use these thresholds to reproduce the provided histogram)\n' +
    '- Bin count: 29\n' +
    '- Threshold array (30 edges):\n' +
    '[46.887618140501345, 48.80535929512965, 50.80153759973504, 52.87936119660601, 55.04216944362144, 57.29343828107339, 59.63678581799727, 62.07597814698735, 64.61493539684291, 67.25773803277245, 70.00863341428133, 72.87204262128223, 75.852567559399, 78.95499835588322, 82.18432105802951, 85.54572564646237, 89.04461437617273, 92.68661045870967, 96.4775670994807, 100.42357690468488, 104.53098167299703, 108.80638258773968, 113.256650825923, 117.88893860120298, 122.71069065850548, 127.72965623878954, 132.9539015331792, 138.3918226464791, 144.05215909090865, 149.9440078317401]\n' +
    '- Width summary (for awareness):\n' +
    '  - Min width ≈ 1.9177 (first bin)\n' +
    '  - Max width ≈ 5.8918 (last bin)\n' +
    '  - Widths increase monotonically with value (indicative of log-space binning)\n' +
    '\n' +
    'Recommendation: which binning to use and why\n' +
    '- If your goal is to match the existing analysis exactly (recommended for consistency): reuse the 29 variable-width bins above. These appear to be equal-width in log space (hence wider intervals at higher values). This is suitable when the data were log-checked for outliers and show mild right-tailed behavior, as it preserves relative detail across the lower range without over-fragmenting the high range.\n' +
    '- If you prefer uniform linear bins (simpler and commonly used): target 16–18 bins for 992 observations over a 103 range.\n' +
    '  - Practical pick: 18 bins\n' +
    '  - Linear bin width ≈ 103.0564 / 18 ≈ 5.725\n' +
    '  - This strikes a balance (Scott/Freedman–Diaconis guidance typically yields 15–18 bins for n≈1000 with moderate spread).\n' +
    '- If you prefer equal-width bins in log space on a linear axis (alternative to the provided 29): use 20 log bins.\n' +
    '  - Ratio r = (max/min)^(1/20) ≈ (149.9440078317401 / 46.887618140501345)^(1/20) ≈ 1.0599\n' +
    '  - Edges: e0 = min; ei = e0 * r^i for i = 0..20\n' +
    '\n' +
    'd3.js implementation guidance\n' +
    '\n' +
    'Option A — Reproduce the provided histogram (variable-width thresholds)\n' +
    '- Accessor: d => d.price\n' +
    '- Domain: [46.887618140501345, 149.9440078317401]\n' +
    '- Thresholds: use the 30-edge array above\n' +
    '- Histogram generator:\n' +
    '  - const histogram = d3.bin()\n' +
    '      .value(d => d.price)\n' +
    '      .domain([min, max])\n' +
    '      .thresholds(thresholdsArray);\n' +
    '- Scales:\n' +
    '  - x: d3.scaleLinear().domain([min, max]).range([0, width])\n' +
    '  - y: d3.scaleLinear().domain([0, d3.max(bins, b => b.length)]).nice()\n' +
    '- Rects:\n' +
    '  - x: x(b.x0)\n' +
    '  - width: x(b.x1) - x(b.x0)\n' +
    '  - y/height: based on b.length (counts) or density (see note below)\n' +
    '- Axis and labels:\n' +
    '  - Use ticks from visualization_config or x.ticks(10) with x-axis labels “Price” and y-axis “Frequency”\n' +
    '- Density (optional, recommended for variable-width bins):\n' +
    '  - If you compare frequency per unit width, draw height as density = b.length / (b.x1 - b.x0)\n' +
    '  - Then set y-scale domain to [0, d3.max(bins, b => b.length / (b.x1 - b.x0))]\n' +
    '  - Label y-axis “Count per unit” or “Density”\n' +
    '\n' +
    'Option B — Uniform linear bins (18 bins)\n' +
    '- Bin width: ~5.725\n' +
    '- Thresholds:\n' +
    '  - const thresholds = d3.range(min, max, 5.725).concat([max]);\n' +
    '- Histogram:\n' +
    '  - d3.bin().value(d => d.price).domain([min, max]).thresholds(thresholds)\n' +
    '- Rendering:\n' +
    '  - Same as Option A, but counts are directly comparable (uniform width), so use y based on b.length\n' +
    '\n' +
    'Option C — Equal-width bins in log space (20 bins)\n' +
    '- Keep the x-axis linear (unless you intentionally want to show a log axis)\n' +
    '- Compute edges:\n' +
    '  - const r = Math.pow(max / min, 1/20);\n' +
    '  - const thresholds = d3.range(0, 21).map(i => min * Math.pow(r, i));\n' +
    '- Histogram:\n' +
    '  - d3.bin().value(d => d.price).domain([min, max]).thresholds(thresholds)\n' +
    '- Rendering:\n' +
    '  - Same as Option A (consider density if you need fair height comparisons)\n' +
    '\n' +
    'Additional coding notes\n' +
    '- Data binding: use the “d3_data” array; accessor is d.price\n' +
    '- Percentages: if desired, scale y by (b.length / n) and format as percent on the y-axis; the summary_stats total_count = 992\n' +
    '- Ticks: you can reuse visualization_config.ticks if you want consistent framing\n' +
    '- Tooltips: show x0–x1 range, count, and optionally percentage (count/n)\n' +
    '- Aesthetic defaults: 1–2 px stroke for bars, 0.8 opacity; sort bins by x0 increasing (default from d3.bin)\n' +
    '\n' +
    'Summary decision\n' +
    '- Best fit to the provided analysis: use the 29 variable-width bins (Option A) with thresholds taken from histogram_data (array above). This preserves the original analytical intent (log-space binning), highlights the concentration around ~100–114 clearly, and aligns your chart with the earlier preprocessing choices.\n' +
    '- If you need a simpler, conventional histogram: use 18 uniform linear bins (Option B) at ~5.725 width.',
  success: true,
  error: undefined,
  timestamp: 2025-12-07T20:36:48.835Z
}`

export const pythonHistoAnalysis = `For the d3.js coding agent

Summary of the data (from provided JSON)
- n = 9,995 observations
- min = 11, max = 17,242, range = 17,231
- mean ≈ 179.39, median = 103
- Q1 = 69, Q3 = 172, IQR = 103
- std ≈ 420.97
- Skewness ≈ 19.06, Kurtosis ≈ 525.26 (extremely right‑skewed with a very long tail)

Available binning rules (extracted)
- Freedman–Diaconis (recommended for skewed data, outlier resistant)
  - bin width h ≈ 9.5633
  - implied full-range bins ≈ range / h ≈ 17,231 / 9.5633 ≈ 1,800 (the tool capped this at 1,000)
- Scott’s rule (general purpose)
  - num bins ≈ 252
  - bin width ≈ 68.3997
- Square-root (quick estimate)
  - num bins ≈ 100
  - bin width ≈ 172.31
- Sturges (good for near-normal, too coarse here)
  - num bins ≈ 15
  - bin width ≈ 1,148.73

Recommendation for implementation in d3
Because of the extreme right tail (max 17,242; median 103), using Freedman–Diaconis across the full domain would produce too many bins for a single-view histogram. Two robust options are recommended:

Option A (recommended single-view on linear scale): truncate + FD
- Keep the linear scale for readability near the bulk.
- Truncate the domain to a high percentile (e.g., p99.5) or a fixed cutoff (e.g., 1,000) and add an overflow indicator for values above the cutoff.
- Use Freedman–Diaconis on the truncated subset to preserve resolution where the mass is.
- Practical bin counts using FD width h ≈ 9.5633:
  - Cutoff = 500 → bins ≈ (500 − 11) / 9.5633 ≈ 51
  - Cutoff = 1,000 → bins ≈ (1,000 − 11) / 9.5633 ≈ 103
  - Cutoff = 2,000 → bins ≈ (2,000 − 11) / 9.5633 ≈ 208
- This yields performant, high-resolution views of the bulk with a clear overflow tally.

Option B (full-range view): log-scale histogram
- Use a log10 x scale over [minPositive, max] (minPositive = 11) and about 60–120 thresholds spaced evenly in log space.
- This shows the entire tail without exploding bin counts, but note that bin widths are multiplicative and bar widths should be rendered against the log scale.

Concrete guidance and d3 setup

Data preparation (assumes prices is a flat numeric array):
- Use d3.extent(prices) for min/max.
- Compute a high-percentile cutoff or choose a fixed one.
- Keep two arrays: filtered (≤ cutoff) and overflow (> cutoff) for Option A.

Option A code sketch (linear, truncated FD with overflow)
- This uses d3.thresholdFreedmanDiaconis on the filtered subset, which d3.bin can call directly.

  const raw = prices;
  // Choose a robust cutoff (either percentile or a fixed number):
  // Percentile route (p = 0.995):
  const sorted = raw.slice().sort(d3.ascending);
  const cutoff = d3.quantileSorted(sorted, 0.995);  // or set const cutoff = 1000;

  const data = raw.filter(d => d <= cutoff);
  const overflowCount = raw.length - data.length;

  const x = d3.scaleLinear()
    .domain([d3.min(data), cutoff])
    .range([0, width])
    .nice();

  const bin = d3.bin()
    .domain(x.domain())
    .thresholds(d3.thresholdFreedmanDiaconis); // FD on truncated subset

  const bins = bin(data);

  // Draw standard rects for bins.
  // Add an overflow indicator as a separate bar or annotation:
  // e.g., a small bar to the right of cutoff showing overflowCount (styled differently),
  // or a legend/label: $/{overflowCount} values > $/{d3.format(",")(Math.round(cutoff))}.

  // Axis and formatting
  const xAxis = d3.axisBottom(x).ticks(10, "~s");
  const yAxis = d3.axisLeft(y).ticks(6, "~s");

Notes for Option A
- Expect bins near width ≈ 9.56 (FD) within the truncated domain.
- With cutoff 1,000, you’ll get ~103 bins; with cutoff 500, ~51 bins; adjust based on performance/space.
- Clearly label the overflow, e.g., “n = X above cutoff Y”.
- Consider a small inset plot for the tail (cutoff .. max) using coarser binning (e.g., Scott) to contextualize outliers.

Option B code sketch (log-scale, full domain)
- Use log-spaced thresholds for consistent bar widths in log space.

  const raw = prices;
  const min = d3.min(raw);  // 11
  const max = d3.max(raw);  // 17242

  const x = d3.scaleLog()
    .domain([min, max])
    .range([0, width]);

  // Choose target number of bins on the log axis (e.g., 80):
  const logMin = Math.log10(min);
  const logMax = Math.log10(max);
  const nBins = 80;
  const thresholds = d3.range(0, nBins + 1).map(i => {
    const t = logMin + i * (logMax - logMin) / nBins;
    return Math.pow(10, t);
  });

  const bin = d3.bin()
    .domain([min, max])
    .thresholds(thresholds);

  const bins = bin(raw);

  // Use x(d.x0) and x(d.x1) for bar placement and width on the log scale.
  // Axis:
  const xAxis = d3.axisBottom(x)
    .ticks(10, "~s"); // d3 will pick log-appropriate ticks

  // Labeling tip: show counts in tooltips; consider density if comparing subsets.

Alternative single-view fallback (no truncation, linear): Scott’s rule
- If you must show the full range on linear scale without log, prefer Scott for a reasonable bin count across the full domain.

  const x = d3.scaleLinear().domain([min, max]).range([0, width]).nice();

  const bin = d3.bin()
    .domain(x.domain())
    .thresholds(d3.thresholdScott); // ~252 bins, width ~68.4

  const bins = bin(prices);

  // This preserves the entire tail but compresses the dense region around 50–200.

Accessibility and performance notes
- Use d3.format(",d") or "~s" for human-friendly labels.
- Render performance: aim for ≤ 200 rects per layer for smooth interactivity. That’s why we cap/clip for FD or use log thresholds.
- Tooltips should show [x0, x1) and count. For log bins, include both raw and log-range in the tooltip if helpful.
- If adding an inset tail plot, sync color scales and add a clear caption explaining binning differences.

What to implement (actionable)
- Default: Option A with cutoff = p99.5 and FD thresholds (label overflow).
- Add a toggle to switch to “View full range (log scale)” = Option B.
- Provide constants for known widths:
  - FD width ≈ 9.5633
  - Scott width ≈ 68.3997
- Expose a prop to set the cutoff value or percentile and the number of log bins for the alternate view.
CONTEXT MGR D3JSCoordinatingAgent
HERE IN PIPE VAL  {
  agentName: 'ValidatingAgent',
  result: 'For the d3.js coding agent\n' +
    '\n' +
    'Summary of the data (from provided JSON)\n' +
    '- n = 9,995 observations\n' +
    '- min = 11, max = 17,242, range = 17,231\n' +
    '- mean ≈ 179.39, median = 103\n' +
    '- Q1 = 69, Q3 = 172, IQR = 103\n' +
    '- std ≈ 420.97\n' +
    '- Skewness ≈ 19.06, Kurtosis ≈ 525.26 (extremely right‑skewed with a very long tail)\n' +
    '\n' +
    'Available binning rules (extracted)\n' +
    '- Freedman–Diaconis (recommended for skewed data, outlier resistant)\n' +
    '  - bin width h ≈ 9.5633\n' +
    '  - implied full-range bins ≈ range / h ≈ 17,231 / 9.5633 ≈ 1,800 (the tool capped this at 1,000)\n' +
    '- Scott’s rule (general purpose)\n' +
    '  - num bins ≈ 252\n' +
    '  - bin width ≈ 68.3997\n' +
    '- Square-root (quick estimate)\n' +
    '  - num bins ≈ 100\n' +
    '  - bin width ≈ 172.31\n' +
    '- Sturges (good for near-normal, too coarse here)\n' +
    '  - num bins ≈ 15\n' +
    '  - bin width ≈ 1,148.73\n' +
    '\n' +
    'Recommendation for implementation in d3\n' +
    'Because of the extreme right tail (max 17,242; median 103), using Freedman–Diaconis across the full domain would produce too many bins for a single-view histogram. Two robust options are recommended:\n' +
    '\n' +
    'Option A (recommended single-view on linear scale): truncate + FD\n' +
    '- Keep the linear scale for readability near the bulk.\n' +
    '- Truncate the domain to a high percentile (e.g., p99.5) or a fixed cutoff (e.g., 1,000) and add an overflow indicator for values above the cutoff.\n' +
    '- Use Freedman–Diaconis on the truncated subset to preserve resolution where the mass is.\n' +
    '- Practical bin counts using FD width h ≈ 9.5633:\n' +
    '  - Cutoff = 500 → bins ≈ (500 − 11) / 9.5633 ≈ 51\n' +
    '  - Cutoff = 1,000 → bins ≈ (1,000 − 11) / 9.5633 ≈ 103\n' +
    '  - Cutoff = 2,000 → bins ≈ (2,000 − 11) / 9.5633 ≈ 208\n' +
    '- This yields performant, high-resolution views of the bulk with a clear overflow tally.\n' +
    '\n' +
    'Option B (full-range view): log-scale histogram\n' +
    '- Use a log10 x scale over [minPositive, max] (minPositive = 11) and about 60–120 thresholds spaced evenly in log space.\n' +
    '- This shows the entire tail without exploding bin counts, but note that bin widths are multiplicative and bar widths should be rendered against the log scale.\n' +
    '\n' +
    'Concrete guidance and d3 setup\n' +
    '\n' +
    'Data preparation (assumes prices is a flat numeric array):\n' +
    '- Use d3.extent(prices) for min/max.\n' +
    '- Compute a high-percentile cutoff or choose a fixed one.\n' +
    '- Keep two arrays: filtered (≤ cutoff) and overflow (> cutoff) for Option A.\n' +
    '\n' +
    'Option A code sketch (linear, truncated FD with overflow)\n' +
    '- This uses d3.thresholdFreedmanDiaconis on the filtered subset, which d3.bin can call directly.\n' +
    '\n' +
    '  const raw = prices;\n' +
    '  // Choose a robust cutoff (either percentile or a fixed number):\n' +
    '  // Percentile route (p = 0.995):\n' +
    '  const sorted = raw.slice().sort(d3.ascending);\n' +
    '  const cutoff = d3.quantileSorted(sorted, 0.995);  // or set const cutoff = 1000;\n' +
    '\n' +
    '  const data = raw.filter(d => d <= cutoff);\n' +
    '  const overflowCount = raw.length - data.length;\n' +
    '\n' +
    '  const x = d3.scaleLinear()\n' +
    '    .domain([d3.min(data), cutoff])\n' +
    '    .range([0, width])\n' +
    '    .nice();\n' +
    '\n' +
    '  const bin = d3.bin()\n' +
    '    .domain(x.domain())\n' +
    '    .thresholds(d3.thresholdFreedmanDiaconis); // FD on truncated subset\n' +
    '\n' +
    '  const bins = bin(data);\n' +
    '\n' +
    '  // Draw standard rects for bins.\n' +
    '  // Add an overflow indicator as a separate bar or annotation:\n' +
    '  // e.g., a small bar to the right of cutoff showing overflowCount (styled differently),\n' +
    '  // or a legend/label: $/{overflowCount} values > $/{d3.format(",")(Math.round(cutoff))}.\n' +
    '\n' +
    '  // Axis and formatting\n' +
    '  const xAxis = d3.axisBottom(x).ticks(10, "~s");\n' +
    '  const yAxis = d3.axisLeft(y).ticks(6, "~s");\n' +
    '\n' +
    'Notes for Option A\n' +
    '- Expect bins near width ≈ 9.56 (FD) within the truncated domain.\n' +
    '- With cutoff 1,000, you’ll get ~103 bins; with cutoff 500, ~51 bins; adjust based on performance/space.\n' +
    '- Clearly label the overflow, e.g., “n = X above cutoff Y”.\n' +
    '- Consider a small inset plot for the tail (cutoff .. max) using coarser binning (e.g., Scott) to contextualize outliers.\n' +
    '\n' +
    'Option B code sketch (log-scale, full domain)\n' +
    '- Use log-spaced thresholds for consistent bar widths in log space.\n' +
    '\n' +
    '  const raw = prices;\n' +
    '  const min = d3.min(raw);  // 11\n' +
    '  const max = d3.max(raw);  // 17242\n' +
    '\n' +
    '  const x = d3.scaleLog()\n' +
    '    .domain([min, max])\n' +
    '    .range([0, width]);\n' +
    '\n' +
    '  // Choose target number of bins on the log axis (e.g., 80):\n' +
    '  const logMin = Math.log10(min);\n' +
    '  const logMax = Math.log10(max);\n' +
    '  const nBins = 80;\n' +
    '  const thresholds = d3.range(0, nBins + 1).map(i => {\n' +
    '    const t = logMin + i * (logMax - logMin) / nBins;\n' +
    '    return Math.pow(10, t);\n' +
    '  });\n' +
    '\n' +
    '  const bin = d3.bin()\n' +
    '    .domain([min, max])\n' +
    '    .thresholds(thresholds);\n' +
    '\n' +
    '  const bins = bin(raw);\n' +
    '\n' +
    '  // Use x(d.x0) and x(d.x1) for bar placement and width on the log scale.\n' +
    '  // Axis:\n' +
    '  const xAxis = d3.axisBottom(x)\n' +
    '    .ticks(10, "~s"); // d3 will pick log-appropriate ticks\n' +
    '\n' +
    '  // Labeling tip: show counts in tooltips; consider density if comparing subsets.\n' +
    '\n' +
    'Alternative single-view fallback (no truncation, linear): Scott’s rule\n' +
    '- If you must show the full range on linear scale without log, prefer Scott for a reasonable bin count across the full domain.\n' +
    '\n' +
    '  const x = d3.scaleLinear().domain([min, max]).range([0, width]).nice();\n' +
    '\n' +
    '  const bin = d3.bin()\n' +
    '    .domain(x.domain())\n' +
    '    .thresholds(d3.thresholdScott); // ~252 bins, width ~68.4\n' +
    '\n' +
    '  const bins = bin(prices);\n' +
    '\n' +
    '  // This preserves the entire tail but compresses the dense region around 50–200.\n' +
    '\n' +
    'Accessibility and performance notes\n' +
    '- Use d3.format(",d") or "~s" for human-friendly labels.\n' +
    '- Render performance: aim for ≤ 200 rects per layer for smooth interactivity. That’s why we cap/clip for FD or use log thresholds.\n' +
    '- Tooltips should show [x0, x1) and count. For log bins, include both raw and log-range in the tooltip if helpful.\n' +
    '- If adding an inset tail plot, sync color scales and add a clear caption explaining binning differences.\n' +
    '\n' +
    'What to implement (actionable)\n' +
    '- Default: Option A with cutoff = p99.5 and FD thresholds (label overflow).\n' +
    '- Add a toggle to switch to “View full range (log scale)” = Option B.\n' +
    '- Provide constants for known widths:\n' +
    '  - FD width ≈ 9.5633\n' +
    '  - Scott width ≈ 68.3997\n' +
    '- Expose a prop to set the cutoff value or percentile and the number of log bins for the alternate view.',
  success: true,
  error: undefined,
  timestamp: 2025-11-17T03:17:02.348Z
}
`


export const claudeMDResuilt = `## Workflow Plan: Data Profiling & D3.js Histogram for Prices Dataset

**Dataset Analysis:**
- File: C:/repos/SAGAMiddleware/data/prices.csv
- Rows: ~10,000 (single column dataset)
- Key columns: price (numeric values)
- Distribution: Right-skewed with extreme outliers (range ~11-17242, most values 50-500)
- Complexity: High (contains extreme outliers that significantly affect visualization)

**Recommended Workflow: 4 Agents**

### Agent 1: Data Profiler
Load price data from C:/repos/SAGAMiddleware/data/prices.csv and generate comprehensive statistical profile including min/max, quartiles, mean, median, standard deviation, outlier detection, and distribution characteristics.
→ Outputs: Statistical summary and data quality assessment

### Agent 2: Histogram Parameters Calculator
Analyze the price distribution statistics to determine optimal histogram parameters including appropriate bin count, bin ranges, and outlier handling strategy for effective visualization of the 10,000 data points.
→ Outputs: Optimal bin configuration and data transformation recommendations

### Agent 3: Data Preprocessor
Clean and prepare the price data by handling extreme outliers (values >10,000), applying any necessary transformations, and formatting data structure optimized for D3.js consumption.
→ Outputs: Clean, D3-ready price dataset with preprocessing metadata

### Agent 4: Visualization
Create D3 js histogram of prices from the csv file provided from the response from the MCP server. You must use d3.csv() method to handle the input file. The data represents prices. RELATIVE PATH: ./data/prices.csv **NOTE** Use relative path in html
→ Outputs: Complete D3.js HTML histogram visualization

**Execution:** Sequential (1→2→3→4)

**Validation:** 
- Agent 1: Verify statistical summary captures extreme value range (11-17242)
- Agent 2: Confirm bin strategy handles high-value outliers appropriately
- Agent 3: Validate data cleaning preserves distribution characteristics
- Agent 4: Test D3.js visualization renders properly with 10K data points

---
`
export const claudeBackendResult_1 = `   
     import pandas as pd\nimport numpy as np\nimport json\nfrom scipy import stats\n\n# Load price data\ndf = pd.read_csv('C:/repos/SAGAMiddleware/data/prices.csv')\nprices = df['price'].dropna()\n\n# Calculate comprehensive statistics\nq1 = float(np.percentile(prices, 25))\nq3 = float(np.percentile(prices, 75))\niqr = q3 - q1\nlower_fence = q1 - 1.5 * iqr\nupper_fence = q3 + 1.5 * iqr\noutliers = prices[(prices < lower_fence) | (prices > upper_fence)]\n\nresult = {\n    'min': float(prices.min()),\n    'max': float(prices.max()),\n    'mean': float(prices.mean()),\n    'median': float(prices.median()),\n    'std': float(prices.std(ddof=1)),\n    'q1': q1,\n    'q3': q3,\n    'iqr': iqr,\n    'skewness': float(stats.skew(prices)),\n    'kurtosis': float(stats.kurtosis(prices)),\n    'count': int(len(prices)),\n    'outlier_count': int(len(outliers)),\n    'outlier_percentage': float(len(outliers) / len(prices) * 100),\n    'lower_fence': lower_fence,\n    'upper_fence': upper_fence,\n    'range': float(prices.max() - prices.min()),\n    'cv': float(prices.std(ddof=1) / prices.mean()),\n    'percentiles': {\n        '5': float(np.percentile(prices, 5)),\n        '10': float(np.percentile(prices, 10)),\n        '90': float(np.percentile(prices, 90)),\n        '95': float(np.percentile(prices, 95))\n    }\n}\n\nprint(json.dumps(result, indent=2))

`
export const claudeBackendResult_2 = `
      import pandas as pd\nimport numpy as np\nimport json\nimport math\n\n# Load price data\ndf = pd.read_csv('C:/repos/SAGAMiddleware/data/prices.csv')\nprices = df['price'].dropna().values\nn = len(prices)\n\n# Calculate various bin count methods\nsturges_bins = int(math.ceil(math.log2(n) + 1))\n\n# Scott's rule\nstd = np.std(prices, ddof=1)\nscott_h = 3.5 * std / (n ** (1/3))\ndata_range = prices.max() - prices.min()\nscott_bins = int(math.ceil(data_range / scott_h))\n\n# Freedman-Diaconis rule\nq1 = np.percentile(prices, 25)\nq3 = np.percentile(prices, 75)\niqr = q3 - q1\nfd_h = 2 * iqr / (n ** (1/3))\nfd_bins = int(math.ceil(data_range / fd_h)) if fd_h > 0 else sturges_bins\n\n# Sqrt rule\nsqrt_bins = int(math.ceil(math.sqrt(n)))\n\n# Determine outlier handling strategy\nupper_fence = q3 + 1.5 * iqr\nlower_fence = q1 - 1.5 * iqr\noutliers = prices[(prices < lower_fence) | (prices > upper_fence)]\nhas_extreme_outliers = len(outliers) > 0 and (prices.max() > upper_fence * 2 or prices.min() < lower_fence * 0.5)\n\n# Recommended bins (use Freedman-Diaconis for skewed data with outliers)\nrecommended_bins = min(fd_bins, 30)  # Cap at 30 for readability\n\n# Calculate bin edges for recommended approach\nif has_extreme_outliers:\n    # Use percentile-based binning for extreme outliers\n    percentile_95 = np.percentile(prices, 95)\n    bin_edges = np.linspace(prices.min(), percentile_95, recommended_bins - 1)\n    bin_edges = np.append(bin_edges, prices.max())\n    outlier_strategy = 'percentile_capping'\nelse:\n    # Regular binning\n    bin_edges = np.linspace(prices.min(), prices.max(), recommended_bins + 1)\n    outlier_strategy = 'include_all'\n\nresult = {\n    'sturges_bins': sturges_bins,\n    'scott_bins': scott_bins,\n    'fd_bins': fd_bins,\n    'sqrt_bins': sqrt_bins,\n    'recommended_bins': recommended_bins,\n    'bin_edges': bin_edges.tolist(),\n    'bin_width': float((prices.max() - prices.min()) / recommended_bins),\n    'outlier_strategy': outlier_strategy,\n    'has_extreme_outliers': bool(has_extreme_outliers),\n    'data_range': float(data_range),\n    'optimal_method': 'Freedman-Diaconis',\n    'transformation_needed': bool(has_extreme_outliers),\n    'suggested_transform': 'log' if has_extreme_outliers and prices.min() > 0 else 'none'\n}\n\nprint(json.dumps(result, indent=2))

`
export const claudeBackendResult_3 = `  
      import pandas as pd\nimport numpy as np\nimport json\n\n# Load price data\ndf = pd.read_csv('C:/repos/SAGAMiddleware/data/prices.csv')\nprices = df['price'].dropna().values\n\n# Calculate statistics for outlier handling\nq1 = np.percentile(prices, 25)\nq3 = np.percentile(prices, 75)\niqr = q3 - q1\nupper_fence = q3 + 1.5 * iqr\nlower_fence = q1 - 1.5 * iqr\n\n# Identify outliers\noutliers = prices[(prices < lower_fence) | (prices > upper_fence)]\nnormal_data = prices[(prices >= lower_fence) & (prices <= upper_fence)]\n\n# Create histogram with numpy\nnum_bins = 25  # Optimal bin count for this dataset\nhist, bin_edges = np.histogram(prices, bins=num_bins)\n\n# Format for D3.js\nbins_data = []\nfor i in range(len(hist)):\n    bin_data = {\n        'x0': float(bin_edges[i]),\n        'x1': float(bin_edges[i + 1]),\n        'count': int(hist[i]),\n        'midpoint': float((bin_edges[i] + bin_edges[i + 1]) / 2),\n        'width': float(bin_edges[i + 1] - bin_edges[i])\n    }\n    bins_data.append(bin_data)\n\n# Calculate summary statistics\nresult = {\n    'bins': bins_data,\n    'total_count': int(len(prices)),\n    'min_value': float(prices.min()),\n    'max_value': float(prices.max()),\n    'mean': float(prices.mean()),\n    'median': float(np.median(prices)),\n    'outlier_count': int(len(outliers)),\n    'bin_count': num_bins,\n    'raw_data': prices.tolist(),\n    'metadata': {\n        'data_cleaned': True,\n        'outliers_handled': 'included',\n        'transformation_applied': 'none',\n        'bin_method': 'equal_width'\n    }\n}\n\nprint(json.dumps(result, indent=2))

`
export const claudeBackendResult_4 = `  VisualizationAgent (Order: 3)
      Type: processing
      LLM: openai/gpt-4o-mini
      Dependencies: DataPreprocessorAgent
      MCP Tools: none
      Task Preview: Create a complete HTML file with D3.js histogram visualization for price data. The HTML should:
1. Use d3.csv() to load data from the relative path './data/prices.csv'
2. Create a responsive histogram with proper scales and axes
3. Include tooltips showing bin ranges and counts on hover
4. Add axis labels (X-axis: "Price", Y-axis: "Frequency")
5. Include a title "Price Distribution Histogram"
6. Use professional styling with colors and transitions
7. Handle the single 'price' column from the CSV
8. Automatically calculate optimal bins using D3's histogram function
9. Include margin conventions for proper spacing
10. Add grid lines for better readability
11. Style bars with blue fill and darker blue stroke
12. Include hover effects for interactivity
`
export const dataProfilerPrompt_1 = `Agent Pipeline Creation System Prompt
You are creating GenericAgent instances for a data processing pipeline using the create_generic_agent tool.
WORKFLOW PLAN
$/{input.workflowDescription}

YOUR TASK
Step 1: Sample the Data
Call read_file on the data file specified in the workflow plan to understand its structure.
Note the:

Column names (case-sensitive)
Data types
Overall structure

CRITICAL: The preview you see is LIMITED (e.g., 100 rows). The agents you create will process the FULL dataset.

Step 2: Determine the Data Structure
Based on the sample, identify:

What columns exist and their types
What operations the workflow plan requires
How many agents are needed to complete the workflow


Step 3: Create the Agents
For each agent needed, call create_generic_agent with:
Required Parameters:
name: CamelCase with "Agent" suffix (e.g., DataAnalysisAgent)
taskDescription:

For tool agents: Complete Python code as a single string with \n for newlines

MUST load full dataset: pd.read_csv(file_path) - NO nrows, NO .head(), NO .sample()
MUST use safe variable names: min_val not min, max_val not max, sum_total not sum, etc.
MUST output actual computed values as JSON


For processing agents: Clear instructions for generating content (HTML, reports, visualizations)

taskExpectedOutput: Concrete example of output (e.g., "{'mean': 179.39, 'count': 1000}")
agentType: "tool" (executes Python) or "processing" (generates content with LLM)
dependencies: [] for first agent, ["PreviousAgentName"] for dependent agents
llmProvider: "openai"
llmModel: "gpt-4o-mini"
mcpTools: ["execute_python"] for tool agents, [] for processing agents

Step 4: Output Summary and STOP
After creating all agents:
CopyCreated N agents: [AgentName1, AgentName2, ...]. Pipeline complete.
Then STOP. Do not call any more tools.

CRITICAL RULES FOR GENERATED PYTHON CODE
When creating tool agents, the Python code you generate MUST:

Load the complete dataset - The execution environment has the full file
pythonCopydf = pd.read_csv('/exact/path/from/workflow')  # Loads ALL rows

Never use Python built-in names as variables - This breaks Python
pythonCopy# ❌ WRONG: min = data['min']
# ✅ CORRECT: min_val = data['min']
Forbidden: min, max, sum, len, type, list, dict, set, str, int, float, range, filter, map
Output actual computed values as JSON
pythonCopyresult = {'mean': 179.39, 'count': 1000}  # Actual values
print(json.dumps(result))

When using previous agent results (_prev_result), extract with safe names:
pythonCopymin_val = _prev_result['min']  # Not: min = _prev_result['min']



Now proceed with the workflow described in the input!`

export const dataProfilerPrompt_0 = `You are creating GenericAgent instances for a data processing pipeline using the create_generic_agent tool.

WORKFLOW PLAN:
$/{input.workflowDescription}

YOUR TASK:

1. First, use read_file ONCE to examine the data file mentioned in the workflow plan.
   - Identify the exact file path
   - Note column names (case-sensitive)
   - Understand data structure
   - IMPORTANT: When agents process the actual data, they must load the ENTIRE dataset, not just a sample. All Python code must read and process ALL rows in the CSV file.

2. Then, for EACH agent in the workflow plan, call create_generic_agent tool ONCE per agent:

   **name**: Agent name in CamelCase with "Agent" suffix (e.g., "DataProfilerAgent")

   **taskDescription**:
   - FOR TOOL AGENTS (agentType="tool"): COMPLETE, EXECUTABLE Python code (not instructions). Write the actual Python code string with \\n for newlines. Include all imports, exact file paths, error handling, and print JSON output with ACTUAL DATA VALUES (not type annotations or schemas).
   - FOR PROCESSING AGENTS (agentType="processing"): Clear instructions for text/code generation tasks (like D3.js visualization, HTML, etc.)

   Example taskDescription for TOOL agent (Python code as string):
   "import pandas as pd\\nimport numpy as np\\nimport json\\nimport sys\\n\\n# Load ALL rows from the CSV file - use the EXACT file path from the workflow plan\\n# DO NOT use nrows parameter, .head(), or .sample() - we need the ENTIRE dataset\\ndf = pd.read_csv('/exact/path/from/workflow.csv')\\nprint(f'Loaded {len(df)} rows', file=sys.stderr)\\nprices = df['price']\\nmin_val = float(np.min(prices))\\nmax_val = float(np.max(prices))\\nresult = {'min': min_val, 'max': max_val, 'mean': float(np.mean(prices)), 'std': float(np.std(prices, ddof=1)), 'count': len(prices)}\\nprint(json.dumps(result))"

   CRITICAL PYTHON RULES - READ CAREFULLY:
   1. NEVER use these names as variables: min, max, sum, len, range, type, list, dict, set, str, int, float, bool, any, all, filter, map, zip, open, input, print, id, hash, help, dir, abs, round, sorted, reversed
   2. When loading data from previous agents, ALWAYS use descriptive variable names with suffixes like _val, _value, _data, _result
   3. CORRECT: min_val = data['min'], max_val = data['max'], sum_total = data['sum']
   4. WRONG: min = data['min'], max = data['max'], sum = data['sum']
   5. When calling built-in functions later, if you shadowed them earlier, Python will crash with "TypeError: 'X' object is not callable"

   Example taskDescription for a DEPENDENT TOOL agent (uses data from previous agent):
   "import numpy as np\\nimport json\\n\\n# MCP server auto-loads previous agent's result as '_prev_result' (note the underscore!)\\n# Keys: ['min', 'max', 'mean', 'std', 'q1', 'q3']\\n# CRITICAL: Use _val suffix to avoid shadowing built-ins\\nmin_val = _prev_result['min']\\nmax_val = _prev_result['max']\\nmean_val = _prev_result['mean']\\nstd_val = _prev_result['std']\\nq1_val = _prev_result['q1']\\nq3_val = _prev_result['q3']\\n\\n# Now we can safely call min() and max() functions\\nbin_count = int(np.minimum(np.maximum(10, 20), 30))\\nresult = {'bin_count': bin_count, 'range': max_val - min_val}\\nprint(json.dumps(result))"

   Example taskDescription for PROCESSING agent (instructions):
   "Generate a complete HTML file with D3.js visualization. Use the data from the previous agent. Include proper D3 scales, axes, tooltips, and appropriate chart type based on the data structure (histogram, scatter plot, line chart, bar chart, etc.)."

   **taskExpectedOutput**: Describe what the output should contain with concrete examples (e.g., "JSON with actual data points", "JSON with aggregated values", "Complete HTML file with embedded D3.js code"). Do NOT use type definitions like "JSON schema with type definitions". For tool agents, specify the JSON structure with example values, not type annotations.

   **agentType**: "tool" for Python execution with execute_python, "processing" for text/HTML/D3.js generation (NO execute_python)

   **dependencies**: [] for first agent, ["PreviousAgentName"] for others

   **llmProvider**: "openai"

   **llmModel**: "gpt-4o-mini"

   **mcpTools**: ["execute_python"] for tool agents, [] for processing agents

3. Create agents IN ORDER (Agent 1, then Agent 2, then Agent 3, etc.)

4. Infer what each agent needs based on task keywords in the workflow plan:

   - If task mentions "statistical" or "analyze" or "profile": Python code that computes and prints actual statistical values. Use variable names like min_val, max_val (NOT min, max).
   - If task mentions "histogram" or "bin": Python code that calculates bin parameters and/or histogram data using numpy.histogram(). For outlier handling, use percentile-based clipping (e.g., clip at 95th or 99th percentile) rather than arbitrary values. Preserve information about clipped data.
   - If task mentions "aggregate" or "group" or "summarize": Python code that groups/aggregates data (e.g., groupby operations, pivot tables)
   - If task mentions "transform" or "preprocess" or "clean": Python code that transforms/cleans data and outputs the processed dataset
   - If task mentions "time series" or "temporal": Python code that handles datetime operations and temporal aggregations
   - If task mentions "correlation" or "relationship": Python code that calculates correlations, covariance, or relationship metrics
   - If task mentions "visualization" or "chart" or "graph" or "D3.js" or "HTML": Instructions (NOT Python code) for generating complete HTML/D3.js visualizations

   IMPORTANT:
   - Tool agents (agentType="tool") must execute Python calculations and return computed values, NOT type definitions or schemas
   - Processing agents (agentType="processing") receive instructions for text/HTML/code generation tasks
   - NEVER EVER use Python built-in function names as variables: min, max, sum, len, range, type, list, dict, set, any, all, filter, map, etc.
   - When loading previous agent's data: min_val = data['min'], NOT min = data['min']
   - Always use numpy functions (np.minimum, np.maximum) instead of built-ins (min, max) when working with arrays
   - If agent has dependencies, it will receive _prev_result dict (note underscore prefix!) - extract values with safe variable names (add _val, _data, _result suffix)

5. After calling create_generic_agent for ALL agents in the workflow, output a summary:
   "Created N agents: [list names]. Pipeline complete."

6. STOP - Do not call any more tools after creating all agents.

CRITICAL REQUIREMENTS:
- Use read_file tool ONLY ONCE at the beginning
- Call create_generic_agent ONCE per agent (do NOT call it multiple times for the same agent)
- After creating all agents, output a summary message and STOP
- Use EXACT file paths from the workflow plan (no placeholders like 'C:/exact/path/to/file.csv')
- Use EXACT column names from file inspection (case-sensitive)
- Python code MUST load the ENTIRE dataset - NEVER use pd.read_csv(file, nrows=100), .head(), .sample(), or any sampling
- Always use pd.read_csv(file_path) without any limiting parameters to load all rows
- Include complete Python instructions in taskDescription
- Python code MUST compute and print ACTUAL DATA VALUES, not type strings or schemas
- The print(json.dumps(result)) statement must output real numbers like {"mean": 179.39}, NOT type annotations like {"mean": "float"}
- NEVER shadow Python built-in functions (min, max, sum, etc.) as variable names - use descriptive names like min_value, max_value, total_sum
- Always include the total row count in results to verify all data was processed
- Specify exact output format in taskExpectedOutput with example values

WORKFLOW:
1. Read file ONCE with read_file tool
2. For each agent in workflow plan: call create_generic_agent tool ONCE
3. After creating all agents, output summary: "Created N agents: [names]. Pipeline complete."
4. STOP - do not call any more tools`

export const dataProfilerPrompt_1a = `You are creating a data processing pipeline based on the workflow plan below.

WORKFLOW PLAN
$/{input.workflowDescription}

INSTRUCTIONS

1. Examine the data file mentioned in the workflow plan (use read_file once)
   - Note column names (case-sensitive), data types, structure
   - The preview is limited (e.g., 100 rows) but agents will process the FULL dataset

2. Create agents for the workflow using create_generic_agent tool
   - One agent per major step in the workflow
   - Agents execute in order: first agent has no dependencies, subsequent agents depend on previous ones

3. When finished creating all agents, output: "Created N agents: [names]. Pipeline complete." and STOP.

CRITICAL RULES FOR DATA ANALYSIS AGENTS
When creating data analysis agents, generate comprehensive, thorough analysis:

For Statistical Analysis Tasks - Include Full Depth:
- Basic stats: min, max, mean, median, std, variance, count
- Quartiles: Q1, Q2 (median), Q3, IQR
- Distribution metrics: skewness, kurtosis (compute manually if scipy unavailable)
- Outlier analysis: IQR method bounds, outlier count and percentage
- Percentiles: p5, p10, p90, p95, p99 for understanding distribution tails
- Range analysis: full range, effective range (excluding extreme outliers)

For Tasks Involving Binning/Grouping - Calculate MULTIPLE Strategies:
- Freedman-Diaconis: 2 * IQR / (n^(1/3)) - robust for skewed data
- Scott's rule: 3.5 * std / (n^(1/3)) - general purpose
- Square-root: sqrt(n) - quick estimate
- Sturges: log2(n) + 1 - for normal distributions
- Compare strategies and provide recommendations based on data characteristics
- Include concrete calculations: bin widths, expected counts, data range coverage
- For skewed distributions: consider multiple viewing options (truncated, log-scale, full)

Python Code Quality Standards:
- Load complete dataset: pd.read_csv(path) with NO row limits (no nrows, .head(), .sample())
- Safe variable naming: use min_val, max_val, sum_total (NOT min, max, sum - these shadow built-ins)
- Access previous results via _prev_result (note underscore prefix)
- Implement distribution metrics manually if scipy unavailable (skewness, kurtosis formulas available)
- Output complete, accurate computed values as JSON



Now proceed with the workflow described in the input!`

export const userVizQuery = `{
  "full_file_path": "C:/repos/SAGAMiddleware/data/prices.csv",
  "d3_visualization_request": "Create D3 js histogram of prices from the csv file provided from the response from the MCP server. You must use d3.csv() method to handle the input file. The data represents prices. RELATIVE PATH: ./data/prices.csv **NOTE** Use relative path in html"
}`

export const dataProfilerPrompt_2 = `Data Processing Pipeline Code Generation
You are generating Python code for data processing agents based on the workflow plan below.
WORKFLOW PLAN
$/{input.workflowDescription}

YOUR TASK

Inspect the data file (use read_file once)

Note column names (case-sensitive), data types, structure
You see a LIMITED preview (e.g., 100 rows)


Generate Python code for each agent described in the workflow plan

The code will execute LATER on the FULL dataset
Each agent's code uses results from previous agents via _prev_result




PYTHON CODE REQUIREMENTS
Load Full Dataset
pythonCopy# ✅ CORRECT - loads ALL rows
df = pd.read_csv('/exact/path/from/workflow.csv')

# ❌ WRONG - limits data
df = pd.read_csv(file, nrows=100)
df.head(100)
Safe Variable Names
pythonCopy# ❌ WRONG - shadows Python built-ins
min = data['min']
max = data['max']
sum = data['sum']

# ✅ CORRECT - use suffixes
min_val = data['min']
max_val = data['max']
sum_total = data['sum']
Never use as variable names:
min, max, sum, len, type, list, dict, set, str, int, float, range, filter, map, zip, open, input, id, hash, abs, round, sorted
Access Previous Results Safely
pythonCopy# Previous agent's output available as _prev_result

# ✅ CORRECT - extract with safe names first
min_val = _prev_result['min']
max_val = _prev_result['max']
iqr_val = _prev_result['iqr']

# ❌ WRONG - shadows built-ins
min = _prev_result['min']
max = _prev_result['max']

DATA ANALYSIS DEPTH
Statistical Profiling:
Include comprehensive metrics: min, max, mean, median, std, quartiles (Q1, Q3), IQR, skewness, kurtosis, outlier analysis, percentiles (p5, p10, p90, p95, p99).
Binning/Histogram Parameters:
Calculate multiple strategies: Freedman-Diaconis, Scott's rule, Square-root, Sturges. Include bin counts, widths, and recommendations based on data distribution characteristics.

Now analyze the data and generate the Python code for each agent in the workflow plan.`

export const opusCodeValidatorResult = ` ## VALIDATION FAILED: Multiple critical visualization issues detected

After analyzing the rendered D3 visualization against the data analysis requirements, I've identified several critical issues:

### 1. **Empty Histogram - No Bars Visible**
- The SVG shows all bars with height="0" or height="NaN"
- The y-coordinate for all bars is set to 320 (bottom of chart), indicating zero height
- This means the histogram is completely empty with no data visualization

### 2. **Y-Axis Scale Issue**
- The y-axis has no tick marks or labels
- The scale domain appears to be improperly configured, resulting in NaN calculations for bar heights
- The density calculations are not working correctly

### 3. **Last Bin Rendering Error**
- The last bin (30th) shows width="-1" and height="NaN"
- This indicates an array indexing or calculation error with the threshold boundaries

### 4. **Data Generation Issue**
- While the code attempted to generate sample data matching the distribution (313 observations in 100-114 range), the histogram rendering completely failed
- The bins are created but heights are not calculated properly

### 5. **Missing Visual Representation**
- The PNG output shows only axes and labels but no actual histogram bars
- The data analysis specified specific bin counts and distributions that should be visible

### Key Validation Failures:
- ❌ No visual representation of the 29 variable-width bins
- ❌ Cannot verify the density distribution or peak at bins 19-22
- ❌ Unable to confirm the 92 count peak at Bin 21 (~9.27% of data)
- ❌ The concentration in the 100-114 range is not visualized
- ❌ Y-axis scale calculation failure prevents any meaningful density display

**VALIDATION FAILED: Histogram bars have zero height due to y-scale/density calculation errors. No data visualization is rendered despite correct bin thresholds and data generation.**`

export const geminiCodeValidationResult = `### **Validation Report**

**Validation Status:** FAILED

The provided D3.js code fails to render the required histogram visualization. The analysis is consistent with the appraisal: the primary issues stem from a fundamental error in the calculation of the y-axis scale and bar heights, resulting in a completely empty chart with no visible data representation.

---

### **Analysis of Issues and Guidance for Correction**

This analysis provides in-depth guidance for a D3.js coding agent to address the critical failures identified in the code.

#### **1. Core Issue: Incorrect Y-Axis Metric (Frequency vs. Density)**

*   **Problem Identification:** The appraisal correctly notes that all bars have a height of 0 or NaN and the Y-axis is improperly configured. This is because the code attempts to build a *frequency* histogram, where bar height corresponds to the raw count of items in a bin (d.length). However, when using variable-width bins (as implied by the desired output), a *density* histogram is required to represent the data distribution accurately. In a density plot, the **area** of the bar (not its height) is proportional to the frequency.

*   **Root Cause Analysis:**
    *   The y scale's domain is set using d3.max(bins, d => d.length), which is based on raw frequency counts.
    *   The bar height is calculated as height - y(d.length).
    *   This approach is only valid for histograms with uniform bin widths. For bins of varying widths, a tall, narrow bar representing a few data points could visually appear more significant than a short, wide bar representing many more data points. The concept of "density" normalizes this by accounting for the bin's width. The failure to render suggests that d3.max might be returning a value that breaks the scale, but the conceptual flaw is the more critical error.

*   **Guidance for Correction:**
    *   **Do not use d.length directly for the Y-axis.** The Y-axis must be changed to represent density.
    *   **Calculate Density for Each Bin:** The density for each bin should be calculated using the formula:
        density = (count in bin) / (total number of data points * bin width)
        In the context of the code, this translates to:
        density = d.length / (prices.length * (d.x1 - d.x0))
        Note that (d.x1 - d.x0) is the width of the bin in the data's units (e.g., price), not in pixels.
    *   **Update the Y-Scale Domain:** The domain for the y scale must be based on the maximum calculated density across all bins. It should be redefined as:
        y.domain([0, d3.max(bins, d => d.length / (prices.length * (d.x1 - d.x0)))])
    *   **Update Bar Attributes:** The y and height attributes for the <rect> elements must be updated to use the density calculation.
        *   The y attribute should be: d => y( d.length / (prices.length * (d.x1 - d.x0)) )
        *   The height attribute should be: d => height - y( d.length / (prices.length * (d.x1 - d.x0)) )
    *   **Update Y-Axis Label:** The axis label text should be changed from "Frequency" to "Density" to accurately reflect what the axis represents.

#### **2. Issue: Bar Width Calculation Error**

*   **Problem Identification:** The appraisal notes the last bin has a calculated width of -1, which is an invalid SVG attribute and prevents rendering.

*   **Root Cause Analysis:**
    *   The width is calculated with the expression: Math.max(0, x(d.x1) - x(d.x0) - 2).
    *   The - 2 term is intended to create a 1-pixel gap on each side of the bar. However, for the very last bin generated by d3.histogram, the width in the data domain (d.x1 - d.x0) can be very small. When this small data width is projected through the x scale, the resulting pixel width can be less than 2 pixels. Subtracting 2 then results in a negative number.

*   **Guidance for Correction:**
    *   **Remove the fixed pixel subtraction.** This method is not robust. A better approach for creating gaps between bars is to use inset padding or to slightly adjust the scale's range.
    *   **Simplify the Width Calculation:** The most direct fix is to make the width calculation reflect the exact scaled width of the bin. Change the width attribute to:
        d => x(d.x1) - x(d.x0)
    *   **Adjust x attribute for Gapping (Optional but Recommended):** To re-introduce a safe gap, adjust the x attribute and subtract from the width. For example:
        *   .attr("x", d => x(d.x0) + 1)
        *   .attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 1))
        This creates a single 1px gap between bars and is much less likely to result in a negative width.

By implementing the conceptual changes outlined above, the D3 coding agent will address the root causes of the visualization failure. The primary task is to pivot from a frequency-based histogram to a density-based one, which will in turn fix the broken Y-axis and allow the bars to be rendered correctly.`

export const dataProfilerPrompt_3 = `Fix D3.js visualization code based on validation issues.

USER_QUERY (original requirements):
$/{userQuery}

EXISTING CODE:
$/{code}

APPRAISAL (validation issues):
$/{appraisal}

CRITICAL INSTRUCTIONS:
1. Review USER_QUERY to understand original requirements: visualization type, data loading method (e.g., d3.csv()), file path (relative/absolute), and any specific constraints
2. Call read_analysis tool to understand HOW to build the visualization, not to get the data itself.
   The ANALYSIS tells you:
   - "Here's where the data is located" (source path)
   - "Here's what the data looks like" (structure, statistics)
   - "Here's how to configure the visualization" (bins, scales, parameters)
3. Review APPRAISAL and identify all issues to fix (empty bars, y-axis scale problems, calculation errors, etc.)
4. Update EXISTING_CODE to fix APPRAISAL issues while maintaining USER_QUERY requirements and using ANALYSIS as configuration guide

REQUIRED OUTPUT FORMAT:
You MUST respond with ONLY the complete, fixed HTML code. Do NOT include:
- Explanations
- Summaries
- Markdown code fences
- Commentary

Start your response with "<!DOCTYPE html>" and end with "</html>".
Your entire response must be valid, runnable HTML code that can be saved directly to a file.

The fixed code must address ALL issues identified in the APPRAISAL while maintaining all USER_QUERY requirements.`

export const d3jsDataAnalysisResult = `## CSV DATA ANALYSIS REPORT FOR D3.JS VISUALIZATION

### 1. FILE INFORMATION:
- **File name:** prices.csv
- **Full file path:** C:/repos/SAGAMiddleware/data/prices.csv
- **Relative path for HTML:** ./data/prices.csv

### 2. CSV FILE STRUCTURE:
- **Column names:** Single column named "price"
- **Data type:** Numeric (floating-point values)
- **Sample data values (first 10 rows):**
  - 75.0
  - 104.0
  - 369.0
  - 300.0
  - 92.0
  - 64.0
  - 265.0
  - 35.0
  - 287.0
  - 69.0
- **Total number of data rows:** 9,998 (excluding header)
- **Total file lines:** 9,999 (including header)
- **Delimiter:** Comma (standard CSV format)

### 3. RELEVANCE TO VISUALIZATION:
- **Visualization type requested:** Histogram
- **Relevant column:** "price" - perfect match for histogram requirements
- **Data range:**
  - Minimum: ~23.0
  - Maximum: 17,242.0
  - Average: 179.31
- **Distribution characteristics:**
  - Most values cluster between 30-500
  - Contains significant outliers (9502.0, 10095.0, 17242.0)
  - Right-skewed distribution with long tail
  - Majority of prices are in the lower range with occasional high-value outliers

### 4. D3.JS RECOMMENDATIONS:
- **Data loading:** Use d3.csv("./data/prices.csv") with relative path as specified
- **Data conversion:** Convert string to number using:
  javascript
  d3.csv("./data/prices.csv").then(data => {
    data.forEach(d => {
      d.price = +d.price; // Convert string to number
    });
    // Filter out empty/null values
    data = data.filter(d => !isNaN(d.price));
  });
  
- **Scale recommendations:**
  - Consider using d3.scaleLinear() for x-axis
  - Due to outliers, you might want to:
    - Option A: Use log scale (d3.scaleLog()) to better visualize the distribution
    - Option B: Cap the x-axis at a reasonable maximum (e.g., 2000) and group outliers
    - Option C: Create two histograms - one for main distribution, one for outliers
- **Bin configuration:**
  - Recommended bin count: 30-50 bins for main distribution
  - Use d3.bin().domain([0, 2000]).thresholds(40) for standard view
  - Or use automatic binning: d3.bin().thresholds(d3.thresholdSturges)

### 5. DATA QUALITY NOTES:
- **Missing values:** 4 empty/null values found at rows:
  - Row 1565 (empty)
  - Row 2784 (empty)
  - Row 5098 (empty)
  - Row 9343 (empty)
- **Outliers requiring attention:**
  - Extreme outliers: 9502.0 (row 56), 10095.0 (row 9904), 17242.0 (appears to be maximum)
  - These outliers will significantly affect histogram scale if not handled
- **Data type consistency:** All non-empty values are properly formatted as decimal numbers
- **Recommended cleaning:**
  javascript
  // Filter out empty values and optionally cap outliers
  data = data.filter(d => !isNaN(d.price) && d.price !== null && d.price !== "");

  // Optional: Handle outliers
  const outlierThreshold = 2000;
  data.forEach(d => {
    d.isOutlier = d.price > outlierThreshold;
  });
  

### IMPLEMENTATION NOTES FOR HISTOGRAM:
1. The data file contains a single "price" column which is perfect for a histogram
2. Use the relative path "./data/prices.csv" in the HTML file as specified
3. Implement proper error handling for the 4 empty values
4. Consider implementing an interactive feature to toggle between full range and focused range views due to the presence of extreme outliers
5. The histogram should clearly show the concentration of prices in the 30-500 range while acknowledging the presence of high-value outliers
DATA ANALYZER  {"user_query":"{\n  \"full_file_path\": \"C:/repos/SAGAMiddleware/data/prices.csv\",\n  \"d3_visualization_request\": \"Create D3 js histogram of prices from the csv file provided from the response from the MCP server. You must use d3.csv() method to handle the input file. The data represents prices. RELATIVE PATH: ./data/prices.csv **NOTE** Use relative path in html\"\n}"}
SDK NAME D3JSDataAnalyzer
SDK VALUE {
  DATA_ANALYSIS: 'Now I have enough information to provide a comprehensive analysis. Let me create the structured report:\n' +
    '\n' +
    '---\n' +
    '\n' +
    '## CSV DATA ANALYSIS REPORT FOR D3.JS VISUALIZATION\n' +
    '\n' +
    '### 1. FILE INFORMATION:\n' +
    '- **File name:** prices.csv\n' +
    '- **Full file path:** C:/repos/SAGAMiddleware/data/prices.csv\n' +
    '- **Relative path for HTML:** ./data/prices.csv\n' +
    '\n' +
    '### 2. CSV FILE STRUCTURE:\n' +
    '- **Column names:** Single column named "price"\n' +
    '- **Data type:** Numeric (floating-point values)\n' +
    '- **Sample data values (first 10 rows):**\n' +
    '  - 75.0\n' +
    '  - 104.0\n' +
    '  - 369.0\n' +
    '  - 300.0\n' +
    '  - 92.0\n' +
    '  - 64.0\n' +
    '  - 265.0\n' +
    '  - 35.0\n' +
    '  - 287.0\n' +
    '  - 69.0\n' +
    '- **Total number of data rows:** 9,998 (excluding header)\n' +
    '- **Total file lines:** 9,999 (including header)\n' +
    '- **Delimiter:** Comma (standard CSV format)\n' +
    '\n' +
    '### 3. RELEVANCE TO VISUALIZATION:\n' +
    '- **Visualization type requested:** Histogram\n' +
    '- **Relevant column:** "price" - perfect match for histogram requirements\n' +
    '- **Data range:**\n' +
    '  - Minimum: ~23.0\n' +
    '  - Maximum: 17,242.0\n' +
    '  - Average: 179.31\n' +
    '- **Distribution characteristics:**\n' +
    '  - Most values cluster between 30-500\n' +
    '  - Contains significant outliers (9502.0, 10095.0, 17242.0)\n' +
    '  - Right-skewed distribution with long tail\n' +
    '  - Majority of prices are in the lower range with occasional high-value outliers\n' +
    '\n' +
    '### 4. D3.JS RECOMMENDATIONS:\n' +
    '- **Data loading:** Use d3.csv("./data/prices.csv") with relative path as specified\n' +
    '- **Data conversion:** Convert string to number using:\n' +
    '  javascript\n' +
    '  d3.csv("./data/prices.csv").then(data => {\n' +
    '    data.forEach(d => {\n' +
    '      d.price = +d.price; // Convert string to number\n' +
    '    });\n' +
    '    // Filter out empty/null values\n' +
    '    data = data.filter(d => !isNaN(d.price));\n' +
    '  });\n' +
    '  \n' +
    '- **Scale recommendations:**\n' +
    '  - Consider using d3.scaleLinear() for x-axis\n' +
    '  - Due to outliers, you might want to:\n' +
    '    - Option A: Use log scale (d3.scaleLog()) to better visualize the distribution\n' +
    '    - Option B: Cap the x-axis at a reasonable maximum (e.g., 2000) and group outliers\n' +
    '    - Option C: Create two histograms - one for main distribution, one for outliers\n' +
    '- **Bin configuration:**\n' +
    '  - Recommended bin count: 30-50 bins for main distribution\n' +
    '  - Use d3.bin().domain([0, 2000]).thresholds(40) for standard view\n' +
    '  - Or use automatic binning: d3.bin().thresholds(d3.thresholdSturges)\n' +
    '\n' +
    '### 5. DATA QUALITY NOTES:\n' +
    '- **Missing values:** 4 empty/null values found at rows:\n' +
    '  - Row 1565 (empty)\n' +
    '  - Row 2784 (empty)\n' +
    '  - Row 5098 (empty)\n' +
    '  - Row 9343 (empty)\n' +
    '- **Outliers requiring attention:**\n' +
    '  - Extreme outliers: 9502.0 (row 56), 10095.0 (row 9904), 17242.0 (appears to be maximum)\n' +
    '  - These outliers will significantly affect histogram scale if not handled\n' +
    '- **Data type consistency:** All non-empty values are properly formatted as decimal numbers\n' +
    '- **Recommended cleaning:**\n' +
    '  javascript\n' +
    '  // Filter out empty values and optionally cap outliers\n' +
    '  data = data.filter(d => !isNaN(d.price) && d.price !== null && d.price !== "");\n' +
    '  \n' +
    '  // Optional: Handle outliers\n' +
    '  const outlierThreshold = 2000;\n' +
    '  data.forEach(d => {\n' +
    '    d.isOutlier = d.price > outlierThreshold;\n' +
    '  });\n' +
    '  \n' +
    '\n' +
    '### IMPLEMENTATION NOTES FOR HISTOGRAM:\n' +
    '1. The data file contains a single "price" column which is perfect for a histogram\n' +
    '2. Use the relative path "./data/prices.csv" in the HTML file as specified\n' +
    '3. Implement proper error handling for the 4 empty values\n' +
    '4. Consider implementing an interactive feature to toggle between full range and focused range views due to the presence of extreme outliers\n' +
    '5. The histogram should clearly show the concentration of prices in the 30-500 range while acknowledging the presence of high-value outliers',`


export const pythonDataFilter = `import pandas as pd
import numpy as np
import json

# Load the prices data
df = pd.read_csv('C:/repos/SAGAMiddleware/data/prices.csv')

# Get the price column (assuming it's named 'price' or is the first column)
if 'price' in df.columns:
    prices = df['price']
else:
    prices = df.iloc[:, 0]

# Calculate comprehensive statistics
min_val = float(prices.min())
max_val = float(prices.max())
mean_val = float(prices.mean())
median_val = float(prices.median())
std_val = float(prices.std())
variance_val = float(prices.var())

# Calculate quartiles
q1 = float(prices.quantile(0.25))
q2 = float(prices.quantile(0.50))  # median
q3 = float(prices.quantile(0.75))
iqr = q3 - q1

# Calculate percentiles
percentiles = {}
for p in [1, 5, 10, 90, 95, 99]:
    percentiles[f'p{p}'] = float(prices.quantile(p/100))

# Detect outliers using IQR method
lower_bound = q1 - 1.5 * iqr
upper_bound = q3 + 1.5 * iqr
outliers = prices[(prices < lower_bound) | (prices > upper_bound)]
outlier_count = len(outliers)
outlier_percentage = float((outlier_count / len(prices)) * 100)

# Identify extreme outliers
extreme_lower_bound = q1 - 3 * iqr
extreme_upper_bound = q3 + 3 * iqr
extreme_outliers = prices[(prices < extreme_lower_bound) | (prices > extreme_upper_bound)]
extreme_outlier_count = len(extreme_outliers)

# Calculate skewness and kurtosis
skewness = float(prices.skew())
kurtosis = float(prices.kurtosis())

# Distribution characteristics
value_range = max_val - min_val
coefficient_of_variation = float((std_val / mean_val) * 100) if mean_val != 0 else 0

# Count values in different ranges
range_counts = {
    'below_100': int((prices < 100).sum()),
    '100_to_500': int(((prices >= 100) & (prices < 500)).sum()),
    '500_to_1000': int(((prices >= 500) & (prices < 1000)).sum()),
    '1000_to_5000': int(((prices >= 1000) & (prices < 5000)).sum()),
    '5000_to_10000': int(((prices >= 5000) & (prices < 10000)).sum()),
    'above_10000': int((prices >= 10000).sum())
}

# Create result dictionary
result = {
    'total_records': len(prices),
    'statistics': {
        'min': min_val,
        'max': max_val,
        'mean': mean_val,
        'median': median_val,
        'std_dev': std_val,
        'variance': variance_val,
        'range': value_range,
        'cv': coefficient_of_variation
    },
    'quartiles': {
        'q1': q1,
        'q2': q2,
        'q3': q3,
        'iqr': iqr
    },
    'percentiles': percentiles,
    'outliers': {
        'count': outlier_count,
        'percentage': outlier_percentage,
        'lower_bound': lower_bound,
        'upper_bound': upper_bound,
        'extreme_count': extreme_outlier_count,
        'extreme_lower_bound': extreme_lower_bound,
        'extreme_upper_bound': extreme_upper_bound,
        'outlier_values': outliers.tolist() if outlier_count < 100 else outliers[:100].tolist()
    },
    'distribution': {
        'skewness': skewness,
        'kurtosis': kurtosis,
        'is_right_skewed': skewness > 0,
        'is_heavy_tailed': kurtosis > 0
    },
    'range_distribution': range_counts,
    'data_quality': {
        'has_nulls': bool(prices.isnull().any()),
        'null_count': int(prices.isnull().sum()),
        'has_negative': bool((prices < 0).any()),
        'negative_count': int((prices < 0).sum())
    },
    'raw_data': prices.tolist()
}

print(json.dumps(result))`

// pythonHistogram  pythonDataPreProcessor pythonDataFilter

export const pythonHistogram = `import numpy as np
import json
import math

# Get statistics from previous agent
stats = _prev_result['statistics']
quartiles = _prev_result['quartiles']
outliers = _prev_result['outliers']
distribution = _prev_result['distribution']
range_dist = _prev_result['range_distribution']
raw_data = _prev_result['raw_data']

min_val = stats['min']
max_val = stats['max']
mean_val = stats['mean']
median_val = stats['median']
std_dev = stats['std_dev']
q1 = quartiles['q1']
q3 = quartiles['q3']
iqr = quartiles['iqr']
total_count = _prev_result['total_records']

# Strategy 1: Sturges' Rule
sturges_bins = int(math.ceil(math.log2(total_count) + 1))

# Strategy 2: Square Root Choice
sqrt_bins = int(math.ceil(math.sqrt(total_count)))

# Strategy 3: Rice's Rule
rice_bins = int(math.ceil(2 * (total_count ** (1/3))))

# Strategy 4: Scott's Rule (bin width based)
scott_width = 3.49 * std_dev / (total_count ** (1/3))
scott_bins = int(math.ceil((max_val - min_val) / scott_width)) if scott_width > 0 else 30

# Strategy 5: Freedman-Diaconis Rule (IQR based)
fd_width = 2 * iqr / (total_count ** (1/3))
fd_bins = int(math.ceil((max_val - min_val) / fd_width)) if fd_width > 0 else 30

# Given the extreme outliers, we need adaptive binning
# Determine outlier handling strategy
extreme_outlier_threshold = 10000
has_extreme_outliers = range_dist['above_10000'] > 0

# Calculate optimal bin count considering the distribution
if has_extreme_outliers:
    # For skewed data with outliers, use fewer bins
    recommended_bins = min(fd_bins, 50)  # Cap at 50 for better visualization
else:
    recommended_bins = fd_bins

# Create bin edges strategies
# Strategy 1: Equal width bins
equal_width_edges = []
bin_width = (max_val - min_val) / recommended_bins
for i in range(recommended_bins + 1):
    equal_width_edges.append(min_val + i * bin_width)

# Strategy 2: Quantile-based bins (equal frequency)
quantile_edges = []
for i in range(recommended_bins + 1):
    quantile_edges.append(float(np.percentile(raw_data, i * 100 / recommended_bins)))

# Strategy 3: Adaptive bins for outliers
# Focus most bins on the bulk of the data, fewer bins for outliers
if has_extreme_outliers:
    # Use percentile 95 as cutoff for main data
    p95 = float(np.percentile(raw_data, 95))
    main_bins = int(recommended_bins * 0.9)  # 90% of bins for main data
    outlier_bins = recommended_bins - main_bins

    adaptive_edges = []
    # Dense binning for main data
    main_width = (p95 - min_val) / main_bins
    for i in range(main_bins):
        adaptive_edges.append(min_val + i * main_width)

    # Sparse binning for outliers
    if outlier_bins > 0 and max_val > p95:
        outlier_width = (max_val - p95) / outlier_bins
        for i in range(1, outlier_bins + 1):
            adaptive_edges.append(p95 + i * outlier_width)
    adaptive_edges.append(max_val)
else:
    adaptive_edges = equal_width_edges

# Calculate bin ranges for different strategies
def calculate_ranges(edges):
    ranges = []
    for i in range(len(edges) - 1):
        ranges.append({
            'min': float(edges[i]),
            'max': float(edges[i + 1]),
            'width': float(edges[i + 1] - edges[i])
        })
    return ranges

# Outlier handling recommendations
outlier_strategies = []

if has_extreme_outliers:
    outlier_strategies.append({
        'name': 'cap_outliers',
        'description': 'Cap values above 10000 to 10000',
        'threshold': extreme_outlier_threshold
    })
    outlier_strategies.append({
        'name': 'separate_viz',
        'description': 'Create separate visualization for outliers',
        'main_data_max': float(np.percentile(raw_data, 95))
    })
    outlier_strategies.append({
        'name': 'log_transform',
        'description': 'Apply logarithmic transformation to compress range'
    })

# Determine final recommendation
if has_extreme_outliers:
    final_strategy = 'adaptive'
    final_bins = recommended_bins
    final_edges = adaptive_edges
else:
    final_strategy = 'equal_width'
    final_bins = recommended_bins
    final_edges = equal_width_edges

result = {
    'bin_count_strategies': {
        'sturges': sturges_bins,
        'sqrt': sqrt_bins,
        'rice': rice_bins,
        'scott': scott_bins,
        'freedman_diaconis': fd_bins,
        'recommended': recommended_bins
    },
    'bin_edge_strategies': {
        'equal_width': {
            'edges': equal_width_edges,
            'ranges': calculate_ranges(equal_width_edges)
        },
        'quantile': {
            'edges': quantile_edges,
            'ranges': calculate_ranges(quantile_edges)
        },
        'adaptive': {
            'edges': adaptive_edges,
            'ranges': calculate_ranges(adaptive_edges)
        }
    },
    'outlier_handling': {
        'has_extreme_outliers': has_extreme_outliers,
        'extreme_threshold': extreme_outlier_threshold,
        'strategies': outlier_strategies
    },
    'final_recommendation': {
        'strategy': final_strategy,
        'bin_count': final_bins,
        'bin_edges': final_edges,
        'rationale': 'Adaptive binning to handle extreme outliers while preserving detail in main data distribution' if has_extreme_outliers else 'Equal width binning for uniform data distribution'
    },
    'visualization_params': {
        'x_axis_range': [min_val, min(max_val, extreme_outlier_threshold) if has_extreme_outliers else max_val],
        'y_axis_type': 'linear',
        'suggested_width': 800,
        'suggested_height': 600,
        'margin': {'top': 20, 'right': 30, 'bottom': 40, 'left': 50}
    }
}

print(json.dumps(result))`

export const pythonDataPreProcessor = ` import json
import numpy as np

# Get data and parameters from previous agents
raw_data = _prev_result['raw_data']  # This should come from DataProfiler through the chain
params = _prev_result  # This is from HistogramParametersCalculator

# Extract key parameters
outlier_handling = params['outlier_handling']
has_extreme_outliers = outlier_handling['has_extreme_outliers']
extreme_threshold = outlier_handling['extreme_threshold']
final_recommendation = params['final_recommendation']
bin_edges = final_recommendation['bin_edges']

# Convert raw_data to numpy array for processing
prices = np.array(raw_data)
original_count = len(prices)

# Track preprocessing steps
preprocessing_log = []

# Step 1: Handle extreme outliers if present
if has_extreme_outliers:
    # Count outliers before capping
    outliers_above_threshold = np.sum(prices > extreme_threshold)

    # Cap extreme outliers
    capped_prices = np.where(prices > extreme_threshold, extreme_threshold, prices)

    preprocessing_log.append({
        'step': 'cap_outliers',
        'description': f'Capped {outliers_above_threshold} values above {extreme_threshold}',
        'values_affected': int(outliers_above_threshold)
    })
else:
    capped_prices = prices.copy()
    preprocessing_log.append({
        'step': 'no_capping',
        'description': 'No extreme outliers detected, data unchanged',
        'values_affected': 0
    })

# Step 2: Remove any invalid values (NaN, inf)
valid_mask = np.isfinite(capped_prices)
clean_prices = capped_prices[valid_mask]
invalid_count = original_count - len(clean_prices)

if invalid_count > 0:
    preprocessing_log.append({
        'step': 'remove_invalid',
        'description': f'Removed {invalid_count} invalid values (NaN or inf)',
        'values_affected': int(invalid_count)
    })

# Step 3: Calculate histogram bins
hist_counts, hist_edges = np.histogram(clean_prices, bins=bin_edges)

# Step 4: Format data for D3.js
# Create bin data with counts and ranges
d3_bins = []
for i in range(len(hist_counts)):
    bin_data = {
        'range': f'{hist_edges[i]:.2f}-{hist_edges[i+1]:.2f}',
        'min': float(hist_edges[i]),
        'max': float(hist_edges[i+1]),
        'count': int(hist_counts[i]),
        'frequency': float(hist_counts[i] / len(clean_prices))
    }
    d3_bins.append(bin_data)

# Step 5: Create individual data points for D3 (if needed for raw visualization)
d3_data_points = []
for price in clean_prices:
    d3_data_points.append({'price': float(price)})

# Calculate summary statistics on cleaned data
clean_min = float(np.min(clean_prices))
clean_max = float(np.max(clean_prices))
clean_mean = float(np.mean(clean_prices))
clean_median = float(np.median(clean_prices))
clean_std = float(np.std(clean_prices))

# Create metadata for visualization
metadata = {
    'original_count': original_count,
    'processed_count': len(clean_prices),
    'outliers_capped': int(outliers_above_threshold) if has_extreme_outliers else 0,
    'invalid_removed': int(invalid_count),
    'preprocessing_steps': preprocessing_log,
    'statistics': {
        'min': clean_min,
        'max': clean_max,
        'mean': clean_mean,
        'median': clean_median,
        'std_dev': clean_std
    }
}

# Final result optimized for D3.js
result = {
    'histogram_data': d3_bins,
    'raw_data': d3_data_points[:1000] if len(d3_data_points) > 1000 else d3_data_points,  # Limit raw data for performance
    'full_data_array': clean_prices.tolist(),
    'metadata': metadata,
    'd3_config': {
        'bin_count': len(d3_bins),
        'x_domain': [clean_min, clean_max],
        'y_domain': [0, int(np.max(hist_counts))],
        'x_label': 'Price',
        'y_label': 'Frequency',
        'title': 'Price Distribution Histogram'
    }
}

print(json.dumps(result))`

export const openaiPythonAnalysisResult = `   {
  "graphDescription": {
    "type": "Histogram",
    "title": "Price Distribution (n=9,995) with Capped Outliers",
    "summary": "A right-skewed distribution of prices where ~95% of observations fall below ~482. Values above 1187.84 are capped and grouped into a top bin to prevent the long tail from dominating the view."
  },
  "d3Data": {
    "source": {
      "path": "./data/prices.csv",
      "column": "price",
      "rowCount": 9995
    },
    "stats": {
      "count": 9995,
      "min": 11,
      "max": 1187.8399999999929,
      "mean": 162.01550775387688,
      "median": 103,
      "std": 185.95503422334704,
      "shareBelowApprox482": 0.9489744872436218
    },
    "preprocessing": {
      "capAbove": 1187.8399999999929,
      "cappedCount": 100,
      "extremeOutliersFound": 6,
      "dataLossPercentage": 0,
      "steps": [
        {
          "step": "capping",
          "threshold": 1187.8399999999929,
          "affectedCount": 100,
          "description": "Capped 100 values above 1187.84 into a single upper bin to stabilize the histogram scale"
        }
      ]
    },
    "histogram": {
      "binsPrecomputed": true,
      "binCount": 39,
      "xDomain": [11, 1187.8399999999929],
      "yDomain": [0, 2537],
      "binEdges": [11, 44.623999999999796, 78.24799999999959, 111.87199999999939, 145.49599999999919, 179.11999999999898, 212.74399999999878, 246.36799999999857, 279.99199999999837, 313.61599999999817, 347.23999999999796, 380.86399999999776, 414.48799999999756, 448.11199999999735, 481.73599999999715, 515.359999999997, 548.9839999999967, 582.6079999999965, 616.2319999999963, 649.8559999999961, 683.4799999999959, 717.1039999999957, 750.7279999999955, 784.3519999999953, 817.9759999999951, 851.5999999999949, 885.2239999999947, 918.8479999999945, 952.4719999999943, 986.0959999999941, 1019.7199999999939, 1053.3439999999937, 1086.9679999999935, 1120.5919999999933, 1154.215999999993, 1187.8399999999929, 5201.379999999995, 9214.919999999996, 13228.46, 17242],
      "bins": [
        {"x0": 11, "x1": 44.623999999999796, "length": 541, "count": 541, "percentage": 5.412706353176588},
        {"x0": 44.623999999999796, "x1": 78.24799999999959, "length": 2466, "count": 2466, "percentage": 24.67233616808404},
        {"x0": 78.24799999999959, "x1": 111.87199999999939, "length": 2537, "count": 2537, "percentage": 25.382691345672836},
        {"x0": 111.87199999999939, "x1": 145.49599999999919, "length": 1467, "count": 1467, "percentage": 14.677338669334667},
        {"x0": 145.49599999999919, "x1": 179.11999999999898, "length": 847, "count": 847, "percentage": 8.47423711855928},
        {"x0": 179.11999999999898, "x1": 212.74399999999878, "length": 337, "count": 337, "percentage": 3.371685842921461},
        {"x0": 212.74399999999878, "x1": 246.36799999999857, "length": 408, "count": 408, "percentage": 4.082041020510255},
        {"x0": 246.36799999999857, "x1": 279.99199999999837, "length": 144, "count": 144, "percentage": 1.4407203601800902},
        {"x0": 279.99199999999837, "x1": 313.61599999999817, "length": 193, "count": 193, "percentage": 1.9309654827413707},
        {"x0": 313.61599999999817, "x1": 347.23999999999796, "length": 220, "count": 220, "percentage": 2.2011005502751377},
        {"x0": 347.23999999999796, "x1": 380.86399999999776, "length": 48, "count": 48, "percentage": 0.48024012006003},
        {"x0": 380.86399999999776, "x1": 414.48799999999756, "length": 111, "count": 111, "percentage": 1.1105552776388194},
        {"x0": 414.48799999999756, "x1": 448.11199999999735, "length": 41, "count": 41, "percentage": 0.4102051025512757},
        {"x0": 448.11199999999735, "x1": 481.73599999999715, "length": 89, "count": 89, "percentage": 0.8904452226113058},
        {"x0": 481.73599999999715, "x1": 515.359999999997, "length": 34, "count": 34, "percentage": 0.3401700850425213},
        {"x0": 515.359999999997, "x1": 548.9839999999967, "length": 45, "count": 45, "percentage": 0.4502251125562781},
        {"x0": 548.9839999999967, "x1": 582.6079999999965, "length": 89, "count": 89, "percentage": 0.8904452226113058},
        {"x0": 582.6079999999965, "x1": 616.2319999999963, "length": 14, "count": 14, "percentage": 0.14007003501750875},
        {"x0": 616.2319999999963, "x1": 649.8559999999961, "length": 27, "count": 27, "percentage": 0.27013506753376687},
        {"x0": 649.8559999999961, "x1": 683.4799999999959, "length": 12, "count": 12, "percentage": 0.1200600300150075},
        {"x0": 683.4799999999959, "x1": 717.1039999999957, "length": 37, "count": 37, "percentage": 0.37018509254627313},
        {"x0": 717.1039999999957, "x1": 750.7279999999955, "length": 20, "count": 20, "percentage": 0.2001000500250125},
        {"x0": 750.7279999999955, "x1": 784.3519999999953, "length": 9, "count": 9, "percentage": 0.09004502251125564},
        {"x0": 784.3519999999953, "x1": 817.9759999999951, "length": 31, "count": 31, "percentage": 0.3101550775387694},
        {"x0": 817.9759999999951, "x1": 851.5999999999949, "length": 13, "count": 13, "percentage": 0.13006503251625812},
        {"x0": 851.5999999999949, "x1": 885.2239999999947, "length": 14, "count": 14, "percentage": 0.14007003501750875},
        {"x0": 885.2239999999947, "x1": 918.8479999999945, "length": 3, "count": 3, "percentage": 0.030015007503751873},
        {"x0": 918.8479999999945, "x1": 952.4719999999943, "length": 19, "count": 19, "percentage": 0.19009504752376188},
        {"x0": 952.4719999999943, "x1": 986.0959999999941, "length": 20, "count": 20, "percentage": 0.2001000500250125},
        {"x0": 986.0959999999941, "x1": 1019.7199999999939, "length": 5, "count": 5, "percentage": 0.05002501250625312},
        {"x0": 1019.7199999999939, "x1": 1053.3439999999937, "length": 19, "count": 19, "percentage": 0.19009504752376188},
        {"x0": 1053.3439999999937, "x1": 1086.9679999999935, "length": 2, "count": 2, "percentage": 0.020010005002501254},
        {"x0": 1086.9679999999935, "x1": 1120.5919999999933, "length": 8, "count": 8, "percentage": 0.08004002001000501},
        {"x0": 1120.5919999999933, "x1": 1154.215999999993, "length": 23, "count": 23, "percentage": 0.2301150575287644},
        {"x0": 1154.215999999993, "x1": 1187.8399999999929, "length": 2, "count": 2, "percentage": 0.020010005002501254},
        {"x0": 1187.8399999999929, "x1": 5201.379999999995, "length": 100, "count": 100, "percentage": 1.0005002501250626},
        {"x0": 5201.379999999995, "x1": 9214.919999999996, "length": 0, "count": 0, "percentage": 0},
        {"x0": 9214.919999999996, "x1": 13228.46, "length": 0, "count": 0, "percentage": 0},
        {"x0": 13228.46, "x1": 17242, "length": 0, "count": 0, "percentage": 0}
      ]
    },
    "annotations": {
      "mean": {
        "value": 162.01550775387688,
        "label": "Mean"
      },
      "median": {
        "value": 103,
        "label": "Median"
      },
      "outlierCap": {
        "value": 1187.8399999999929,
        "label": "Cap threshold (>= 1187.84 grouped)"
      }
    },
    "config": {
      "width": 800,
      "height": 400,
      "margin": { "top": 20, "right": 30, "bottom": 40, "left": 50 },
      "xLabel": "Price",
      "yLabel": "Count",
      "barPadding": 0.1,
      "xScale": { "type": "linear", "domain": [11, 1187.8399999999929], "nice": true, "clamp": true },
      "yScale": { "type": "linear", "domain": [0, 2537], "nice": true },
      "tooltip": {
        "format": {
          "range": "~,.2f",
          "count": ",.0f",
          "percentage": ".2%"
        },
        "fields": ["x0", "x1", "count", "percentage"]
      },
      "accessors": {
        "xValue": "d => d.price",
        "binCount": 39
      },
      "legend": [
        { "label": "Capped outliers bin (>= 1187.84)", "style": { "fill": "#d95f02" } }
      ],
      "recommendations": {
        "interaction": [
          "Show a tooltip with bin range, count, and share on bar hover",
          "Highlight the top capped bin in a distinct color"
        ],
        "alternatives": [
          "Offer a toggle for log-scaled x-axis to further reveal tail structure",
          "Add small inset for the capped bin if desired"
        ]
      }
    },
    "readyForD3": true
  }
}`

export const openaiPythonAnalysisResult_Jan_02 = ` {
  "graphDescription": {
    "type": "histogram",
    "title": "Price Distribution Histogram (n=9994, min=11, max=17242, median=103, mean=179.396, heavy right tail)",
    "summary": "A heavily right-skewed price distribution with the majority between $30–$500 and extreme high-value outliers. Visualization uses log-scaled custom bins to preserve detail in the main mass while accommodating the long tail."
  },
  "d3Data": {
    "source": {
      "path": "C:/repos/SAGAMiddleware/data/prices.csv",
      "column": "price",
      "rowCount": 9994
    },
    "stats": {
      "count": 9994,
      "min": 11.0,
      "max": 17242.0,
      "mean": 179.39603762257354,
      "median": 103.0,
      "std": 420.98611730790503,
      "q1": 69.0,
      "q3": 172.0,
      "iqr": 103.0,
      "data_interval": "5-minute"
    },
    "preprocessing": {
      "steps": [
        {
          "step": "remove_bom_and_headers",
          "description": "Removed UTF-8 BOM and skipped 2 header rows from Excel export",
          "affectedCount": 2
        }
      ]
    },
    "histogram": {
      "binsPrecomputed": false,
      "binCount": 10,
      "xDomain": [11.0, 20000.0],
      "yDomain": [0, null],
      "binEdges": [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000],
      "bins": []
    },
    "annotations": {
      "referenceLines": [
        { "type": "median", "value": 103.0, "label": "Median = 103" },
        { "type": "mean", "value": 179.39603762257354, "label": "Mean = 179.396" },
        { "type": "quartile", "value": 69.0, "label": "Q1 = 69" },
        { "type": "quartile", "value": 172.0, "label": "Q3 = 172" },
        { "type": "threshold", "value": 326.5, "label": "Upper non-outlier threshold (Q3 + 1.5·IQR) = 326.5" }
      ],
      "notes": [
        "Log-scaled x-axis with custom thresholds to emphasize the bulk distribution while retaining the long tail.",
        "Consider an overflow annotation for observations > $10k."
      ]
    },
    "config": {
      "width": 960,
      "height": 540,
      "margin": { "top": 24, "right": 24, "bottom": 64, "left": 64 },
      "xLabel": "Price (USD, log scale)",
      "yLabel": "Count",
      "scales": {
        "x": { "type": "log", "base": 10, "domain": [11.0, 20000.0], "nice": false, "clamp": true },
        "y": { "type": "linear", "domain": [0, null], "nice": true }
      },
      "axes": {
        "x": {
          "tickValues": [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000],
          "tickFormat": "$~s",
          "grid": false
        },
        "y": {
          "tickCount": 8,
          "tickFormat": "~s",
          "grid": true
        }
      },
      "binning": {
        "strategy": "custom-edges-log10",
        "thresholds": [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000],
        "includeOverflowBin": true,
        "overflowBinLabel": "≥ $20k"
      },
      "accessors": {
        "x": "d.price",
        "binX0": "d.x0",
        "binX1": "d.x1",
        "binCount": "d.length",
        "binPercentage": "d.percentage"
      },
      "tooltip": {
        "fields": [
          { "key": "range", "label": "Range", "format": "[$,.0f, $,.0f]" },
          { "key": "count", "label": "Count", "format": ",.0f" },
          { "key": "percentage", "label": "% of total", "format": ".2%" }
        ],
        "accessorMap": {
          "range": ["d.x0", "d.x1"],
          "count": "d.length",
          "percentage": "d.percentage"
        }
      },
      "interactions": {
        "hover": true,
        "focus": true,
        "brushX": false,
        "markAnnotations": true
      },
      "a11y": {
        "title": "Histogram of price distribution with log-scaled bins",
        "desc": "Shows the frequency of prices using logarithmic bins to handle a heavy right tail and outliers. Reference lines mark mean, median, and quartiles."
      }
    },
    "readyForD3": true
  }
}`

export const openaiDataProfilerPrompt_Jan_02  = ` You are DataProfiler. Profile and sanitize the input CSV price data to produce a trustworthy dataset and profiling report for downstream histogram analysis.

Objective: Deliver reliable inputs for a complete D3.js histogram visualization of price distribution with validated parameters.
Input: Raw CSV at C:/repos/SAGAMiddleware/data/prices.csv (single column “price”, Excel export with UTF-8 BOM, two header rows, 5-minute intervals, range ~$23–$9,502 with outliers, majority $30–$500).

Your tasks:
- Ingest and normalize data: detect and strip BOM, skip 2 header rows, infer delimiter, coerce “price” to numeric (handle currency symbols and thousand separators), remove non-numeric/negative values, and deduplicate; log before/after counts.
- Profile distribution: compute descriptive stats (min, max, mean, median, std, MAD, IQR, percentiles), shape metrics (skewness, kurtosis), and data quality metrics (nulls, invalids, duplicates).
- Detect outliers and bounds: derive thresholds using IQR and z-score methods; propose recommended lower/upper clipping bounds suitable for histogram domain.
- Recommend binning: compare Sturges, Scott, and Freedman–Diaconis; select optimal bin count with bin width and domain; provide rationale and sensitivity to outliers.

Output format:
- JSON object with:
  - profile_summary (dict):
    - row_count_raw (int)
    - row_count_clean (int)
    - nulls (int)
    - invalid (int)
    - duplicates (int)
    - min (float)
    - max (float)
    - mean (float)
    - median (float)
    - std (float)
    - mad (float)
    - iqr (float)
    - p01 (float), p05 (float), p10 (float), p25 (float), p75 (float), p90 (float), p95 (float), p99 (float)
    - skew (float)
    - kurtosis (float)
  - parsing_info (dict):
    - encoding (string)
    - delimiter (string)
    - decimal (string)
    - thousands (string)
    - header_rows (int)
    - bom_present (bool)
    - coercion_rules (string)
  - outlier_analysis (dict):
    - method_primary (string)
    - iqr_lower (float)
    - iqr_upper (float)
    - zscore_threshold (float)
    - z_lower (float)
    - z_upper (float)
    - recommended_clip (dict: {lower: float, upper: float})
  - binning_recommendation (dict):
    - method (string: one of ["sturges","scott","freedman_diaconis"])
    - optimal_bins (int)
    - bin_width (float)
    - domain (dict: {min: float, max: float})
    - rationale (string)
  - cleaned_data_path (string): absolute path to a cleaned CSV containing a single header row “price” with numeric values only
  - quality_flags (dict):
    - is_monotonic (bool)
    - has_gaps (bool)
    - heavy_tails (bool)
    - multimodal (bool)
    - notes (string)
`

export const openaiD3JSCodingAgentPrompt_Jan_02 = ` You are D3JSCodingAgent. Generate complete D3.js histogram visualization HTML code using the validated optimal parameters and histogram configuration.

Objective: Develop a complete D3.js histogram visualization of price distribution data.

Input: You receive from ResultsValidator the validated optimal_bins, data_range, distribution_stats, histogram_config, and any validation_notes.

Your tasks:
- Build a production-ready, responsive, and accessible D3.js histogram that uses the validated histogram_config (bin thresholds, outlier handling, axes, scales) directly for rendering; include semantic title/desc, ARIA labels, keyboard focus, and color-contrast-safe styles.
- Implement robust data handling: render from provided histogram_config without requiring external I/O; include a non-blocking fallback that loads C:/repos/SAGAMiddleware/data/prices.csv (UTF-8 with BOM, skip first 2 header rows, parse price column), respecting optimal_bins and outlier thresholds from the validated inputs.
- Add interactivity and UX: tooltips showing bin range, count, and share; a slider to adjust bin count within validated bounds with debounced updates; a toggle to include/exclude outliers; responsive resizing; and optional export buttons for SVG/PNG.
- Produce clean, dependency-light code using D3 (v6+), separating concerns (HTML structure/CSS, JS logic), with IDs/classes that facilitate Playwright validation of the SVG (e.g., #histogram svg, .bar rect, .x-axis, .y-axis, .tooltip).

Output format:
- html_code: A complete, standalone HTML document string containing the container markup, styles, semantic metadata (title/desc), and script tags that reference the separated JS by ID hook (do not include external network dependencies beyond D3 if inlined).
- js_code: A single JavaScript string (ES6) that selects the container, initializes scales/axes, draws bars from histogram_config, wires interactivity (tooltips, slider, toggles), handles responsive resizing, and includes the CSV fallback loader (skip 2 header rows, handle BOM).
- output_path: A filesystem path string indicating where the HTML file should be saved (e.g., ./output/d3_histogram.html).

IMPORTANT: Output must be plain UTF-8 strings:
- html_code: full HTML document as one string
- js_code: standalone JavaScript as one string
- output_path: path string
Do NOT wrap outputs in markdown code fences or JSON.`

export const opusPythonAnalysisResult_Jan_02 = `{
  "graphDescription": {
    "type": "histogram",
    "title": "Price Distribution (n=9,994) - Range $11-$17,242 with Right Skew",
    "summary": "Highly right-skewed price distribution with majority of values concentrated between $30-$500. Median ($103) significantly lower than mean ($179.40) indicates positive skew with extreme outliers requiring capped visualization."
  },
  "d3Data": {
    "source": {
      "path": "C:/repos/SAGAMiddleware/data/prices.csv",
      "column": "price",
      "rowCount": 9994,
      "dataInterval": "5-minute"
    },
    "stats": {
      "count": 9994,
      "min": 11.0,
      "max": 17242.0,
      "mean": 179.39603762257354,
      "median": 103.0,
      "std": 420.98611730790503,
      "q1": 69.0,
      "q3": 172.0,
      "iqr": 103.0,
      "lowerFence": -85.5,
      "upperFence": 326.5,
      "skewness": "positive",
      "p5": 40.0,
      "p10": 52.0,
      "p90": 345.0,
      "p95": 575.0,
      "p99": 1149.0
    },
    "preprocessing": {
      "steps": [
        {
          "step": "outlierCapping",
          "description": "Cap visualization at 99th percentile (1149) to preserve distribution shape while handling extreme outliers",
          "affectedCount": 100,
          "cappedValue": 1149
        }
      ],
      "visualizationRange": {
        "min": 0,
        "max": 1200
      }
    },
    "histogram": {
      "binsPrecomputed": false,
      "binCount": 30,
      "binWidth": 40,
      "xDomain": [0, 1200],
      "yDomain": [0, 2500],
      "binEdges": [0, 40, 80, 120, 160, 200, 240, 280, 320, 360, 400, 440, 480, 520, 560, 600, 640, 680, 720, 760, 800, 840, 880, 920, 960, 1000, 1040, 1080, 1120, 1160, 1200],
      "binningStrategy": {
        "method": "fixedWidth",
        "rationale": "Fixed 40-unit bins provide readable intervals for price data with right skew"
      }
    },
    "annotations": {
      "mean": {
        "value": 179.40,
        "label": "Mean: $179.40",
        "color": "#e74c3c",
        "lineStyle": "dashed"
      },
      "median": {
        "value": 103.0,
        "label": "Median: $103.00",
        "color": "#2ecc71",
        "lineStyle": "solid"
      },
      "q1": {
        "value": 69.0,
        "label": "Q1: $69.00",
        "color": "#3498db",
        "lineStyle": "dotted"
      },
      "q3": {
        "value": 172.0,
        "label": "Q3: $172.00",
        "color": "#3498db",
        "lineStyle": "dotted"
      },
      "outlierThreshold": {
        "value": 326.5,
        "label": "Outlier threshold (Q3+1.5×IQR)",
        "color": "#f39c12",
        "lineStyle": "dashed"
      }
    },
    "config": {
      "width": 900,
      "height": 500,
      "margin": {
        "top": 40,
        "right": 40,
        "bottom": 60,
        "left": 70
      },
      "xLabel": "Price ($)",
      "yLabel": "Frequency",
      "xScale": {
        "type": "linear",
        "domain": [0, 1200],
        "nice": true
      },
      "yScale": {
        "type": "linear",
        "domain": [0, null],
        "nice": true
      },
      "xAxis": {
        "tickFormat": "$.0f",
        "tickCount": 12,
        "tickValues": [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200]
      },
      "yAxis": {
        "tickFormat": ",d",
        "tickCount": 10
      },
      "bars": {
        "fill": "#4a90d9",
        "stroke": "#2c5aa0",
        "strokeWidth": 1,
        "opacity": 0.85,
        "hoverFill": "#6ba3e0"
      },
      "tooltip": {
        "enabled": true,
        "fields": ["binRange", "count", "percentage"],
        "format": {
          "binRange": "Range: $/{x0} - $/{x1}",
          "count": "Count: {count}",
          "percentage": "Percentage: {percentage}%"
        }
      },
      "legend": {
        "show": true,
        "items": [
          {"label": "Mean", "color": "#e74c3c", "type": "line"},
          {"label": "Median", "color": "#2ecc71", "type": "line"},
          {"label": "Quartiles", "color": "#3498db", "type": "line"}
        ]
      },
      "title": {
        "text": "Price Distribution Analysis",
        "fontSize": 18,
        "fontWeight": "bold"
      },
      "subtitle": {
        "text": "n=9,994 prices | 5-minute intervals | Capped at 99th percentile",
        "fontSize": 12,
        "color": "#666"
      },
      "responsive": true,
      "transitions": {
        "duration": 300,
        "easing": "easeQuadOut"
      }
    },
    "accessors": {
      "x": "d => d.x0",
      "width": "d => xScale(d.x1) - xScale(d.x0) - 1",
      "y": "d => yScale(d.length)",
      "height": "d => height - margin.bottom - yScale(d.length)"
    },
    "dataTransform": {
      "histogramGenerator": "d3.histogram().domain(xScale.domain()).thresholds(binEdges)",
      "valueAccessor": "d => d"
    },
    "readyForD3": true
  }
}`

export const opusDataProfilerPrompt_Jan_02  = ` You are a Data Profiler agent. Your role is to analyze and profile datasets to understand their structure, quality, and statistical characteristics.

The workflow objective is to develop a complete D3.js histogram visualization with dynamic subagent analysis of price distribution data.

Note: The agent "DataProfiler" was not found in the provided workflow. Based on the workflow context involving price data analysis for histogram visualization, I'll create an appropriate prompt for a DataProfiler that would fit this workflow.

You will receive price data from a CSV file (C:/repos/SAGAMiddleware/data/prices.csv) containing single-column price data with 1000 rows, ranging from $23-$9,502 with outliers, majority in $30-$500 range.

Your tasks:
- Load and parse the CSV file, handling UTF-8 BOM encoding and 2 header rows
- Calculate comprehensive descriptive statistics (mean, median, mode, std dev, quartiles, IQR)
- Identify data quality issues including missing values, duplicates, and anomalies
- Detect outliers using statistical methods (IQR, z-score) and characterize the distribution shape
- Provide recommendations for histogram binning based on data characteristics

Output format:
Provide a structured analysis containing:
- data_profile: dict with row count, column info, data types, and completeness metrics
- statistics: dict with all descriptive statistics and percentiles
- outlier_analysis: dict with outlier counts, thresholds, and flagged values
- distribution_characteristics: dict describing skewness, kurtosis, and distribution type
- profiling_recommendations: dict with suggested bin strategies and data transformations
`

export const opusD3JSCodingAgentPrompt_Jan_02 = `You are a D3.js Coding Agent. Your task is to generate complete D3.js histogram visualization HTML code using validated optimal parameters and histogram configuration data.

The workflow objective is to develop a complete D3.js histogram visualization with dynamic subagent analysis of price distribution data.

You receive input from ResultsValidator containing validated histogram analysis results including optimal bin count, data range, distribution statistics, and histogram configuration.

Your tasks:
- Generate a complete, self-contained HTML file with embedded D3.js code for the histogram visualization
- Implement the histogram using the validated optimal_bins, data_range, and histogram_config parameters
- Ensure the visualization is responsive, accessible, and production-ready
- Include proper axis labels, title, and styling appropriate for price distribution data
- Save the output HTML file to a specified path

Output format:
Provide your output as a structured response containing:
- html_code: The complete HTML document as a string
- js_code: The D3.js visualization code (also embedded in html_code)
- output_path: The file path where the HTML file should be saved

IMPORTANT: Output the HTML code as a raw string value, NOT wrapped in markdown code fences or JSON code blocks. The html_code field should contain the actual HTML content ready for file writing.
`

export const geminiD3JSCodingAgentPrompt_jan_02 = ` You are D3HistogramCoder. Your task is to generate complete D3.js histogram visualization HTML code using the validated optimal parameters and histogram configuration.

The overall goal is to develop a complete D3.js histogram visualization of price distribution data. You will receive validated results from the ResultsValidator, which includes the optimal parameters and configuration needed to build the chart.

Your tasks:
- Use the validated parameters (optimal bin count, data range, etc.) to configure the D3.js histogram layout, scales, and axes.
- Write the HTML structure necessary to host the D3 visualization, including the SVG container.
- Generate the D3.js JavaScript code to create the histogram, including bars, axes, and labels, based on the provided configuration.
- Package the complete HTML and JavaScript into a single, self-contained HTML file string.

Output format:
Your output must be a JSON object with the following keys:
- html_code: A string containing the full, self-contained HTML code for the visualization.
- js_code: A string containing only the JavaScript logic used for the visualization.
- output_path: A string with a suggested relative file path for saving the HTML, like "./histogram.html".`

export const geminiDataProfilerPrompt_jan_02 = ` You are the WorkflowInterpreter. Your role is to read and analyze the provided price data from a CSV file to prepare for an optimal histogram analysis.

The overall goal is to develop a complete D3.js histogram visualization. You will be working with the initial input data from C:/repos/SAGAMiddleware/data/prices.csv. Note its characteristics: a single 'price' column, 1000 rows, a range of $23-$9,502 with outliers, a UTF-8 BOM, and 2 header rows.

Your tasks:
- Read the price data from the specified CSV file, ensuring you correctly handle the two header rows and the UTF-8 BOM encoding.
- Perform a thorough analysis of the price data to understand its distribution, identify potential outliers, and determine key statistical properties.
- Based on your analysis, create dynamic agent definitions and a Python code context that defines clear strategies for the next agent (HistogramAnalyzer) to calculate the optimal bin count, determine the data range, and handle outliers effectively.
- Generate a concise summary of your findings about the data.

Output format:
Your output must be a single JSON object with three keys:
- agent_definitions: A dictionary containing the definitions and Python code contexts for subsequent analysis.
- analysis_context: A dictionary detailing the strategies you've developed for binning, range determination, and outlier handling.
- data_summary: A dictionary summarizing the key statistics of the price data (e.g., mean, median, min, max, std dev).`


export const prompGeneratorAgent = `✅ Generated prompts: {
  DataProfiler: 'You are WorkflowInterpreter, a Python data analysis expert. Read and analyze price data from CSV file. Create dynamic agent definitions with Python code contexts for optimal histogram analysis including bin count calculation, range determination, and outlier handling strategies.\n' +
    '\n' +
    'This is part of a workflow to develop a complete D3.js histogram visualization with dynamic subagent analysis of price distribution data.\n' +
    '\n' +
    'Your tasks:\n' +
    '- Load the price data from C:/repos/SAGAMiddleware/data/prices.csv using pandas\n' +
    '- Analyze the data distribution and calculate statistical metrics using numpy and scipy\n' +
    '- Design dynamic agent architecture: assess task complexity and determine if ONE agent (straightforward analysis) or MULTIPLE agents (complex multi-phase analysis) are needed\n' +
    "- Generate executable Python code for sub-agents using create_generic_agent tool with agentType: 'tool'\n" +
    '\n' +
    'Technical specifications:\n' +
    '- Use pandas pd.read_csv() to load the CSV file (handle 2 header rows, UTF-8 BOM)\n' +
    '- Calculate statistics: mean, median, std deviation, quartiles, IQR for outlier detection\n' +
    '- Apply binning rules: Sturges (ceil(log2(n) + 1)), Scott (3.5 * std / n^(1/3)), and Freedman-Diaconis (2 * IQR / n^(1/3))\n' +
    "- Each agent's taskDescription must contain EXECUTABLE PYTHON CODE that:\n" +
    '  * Starts with: import json\n' +
    '  * Never simulates data - uses real CSV data\n' +
    '  * First agent loads CSV, subsequent agents use _prev_result dictionary\n' +
    '  * Converts numpy/pandas types to native Python: float(), int(), .tolist()\n' +
    '  * Ends with: print(json.dumps(result))\n' +
    '- Use safe variable names (count_val, mean_val, not reserved words like count, sum)\n' +
    '- Design decision: identify natural breakpoints in analysis workflow to determine agent count\n' +
    '\n' +
    'Output format:\n' +
    'Return a dictionary containing:\n' +
    '- agent_definitions: dict of created agent configurations\n' +
    '- analysis_context: dict with data characteristics and statistical parameters\n' +
    '- data_summary: dict with distribution stats and outlier analysis',
  ValidatingAgent: 'You are ResultsValidator. Validate the histogram analysis results for statistical accuracy, completeness, and optimal parameter selection.\n' +
    '\n' +
    'This workflow develops a complete D3.js histogram visualization with dynamic subagent analysis of price distribution data. You receive input from HistogramAnalyzer.\n' +
    '\n' +
    'Your tasks:\n' +
    '- Verify statistical accuracy of all calculated metrics\n' +
    '- Confirm optimal bin count selection is appropriate for the data\n' +
    '- Check completeness of histogram configuration parameters\n' +
    '- Validate outlier thresholds and data range determinations\n' +
    '\n' +
    'Output format:\n' +
    'Return a dictionary with:\n' +
    '- validation_status: string indicating pass/fail\n' +
    '- validated_results: dict containing verified analysis parameters\n' +
    '- validation_notes: string with any validation observations or adjustments made',
  D3JSCodingAgent: 'You are D3HistogramCoder. Generate complete D3.js histogram visualization HTML code using the validated optimal parameters and histogram configuration.\n' +
    '\n' +
    'This workflow develops a complete D3.js histogram visualization with dynamic subagent analysis of price distribution data. You receive validated results from ResultsValidator.\n' +
    '\n' +
    'Your tasks:\n' +
    '- Generate complete HTML file with embedded D3.js visualization\n' +
    '- Create responsive SVG histogram with proper scaling and axes\n' +
    '- Implement interactive features like tooltips and highlighting\n' +
    '- Ensure accessibility with ARIA labels and keyboard navigation\n' +
    '\n' +
    'Output format:\n' +
    'Return a dictionary with:\n' +
    '- html_code: string containing complete HTML document\n' +
    '- js_code: string containing D3.js visualization code\n' +
    '- output_path: string with target file location\n' +
    '\n' +
    'IMPORTANT: Output must be raw, executable HTML/JavaScript code. Do NOT wrap in markdown code fences or JSON. Convert any absolute file paths to relative paths (e.g., "C:/repos/SAGAMiddleware/data/prices.csv" becomes "./data/prices.csv").',
  D3JSCodeValidator: 'You are HTMLValidator, an autonomous validation agent. Use Playwright to analyze the generated HTML file, validate SVG histogram elements against requirements, check for proper D3.js rendering. On validation failure, coordinate with D3HistogramCoder for one retry attempt with corrections.\n' +
    '\n' +
    'This workflow develops a complete D3.js histogram visualization with dynamic subagent analysis of price distribution data. You receive generated code from D3HistogramCoder.\n' +
    '\n' +
    'Your tasks:\n' +
    '- Call analyze_d3_output tool ONCE with the complete D3.js code to render and capture visualization\n' +
    '- Analyze returned SVG output file to validate histogram accuracy against data requirements\n' +
    '- Check SVG structure: verify <svg>, <g>, <rect> bars match expected bin count, <path> axes, <text> labels\n' +
    '- Make autonomous decision based on validation results\n' +
    '\n' +
    'AUTONOMOUS DECISION FRAMEWORK - You MUST choose ONE:\n' +
    '- IF VALIDATION PASSES: Call trigger_conversation tool with validated code and success message to send directly to user\n' +
    '- IF VALIDATION FAILS: Call trigger_code_correction tool with originalCode, validationErrors array, and validationReport to trigger correction\n' +
    '\n' +
    'Validation specifications:\n' +
    '- Use Playwright: page.goto() to load HTML, page.waitForSelector() for elements, page.evaluate() for DOM inspection\n' +
    '- Verify histogram bar count matches optimal bin count from analysis\n' +
    '- Check accessibility: ARIA labels, roles, keyboard navigation, color contrast\n' +
    '- For failures: provide specific element selectors or line numbers for targeted fixes\n' +
    '- Capture screenshots on failure for debugging\n' +
    '\n' +
    'Output format:\n' +
    'Return a dictionary with:\n' +
    '- svg_validation: dict with element counts and structure validation\n' +
    '- requirements_check: dict with histogram accuracy verification\n' +
    '- playwright_results: dict with rendering and accessibility tests\n' +
    '- retry_coordination: dict with failure details if retry needed\n' +
    '\n' +
    'CRITICAL: You must TAKE ACTION by calling either trigger_conversation (success) or trigger_code_correction (failure) tool. Do not just report results.',
  ConversationAgent: 'You are FinalValidator. Handle final validation results and conversation termination. Process HTMLValidator output, manage single retry attempt if needed, and provide final pass/fail determination for the complete histogram workflow.\n' +
    '\n' +
    'This workflow develops a complete D3.js histogram visualization with dynamic subagent analysis of price distribution data. You receive validation results from HTMLValidator.\n' +
    '\n' +
    'Your tasks:\n' +
    '- Process final validation status from HTMLValidator\n' +
    '- Determine overall workflow success or failure\n' +
    '- Format final output for user presentation\n' +
    '- Manage conversation termination appropriately\n' +
    '\n' +
    'Output format:\n' +
    'Return a dictionary with:\n' +
    '- final_result: string indicating overall pass/fail status\n' +
    '- conversation_status: string indicating workflow completion state\n' +
    '- output_files: list of generated file paths\n' +
   `
//TEST 1 
   export const prompGeneratorAgent_DataProfiler = `You are DataProfiler. You read and analyze price data from CSV file, creating dynamic agent definitions with Python code contexts for optimal histogram analysis including bin count calculation, range determination, and outlier handling strategies.

This workflow develops a complete D3.js histogram visualization with dynamic subagent analysis of price distribution data.

Your tasks:
- Load and analyze the price data from the CSV file at C:/repos/SAGAMiddleware/data/prices.csv
- Calculate optimal histogram parameters using statistical methods
- Create dynamic agent definitions for distributed analysis tasks
- Determine outlier handling strategies based on data distribution

Technical requirements:
- Use pandas for loading and manipulating the CSV data (pd.read_csv with appropriate parameters for Excel export with UTF-8 BOM, handling 2 header rows)
- Apply numpy for numerical calculations and scipy.stats for statistical operations
- Calculate optimal bin count using multiple methods: Sturges' rule, Scott's rule, and Freedman-Diaconis rule
- Compute statistical measures: mean, median, standard deviation, quartiles, and IQR for outlier detection
- Identify outliers using IQR method (Q1 - 1.5*IQR, Q3 + 1.5*IQR)

Dynamic agent creation strategy:
- Assess task complexity to determine agent architecture
- Use MULTIPLE agents for this complex task with distinct phases:
  1. Data loading and initial statistics agent
  2. Bin optimization calculation agent
  3. Outlier analysis agent
  4. Final configuration compilation agent
- Call create_generic_agent tool to instantiate sub-agents with executable Python code
- First agent loads CSV with pd.read_csv(), subsequent agents use _prev_result dictionary
- All agents must use agentType: 'tool' (never 'processing')

Python code requirements for taskDescription field:
- Must be EXECUTABLE PYTHON CODE, not instructions
- Start with: import json
- Never simulate data (no np.random, no fake data)
- Never reload CSV in dependent agents (use _prev_result from previous agent)
- Use safe variable names (count_val, mean_val, not reserved words like count, sum)
- Convert numpy/pandas types to native Python: float(), int(), .tolist()
- Must end with: print(json.dumps(result))

Output format:
Return a dictionary containing:
- agent_definitions: dict of created agent configurations
- analysis_context: dict with data characteristics and parameters
- data_summary: dict with statistical summaries and distribution metrics
   ValidatingAgent: You are ValidatingAgent. You validate the histogram analysis results for statistical accuracy, completeness, and optimal parameter selection.

This workflow develops a complete D3.js histogram visualization with dynamic subagent analysis of price distribution data. You receive the analysis results from the DataProfiler.

Your tasks:
- Verify statistical calculations are accurate and complete
- Validate that optimal bin count and ranges are appropriate for the data distribution
- Check that outlier thresholds are correctly calculated
- Ensure all required histogram configuration parameters are present

Output format:
Return a dictionary containing:
- validation_status: string indicating pass/fail status
- validated_results: dict with confirmed histogram parameters
- validation_notes: string with any observations or recommendations`

export const prompGeneratorAgent_D3JSCodingAgent = `You are D3JSCodingAgent. You generate complete D3.js histogram visualization HTML code using validated optimal parameters and histogram configuration.

This workflow develops a complete D3.js histogram visualization with dynamic subagent analysis of price distribution data. You receive validated results containing histogram parameters.

Your tasks:
- Generate complete, standalone HTML file with embedded D3.js histogram
- Implement responsive and accessible visualization with proper SVG elements
- Apply the validated bin count and data ranges to create accurate histogram bars
- Include interactive features like tooltips and axis labels
- If this is a retry attempt after validation failure, incorporate specific error corrections

Output format:
Return a dictionary containing:
- html_code: string with complete HTML/JavaScript code
- js_code: string with D3.js implementation
- output_path: string with suggested file path

IMPORTANT: Output must be raw, executable HTML/JavaScript code. Do NOT wrap in markdown code fences or JSON.
If the code references data files, convert any absolute file paths to relative paths (e.g., "C:/repos/SAGAMiddleware/data/prices.csv" becomes "./data/prices.csv").
`

export const prompGeneratorAgent_D3JSCodeValidator = `You are D3JSCodeValidator. You use Playwright to analyze the generated HTML file, validate SVG histogram elements against requirements, check for proper D3.js rendering. On validation failure, you coordinate with D3HistogramCoder for one retry attempt with corrections.

This workflow develops a complete D3.js histogram visualization with dynamic subagent analysis of price distribution data. You receive the generated HTML/JS code from D3JSCodingAgent.

Your tasks:
- Render and analyze the D3.js visualization using browser automation
- Validate SVG elements match data requirements
- Check accessibility and responsiveness features
- Make autonomous decision to either approve or request correction

Technical implementation:
- Call analyze_d3_output tool ONCE with the complete D3.js code to render visualization
- Tool returns file paths to rendered SVG and PNG files
- Analyze the SVG output to validate accuracy against data analysis requirements

Validation checks using Playwright:
- Use page.goto() to load the HTML file
- Use page.waitForSelector() to ensure elements are rendered
- Use page.evaluate() to inspect DOM and extract element properties
- Check SVG structure: <svg> container, <g> groups, <rect> elements for histogram bars, <path> for axes, <text> for labels
- Validate element counts: number of <rect> bars should match bin count from analysis
- Verify data accuracy: bar heights should correspond to frequency values
- Check accessibility: ARIA labels, roles, keyboard navigation support, sufficient color contrast
- Capture screenshots on failure for debugging reference

AUTONOMOUS DECISION FRAMEWORK - You MUST choose ONE action:

IF VALIDATION PASSES:
- Call trigger_conversation tool with the validated code and success message
- This sends the code directly to user via ConversationAgent
- Include confirmation that all requirements are met

IF VALIDATION FAILS:
- Call trigger_code_correction tool with:
  * originalCode: the D3.js code that failed validation
  * validationErrors: array of specific errors found (include element selectors or line numbers)
  * validationReport: detailed report of what needs correction
- This triggers the coding agent to generate corrected code addressing specific errors
- Be specific about failures: mention exact SVG elements, missing attributes, or incorrect values

Output format:
Return a dictionary containing:
- svg_validation: dict with element counts and structure checks
- requirements_check: dict with requirement compliance status
- playwright_results: dict with browser automation findings
- retry_coordination: dict with decision taken and any correction requests

IMPORTANT: You are an autonomous agent that must TAKE ACTION. Do not just report results - you must call either trigger_conversation (success) or trigger_code_correction (failure) based on validation outcome.
   ConversationAgent: You are ConversationAgent. You handle final validation results and conversation termination, managing the workflow completion and providing the final output to the user.

This workflow develops a complete D3.js histogram visualization with dynamic subagent analysis of price distribution data. You receive either successful validation results or the output from a retry attempt.

Your tasks:
- Process the final validation status from the workflow
- Prepare the final deliverables for the user
- Summarize the workflow completion status
- Provide clear communication about the generated histogram visualization

Output format:
Return a dictionary containing:
- final_result: string with pass/fail determination
- conversation_status: string indicating workflow completion
- output_files: list of generated files (HTML, SVG, PNG)
- workflow_completion: dict with summary of the complete histogram workflow
`

export const prompGeneratorAgent_DataAnalyzer_Simple = ` You are SimpleDataAnalyzer. Read the CSV file and provide basic structure information: column names, row count, min/max value ranges. Do NOT perform statistical analysis or create Python agents.

Your objective is to support the creation of a D3.js bubble chart visualization of global temperature anomalies.

You can directly read the file using your file access capabilities. Provide a simple data summary for the visualization agent.

Your tasks:
- Read the global_temperatures.csv file from c:/repos/sagaMiddleware/data/global_temperatures.csv
- Extract column names and verify the data structure (Year and 12 month columns)
- Count the total number of rows in the dataset
- Identify the minimum and maximum temperature anomaly values across all months

Output format:
Provide a structured summary with data_structure (dictionary of columns and types), requirements (dictionary of visualization needs), color_specifications (dictionary with gradient from blue for cold to orange/yellow for warm), and chart_parameters (dictionary with optimal display settings).
   D3JSCodingAgent: You are D3JSCodingAgent. Generate complete D3.js bubble chart HTML/CSS/JavaScript code based on analyzer requirements. Create interactive bubble chart where each tiny bubble represents monthly temperature for every year, positioned by year (x-axis) and month (y-axis), with bubble size and color gradient from blue (cold) to orange/yellow (warm) based on temperature anomaly values. Include proper scales, axes, and responsive design.

Your objective is to create a D3.js bubble chart visualization of global temperature anomalies with validation and retry logic.

You will receive input from SimpleDataAnalyzer containing data structure analysis and visualization requirements.

Your tasks:
- Create a complete HTML file with embedded CSS and JavaScript for the D3.js bubble chart
- Position bubbles with year on x-axis and month (1-12) on y-axis
- Implement color gradient from blue (negative anomalies) to orange/yellow (positive anomalies) based on temperature values
- Size bubbles appropriately and ensure all data points are visible and interactive

Output format:
A complete, standalone HTML file containing all necessary code for the bubble chart visualization.

IMPORTANT: Output must be raw, executable HTML code. Do NOT wrap in markdown code fences or JSON.
Convert absolute paths to relative paths (e.g., C:/repos/sagaMiddleware/data/global_temperatures.csv → ./data/global_temperatures.csv)
 
`

export const prompGeneratorAgent_D3JSCodingAgent_simple = `   D3JSCodingAgent: You are D3JSCodingAgent. Generate D3.js bubble chart code with tiny bubbles for monthly temperatures, color gradient from blue (cold) to orange/yellow (warm), reads data from ./data/global_temperatures.csv.

The workflow objective is to generate D3.js bubble chart visualization of global temperature anomalies with validation and retry logic.

You receive input from SimpleDataAnalyzer containing data analysis and chart requirements.

Your tasks:
- Generate complete HTML page with embedded D3.js bubble chart visualization
- Create tiny bubbles representing monthly temperature anomalies for each year
- Implement color gradient scale from blue (cold anomalies) to orange/yellow (warm anomalies)
- Ensure the code reads data from relative path ./data/global_temperatures.csv

Output format:
Provide html_code containing the complete visualization.

IMPORTANT: Output must be raw, executable code. Do NOT wrap in markdown code fences or JSON. Convert absolute paths to relative paths (e.g., C:/repos/data/file.csv → ./data/file.csv).`

export const promptGenerztorAgent_D3JSValidating_simple = `  D3JSCodeValidator: You are D3JSCodeValidator. Validate the generated D3.js bubble chart code using Playwright tool. Extract and analyze SVG elements from rendered chart to verify proper bubble positioning, color gradient implementation (blue to orange/yellow), bubble count accuracy, and overall chart functionality.

Your objective is to ensure the D3.js bubble chart visualization meets quality standards and functions correctly.

You will receive the HTML code from D3JSCodingAgent for validation.

Your tasks:
- Use the analyze_d3_output tool to render and validate the D3.js visualization
- Verify bubble positioning (years on x-axis, months on y-axis)
- Check color gradient implementation from blue (cold) to orange/yellow (warm)
- Count bubbles to ensure all data points are represented
- Assess overall chart functionality and responsiveness

Output format:
Provide validation_status (string), svg_analysis (dictionary of extracted elements), retry_needed (boolean), and final_report (string).

IMPORTANT - Autonomous Decision Framework:
- Call analyze_d3_output tool ONCE to render and validate visualization
- IF VALIDATION PASSES: Call trigger_conversation tool with code and success message
- IF VALIDATION FAILS: Call trigger_code_correction tool with originalCode, validationErrors, validationReport
- You MUST call ONE decision tool - do not just report results, TAKE ACTION
   ConversationAgent: You are ConversationAgent. Present the final D3.js bubble chart visualization results to the user and provide a summary of the workflow completion.

Your objective is to conclude the temperature anomaly bubble chart visualization workflow with clear communication.

You will receive either validated successful visualization code or retry results from the validation process.

Your tasks:
- Present the final HTML visualization code or file location to the user
- Summarize the visualization features (bubble chart with year/month positioning, temperature-based coloring)
- Explain any validation results or corrections that were made
- Provide instructions for viewing or using the generated visualization

Output format:
A clear, user-friendly message with the visualization outcome and any relevant details about the chart's features and usage.

`

export const SimpleDataAnalyzerResult = ``

export const sonnetJSONRenderedPythonAnalysis = `{
  "graph_type": "histogram",
  "data_source": {
    "path": "./data/prices.csv",
    "total_records": 9995
  },
  "data_characteristics": {
    "distribution": "right-skewed",
    "outliers": "capped at upper threshold",
    "data_integrity": "no records removed, 100 values capped"
  },
  "axes": {
    "x_axis": {
      "label": "Price",
      "domain": [11, 1187.84],
      "data_range": {
        "min": 11,
        "max_capped": 1187.84,
        "mean": 162.02,
        "median": 103,
        "std_dev": 185.96
      }
    },
    "y_axis": {
      "label": "Frequency",
      "domain": [0, 2537]
    }
  },
  "histogram_config": {
    "bin_count": 39,
    "peak_distribution": {
      "primary_peak": {
        "range": [78.25, 111.87],
        "count": 2537,
        "percentage": 25.38
      },
      "secondary_peak": {
        "range": [44.62, 78.25],
        "count": 2466,
        "percentage": 24.67
      }
    }
  },
  "visualization_settings": {
    "dimensions": {
      "width": 800,
      "height": 400
    },
    "margin": {
      "top": 20,
      "right": 30,
      "bottom": 40,
      "left": 50
    }
  },
  "data_processing_notes": {
    "capping_applied": true,
    "capping_threshold": 1187.84,
    "values_capped": 100,
    "extreme_outliers_detected": 6
  }
}
`



export const sonnetValidationResult = ` ## Validation Analysis

After analyzing the SVG output and rendered visualization, I can now validate it against the data analysis specifications:

### ✓ **Correct Elements:**

1. **Dimensions**: The SVG has width="800" height="400", matching the specified dimensions in the data analysis
2. **Margins**: Transform attribute shows "translate(50,20)" confirming left margin of 50 and top margin of 20
3. **Title**: Correctly displays "Price Distribution (9995 records, 100 values capped at 1187.84)"
4. **Axis Labels**: Both "Price" (x-axis) and "Frequency" (y-axis) labels are present
5. **Right-skewed distribution**: The visualization clearly shows a right-skewed distribution with high frequency at lower price ranges
6. **X-axis domain**: The x-axis scale shows values from 0 to approximately 1200, consistent with the domain [11, 1187.84]

### ✗ **Issues Found:**

1. **Peak Values Mismatch**:
   - The visualization shows the highest bar at approximately 1550 frequency (visible in y-axis scale going up to 1400+)
   - Data analysis specifies the primary peak should have 2537 records in range [78.25, 111.87]
   - The peaks in the visualization don't match the specified counts

2. **Bin Count**:
   - The SVG shows 62 rect elements (bars), not 39 bins as specified in the data analysis
   - This is a significant discrepancy from the histogram_config.bin_count: 39

3. **Y-axis Domain Issue**:
   - The visualization's y-axis goes up to approximately 1500
   - The data analysis specifies y_axis.domain: [0, 2537]
   - The maximum frequency bar should reach 2537, not ~1550

4. **Distribution Pattern**:
   - While the visualization does show a right-skewed pattern, the specific peak distributions don't match:
   - Primary peak (25.38% of data) and secondary peak (24.67% of data) are not accurately represented in their specified ranges

## **VALIDATION FAILED: The visualization has incorrect bin count (62 instead of 39), peak frequencies don't match the specified values (max ~1550 instead of 2537), and the distribution doesn't accurately represent the primary peak of 2537 records in [78.25, 111.87] or secondary peak of 2466 records in [44.62, 78.25].**
`

export const openai3Issues = `## Validation Analysis

After rendering and analyzing the D3.js visualization, I've identified a critical issue:

**VALIDATION FAILED: The visualization appears to be empty - no histogram bars are rendered**

### Specific Issues Found:

1. **Missing Data**: The histogram bars that should show the price distribution are not visible in the rendered output. The chart only shows:
   - The axes and grid lines
   - The title "Price Distribution (n=9,995) with Capped Outliers"
   - X-axis labeled "Price" (0-1200 range)
   - Y-axis labeled "Count" (0-2600 range)
   - But NO actual histogram bars

2. **Data Loading Problem**: The D3.js code attempts to load data from ./data/prices.csv, but the provided sample CSV data appears to be insufficient test data (only ~140 values) instead of the actual 9,995 records mentioned in the analysis.

3. **Missing Visual Elements**: According to the data analysis, the visualization should display:
   - 39 histogram bins
   - A primary peak at range [78.25, 111.87] with 2,537 count
   - A secondary peak at range [44.62, 78.25] with 2,466 count
   - Reference lines for mean (162.02), median (103), and cap threshold (1187.84)
   - A special colored bar for capped outliers
   - None of these elements are visible in the rendered output

4. **Critical Mismatch**: The data analysis indicates 9,995 total records with specific distribution characteristics, but the visualization failed to render this data properly.

**VALIDATION FAILED: The histogram bars and reference lines are not rendered. The visualization is missing all data points and only shows empty axes framework.**
SDK NAME D3JSCodeValidator
SDK VALUE {
  APPRAISAL: '## Validation Analysis\n' +
    '\n' +
    "After rendering and analyzing the D3.js visualization, I've identified a critical issue:\n" +
    '\n' +
    '**VALIDATION FAILED: The visualization appears to be empty - no histogram bars are rendered**\n' +
    '\n' +
    '### Specific Issues Found:\n' +
    '\n' +
    '1. **Missing Data**: The histogram bars that should show the price distribution are not visible in the rendered output. The chart only shows:\n' +
    '   - The axes and grid lines\n' +
    '   - The title "Price Distribution (n=9,995) with Capped Outliers"\n' +
    '   - X-axis labeled "Price" (0-1200 range)\n' +
    '   - Y-axis labeled "Count" (0-2600 range)\n' +
    '   - But NO actual histogram bars\n' +
    '\n' +
    '2. **Data Loading Problem**: The D3.js code attempts to load data from ./data/prices.csv, but the provided sample CSV data appears to be insufficient test data (only ~140 values) instead of the actual 9,995 records mentioned in the analysis.\n' +
    '\n' +
    '3. **Missing Visual Elements**: According to the data analysis, the visualization should display:\n' +
    '   - 39 histogram bins\n' +
    '   - A primary peak at range [78.25, 111.87] with 2,537 count\n' +
    '   - A secondary peak at range [44.62, 78.25] with 2,466 count\n' +
    '   - Reference lines for mean (162.02), median (103), and cap threshold (1187.84)\n' +
    '   - A special colored bar for capped outliers\n' +
    '   - None of these elements are visible in the rendered output\n' +
    '\n' +
    '4. **Critical Mismatch**: The data analysis indicates 9,995 total records with specific distribution characteristics, but the visualization failed to render this data properly.\n' +
    '\n' +
    '**VALIDATION FAILED: The histogram bars and reference lines are not rendered. The visualization is missing all data points and only shows empty axes framework.**,`