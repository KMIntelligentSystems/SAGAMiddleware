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

export const openaiAnalyis = ` {
  "histogram_data": [
    {
      "bin_label": "Bin 1",
      "bin_start": 46.887618140501345,
      "bin_end": 48.80535929512965,
      "count": 2,
      "percentage": 0.20161290322580644
    },
    {
      "bin_label": "Bin 2",
      "bin_start": 48.80535929512965,
      "bin_end": 50.80153759973504,
      "count": 2,
      "percentage": 0.20161290322580644
    },
    {
      "bin_label": "Bin 3",
      "bin_start": 50.80153759973504,
      "bin_end": 52.87936119660601,
      "count": 2,
      "percentage": 0.20161290322580644
    },
    {
      "bin_label": "Bin 4",
      "bin_start": 52.87936119660601,
      "bin_end": 55.04216944362144,
      "count": 3,
      "percentage": 0.3024193548387097
    },
    {
      "bin_label": "Bin 5",
      "bin_start": 55.04216944362144,
      "bin_end": 57.29343828107339,
      "count": 4,
      "percentage": 0.4032258064516129
    },
    {
      "bin_label": "Bin 6",
      "bin_start": 57.29343828107339,
      "bin_end": 59.63678581799727,
      "count": 4,
      "percentage": 0.4032258064516129
    },
    {
      "bin_label": "Bin 7",
      "bin_start": 59.63678581799727,
      "bin_end": 62.07597814698735,
      "count": 7,
      "percentage": 0.7056451612903225
    },
    {
      "bin_label": "Bin 8",
      "bin_start": 62.07597814698735,
      "bin_end": 64.61493539684291,
      "count": 8,
      "percentage": 0.8064516129032258
    },
    {
      "bin_label": "Bin 9",
      "bin_start": 64.61493539684291,
      "bin_end": 67.25773803277245,
      "count": 13,
      "percentage": 1.310483870967742
    },
    {
      "bin_label": "Bin 10",
      "bin_start": 67.25773803277245,
      "bin_end": 70.00863341428133,
      "count": 20,
      "percentage": 2.0161290322580645
    },
    {
      "bin_label": "Bin 11",
      "bin_start": 70.00863341428133,
      "bin_end": 72.87204262128223,
      "count": 19,
      "percentage": 1.9153225806451613
    },
    {
      "bin_label": "Bin 12",
      "bin_start": 72.87204262128223,
      "bin_end": 75.852567559399,
      "count": 27,
      "percentage": 2.721774193548387
    },
    {
      "bin_label": "Bin 13",
      "bin_start": 75.852567559399,
      "bin_end": 78.95499835588322,
      "count": 33,
      "percentage": 3.326612903225806
    },
    {
      "bin_label": "Bin 14",
      "bin_start": 78.95499835588322,
      "bin_end": 82.18432105802951,
      "count": 42,
      "percentage": 4.233870967741935
    },
    {
      "bin_label": "Bin 15",
      "bin_start": 82.18432105802951,
      "bin_end": 85.54572564646237,
      "count": 54,
      "percentage": 5.443548387096774
    },
    {
      "bin_label": "Bin 16",
      "bin_start": 85.54572564646237,
      "bin_end": 89.04461437617273,
      "count": 54,
      "percentage": 5.443548387096774
    },
    {
      "bin_label": "Bin 17",
      "bin_start": 89.04461437617273,
      "bin_end": 92.68661045870967,
      "count": 80,
      "percentage": 8.064516129032258
    },
    {
      "bin_label": "Bin 18",
      "bin_start": 92.68661045870967,
      "bin_end": 96.4775670994807,
      "count": 73,
      "percentage": 7.358870967741936
    },
    {
      "bin_label": "Bin 19",
      "bin_start": 96.4775670994807,
      "bin_end": 100.42357690468488,
      "count": 83,
      "percentage": 8.366935483870968
    },
    {
      "bin_label": "Bin 20",
      "bin_start": 100.42357690468488,
      "bin_end": 104.53098167299703,
      "count": 76,
      "percentage": 7.661290322580645
    },
    {
      "bin_label": "Bin 21",
      "bin_start": 104.53098167299703,
      "bin_end": 108.80638258773968,
      "count": 92,
      "percentage": 9.274193548387096
    },
    {
      "bin_label": "Bin 22",
      "bin_start": 108.80638258773968,
      "bin_end": 113.256650825923,
      "count": 60,
      "percentage": 6.048387096774194
    },
    {
      "bin_label": "Bin 23",
      "bin_start": 113.256650825923,
      "bin_end": 117.88893860120298,
      "count": 64,
      "percentage": 6.451612903225806
    },
    {
      "bin_label": "Bin 24",
      "bin_start": 117.88893860120298,
      "bin_end": 122.71069065850548,
      "count": 60,
      "percentage": 6.048387096774194
    },
    {
      "bin_label": "Bin 25",
      "bin_start": 122.71069065850548,
      "bin_end": 127.72965623878954,
      "count": 36,
      "percentage": 3.6290322580645165
    },
    {
      "bin_label": "Bin 26",
      "bin_start": 127.72965623878954,
      "bin_end": 132.9539015331792,
      "count": 24,
      "percentage": 2.4193548387096775
    },
    {
      "bin_label": "Bin 27",
      "bin_start": 132.9539015331792,
      "bin_end": 138.3918226464791,
      "count": 24,
      "percentage": 2.4193548387096775
    },
    {
      "bin_label": "Bin 28",
      "bin_start": 138.3918226464791,
      "bin_end": 144.05215909090865,
      "count": 14,
      "percentage": 1.411290322580645
    },
    {
      "bin_label": "Bin 29",
      "bin_start": 144.05215909090865,
      "bin_end": 149.9440078317401,
      "count": 12,
      "percentage": 1.2096774193548387
    }
  ],
  "summary_stats": {
    "total_count": 992,
    "min_value": 46.887618140501345,
    "max_value": 149.94400783174015,
    "mean": 99.2085771870391
  }
}`

