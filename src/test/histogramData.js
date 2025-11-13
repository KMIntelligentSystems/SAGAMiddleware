export const histoRequirementsResultJSON = `{"CSV_FILE_PATH": "C:/repos/SAGAMiddleware/data/prices.csv"}
{"REQUIREMENTS": ["Data profiling.", "Excel export, UTF-8 BOM, 2 header rows, 5-min intervals", "The task is to provide a histogram based on the distribution of the prices in the CSV file.", "Examine the data to provide an optional approach to the bin sizes.", "Provide a detailed analysis for a coding agent."]}`;

export const histoFlowDefineingAgentResult = `{
  agentName: 'FlowDefiningAgent',
  result: '<!DOCTYPE html>\n' +
    '<html>\n' +
    '  <body>\n' +
    '    <flow>data-profiler -> bin-optimizer -> histogram-generator -> excel-exporter -> report-generator</flow>\n' +
    '    {"toolUsers": ["DataProfilingAgent", "HistogramGenerationAgent", "ExcelExportAgent", "ReportGenerationAgent"]}\n' +
    '  </body>\n' +
    '</html>',
  success: true,
  timestamp: 2025-11-11T19:43:59.330Z
}
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
