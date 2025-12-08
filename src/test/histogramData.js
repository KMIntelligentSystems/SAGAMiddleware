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
- Rows: ~1000 (single column dataset)
- Key columns: price (numeric values)
- Distribution: Right-skewed with outliers (range ~23-9502, most values 50-500)
- Complexity: Medium (contains extreme outliers that need handling)

**Recommended Workflow: 4 Agents**

### Agent 1: Data Profiler
Load price data from C:/repos/SAGAMiddleware/data/prices.csv and generate comprehensive statistical profile including min/max, quartiles, mean, median, standard deviation, outlier detection, and distribution characteristics.
→ Outputs: Statistical summary and data quality assessment

### Agent 2: Histogram Parameters Calculator
Analyze the price distribution statistics to determine optimal histogram parameters including appropriate bin count, bin ranges, and outlier handling strategy for effective visualization.
→ Outputs: Optimal bin configuration and data transformation recommendations

### Agent 3: Data Preprocessor
Clean and prepare the price data by handling outliers, applying any necessary transformations, and formatting data structure optimized for D3.js consumption.
→ Outputs: Clean, D3-ready price dataset with preprocessing metadata

### Agent 4: Visualization
Create D3 js histogram of prices from the csv file provided from the response from the MCP server. You must use d3.csv() method to handle the input file. The data represents prices. RELATIVE PATH: ./data/prices.csv **NOTE** Use relative path in html
→ Outputs: Complete D3.js HTML histogram visualization

**Execution:** Sequential (1→2→3→4)

**Validation:** Statistical profile accuracy, optimal binning for skewed distribution, data preprocessing integrity, D3.js visualization functionality
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