export const geminiAnalysis = `{
  "graph_type": "histogram",
  "summary": {
    "title": "Price Distribution Histogram",
    "total_points_processed": 992,
    "min_value": 46.887618140501345,
    "max_value": 149.94400783174015,
    "mean": 99.2085771870391
  },
  "preprocessing_info": {
    "original_data_points": 1000,
    "outliers_removed": 8,
    "transformation_applied": "log"
  },
  "visualization_config": {
    "x_axis": {
      "label": "Price",
      "domain": [
        46.887618140501345,
        149.94400783174015
      ],
      "ticks": [
        46.887618140501345,
        58.338328106194545,
        69.78903807188775,
        81.23974803758094,
        92.69045800327414,
        104.14116796896735,
        115.59187793466054,
        127.04258790035375,
        138.49329786604693,
        149.94400783174015
      ]
    },
    "y_axis": {
      "label": "Frequency"
    }
  },
  "binned_data": [
    {
      "bin_label": "Bin 1",
      "range_start": 46.887618140501345,
      "range_end": 48.80535929512965,
      "count": 2
    },
    {
      "bin_label": "Bin 2",
      "range_start": 48.80535929512965,
      "range_end": 50.80153759973504,
      "count": 2
    },
    {
      "bin_label": "Bin 3",
      "range_start": 50.80153759973504,
      "range_end": 52.87936119660601,
      "count": 2
    },
    {
      "bin_label": "Bin 4",
      "range_start": 52.87936119660601,
      "range_end": 55.04216944362144,
      "count": 3
    },
    {
      "bin_label": "Bin 5",
      "range_start": 55.04216944362144,
      "range_end": 57.29343828107339,
      "count": 4
    },
    {
      "bin_label": "Bin 6",
      "range_start": 57.29343828107339,
      "range_end": 59.63678581799727,
      "count": 4
    },
    {
      "bin_label": "Bin 7",
      "range_start": 59.63678581799727,
      "range_end": 62.07597814698735,
      "count": 7
    },
    {
      "bin_label": "Bin 8",
      "range_start": 62.07597814698735,
      "range_end": 64.61493539684291,
      "count": 8
    },
    {
      "bin_label": "Bin 9",
      "range_start": 64.61493539684291,
      "range_end": 67.25773803277245,
      "count": 13
    },
    {
      "bin_label": "Bin 10",
      "range_start": 67.25773803277245,
      "range_end": 70.00863341428133,
      "count": 20
    },
    {
      "bin_label": "Bin 11",
      "range_start": 70.00863341428133,
      "range_end": 72.87204262128223,
      "count": 19
    },
    {
      "bin_label": "Bin 12",
      "range_start": 72.87204262128223,
      "range_end": 75.852567559399,
      "count": 27
    },
    {
      "bin_label": "Bin 13",
      "range_start": 75.852567559399,
      "range_end": 78.95499835588322,
      "count": 33
    },
    {
      "bin_label": "Bin 14",
      "range_start": 78.95499835588322,
      "range_end": 82.18432105802951,
      "count": 42
    },
    {
      "bin_label": "Bin 15",
      "range_start": 82.18432105802951,
      "range_end": 85.54572564646237,
      "count": 54
    },
    {
      "bin_label": "Bin 16",
      "range_start": 85.54572564646237,
      "range_end": 89.04461437617273,
      "count": 54
    },
    {
      "bin_label": "Bin 17",
      "range_start": 89.04461437617273,
      "range_end": 92.68661045870967,
      "count": 80
    },
    {
      "bin_label": "Bin 18",
      "range_start": 92.68661045870967,
      "range_end": 96.4775670994807,
      "count": 73
    },
    {
      "bin_label": "Bin 19",
      "range_start": 96.4775670994807,
      "range_end": 100.42357690468488,
      "count": 83
    },
    {
      "bin_label": "Bin 20",
      "range_start": 100.42357690468488,
      "range_end": 104.53098167299703,
      "count": 76
    },
    {
      "bin_label": "Bin 21",
      "range_start": 104.53098167299703,
      "range_end": 108.80638258773968,
      "count": 92
    },
    {
      "bin_label": "Bin 22",
      "range_start": 108.80638258773968,
      "range_end": 113.256650825923,
      "count": 60
    },
    {
      "bin_label": "Bin 23",
      "range_start": 113.256650825923,
      "range_end": 117.88893860120298,
      "count": 64
    },
    {
      "bin_label": "Bin 24",
      "range_start": 117.88893860120298,
      "range_end": 122.71069065850548,
      "count": 60
    },
    {
      "bin_label": "Bin 25",
      "range_start": 122.71069065850548,
      "range_end": 127.72965623878954,
      "count": 36
    },
    {
      "bin_label": "Bin 26",
      "range_start": 127.72965623878954,
      "range_end": 132.9539015331792,
      "count": 24
    },
    {
      "bin_label": "Bin 27",
      "range_start": 132.9539015331792,
      "range_end": 138.3918226464791,
      "count": 24
    },
    {
      "bin_label": "Bin 28",
      "range_start": 138.3918226464791,
      "range_end": 144.05215909090865,
      "count": 14
    },
    {
      "bin_label": "Bin 29",
      "range_start": 144.05215909090865,
      "range_end": 149.9440078317401,
      "count": 12
    }
  ]
}`

