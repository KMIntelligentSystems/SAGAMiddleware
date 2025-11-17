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