export const geminiAnalysisSummary = `{
  "data_requirements": {
    "source": "./data/prices.csv",
    "loading_method": "d3.csv()",
    "fields_to_use": [
      "price"
    ],
    "expected_record_count": "992"
  },
  "data_structures_provided_by_analysis": {
    "binned_data": {
      "type": "array of objects, representing pre-computed histogram bins",
      "exact_values": "Reference ANALYSIS.binned_data",
      "fields": [
        "bin_label",
        "range_start",
        "range_end",
        "count"
      ],
      "count": 29
    },
    "x_axis_domain": {
      "type": "array of two numbers for min/max",
      "exact_values": [
        46.887618140501345,
        149.94400783174015
      ],
      "fields": [],
      "count": 2
    },
    "x_axis_ticks": {
      "type": "array of numbers",
      "exact_values": [
        46.887618140501345,
        58.338328106194545,
        69.78903807188775,
        81.23974803758094,
        92.69045800327414,
        104.14116796896735,
        115.59187793466054,
        127.04258790035375,
        138.49329786604693,
        149.94400783174015
      ],
      "fields": [],
      "count": 10
    }
  },
  "implementation_gaps": [
    {
      "appraisal_failure": "Empty Histogram - No Bars Visible; all bars with height='0' or height='NaN'",
      "code_pattern_causing_failure": "The code uses d3.histogram() to dynamically calculate bins from the raw CSV data. It then sets the y-scale domain using d3.max(bins, d => d.length). This entire calculation process is failing, resulting in bins with a .length that produces a NaN or 0 height.",
      "analysis_provides_solution": "The ANALYSIS provides a complete, pre-calculated binned_data array. Each object in this array contains the exact bin boundaries (range_start, range_end) and the final count (count) for that bin.",
      "required_fix": "Do not use d3.histogram(). Instead, use the binned_data array provided in the ANALYSIS as the data source for the bars. The y-scale domain must be based on the maximum count value from this array. Bar height should be mapped from d.count, and x-position/width from d.range_start and d.range_end."
    },
    {
      "appraisal_failure": "Y-Axis Scale Issue; the y-axis has no tick marks or labels",
      "code_pattern_causing_failure": "The y-scale domain is set by d3.max(bins, d => d.length). Because the d3.histogram() calculation is failing, this returns an invalid value (likely 0 or undefined), which breaks the scale and prevents axis generation.",
      "analysis_provides_solution": "The binned_data array contains a count for each bin. The maximum of these counts (92) should be used to define the y-scale's domain.",
      "required_fix": "Calculate the maximum value from the count field across all objects in the binned_data array and use it to set the y-scale domain, e.g., y.domain([0, d3.max(analysisBinnedData, d => d.count)])."
    },
    {
      "appraisal_failure": "No visual representation of the 29 variable-width bins",
      "code_pattern_causing_failure": "The code attempts to generate its own bins using d3.histogram().thresholds(x.ticks(30)), which does not match the specific 29 bins provided by the analysis. This automatic generation is the root cause of all rendering failures.",
      "analysis_provides_solution": "The binned_data array explicitly defines all 29 bins, their start/end points, and their counts.",
      "required_fix": "Bind the binned_data array directly to the SVG rectangles. Use d.range_start for the 'x' attribute and d.range_end - d.range_start for the 'width' attribute."
    }
  ],
  "must_use_from_analysis": {
    "exact_arrays": [
      {
        "name": "pre_computed_bins",
        "values": "Reference ANALYSIS.binned_data",
        "purpose": "To serve as the direct data source for rendering histogram bars, eliminating the need for d3.histogram()."
      },
      {
        "name": "x_axis_domain",
        "values": [
          46.887618140501345,
          149.94400783174015
        ],
        "purpose": "To set the precise domain for the x-axis linear scale, instead of calculating it with d3.min and d3.max."
      },
      {
        "name": "x_axis_tick_values",
        "values": [
          46.887618140501345,
          58.338328106194545,
          69.78903807188775,
          81.23974803758094,
          92.69045800327414,
          104.14116796896735,
          115.59187793466054,
          127.04258790035375,
          138.49329786604693,
          149.94400783174015
        ],
        "purpose": "To provide the exact values for the x-axis ticks using axis.tickValues() instead of auto-generating them with axis.ticks()."
      }
    ],
    "exact_values": []
  },
  "must_not_do": [
    "Do not use d3.histogram() to calculate bins. Use the provided binned_data array.",
    "Do not calculate the x-axis domain from the raw data using d3.min() or d3.max(). Use the provided x_axis.domain values.",
    "Do not derive bar height from bin.length. Use the count property from the objects within the binned_data array.",
    "Do not automatically generate axis ticks with .ticks(n). Use .tickValues() with the provided x_axis.ticks array."
  ],
  "success_criteria": [
    "The chart must render exactly 29 bars.",
    "The bar heights must correspond to the count values in the binned_data array, with the tallest bar having a count of 92.",
    "The x-position and width of each bar must correspond to its range_start and range_end values.",
    "The y-axis must be visible with ticks and labels, scaled to a domain that includes the maximum count of 92.",
    "The x-axis domain must be exactly [46.887618140501345, 149.94400783174015].",
    "The sum of all bar counts must equal 992."
  ]
}`