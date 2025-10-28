

const agentData = ` {
  agentName: 'TransactionGroupingAgent',
  result: '[AGENT: StructuredQueryPaginationAgent, 1]\n' +
    'Task: Iteratively call the structured query tool, one page at a time, and emit the returned data array for downstream processing until no more results are av
ailable.\n' +
    '\n' +
    'Tool to use: structured_query\n' +
    '\n' +
    'Exact structured query JSON to call each time (keep exactly as-is; substitute {page} with the current page number starting at 1 and increment by 1):\n' +    
    '{ "collection": "supply_analysis", "metadata_filters": { "category_type": ["coal","solar","wind"] }, "date_filters": { "field": "datetime", "start_date": "20
23-11-02T04:00:00.000Z", "end_date": "2023-11-05T23:55:00.000Z" }, "limit": 10, "page": {page}, "order_by: "asc", "include_distances": false }\n' +
    '\n' +
    'Pagination rules:\n' +
    '- Start with page = 1.\n' +
    '- Call the tool with the exact JSON above for each page.\n' +
    '- If the returned data array length is 0 or less than limit (10), stop pagination. Otherwise, increment page and continue.\n' +
    '\n' +
    'Expected sample shape of returned items (forward exactly to the next agent):\n' +
    '{"energy_generation":{"datetime":"2023-11-02T04:20:00.000Z","category_type":"Coal","installation":"ERGTO1","value":0,"unit":"MW"}},{"energy_generation":{"dat
etime":"2023-11-02T04:20:00.000Z","category_type":"Coal","installation":"RPCG","value":15.2,"unit":"MW"}}]\n' +
    '\n' +
    'Output to next agent (per page):\n' +
    '- The raw array of items exactly as returned by the tool.\n' +
    '\n' +
    '[/AGENT]\n' +
    '\n' +
    '[AGENT: PageProcessingAndAggregationAgent, 2]\n' +
    'Task: For each page of results, process each energy_generation element and aggregate values by the unique (date, installation, category_type) triple into arr
ays. Maintain an accumulator across pages until pagination completes, then emit the final aggregated structure.\n' +
    '\n' +
    'Per-item processing rules:\n' +
    '1) Convert energy_generation.datetime to date in YYYY-MM-DD format.\n' +
    '2) Normalize category_type to match the filter terms used:\n' +
    '   - Lowercase category_type (e.g., "Coal" -> "coal", "Solar" -> "solar", "Wind" -> "wind").\n' +
    '3) Extract installation as-is.\n' +
    '4) Extract value as numeric.\n' +
    '5) Append the value to the accumulator keyed by (date, installation, category_type).\n' +
    '\n' +
    'Accumulator shape:\n' +
    '- Key: tuple (date, installation, category_type)\n' +
    '- Value: { "date": <YYYY-MM-DD>, "category_type": <lowercase>, "installation": <string>, "values": [<numbers in arrival order>] }\n' +
    '\n' +
    'Final aggregated structure (after all pages processed):\n' +
    '- An array of aggregated objects in any stable order:\n' +
    '  [ { "date": "...", "category_type": "...", "installation": "...", "values": [ ... ] }, ... ]\n' +
    '\n' +
    'Data Operations for each page returned (apply exactly as specified):\n' +
    '1) Process each "energy_generation" element in the data array returned by the structured query.\n' +
    '   1.1) Convert date to YYYY-MM-DD format.\n' +
    '   1.2) For each date/installation/category_type triple, accumulate their respective values into an array.\n' +
    '      Example aggregation concept: { "date": "2023-11-04", "installation": "RPCG", "values": [15.2, 14.6, 14.6, 14.6] }\n' +
    '2) Final aggregated structure example (shape to match):\n' +
    '[ { "date": "2023-11-04","category_type: "coal", "installation": "ERGTO1", "values": [0, 0, 0 }, { "date": "2023-11-04", "installation": "RPCG", "values": [1
5.2, 14.6, 14.6, 14.6] }\n' +
    '\n' +
    'Input example (from the query) you will receive:\n' +
    '{"energy_generation":{"datetime":"2023-11-02T04:20:00.000Z","category_type":"Coal","installation":"ERGTO1","value":0,"unit":"MW"}},{"energy_generation":{"dat
etime":"2023-11-02T04:20:00.000Z","category_type":"Coal","installation":"RPCG","value":15.2,"unit":"MW"}}]\n' +
    '\n' +
    'Output to next agent (after final page is processed):\n' +
    '- The final aggregated array: [ { "date": "...", "category_type": "...", "installation": "...", "values": [ ... ] }, ... ]\n' +
    '\n' +
    '[/AGENT]\n' +
    '\n' +
    '[AGENT: DataSavingAgent, 3]\n' +
    'Task: Save the aggregated results using the provided tool and parameters. Use the aggregated array produced by PageProcessingAndAggregationAgent as the recor
ds input.\n' +
    '\n' +
    'Tool name: calculate_energy_totals\n' +
    'Example record to save (format reference):\n' +
    '[{"date":"2023-11-02","category_type: "coal", "installation":"RPCG","values":[16.3,14.8, 14.6, 14.6, 14.6]}]\n' +
    'File path: "c:/repos/sagaWorkflow/data/calcualtedResults"\n' +
    'Operation: avg\n' +
    '\n' +
    'Instructions:\n' +
    '- Prepare the records from the aggregated array in the same structural pattern as the example (date, category_type, installation, values).\n' +
    '- Call calculate_energy_totals with:\n' +
    '  - records: the aggregated array\n' +
    '  - file path: "c:/repos/sagaWorkflow/data/calcualtedResults"\n' +
    '  - operation: avg\n' +
    '- Confirm successful save or surface any errors.\n' +
    '\n' +
    '[/AGENT]\n' +
    '\n' +
    'SEQUENCE:\n' +
    '  {1 -> 2 -> 1 -> 3}'
    `;

const csvContent = `
    '{\n' +
    '  "results": [\n' +
    '    {\n' +
    '      "id": "test1.csv-chunk-31-828-6f5850c6-a989-4210-8c2c-7ad2e8fc3323",\n' +
    '      "content": "[{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T00:25:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"ERGTO1\\",\\"value\\":0,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T00:25:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"RPCG\\",\\"value\\":14.6,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T00:30:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"ERGTO1\\",\\"value\\":0,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T00:30:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"RPCG\\",\\"value\\":14.6,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T00:35:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"ERGTO1\\",\\"value\\":0,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T00:35:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"RPCG\\",\\"value\\":14.6,\\"unit\\":\\"value\\"}}]",\n' +
    '      "metadata": {\n' +
    '        "chunkIndex": 1,\n' +
    '        "chunkSize": 12538,\n' +
    '        "csvHeaderRows": 2,\n' +
    '        "endRow": 36,\n' +
    '        "fileExtension": ".csv",\n' +
    '        "fileName": "test1.csv",\n' +
    '        "filePath": "c:/repos/SAGAMiddleware/data/test1.csv",\n' +
    '        "indexedAt": "2025-07-16T04:01:17.231Z",\n' +
    '        "rowsInChunk": 4,\n' +
    '        "startRow": 31,\n' +
    '        "subChunkIndex": 1\n' +
    '      }\n' +
    '    },\n' +
    '    {\n' +
    '      "id": "test1.csv-chunk-37-828-97bfc9d6-23df-4aac-ae4d-cf4e15caf6b5",\n' +
    '      "content": "[{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T00:55:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"ERGTO1\\",\\"value\\":0,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T00:55:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"RPCG\\",\\"value\\":13.3,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T01:00:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"ERGTO1\\",\\"value\\":0,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T01:00:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"RPCG\\",\\"value\\":13.3,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T01:05:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"ERGTO1\\",\\"value\\":0,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T01:05:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"RPCG\\",\\"value\\":13.3,\\"unit\\":\\"value\\"}}]",\n' +
    '      "metadata": {\n' +
    '        "chunkIndex": 1,\n' +
    '        "chunkSize": 12521,\n' +
    '        "csvHeaderRows": 2,\n' +
    '        "endRow": 42,\n' +
    '        "fileExtension": ".csv",\n' +
    '        "fileName": "test1.csv",\n' +
    '        "filePath": "c:/repos/SAGAMiddleware/data/test1.csv",\n' +
    '        "indexedAt": "2025-07-16T04:01:17.231Z",\n' +
    '        "rowsInChunk": 4,\n' +
    '        "startRow": 37,\n' +
    '        "subChunkIndex": 1\n' +
    '      }\n' +
    '    },\n' +
    '    {\n' +
    '      "id": "test1.csv-chunk-25-828-81c64c02-f780-4b6f-9f13-d52c425bcaf9",\n' +
    '      "content": "[{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-03T23:55:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"ERGTO1\\",\\"value\\":0,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-03T23:55:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"RPCG\\",\\"value\\":13.5,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T00:00:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"ERGTO1\\",\\"value\\":0,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T00:00:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"RPCG\\",\\"value\\":13.5,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T00:05:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"ERGTO1\\",\\"value\\":0,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T00:05:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"RPCG\\",\\"value\\":12,\\"unit\\":\\"value\\"}}]",\n' +
    '      "metadata": {\n' +
    '        "chunkIndex": 1,\n' +
    '        "chunkSize": 12533,\n' +
    '        "csvHeaderRows": 2,\n' +
    '        "endRow": 30,\n' +
    '        "fileExtension": ".csv",\n' +
    '        "fileName": "test1.csv",\n' +
    '        "filePath": "c:/repos/SAGAMiddleware/data/test1.csv",\n' +
    '        "indexedAt": "2025-07-16T04:01:17.231Z",\n' +
    '        "rowsInChunk": 4,\n' +
    '        "startRow": 25,\n' +
    '        "subChunkIndex": 1\n' +
    '      }\n' +
    '    },\n' +
    '    {\n' +
    '      "id": "test1.csv-chunk-43-828-f6775abe-66cf-489a-9464-767646d89173",\n' +
    '      "content": "[{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T22:55:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"ERGTO1\\",\\"value\\":0,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T22:55:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"RPCG\\",\\"value\\":-2.2,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T23:00:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"ERGTO1\\",\\"value\\":0,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T23:00:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"RPCG\\",\\"value\\":-2.2,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T23:05:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"ERGTO1\\",\\"value\\":0,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T23:05:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"RPCG\\",\\"value\\":-2.2,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T23:10:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"ERGTO1\\",\\"value\\":0,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T23:10:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"RPCG\\",\\"value\\":-2.2,\\"unit\\":\\"value\\"}}]",\n' +
    '      "metadata": {\n' +
    '        "chunkIndex": 1,\n' +
    '        "chunkSize": 17622,\n' +
    '        "csvHeaderRows": 2,\n' +
    '        "endRow": 49,\n' +
    '        "fileExtension": ".csv",\n' +
    '        "fileName": "test1.csv",\n' +
    '        "filePath": "c:/repos/SAGAMiddleware/data/test1.csv",\n' +
    '        "indexedAt": "2025-07-16T04:01:17.231Z",\n' +
    '        "rowsInChunk": 4,\n' +
    '        "startRow": 43,\n' +
    '        "subChunkIndex": 1\n' +
    '      }\n' +
    '    },\n' +
    '    {\n' +
    '      "id": "test1.csv-chunk-18-828-b7abcb88-6bae-4cae-a5c4-14f71f7629cb",\n' +
    '      "content": "[{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-03T23:20:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"ERGTO1\\",\\"value\\":0,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-03T23:20:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"RPCG\\",\\"value\\":13.3,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-03T23:25:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"ERGTO1\\",\\"',
  success: true,
  timestamp: 2025-07-17T21:46:58.546Z
}
RRESULT  {
  agentName: 'DataFilteringAgent',
  +
    '{\n' +
    '  "results": [\n' +
    '    {\n' +
    '      "id": "test1.csv-chunk-31-828-6f5850c6-a989-4210-8c2c-7ad2e8fc3323",\n' +
    '      "content": "[{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T00:25:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"ERGTO1\\",\\"value\\":0,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T00:25:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"RPCG\\",\\"value\\":14.6,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T00:30:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"ERGTO1\\",\\"value\\":0,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T00:30:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"RPCG\\",\\"value\\":14.6,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T00:35:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"ERGTO1\\",\\"value\\":0,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T00:35:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"RPCG\\",\\"value\\":14.6,\\"unit\\":\\"value\\"}}]",\n' +
    '      "metadata": {\n' +
    '        "chunkIndex": 1,\n' +
    '        "chunkSize": 12538,\n' +
    '        "csvHeaderRows": 2,\n' +
    '        "endRow": 36,\n' +
    '        "fileExtension": ".csv",\n' +
    '        "fileName": "test1.csv",\n' +
    '        "filePath": "c:/repos/SAGAMiddleware/data/test1.csv",\n' +
    '        "indexedAt": "2025-07-16T04:01:17.231Z",\n' +
    '        "rowsInChunk": 4,\n' +
    '        "startRow": 31,\n' +
    '        "subChunkIndex": 1\n' +
    '      }\n' +
    '    },\n' +
    '    {\n' +
    '      "id": "test1.csv-chunk-37-828-97bfc9d6-23df-4aac-ae4d-cf4e15caf6b5",\n' +
    '      "content": "[{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T00:55:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"ERGTO1\\",\\"value\\":0,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T00:55:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"RPCG\\",\\"value\\":13.3,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T01:00:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"ERGTO1\\",\\"value\\":0,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T01:00:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"RPCG\\",\\"value\\":13.3,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T01:05:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"ERGTO1\\",\\"value\\":0,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T01:05:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"RPCG\\",\\"value\\":13.3,\\"unit\\":\\"value\\"}}]",\n' +
    '      "metadata": {\n' +
    '        "chunkIndex": 1,\n' +
    '        "chunkSize": 12521,\n' +
    '        "csvHeaderRows": 2,\n' +
    '        "endRow": 42,\n' +
    '        "fileExtension": ".csv",\n' +
    '        "fileName": "test1.csv",\n' +
    '        "filePath": "c:/repos/SAGAMiddleware/data/test1.csv",\n' +
    '        "indexedAt": "2025-07-16T04:01:17.231Z",\n' +
    '        "rowsInChunk": 4,\n' +
    '        "startRow": 37,\n' +
    '        "subChunkIndex": 1\n' +
    '      }\n' +
    '    },\n' +
    '    {\n' +
    '      "id": "test1.csv-chunk-25-828-81c64c02-f780-4b6f-9f13-d52c425bcaf9",\n' +
    '      "content": "[{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-03T23:55:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"ERGTO1\\",\\"value\\":0,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-03T23:55:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"RPCG\\",\\"value\\":13.5,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T00:00:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"ERGTO1\\",\\"value\\":0,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T00:00:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"RPCG\\",\\"value\\":13.5,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T00:05:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"ERGTO1\\",\\"value\\":0,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T00:05:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"RPCG\\",\\"value\\":12,\\"unit\\":\\"value\\"}}]",\n' +
    '      "metadata": {\n' +
    '        "chunkIndex": 1,\n' +
    '        "chunkSize": 12533,\n' +
    '        "csvHeaderRows": 2,\n' +
    '        "endRow": 30,\n' +
    '        "fileExtension": ".csv",\n' +
    '        "fileName": "test1.csv",\n' +
    '        "filePath": "c:/repos/SAGAMiddleware/data/test1.csv",\n' +
    '        "indexedAt": "2025-07-16T04:01:17.231Z",\n' +
    '        "rowsInChunk": 4,\n' +
    '        "startRow": 25,\n' +
    '        "subChunkIndex": 1\n' +
    '      }\n' +
    '    },\n' +
    '    {\n' +
    '      "id": "test1.csv-chunk-43-828-f6775abe-66cf-489a-9464-767646d89173",\n' +
    '      "content": "[{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T22:55:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"ERGTO1\\",\\"value\\":0,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T22:55:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"RPCG\\",\\"value\\":-2.2,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T23:00:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"ERGTO1\\",\\"value\\":0,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T23:00:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"RPCG\\",\\"value\\":-2.2,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T23:05:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"ERGTO1\\",\\"value\\":0,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T23:05:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"RPCG\\",\\"value\\":-2.2,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T23:10:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"ERGTO1\\",\\"value\\":0,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-04T23:10:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"RPCG\\",\\"value\\":-2.2,\\"unit\\":\\"value\\"}}]",\n' +
    '      "metadata": {\n' +
    '        "chunkIndex": 1,\n' +
    '        "chunkSize": 17622,\n' +
    '        "csvHeaderRows": 2,\n' +
    '        "endRow": 49,\n' +
    '        "fileExtension": ".csv",\n' +
    '        "fileName": "test1.csv",\n' +
    '        "filePath": "c:/repos/SAGAMiddleware/data/test1.csv",\n' +
    '        "indexedAt": "2025-07-16T04:01:17.231Z",\n' +
    '        "rowsInChunk": 4,\n' +
    '        "startRow": 43,\n' +
    '        "subChunkIndex": 1\n' +
    '      }\n' +
    '    },\n' +
    '    {\n' +
    '      "id": "test1.csv-chunk-18-828-b7abcb88-6bae-4cae-a5c4-14f71f7629cb",\n' +
    '      "content": "[{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-03T23:20:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"ERGTO1\\",\\"value\\":0,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-03T23:20:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"RPCG\\",\\"value\\":13.3,\\"unit\\":\\"value\\"}},{\\"energy_generation\\":{\\"datetime\\":\\"2023-11-03T23:25:00.000Z\\",\\"category_type\\":\\"Coal\\",\\"installation\\":\\"ERGTO1\\",\\"',

`;

const generatorPrompt = `[AGENT: DataStructuringAgent]. Task description: Sum energy generation values by day from the provided records.
Instructions:
Parse the datetime field in each record to extract the date (ignore time components)

{
Place each record of this form:
  "energy_generation": {
    "datetime": YYYY-MM-DDTHH:MM:SS,
    "category_type": [category_type],
    "installation": [installation],
    "value": [unit],
    "unit": "value"
  }
}

Order the records in CSV format with columns: Date, Category type, installation, amount:

[/AGENT]

`;

export const groupingAgentResult = `{
  agentName: TransactionGroupingAgent,
  result: [AGENT: EnergyCSVNormalizer, EDN-01]
    Your task: Write a complete Python script that reads a CSV exported from Excel, normalizes the data into long format, and outputs:
    - A single combined CSV with columns: date/time, installation, energy_source, MW
    - Individual CSVs per installation (one file per installation)
   
    Input details:
    - CSV file path: C:/repos/SAGAMiddleware/data/Output_one_hour.csv
    - Header structure: The first row contains merged category labels (e.g., Solar, Wind, etc.) with many commas; the second row contains the actual column headers (e.g
., date/time, BARCSF1, GRIFSF1, ...). Use the second row as headers when reading the CSV.
    - Mapping between energy sources and installation column names:
      categoryMapping = {
    "    Solar: [BARCSF1, GRIFSF1, HUGSF1, LRSF1, MLSP1, ROTALLA1],\n"
    "    Wind: [CAPTL_WF, CHALLHWF, CULLRGWF, DIAPURWF1, MLWF1, WAUBRAWF, WOOLNTH1, YAMBUKWF, YSWF1],\n"
    "    Natural Gas: [SHOAL1],\n"
    "    Hydro: [BUTLERSG, CLOVER, CLUNY, PALOONA, REPULSE],\n"
    "    Diesel: [ERGT01, GBO1],\n"
    "    Battery: [KEPBG1],\n"
    "    Coal: [ERGTO1, RPCG]\n"
      }
   
    Requirements for the script behavior:
    "- Read the CSV using the second row as the header (pandas read_csv with header=1). Strip whitespace from column names to ensure date/time is matched correctly.\n"

    - Use the categoryMapping to determine which columns correspond to each energy source.
    - Reshape the data to a long format with columns: date/time, installation, energy_source, MW
      - date/time should retain the original string format from the CSV (do not reformat dates).
      - Convert MW to numeric (coerce errors to NaN) and keep rows even if MW is NaN (optional to drop NaN rows if that’s preferable).
    - Output files:
      - Combined file: C:/repos/SAGAMiddleware/data/Output_one_hour_normalized.csv
      - Per-installation files under: C:/repos/SAGAMiddleware/data/installations/{INSTALLATION}.csv
        - Create the directory if it does not exist.
    - Be robust to missing columns: if a mapped installation is not present in the CSV, skip it gracefully.
    - Sort the combined result by date/time and installation.
    "- Include necessary imports and ensure the script can be executed directly (if __name__ == __main__).\n"
   
    ABSOLUTE REQUIREMENTS:
    - Output ONLY Python code
    - First character must be Python code (import, def, or variable)
    - Last character must be Python code
    - Zero explanatory text
    - Zero markdown
    [/AGENT]
   
    [AGENT: PythonToolInvoker, PTI-01]
    You are a tool-calling agent. Your task is to call the MCP server to execute Python code produced by the coding agent.
   
    Perform exactly this JSON-RPC 2.0 request to the MCP server, calling the execute_python tool:
    {
      "jsonrpc": "2.0",
      "id": 3,
      "method": "tools/call",
      "params": {
        "name": "execute_python",
        "arguments": {
          "code": {code}
        }
      }
    }
   
    Instructions:
    - Replace {code} with the exact Python code generated by the coding agent.
    - Ensure the code is passed as the value of the "code" field.
    - Do not modify "jsonrpc", "id", "method", or "name".
    - Do not add any extra commentary or fields to the request.
    [/AGENT]
}`;

export const groupingAgentFailedResult = `{
  agentName: TransactionGroupingAgent,
  result: Agent 1: (EnergyCSVNormalizer, EDN-01)
    Your task: Write a complete Python script that reads a CSV exported from Excel, normalizes the data into long format, and outputs:
    - A single combined CSV with columns: date/time, installation, energy_source, MW
    - Individual CSVs per installation (one file per installation)
   
    Input details:
    - CSV file path: C:/repos/SAGAMiddleware/data/Output_one_hour.csv
    - Header structure: The first row contains merged category labels (e.g., Solar, Wind, etc.) with many commas; the second row contains the actual column headers (e.g
., date/time, BARCSF1, GRIFSF1, ...). Use the second row as headers when reading the CSV.
    - Mapping between energy sources and installation column names:
      categoryMapping = {
    "    Solar: [BARCSF1, GRIFSF1, HUGSF1, LRSF1, MLSP1, ROTALLA1],\n"
    "    Wind: [CAPTL_WF, CHALLHWF, CULLRGWF, DIAPURWF1, MLWF1, WAUBRAWF, WOOLNTH1, YAMBUKWF, YSWF1],\n"
    "    Natural Gas: [SHOAL1],\n"
    "    Hydro: [BUTLERSG, CLOVER, CLUNY, PALOONA, REPULSE],\n"
    "    Diesel: [ERGT01, GBO1],\n"
    "    Battery: [KEPBG1],\n"
    "    Coal: [ERGTO1, RPCG]\n"
      }
   
    Requirements for the script behavior:
    "- Read the CSV using the second row as the header (pandas read_csv with header=1). Strip whitespace from column names to ensure date/time is matched correctly.\n"

    - Use the categoryMapping to determine which columns correspond to each energy source.
    - Reshape the data to a long format with columns: date/time, installation, energy_source, MW
      - date/time should retain the original string format from the CSV (do not reformat dates).
      - Convert MW to numeric (coerce errors to NaN) and keep rows even if MW is NaN (optional to drop NaN rows if that’s preferable).
    - Output files:
      - Combined file: C:/repos/SAGAMiddleware/data/Output_one_hour_normalized.csv
      - Per-installation files under: C:/repos/SAGAMiddleware/data/installations/{INSTALLATION}.csv
        - Create the directory if it does not exist.
    - Be robust to missing columns: if a mapped installation is not present in the CSV, skip it gracefully.
    - Sort the combined result by date/time and installation.
    "- Include necessary imports and ensure the script can be executed directly (if __name__ == __main__).\n"
   
    ABSOLUTE REQUIREMENTS:
    - Output ONLY Python code
    - First character must be Python code (import, def, or variable)
    - Last character must be Python code
    - Zero explanatory text
    - Zero markdown
    
   
    Agent 2:  (PythonToolInvoker, PTI-01)
    You are a tool-calling agent. Your task is to call the MCP server to execute Python code produced by the coding agent.
   
    Perform exactly this JSON-RPC 2.0 request to the MCP server, calling the execute_python tool:
    {
      "jsonrpc": "2.0",
      "id": 3,
      "method": "tools/call",
      "params": {
        "name": "execute_python",
        "arguments": {
          "code": {code}
        }
      }
    }
   
    Instructions:
    - Replace {code} with the exact Python code generated by the coding agent.
    - Ensure the code is passed as the value of the "code" field.
    - Do not modify "jsonrpc", "id", "method", or "name".
    - Do not add any extra commentary or fields to the request.
}`

export const visualizationGroupingAgentsResult = ` {
  agentName: 'VisualizationCoordinatingAgent',
  result: '[AGENT: PandasDailyAveragingCoder, CODE-DAILY-AVG-01]\n' +
    'Your task: Write complete, runnable Python code that:\n' +
    '- Reads the input CSV at C:/repos/SAGAMiddleware/data/Output_one_hour_normalized.csv\n' +
    '- Computes daily average MW per installation per energy_source for the 4 days from 11/02/2023 to 11/05/2023, using only the 4:00–4:55 time window at 5-minute interv
als\n' +
    '- Writes a CSV with columns in this exact order and naming: date/time,installation,MW,energy_source\n' +
    '  - date/time should be the date only (e.g., 11/02/2023)\n' +
    '  - MW should be the average MW for that installation and energy_source on that date (include negative values if present)\n' +
    '- Saves the output to: C:/repos/SAGAMiddleware/data/Output_one_hour_daily_avg.csv\n' +
    '\n' +
    'Data details and constraints:\n' +
    '- Input CSV columns: date/time,installation,MW,energy_source\n' +
    '  - date/time format like: 11/02/2023 4:00\n' +
    '  - One-hour window per day: 4:00 through 4:55 inclusive, at 5-minute intervals\n' +
    '  - Data spans four dates: 11/02/2023, 11/03/2023, 11/04/2023, 11/05/2023\n' +
    '- Compute averages per (date, installation, energy_source)\n' +
    '- Keep MW as numeric; coerce non-numeric to NaN and drop those rows from averaging\n' +
    '- Preserve negative MW readings in averaging (do not clip)\n' +
    '- Grouping must include energy_source to avoid mixing categories\n' +
    '- Output CSV must have only the aggregated rows with the exact header and column order: date/time,installation,MW,energy_source\n' +
    '\n' +
    'Implementation guidance:\n' +
    '- Use pandas\n' +
    '- Steps:\n' +
    '  1) Read CSV; parse date/time to datetime\n' +
    '  2) Ensure MW is numeric (coerce errors), drop rows where MW is NaN\n' +
    '  3) Filter rows to dates 11/02/2023–11/05/2023 and time-of-day between 4:00 and 4:55 inclusive at 5-minute intervals\n' +
    '  4) Create a date-only string column for output formatting (MM/DD/YYYY), named date/time\n' +
    '  5) Group by date/time, installation, energy_source; average MW\n' +
    '  6) Reorder columns exactly and write to C:/repos/SAGAMiddleware/data/Output_one_hour_daily_avg.csv with index=False\n' +
    '\n' +
    'Absolute requirements:\n' +
    '- Output ONLY Python code\n' +
    '- The very first character of your reply must be Python code (import, def, or variable)\n' +
    '- The very last character of your reply must be Python code\n' +
    '- No explanatory text\n' +
    '- No markdown\n' +
    '- No comments\n' +
    '- No surrounding quotes or code fences\n' +
    '[/AGENT]\n' +
    '\n' +
    '[AGENT: MCPExecutePythonCaller, TOOL-CALL-EXEC-01]\n' +
    'You are a tool calling agent. Take the Python code produced by the coding agent and execute it by making a single JSON-RPC request to the MCP server to call the exe
cute_python tool.\n' +
    '\n' +
    'Instructions:\n' +
    '- Replace {code} below with the exact Python code produced by the coding agent (no modifications, no added wrappers)\n' +
    '- Ensure proper JSON string encoding so that the entire code is passed under the "code" field (preserve newlines)\n' +
    '- Output only the JSON-RPC request object with no extra text or formatting\n' +
    '\n' +
    'Tool call to send:\n' +
    '{\n' +
    '  "jsonrpc": "2.0",\n' +
    '  "id": 3,\n' +
    '  "method": "tools/call",\n' +
    '  "params": {\n' +
    '    "name": "execute_python",\n' +
    '    "arguments": {\n' +
    '      "code": {code}\n' +
    '    }\n' +
    '  }\n' +
    '}\n' +
    '[/AGENT]',
  success: true,
  timestamp: 2025-09-03T21:12:00.968Z
}
`;
export const flowData = `'<flow>CODE-DAILY-AVG-01 -> TOOL-CALL-EXEC-01</flow>\n' +
    '{"toolUsers": ["MCPExecutePythonCaller"]}'`;

export const d3jsFlowData = `{
  agentName: 'FlowDefiningAgent',
  result: '<!doctype html>\n' +
    '<html>\n' +
    '  <head>\n' +
    '    <meta charset="utf-8">\n' +
    '    <title>Agent Flow</title>\n' +
    '  </head>\n' +
    '  <body>\n' +
    '    <flow>DA-001</flow>\n' +
    '    {"toolUsers": []}\n' +
    '  </body>\n' +
    '</html>',
  success: true,
  timestamp: 2025-10-04T06:47:01.676Z
}`
export const codeWriterTaskDescription = `            Your task: Write a complete Python script that reads a CSV exported from Excel, normalizes the data into long format, and outputs:
    - A single combined CSV with columns: date/time, installation, energy_source, MW
    - Individual CSVs per installation (one file per installation)

    Input details:
    - CSV file path: C:/repos/SAGAMiddleware/data/Output_one_hour.csv
    - Header structure: The first row contains merged category labels (e.g., Solar, Wind, etc.) with many commas; the second row contains the actual column headers (e.g
., date/time, BARCSF1, GRIFSF1, ...). Use the second row as headers when reading the CSV.
    - Mapping between energy sources and installation column names:
      categoryMapping = {
    "    Solar: [BARCSF1, GRIFSF1, HUGSF1, LRSF1, MLSP1, ROTALLA1],
"
    "    Wind: [CAPTL_WF, CHALLHWF, CULLRGWF, DIAPURWF1, MLWF1, WAUBRAWF, WOOLNTH1, YAMBUKWF, YSWF1],
"
    "    Natural Gas: [SHOAL1],
"
    "    Hydro: [BUTLERSG, CLOVER, CLUNY, PALOONA, REPULSE],
"
    "    Diesel: [ERGT01, GBO1],
"
    "    Battery: [KEPBG1],
"
    "    Coal: [ERGTO1, RPCG]
"
      }

    Requirements for the script behavior:
    "- Read the CSV using the second row as the header (pandas read_csv with header=1). Strip whitespace from column names to ensure date/time is matched correctly.
"

    - Use the categoryMapping to determine which columns correspond to each energy source.
    - Reshape the data to a long format with columns: date/time, installation, energy_source, MW
      - date/time should retain the original string format from the CSV (do not reformat dates).
      - Convert MW to numeric (coerce errors to NaN) and keep rows even if MW is NaN (optional to drop NaN rows if that’s preferable).
    - Output files:
      - Combined file: C:/repos/SAGAMiddleware/data/Output_one_hour_normalized.csv
      - Per-installation files under: C:/repos/SAGAMiddleware/data/installations/{INSTALLATION}.csv
        - Create the directory if it does not exist.
    - Be robust to missing columns: if a mapped installation is not present in the CSV, skip it gracefully.
    - Sort the combined result by date/time and installation.
    "- Include necessary imports and ensure the script can be executed directly (if __name__ == __main__).
"

    ABSOLUTE REQUIREMENTS:
    - Output ONLY Python code
    - First character must be Python code (import, def, or variable)
    - Last character must be Python code
    - Zero explanatory text
    - Zero markdown`;

export const visCodeWriterTaskDescription = ` 'You are the coding task agent. Your job is to produce a single, self-contained Python script that reads the specified CSV, computes daily average MW values, and wri
tes the results back to a CSV.\n' +
    '\n' +
    'Goal:\n' +
    '- Read input CSV from: C:/repos/SAGAMiddleware/data/Output_one_hour_normalized.csv\n' +
    '- Columns present: date/time, installation, MW, energy_source\n' +
    '- Compute, for each calendar day present in the file (the data spans 11/02/2023 through 11/05/2023), the average MW per installation per energy_source across the ti
me slices for that day.\n' +
    '- Output a CSV with columns exactly in this order and with these names:\n' +
    '  - date/time\n' +
    '  - installation\n' +
    '  - MW\n' +
    '  - energy_source\n' +
    '- The date/time column in the output should be the day only (e.g., 11/02/2023), formatted as mm/dd/YYYY.\n' +
    '- Write the output file to: C:/repos/SAGAMiddleware/data/Output_one_hour_normalized_daily_avg.csv\n' +
    '\n' +
    'Implementation guidance:\n' +
    '- Use pandas for data handling.\n' +
    '- Parse the input column date/time into a datetime; extract the date as mm/dd/YYYY strings for grouping/output.\n' +
    '- Ensure MW is numeric; coerce non-numeric values to NaN and exclude them from the average automatically via pandas mean.\n' +
    '- Group by: day (derived from date/time), installation, energy_source; compute the mean of MW.\n' +
    '- Rename the derived day back to date/time for the output, and order columns exactly as required.\n' +
    '- Sort by date/time, installation, energy_source for readability.\n' +
    '- Save CSV with index=False.\n' +
    '\n' +
    'Constraints:\n' +
    '- No assumptions about fixed counts of intervals; simply average whatever rows exist for that day.\n' +
    '- Do not hardcode specific installation names; handle all present in the CSV.\n' +
    '- Avoid printing or extra output; just perform the computation and write the file.\n' +
    '\n' +
    'ABSOLUTE REQUIREMENTS:\n' +
    '- Output ONLY Python code\n' +
    '- First character must be Python code (import, def, or variable)\n' +
    '- Last character must be Python code\n' +
    '- Zero explanatory text\n' +
    '- Zero markdown\n' +
`;

export const codeExecutorTaskDescription = `  You are a tool-calling agent. Your task is to call the MCP server to execute Python code produced by the coding agent.

    Perform exactly this JSON-RPC 2.0 request to the MCP server, calling the execute_python tool:
    {
      "jsonrpc": "2.0",
      "id": 3,
      "method": "tools/call",
      "params": {
        "name": "execute_python",
        "arguments": {
          "code": {code}
        }
      }
    }

    Instructions:
    - Replace {code} with the exact Python code generated by the coding agent.
    - Ensure the code is passed as the value of the "code" field.
    - Do not modify "jsonrpc", "id", "method", or "name".
    - Do not add any extra commentary or fields to the request.
`;

export const visCodeExecutorTaskDescription = ` 'You are the tool calling agent. Your sole task is to take the exact Python code produced by the coding agent and invoke the MCP server tool execute_python with a va
lid JSON-RPC 2.0 request.\n' +
    '\n' +
    'What you must do:\n' +
    '- Produce a single JSON object (no extra text) that calls the execute_python tool as follows:\n' +
    '  {\n' +
    '    "jsonrpc": "2.0",\n' +
    '    "id": 3,\n' +
    '    "method": "tools/call",\n' +
    '    "params": {\n' +
    '      "name": "execute_python",\n' +
    '      "arguments": {\n' +
    '        "code": "<PLACE THE EXACT PYTHON CODE HERE AS A SINGLE JSON STRING>"\n' +
    '      }\n' +
    '    }\n' +
    '  }\n' +
    '\n' +
    'Instructions and requirements:\n' +
    '- Replace the placeholder with the exact code from the coding agent.\n' +
    '- The value of "code" must be a valid JSON string:\n' +
    '  - Preserve all characters of the code.\n' +
    '  - Escape characters per JSON rules (e.g., newline as \\n, quotes as \\", backslashes as \\\\).\n' +
    '  - Do NOT wrap the code in markdown or backticks.\n' +
    '- Output ONLY the JSON object above; no additional commentary before or after.\n' +
    '- Keep "id" as 3 and "name" as "execute_python" exactly as specified.\n' +
    '\n' +
    'Example structure (illustrative only; you must insert the real code):\n' +
    '{\n' +
    '  "jsonrpc": "2.0",\n' +
    '  "id": 3,\n' +
    '  "method": "tools/call",\n' +
    '  "params": {\n' +
    '    "name": "execute_python",\n' +
    '    "arguments": {\n' +
    '      "code": "import sys\\nprint('ok')"\n +
    '    }\n' +
    '  }\n' +
    '}\n' +
`;

export const codeWriterResult = `python
import pandas as pd
import numpy as np
import os

def normalize_csv():
    # define mapping
    categoryMapping = {
        "Solar": ["BARCSF1", "GRIFSF1", "HUGSF1", "LRSF1", "MLSP1", "ROTALLA1"],
        "Wind": ["CAPTL_WF", "CHALLHWF", "CULLRGWF", "DIAPURWF1", "MLWF1", "WAUBRAWF", "WOOLNTH1", "YAMBUKWF", "YSWF1"],
        "Natural Gas": ["SHOAL1"],
        "Hydro": ["BUTLERSG", "CLOVER", "CLUNY", "PALOONA", "REPULSE"],
        "Diesel": ["ERGT01", "GBO1"],
        "Battery": ["KEPBG1"],
        "Coal": ["ERGTO1", "RPCG"]
    }

    # read csv with second row as header
    df = pd.read_csv('C:/repos/SAGAMiddleware/data/Output_one_hour.csv', header=1)
    df.columns = df.columns.str.strip()

    normalized_df = pd.DataFrame()

    for energy_source, installations in categoryMapping.items():
        for installation in installations:
            if installation in df.columns:
                temp_df = df[['date/time', installation]].copy()
                temp_df["installation"] = installation
                temp_df["energy_source"] = energy_source
                temp_df = temp_df.rename(columns={installation: "MW"})
                temp_df['MW'] = pd.to_numeric(temp_df['MW'], errors='coerce')
                normalized_df = pd.concat([normalized_df, temp_df])

    # sort dataframe
    normalized_df.sort_values(['date/time', 'installation'], inplace=True)
    # output combined CSV
    normalized_df.to_csv("C:/repos/SAGAMiddleware/data/Output_one_hour_normalized.csv", index=False)

    # create directory if doesn't exist
    if not os.path.exists("C:/repos/SAGAMiddleware/data/installations/"):
        os.makedirs("C:/repos/SAGAMiddleware/data/installations/")

    # loop over installations and output each CSV
    for installation in normalized_df['installation'].unique():
        temp_df = normalized_df[normalized_df['installation'] == installation]
        temp_df.to_csv("C:/repos/SAGAMiddleware/data/installations/"+installation+".csv", index=False)

if __name__ == "__main__":
    normalize_csv()`;

export const visCodeWriterResult = `'import pandas as pd\n' +
    '\n' +
    '# Load the data\n' +
    "df = pd.read_csv('C:/repos/SAGAMiddleware/data/Output_one_hour_normalized.csv')\n" +
    '\n' +
    '# Ensure MW is numeric\n' +
    "df['MW'] = pd.to_numeric(df['MW'], errors='coerce')\n" +
    '\n' +
    '# Convert date/time to datetime format and extract the date\n' +
    "df['date/time'] = pd.to_datetime(df['date/time']).dt.date\n" +
    '\n' +
    '# Group by day, installation, and energy_source to compute the mean of MW\n' +
    "df = df.groupby(['date/time', 'installation', 'energy_source'], as_index=False)['MW'].mean()\n" +
    '\n' +
    "# Convert 'date/time' back to string format\n" +
    "df['date/time'] = df['date/time'].apply(lambda x: x.strftime('%m/%d/%Y'))\n" +
    '\n' +
    '# Sort the dataframe\n' +
    "df = df.sort_values(by=['date/time', 'installation', 'energy_source'])\n" +
    '\n' +
    '# Save the dataframe to csv\n' +
    "df.to_csv('C:/repos/SAGAMiddleware/data/Output_one_hour_normalized_daily_avg.csv', index=False)"
`;

//Called MCP regex check had issue - not a good error result
export const codeExecutorResult = ` {
  "content": [],
  "success": false,
  "stdout": "",
  "stderr": "Traceback (most recent call last):\r\n  File \"C:\\repos\\codeGen-mcp-server\\workspace\\script_1756625857917.py\", line 23, in <module>\r\n    ensure_dir_exists(match)\r\n  File \"C:\\repos\\codeGen-mcp-server\\workspace\\script_1756625857917.py\", line 8, in ensure_dir_exists\r\n    os.makedirs(dir_path, exist_ok=True)\r\n  File \"<frozen os>\", line 215, in makedirs\r\n  File \"<frozen os>\", line 215, in makedirs\r\n  File \"<frozen os>\", line 215, in makedirs\r\n  File \"<frozen os>\", line 225, in makedirs\r\nOSError: [WinError 123] The filename, directory name, or volume label syntax is incorrect: '], inplace=True)\\n    # output combined CSV\\n    normalized_df.to_csv(\"C:'",
  "error": "Command failed: py \"C:\\repos\\codeGen-mcp-server\\workspace\\script_1756625857917.py\"\nTraceback (most recent call last):\r\n  File \"C:\\repos\\codeGen-mcp-server\\workspace\\script_1756625857917.py\", line 23, in <module>\r\n    ensure_dir_exists(match)\r\n  File \"C:\\repos\\codeGen-mcp-server\\workspace\\script_1756625857917.py\", line 8, in ensure_dir_exists\r\n    os.makedirs(dir_path, exist_ok=True)\r\n  File \"<frozen os>\", line 215, in makedirs\r\n  File \"<frozen os>\", line 215, in makedirs\r\n  File \"<frozen os>\", line 215, in makedirs\r\n  File \"<frozen os>\", line 225, in makedirs\r\nOSError: [WinError 123] The filename, directory name, or volume label syntax is incorrect: '], inplace=True)\\n    # output combined CSV\\n    normalized_df.to_csv(\"C:'\r\n",
  "filename": "script_1756625857917.py"
}
`;
//this is result.result of SetExecutionResult below
export const pythonLogCodeResult = ` {
  agentName: 'MCPExecutePythonCaller',
  result: {
    agentName: 'MCPExecutePythonCaller',
    result: '{"content":[],"success":true,"stdout":"","stderr":"","filename":"script_1756934015527.py"}',
    success: true,
    timestamp: 2025-09-03T21:13:38.364Z
  },
  success: true,
  timestamp: 2025-09-03T21:13:26.962Z
}
`;

export const setExecutionResult = `{
  "setId": "visualization-saga-collection",
  "success": true,
  "result": {
    "workflowId": "thread_saga_thread_h8yBBgWkDd2vzTuk23c7GJhY_1757028911418",
    "collectionId": "visualization-saga-collection",
    "setResults": {
      "visualization-loading-set": {
        "setId": "visualization-loading-set",
        "success": true,
        "result": " {\n  agentName: 'MCPExecutePythonCaller',\n  result: {\n    agentName: 'MCPExecutePythonCaller',\n    result: '{\"content\":[],\"success\":true,\"std
out\":\"\",\"stderr\":\"\",\"filename\":\"script_1756934015527.py\"}',\n    success: true,\n    timestamp: 2025-09-03T21:13:38.364Z\n  },\n  success: true,\n  timestamp:
 2025-09-03T21:13:26.962Z\n}\n",
        "executionTime": 2,
        "transactionResults": {},
        "metadata": {
          "startTime": "2025-09-04T23:35:11.418Z",
          "endTime": "2025-09-04T23:35:11.420Z",
          "transactionsExecuted": 3,
          "transactionsFailed": 0
        }
      },
      "agent-generating-set": {
        "setId": "agent-generating-set",
        "success": true,
        "result": "'<flow>CODE-DAILY-AVG-01 -> TOOL-CALL-EXEC-01</flow>\n' +\n    '{\"toolUsers\": [\"MCPExecutePythonCaller\"]}'",
        "executionTime": 26,
        "transactionResults": {},
        "metadata": {
          "startTime": "2025-09-04T23:35:11.420Z",
          "endTime": "2025-09-04T23:35:11.446Z",
          "transactionsExecuted": 1,
          "transactionsFailed": 0
        }
      },
      "processing-set": {
        "setId": "processing-set",
        "success": true,
        "result": " {\n  agentName: 'MCPExecutePythonCaller',\n  result: {\n    agentName: 'MCPExecutePythonCaller',\n    result: '{\"content\":[],\"success\":true,\"std
out\":\"\",\"stderr\":\"\",\"filename\":\"script_1756934015527.py\"}',\n    success: true,\n    timestamp: 2025-09-03T21:13:38.364Z\n  },\n  success: true,\n  timestamp:
 2025-09-03T21:13:26.962Z\n}\n",
        "executionTime": 1,
        "transactionResults": {
          "setId": {
            "id": "processing-set",
            "name": "Data Processing Set",
            "description": "Processing agents that fetch, extract, normalize, group and aggregate data",
            "transactions": [
              {
                "id": "CODE-DAILY-AVG-01",
                "name": "PandasDailyAveragingCoder Transaction",
                "agentName": "PandasDailyAveragingCoder",
                "agentType": "processing",
                "dependencies": [
                  "TOOL-CALL-EXEC-01"
                ],
                "compensationAction": "cleanup_conversation_state",
                "status": "pending",
                "transactionPrompt": "Your task: Write complete, runnable Python code that:\n- Reads the input CSV at C:/repos/SAGAMiddleware/data/Output_one_hour_normal
ized.csv\n- Computes daily average MW per installation per energy_source for the 4 days from 11/02/2023 to 11/05/2023, using only the 4:00–4:55 time window at 5-minute i
nterv\nals\n- Writes a CSV with columns in this exact order and naming: date/time,installation,MW,energy_source\n  - date/time should be the date only (e.g., 11/02/2023)
\n  - MW should be the average MW for that installation and energy_source on that date (include negative values if present)\n- Saves the output to: C:/repos/SAGAMiddlewa
re/data/Output_one_hour_daily_avg.csv\n\nData details and constraints:\n- Input CSV columns: date/time,installation,MW,energy_source\n  - date/time format like: 11/02/20
23 4:00\n  - One-hour window per day: 4:00 through 4:55 inclusive, at 5-minute intervals\n  - Data spans four dates: 11/02/2023, 11/03/2023, 11/04/2023, 11/05/2023\n- Co
mpute averages per (date, installation, energy_source)\n- Keep MW as numeric; coerce non-numeric to NaN and drop those rows from averaging\n- Preserve negative MW readin
gs in averaging (do not clip)\n- Grouping must include energy_source to avoid mixing categories\n- Output CSV must have only the aggregated rows with the exact header an
d column order: date/time,installation,MW,energy_source\n\nImplementation guidance:\n- Use pandas\n- Steps:\n  1) Read CSV; parse date/time to datetime\n  2) Ensure MW i
s numeric (coerce errors), drop rows where MW is NaN\n  3) Filter rows to dates 11/02/2023–11/05/2023 and time-of-day between 4:00 and 4:55 inclusive at 5-minute interva
ls\n  4) Create a date-only string column for output formatting (MM/DD/YYYY), named date/time\n  5) Group by date/time, installation, energy_source; average MW\n  6) Reo
rder columns exactly and write to C:/repos/SAGAMiddleware/data/Output_one_hour_daily_avg.csv with index=False\n\nAbsolute requirements:\n- Output ONLY Python code\n- The
 very first character of your reply must be Python code (import, def, or variable)\n- The very last character of your reply must be Python code\n- No explanatory text\n-
 No markdown\n- No comments\n- No surrounding quotes or code fences"
              },
              {
                "id": "TOOL-CALL-EXEC-01",
                "name": "MCPExecutePythonCaller Transaction",
                "agentName": "MCPExecutePythonCaller",
                "agentType": "tool",
                "dependencies": [],
                "compensationAction": "cleanup_conversation_state",
                "status": "pending",
                "transactionPrompt": "You are a tool calling agent. Take the Python code produced by the coding agent and execute it by making a single JSON-RPC request 
to the MCP server to call the exe\ncute_python tool.\n\nInstructions:\n- Replace {code} below with the exact Python code produced by the coding agent (no modifications, 
no added wrappers)\n- Ensure proper JSON string encoding so that the entire code is passed under the \"code\" field (preserve newlines)\n- Output only the JSON-RPC reque
st object with no extra text or formatting\n\nTool call to send:\n{\n  \"jsonrpc\": \"2.0\",\n  \"id\": 3,\n  \"method\": \"tools/call\",\n  \"params\": {\n    \"name\":
 \"execute_python\",\n    \"arguments\": {\n      \"code\": {code}\n    }\n  }\n}"
              }
            ],
            "dependencies": []
          }
        },
        "metadata": {
          "startTime": "2025-09-04T23:35:11.447Z",
          "endTime": "2025-09-04T23:35:11.448Z",
          "transactionsExecuted": 2,
          "transactionsFailed": 0
        }
      }
    },
    "collectionResult": {}
  },
  "executionTime": 0,
  "transactionResults": {
    "visualization-loading-set": {
      "setId": "visualization-loading-set",
      "success": true,
      "result": " {\n  agentName: 'MCPExecutePythonCaller',\n  result: {\n    agentName: 'MCPExecutePythonCaller',\n    result: '{\"content\":[],\"success\":true,\"stdou
t\":\"\",\"stderr\":\"\",\"filename\":\"script_1756934015527.py\"}',\n    success: true,\n    timestamp: 2025-09-03T21:13:38.364Z\n  },\n  success: true,\n  timestamp:2 
025-09-03T21:13:26.962Z\n}\n",
      "executionTime": 2,
      "transactionResults": {},
      "metadata": {
        "startTime": "2025-09-04T23:35:11.418Z",
        "endTime": "2025-09-04T23:35:11.420Z",
        "transactionsExecuted": 3,
        "transactionsFailed": 0
      }
    },
    "agent-generating-set": {
      "setId": "agent-generating-set",
      "success": true,
      "result": "'<flow>CODE-DAILY-AVG-01 -> TOOL-CALL-EXEC-01</flow>\n' +\n    '{\"toolUsers\": [\"MCPExecutePythonCaller\"]}'",
      "executionTime": 26,
      "transactionResults": {},
      "metadata": {
        "startTime": "2025-09-04T23:35:11.420Z",
        "endTime": "2025-09-04T23:35:11.446Z",
        "transactionsExecuted": 1,
        "transactionsFailed": 0
      }
    },
    "processing-set": {
      "setId": "processing-set",
      "success": true,
      "result": " {\n  agentName: 'MCPExecutePythonCaller',\n  result: {\n    agentName: 'MCPExecutePythonCaller',\n    result: '{\"content\":[],\"success\":true,\"stdou
t\":\"\",\"stderr\":\"\",\"filename\":\"script_1756934015527.py\"}',\n    success: true,\n    timestamp: 2025-09-03T21:13:38.364Z\n  },\n  success: true,\n  timestamp: 2
025-09-03T21:13:26.962Z\n}\n",
      "executionTime": 1,
      "transactionResults": {
        "setId": {
          "id": "processing-set",
          "name": "Data Processing Set",
          "description": "Processing agents that fetch, extract, normalize, group and aggregate data",
          "transactions": [
            {
              "id": "CODE-DAILY-AVG-01",
              "name": "PandasDailyAveragingCoder Transaction",
              "agentName": "PandasDailyAveragingCoder",
              "agentType": "processing",
              "dependencies": [
                "TOOL-CALL-EXEC-01"
              ],
              "compensationAction": "cleanup_conversation_state",
              "status": "pending",
              "transactionPrompt": "Your task: Write complete, runnable Python code that:\n- Reads the input CSV at C:/repos/SAGAMiddleware/data/Output_one_hour_normaliz
ed.csv\n- Computes daily average MW per installation per energy_source for the 4 days from 11/02/2023 to 11/05/2023, using only the 4:00–4:55 time window at 5-minute int
erv\nals\n- Writes a CSV with columns in this exact order and naming: date/time,installation,MW,energy_source\n  - date/time should be the date only (e.g., 11/02/2023)\n
  - MW should be the average MW for that installation and energy_source on that date (include negative values if present)\n- Saves the output to: C:/repos/SAGAMiddleware
/data/Output_one_hour_daily_avg.csv\n\nData details and constraints:\n- Input CSV columns: date/time,installation,MW,energy_source\n  - date/time format like: 11/02/2023
 4:00\n  - One-hour window per day: 4:00 through 4:55 inclusive, at 5-minute intervals\n  - Data spans four dates: 11/02/2023, 11/03/2023, 11/04/2023, 11/05/2023\n- Comp
ute averages per (date, installation, energy_source)\n- Keep MW as numeric; coerce non-numeric to NaN and drop those rows from averaging\n- Preserve negative MW readings
 in averaging (do not clip)\n- Grouping must include energy_source to avoid mixing categories\n- Output CSV must have only the aggregated rows with the exact header and 
column order: date/time,installation,MW,energy_source\n\nImplementation guidance:\n- Use pandas\n- Steps:\n  1) Read CSV; parse date/time to datetime\n  2) Ensure MW is 
numeric (coerce errors), drop rows where MW is NaN\n  3) Filter rows to dates 11/02/2023–11/05/2023 and time-of-day between 4:00 and 4:55 inclusive at 5-minute intervals
\n  4) Create a date-only string column for output formatting (MM/DD/YYYY), named date/time\n  5) Group by date/time, installation, energy_source; average MW\n  6) Reord
er columns exactly and write to C:/repos/SAGAMiddleware/data/Output_one_hour_daily_avg.csv with index=False\n\nAbsolute requirements:\n- Output ONLY Python code\n- Thev 
ery first character of your reply must be Python code (import, def, or variable)\n- The very last character of your reply must be Python code\n- No explanatory text\n- N
o markdown\n- No comments\n- No surrounding quotes or code fences"
            },
            {
              "id": "TOOL-CALL-EXEC-01",
              "name": "MCPExecutePythonCaller Transaction",
              "agentName": "MCPExecutePythonCaller",
              "agentType": "tool",
              "dependencies": [],
              "compensationAction": "cleanup_conversation_state",
              "status": "pending",
              "transactionPrompt": "You are a tool calling agent. Take the Python code produced by the coding agent and execute it by making a single JSON-RPC request to
 the MCP server to call the exe\ncute_python tool.\n\nInstructions:\n- Replace {code} below with the exact Python code produced by the coding agent (no modifications, no
 added wrappers)\n- Ensure proper JSON string encoding so that the entire code is passed under the \"code\" field (preserve newlines)\n- Output only the JSON-RPC request
 object with no extra text or formatting\n\nTool call to send:\n{\n  \"jsonrpc\": \"2.0\",\n  \"id\": 3,\n  \"method\": \"tools/call\",\n  \"params\": {\n    \"name\": \
"execute_python\",\n    \"arguments\": {\n      \"code\": {code}\n    }\n  }\n}"
            }
          ],
          "dependencies": []
        }
      },
      "metadata": {
        "startTime": "2025-09-04T23:35:11.447Z",
        "endTime": "2025-09-04T23:35:11.448Z",
        "transactionsExecuted": 2,
        "transactionsFailed": 0
      }
    }
  },
  "metadata": {
    "startTime": "2025-09-04T23:35:11.448Z",
    "endTime": "2025-09-04T23:35:11.448Z",
    "transactionsExecuted": 3,
    "transactionsFailed": 0
  }
}`

export const graphAnalyzerResult = `  agentName: 'D3JSCoordinatingAgent',
  result: '[AGENT: Installation Time-Series Aggregator, DA-001]\n' +
    'Your mission\n' +
    '- Analyze CSV data provided in chunks and produce a clean, aggregated time series suitable for a 2D multi-line chart.\n' +
    '- X-axis: the four dates 11/02/2023, 11/03/2023, 11/04/2023, 11/05/2023.\n' +
    '- Y-axis: MW/hr produced per installation (sum of MW values per installation per date).\n' +
    '- Maintain running aggregates across chunks and output final graph-ready structures plus summary statistics and axis intervals.\n' +
    '\n' +
    'Input schema\n' +
    '- CSV columns: date/time, installation, energy_source, MW\n' +
    '- Rows arrive in chunks of up to 20. You will also receive total_row_count at the start.\n' +
    '- Only the four target dates are in scope. Ignore rows outside these dates.\n' +
    '\n' +
    'Core assumptions and rules\n' +
    '- Treat date/time values as month/day/year (MM/DD/YYYY). Normalize internally to ISO (YYYY-MM-DD) or keep the original strings consistently for output labels; choos
e one and use it consistently.\n' +
    '- Sum MW for duplicate (installation, date) pairs.\n' +
    '- Keep negative and zero MW values as-is. They must influence y-axis domain.\n' +
    '- If an installation has no record for a target date, fill that date with 0 (so each installation has exactly four points).\n' +
    '- Energy source per installation: if multiple appear for an installation across rows, use the most frequent value; if tied, choose lexicographically smallest or mar
k as "Mixed".\n' +
    '- Skip rows with missing or non-numeric MW; count them under data_quality.skipped_rows.\n' +
    '\n' +
    'State to keep across chunks\n' +
    '- processed_rows: integer\n' +
    '- total_rows: integer (provided once)\n' +
    '- target_dates: ordered array of the four dates\n' +
    '- unique_installations: set\n' +
    '- unique_energy_sources: set\n' +
    '- by_install_date: map installation -> map date -> sumMW\n' +
    '- per_date_totals: map date -> sumMW across all installations\n' +
    '- per_installation_totals: map installation -> sumMW across all dates\n' +
    '- energy_source_by_installation: map installation -> frequency map of energy_source\n' +
    '- data_quality: { skipped_rows, out_of_scope_date_rows }\n' +
    '- provisional_min_max (optional for progress reporting): running min and max of aggregated values; final min and max will be computed after all chunks\n' +
    '\n' +
    'Per-chunk processing\n' +
    '1) Parse and validate\n' +
    '- For each row: trim fields, parse MW as float. If MW is NaN or missing, increment data_quality.skipped_rows and continue.\n' +
    '- Normalize/validate date. If date not in target_dates, increment data_quality.out_of_scope_date_rows and continue.\n' +
    '\n' +
    '2) Update aggregates\n' +
    '- unique_installations.add(installation)\n' +
    '- unique_energy_sources.add(energy_source)\n' +
    '- energy_source_by_installation[installation][energy_source] += 1\n' +
    '- by_install_date[installation][date] = (existing or 0) + MW\n' +
    '- per_date_totals[date] = (existing or 0) + MW\n' +
    '- per_installation_totals[installation] = (existing or 0) + MW\n' +
    '- processed_rows += 1\n' +
    '\n' +
    '3) Optional provisional min/max update\n' +
    '- After updating by_install_date[installation][date], you may update provisional_min_max.{min,max} by comparing against the updated sum. Final min/max will be recom
puted after all chunks for exactness.\n' +
    '\n' +
    'Finalization (after processed_rows == total_rows)\n' +
    '1) Complete the grid\n' +
    '- For every installation in unique_installations and each date in target_dates, ensure by_install_date[installation][date] exists; if missing, set to 0.\n' +       
    '\n' +
    '2) Build series for the line chart\n' +
    '- For each installation:\n' +
    '  - Determine energy_source = mode of energy_source_by_installation[installation] (or "Mixed" on tie).\n' +
    '  - Create values array ordered by target_dates: [{ date: d, mw: by_install_date[installation][d] }, ...]\n' +
    '  - series item: { id: installation, energy_source, values }\n' +
    '- Sort series by descending total across dates (per_installation_totals) to aid legend ordering.\n' +
    '\n' +
    '3) Compute y-domain and ticks\n' +
    '- Gather all mw across all series.values.\n' +
    '- global_min = min of all mw\n' +
    '- global_max = max of all mw\n' +
    '- If global_min == global_max, pad by epsilon (e.g., 1% of |value| or 1.0 if value ~ 0): y_min = global_min - epsilon; y_max = global_max + epsilon\n' +
    '- Else set y_min = global_min, y_max = global_max\n' +
    '- Choose target_tick_count = 6 (5–8 acceptable). Compute a "nice" step:\n' +
    '  - raw_step = (y_max - y_min) / target_tick_count\n' +
    '  - nice_step = nice_number(raw_step) using multipliers [1, 2, 2.5, 5, 10] * 10^k\n' +
    '  - y_min_nice = floor(y_min / nice_step) * nice_step\n' +
    '  - y_max_nice = ceil(y_max / nice_step) * nice_step\n' +
    '  - y_ticks = sequence from y_min_nice to y_max_nice inclusive by nice_step\n' +
    '- Provide a tick label format hint:\n' +
    '  - If |y_max_nice| < 1 or nice_step < 1: 3–4 decimals\n' +
    '  - Else if nice_step < 10: 2 decimals\n' +
    '  - Else: 0 decimals\n' +
    '\n' +
    '4) Additional measures useful for a line chart\n' +
    '- counts:\n' +
    '  - total_rows\n' +
    '  - processed_rows\n' +
    '  - n_installations = size(unique_installations)\n' +
    '  - n_energy_sources = size(unique_energy_sources)\n' +
    '  - n_dates = 4\n' +
    '- per_date_totals as computed\n' +
    '- per_installation_totals as computed\n' +
    '- extrema:\n' +
    '  - max_point: { installation, date, mw } where mw is global_max\n' +
    '  - min_point: { installation, date, mw } where mw is global_min\n' +
    '- central tendencies (optional but useful):\n' +
    '  - global_mean of all mw values across the 4×n_installations grid\n' +
    '  - per_date_mean: average across installations for each date\n' +
    '\n' +
    '5) Output shape (JSON-like; use these keys)\n' +
    '- xDomain: array of the four dates in order\n' +
    '- series: array of { id, energy_source, values: [{ date, mw }] }\n' +
    '- yDomain: [y_min_nice, y_max_nice]\n' +
    '- yTicks: array of tick numbers in ascending order\n' +
    '- tickFormatHint: e.g., "auto-2dp", "auto-3dp"\n' +
    '- stats:\n' +
    '  - counts: { total_rows, processed_rows, n_installations, n_energy_sources, n_dates }\n' +
    '  - per_date_totals: map date -> sumMW\n' +
    '  - per_installation_totals: map installation -> sumMW\n' +
    '  - extrema: { global_min, global_max, min_point, max_point }\n' +
    '  - data_quality: { skipped_rows, out_of_scope_date_rows }\n' +
    '\n' +
    'Nice number helper (description)\n' +
    '- Determine k = floor(log10(raw_step))\n' +
    '- base = 10^k\n' +
    '- candidate = raw_step / base\n' +
    '- Choose m from [1, 2, 2.5, 5, 10] that is >= candidate (or the closest above), then nice_step = m * base\n' +
    '\n' +
    'Example using the provided sample (single date shown for illustration)\n' +
    '- Input rows (11/02/2023):\n' +
    '  - BARCSF1 Solar 0.1\n' +
    '  - BUTLERSG Hydro 9.399999\n' +
    '  - CAPTL_WF Wind 7.776811333333334\n' +
    '  - CHALLHWF Wind 23.766666666666666\n' +
    '  - CLOVER Hydro -0.008333333333333333\n' +
    '  - CLUNY Hydro 18.216982916666666\n' +
    '  - CULLRGWF Wind 9.554166666666667\n' +
    '- For 11/02/2023, global_min ≈ -0.0083333333, global_max ≈ 23.7666667\n' +
    '- With target_tick_count = 6: raw_step ≈ 3.96 → nice_step = 5\n' +
    '- y_min_nice = -5, y_max_nice = 25\n' +
    '- y_ticks = [-5, 0, 5, 10, 15, 20, 25]\n' +
    '- For the missing three dates per installation, fill mw = 0.\n' +
    '\n' +
    'Operational notes\n' +
    '- Be deterministic and idempotent: reprocessing the same chunk should not double-count. If chunking infra can resend chunks, require a monotonically increasing offs
et, or maintain a processed_row_ids set if IDs are available. If not available, assume exactly-once delivery.\n' +
    '- Memory: maps will have at most n_installations × 4 entries for by_install_date; this scales well.\n' +
    '- Time: all operations are O(rows + n_installations × 4).\n' +
    '\n' +
    'Deliverable\n' +
    '- After the final chunk, return the output shape described above with complete series, domains, ticks, and stats ready for visualization.\n' +
    '[/AGENT]'`

export const graphAnalyzerResult_1 = `{
  agentName: 'D3JSCoordinatingAgent',
  result: '[AGENT: Grid-Line Data Analyzer, DA-001]\n' +
    'Your task: Analyze CSV data to prepare a structured specification for a 2‑D multi-series line chart of MW/Hr produced by installations across four dates.\n' +
    '\n' +
    'Input CSV structure:\n' +
    '- Columns: date/time,installation,energy_source,MW\n' +
    '- Example rows:\n' +
    '  date/time,installation,energy_source,MW\n' +
    '  11/02/2023,BARCSF1,Solar,0.10000000000000002\n' +
    '  11/02/2023,BUTLERSG,Hydro,9.399999\n' +
    '  11/02/2023,CAPTL_WF,Wind,7.776811333333334\n' +
    '  11/02/2023,CHALLHWF,Wind,23.766666666666666\n' +
    '  11/02/2023,CLOVER,Hydro,-0.008333333333333333\n' +
    '  11/02/2023,CLUNY,Hydro,18.216982916666666\n' +
    '  11/02/2023,CULLRGWF,Wind,9.554166666666667\n' +
    '\n' +
    'Chart requirements:\n' +
    '- chart_type: line\n' +
    '- X-axis: the 4 dates exactly: ["11/02/2023","11/03/2023","11/04/2023","11/05/2023"]\n' +
    '- Y-axis: MW/Hr produced by each installation\n' +
    '- Multi-series: one line per unique installation\n' +
    '- Handle potential negative MW values and missing dates per installation\n' +
    '\n' +
    'Data preparation steps:\n' +
    '1) Parse and normalize\n' +
    '   - Parse CSV rows; coerce MW to Number (floating point).\n' +
    '   - Normalize date/time to string format MM/DD/YYYY. If timestamps are present, truncate to date.\n' +
    '   - Trim installation and energy_source strings.\n' +
    '\n' +
    '2) Filter and organize by target dates\n' +
    '   - Keep only rows whose date is one of the four target dates.\n' +
    '   - Group by installation, then by date.\n' +
    '\n' +
    '3) Aggregate per installation per date\n' +
    '   - For each installation and date, aggregate MW by summing all rows for that (installation, date).\n' +
    '   - If no data for an installation on a target date, set the MW value to null for that date (leave gaps in the line).\n' +
    '\n' +
    '4) Compute required sets and ranges\n' +
    '   - Unique installations: the set of all installation values present in the filtered data (across the 4 dates).\n' +
    '   - Date range: {start: "11/02/2023", end: "11/05/2023"}, and x_values as the ordered list of those four dates.\n' +
    '   - MW min/max (raw): compute across all aggregated points for the 4 dates, ignoring nulls:\n' +
    '       raw_min_mw = min(MW)\n' +
    '       raw_max_mw = max(MW)\n' +
    '   - Y-axis domain and ticks (nice intervals):\n' +
    '       a) range = raw_max_mw - raw_min_mw\n' +
    '       b) target_tick_count = 6\n' +
    '       c) step0 = range / (target_tick_count - 1)\n' +
    '       d) nice step function: round step0 to 1, 2, or 5 × 10^k (choose the nearest larger “nice” number)\n' +
    '       e) y_min = floor(raw_min_mw / step) * step\n' +
    '          y_max = ceil(raw_max_mw / step) * step\n' +
    '          Also ensure 0 is included in [y_min, y_max] if it lies between raw_min_mw and raw_max_mw.\n' +
    '       f) ticks = sequence from y_min to y_max inclusive in increments of step\n' +
    '   - Number of installations: count of unique installations.\n' +
    '   - Also report the set of unique energy_source values for reference.\n' +
    '\n' +
    '5) Series construction\n' +
    '   - For each installation, produce an ordered array of points aligned to x_values, e.g.:\n' +
    '     points: [{date: "11/02/2023", MW: number|null}, {date: "11/03/2023", MW: number|null}, {date: "11/04/2023", MW: number|null}, {date: "11/05/2023", MW: number|null}]\n' +
    '   - Do not forward-fill or interpolate missing values; leave them as null.\n' +
    '\n' +
    '6) Output format (ABSOLUTE REQUIREMENTS)\n' +
    '   - Output a single structured JSON object with:\n' +
    '     {\n' +
    "       chart_type: 'line',\n" +
    '       x_values: ["11/02/2023","11/03/2023","11/04/2023","11/05/2023"],\n' +
    '       date_range: { start: "11/02/2023", end: "11/05/2023" },\n' +
    '       installations: [list of unique installations],\n' +
    '       installation_count: <integer>,\n' +
    '       energy_sources: [list of unique energy_source values],\n' +
    '       mw_range_raw: { min: <number>, max: <number> },\n' +
    '       y_axis: {\n' +
    '         unit: "MW/Hr",\n' +
    '         domain: { min: <number>, max: <number> },\n' +
    '         tick_step: <number>,\n' +
    '         ticks: [<number>...]\n' +
    '       },\n' +
    '       series: [\n' +
    '         {\n' +
    '           installation: "<installation_id>",\n' +
    '           points: [\n' +
    '             { date: "11/02/2023", MW: <number|null> },\n' +
    '             { date: "11/03/2023", MW: <number|null> },\n' +
    '             { date: "11/04/2023", MW: <number|null> },\n' +
    '             { date: "11/05/2023", MW: <number|null> }\n' +
    '           ]\n' +
    '         },\n' +
    '         ...\n' +
    '       ],\n' +
    '       notes: {\n' +
    '         aggregation: "sum per installation per date",\n' +
    '         negative_values_possible: true,\n' +
    '         missing_values: "null to create line gaps",\n' +
    '         decimals: "preserve source precision; round for display only"\n' +
    '       }\n' +
    '     }\n' +
    '\n' +
    'Worked example using the provided sample rows only (for illustration; final output must be computed from the full filtered dataset):\n' +
    '- Unique installations (sample): ["BARCSF1","BUTLERSG","CAPTL_WF","CHALLHWF","CLOVER","CLUNY","CULLRGWF"]\n' +
    '- Unique energy_sources (sample): ["Solar","Hydro","Wind"]\n' +
    '- raw_min_mw (sample) = -0.008333333333333333\n' +
    '- raw_max_mw (sample) = 23.766666666666666\n' +
    '- range ≈ 23.775\n' +
    '- With target_tick_count = 6, step0 ≈ 4.755 → nice step = 5\n' +
    '- y_min = floor(-0.008333... / 5) * 5 = -5\n' +
    '- y_max = ceil(23.766666... / 5) * 5 = 25\n' +
    '- ticks = [-5, 0, 5, 10, 15, 20, 25]\n' +
    '\n' +
    'Return the final structured JSON as the only output.\n' +
    '[/AGENT]',
  success: true,
  timestamp: 2025-09-16T00:25:30.326Z
}`;

// Installation Time-Series Aggregator, DA-001
export const aggregatorContext = `Include explicit instructions for the agent with:
- confirmed_installations_count: N
- confirmed_date_range: [start, end] 
- confirmed_y_range: [min, max]
`

export const csvData = `date/time,installation,energy_source,MW
11/02/2023,BARCSF1,Solar,0.10000000000000002
11/02/2023,BUTLERSG,Hydro,9.399999
11/02/2023,CAPTL_WF,Wind,7.776811333333334
11/02/2023,CHALLHWF,Wind,23.766666666666666
11/02/2023,CLOVER,Hydro,-0.008333333333333333
11/02/2023,CLUNY,Hydro,18.216982916666666
11/02/2023,CULLRGWF,Wind,9.554166666666667
11/02/2023,DIAPURWF1,Wind,
11/02/2023,ERGT01,Diesel,0.0
11/02/2023,ERGTO1,Coal,0.0
11/02/2023,GBO1,Diesel,0.0
11/02/2023,GRIFSF1,Solar,0.0015260000000000002
11/02/2023,HUGSF1,Solar,-0.17600000000000002
11/02/2023,KEPBG1,Battery,0.0
11/02/2023,LRSF1,Solar,0.005
11/02/2023,MLSP1,Solar,0.037
11/02/2023,MLWF1,Wind,1.9324999999999999
11/02/2023,PALOONA,Hydro,0.0
11/02/2023,REPULSE,Hydro,28.973424166666664`

export const aggregatorResult_1 = `{
  agentName: 'Installation Time-Series Aggregator',
  result: '{\n' +
    '  "xDomain": ["11/02/2023", "11/03/2023", "11/04/2023", "11/05/2023"],\n' +
    '  "series": [\n' +
    '    {\n' +
    '      "id": "BARCSF1",\n' +
    '      "energy_source": "Solar",\n' +
    '      "values": [\n' +
    '        { "date": "11/02/2023", "mw": 0.1 },\n' +
    '        { "date": "11/03/2023", "mw": 0 },\n' +
    '        { "date": "11/04/2023", "mw": 0 },\n' +
    '        { "date": "11/05/2023", "mw": 0 }\n' +
    '      ]\n' +
    '    },\n' +
    '    ...\n' +
    '  ],\n' +
    '  "yDomain": [-5, 25],\n' +
    '  "yTicks": [-5, 0, 5, 10, 15, 20, 25],\n' +
    '  "tickFormatHint": "auto-2dp",\n' +
    '  "stats": {\n' +
    '    "counts": {\n' +
    '      "total_rows": 20,\n' +
    '      "processed_rows": 20,\n' +
    '      "n_installations": 16,\n' +
    '      "n_energy_sources": 5,\n' +
    '      "n_dates": 4\n' +
    '    },\n' +
    '    "per_date_totals": {\n' +
    '      "11/02/2023": 69.91014775000001,\n' +
    '      "11/03/2023": 0,\n' +
    '      "11/04/2023": 0,\n' +
    '      "11/05/2023": 0\n' +
    '    },\n' +
    '    "per_installation_totals": {\n' +
    '      "BARCSF1": 0.1,\n' +
    '      ...\n' +
    '    },\n' +
    '    "extrema": {\n' +
    '      "global_min": -0.176,\n' +
    '      "global_max": 28.973424166666664,\n' +
    '      "min_point": { "installation": "HUGSF1", "date": "11/02/2023", "mw": -0.176 },\n' +
    '      "max_point": { "installation": "REPULSE", "date": "11/02/2023", "mw": 28.973424166666664 }\n' +
    '    },\n' +
    '    "data_quality": {\n' +
    '      "skipped_rows": 1,\n' +
    '      "out_of_scope_date_rows": 0\n' +
    '    }\n' +
    '  }\n' +
    '}',
  success: true,
  timestamp: 2025-09-07T21:46:25.531Z
}`;

export const aggregatorResult_2 = `{
  agentName: 'Installation Time-Series Aggregator',
  result: '{\n' +
    '  "xDomain": ["11/02/2023", "11/03/2023", "11/04/2023", "11/05/2023"],\n' +
    '  "series": [\n' +
    '    {\n' +
    '      "id": "KEPBG1",\n' +
    '      "energy_source": "Battery",\n' +
    '      "values": [\n' +
    '        {"date": "11/02/2023", "mw": 0},\n' +
    '        {"date": "11/03/2023", "mw": 0.0},\n' +
    '        {"date": "11/04/2023", "mw": 0},\n' +
    '        {"date": "11/05/2023", "mw": 0}\n' +
    '      ]\n' +
    '    },\n' +
    '    {\n' +
    '      "id": "LRSF1",\n' +
    '      "energy_source": "Solar",\n' +
    '      "values": [\n' +
    '        {"date": "11/02/2023", "mw": 0},\n' +
    '        {"date": "11/03/2023", "mw": 0.004},\n' +
    '        {"date": "11/04/2023", "mw": 0},\n' +
    '        {"date": "11/05/2023", "mw": 0}\n' +
    '      ]\n' +
    '    },\n' +
    '    {\n' +
    '      "id": "MLSP1",\n' +
    '      "energy_source": "Solar",\n' +
    '      "values": [\n' +
    '        {"date": "11/02/2023", "mw": 0},\n' +
    '        {"date": "11/03/2023", "mw": 0.002},\n' +
    '        {"date": "11/04/2023", "mw": 0},\n' +
    '        {"date": "11/05/2023", "mw": 0}\n' +
    '      ]\n' +
    '    }\n' +
    '    ...\n' +
    '  ],\n' +
    '  "yDomain": [-1, 70],\n' +
    '  "yTicks": [-1, 0, 10, 20, 30, 40, 50, 60, 70],\n' +
    '  "tickFormatHint": "auto-1dp",\n' +
    '  "stats": {\n' +
    '    "counts": {\n' +
    '      "total_rows": 160,\n' +
    '      "processed_rows": 160,\n' +
    '      "n_installations": 22,\n' +
    '      "n_energy_sources": 6,\n' +
    '      "n_dates": 4\n' +
    '    },\n' +
    '    "per_date_totals": {\n' +
    '      "11/02/2023": 0,\n' +
    '      "11/03/2023": 154.96340849999997,\n' +
    '      "11/04/2023": 79.58323216666667,\n' +
    '      "11/05/2023": 0\n' +
    '    },\n' +
    '    "per_installation_totals": {\n' +
    '      "KEPBG1": 0,\n' +
    '      "LRSF1": 0.004,\n' +
    '      "MLSP1": 0.002,\n' +
    '      ...\n' +
    '    },\n' +
    '    "extrema": {\n' +
    '      "global_min": -0.006666666666666667,\n' +
    '      "global_max": 68.01666666666667,\n' +
    '      "min_point": {"installation": "CLOVER", "date": "11/04/2023", "mw": -0.006666666666666667},\n' +
    '      "max_point": {"installation": "WOOLNTH1", "date": "11/03/2023", "mw": 68.01666666666667}\n' +
    '    },\n' +
    '    "data_quality": {\n' +
    '      "skipped_rows": 0,\n' +
    '      "out_of_scope_date_rows": 0\n' +
    '    }\n' +
    '  }\n' +
    '}',
  success: true,
  timestamp: 2025-09-07T21:46:50.798Z
}`;
export const aggregatorResult_3 = `{
  agentName: 'Installation Time-Series Aggregator',
  result: '{\n' +
    '  "xDomain": ["2023-11-02", "2023-11-03", "2023-11-04", "2023-11-05"],\n' +
    '  "series": [\n' +
    '    {\n' +
    '      "id": "DIAPURWF1",\n' +
    '      "energy_source": "Wind",\n' +
    '      "values": [\n' +
    '        { "date": "2023-11-02", "mw": 0 },\n' +
    '        { "date": "2023-11-03", "mw": 0 },\n' +
    '        { "date": "2023-11-04", "mw": 0 },\n' +
    '        { "date": "2023-11-05", "mw": 0 }\n' +
    '      ]\n' +
    '    },\n' +
    '    {\n' +
    '      "id": "ERGT01",\n' +
    '      "energy_source": "Diesel",\n' +
    '      "values": [\n' +
    '        { "date": "2023-11-02", "mw": 0 },\n' +
    '        { "date": "2023-11-03", "mw": 0 },\n' +
    '        { "date": "2023-11-04", "mw": 0 },\n' +
    '        { "date": "2023-11-05", "mw": 0 }\n' +
    '      ]\n' +
    '    },\n' +
    '    {\n' +
    '      "id": "ERGTO1",\n' +
    '      "energy_source": "Coal",\n' +
    '      "values": [\n' +
    '        { "date": "2023-11-02", "mw": 0 },\n' +
    '        { "date": "2023-11-03", "mw": 0 },\n' +
    '        { "date": "2023-11-04", "mw": 0 },\n' +
    '        { "date": "2023-11-05", "mw": 0 }\n' +
    '      ]\n' +
    '    },\n' +
    '    {... and so on for all installations ...}\n' +
    '  ],\n' +
    '  "yDomain": [-0.1095, 145.70458333333332],\n' +
    '  "yTicks": [-0.2, 0, 20, 40, 60, 80, 100, 120, 140, 160],\n' +
    '  "tickFormatHint": "auto-2dp",\n' +
    '  "stats": {\n' +
    '    "counts": {\n' +
    '      "total_rows": 500,\n' +
    '      "processed_rows": 20,\n' +
    '      "n_installations": 20,\n' +
    '      "n_energy_sources": 6,\n' +
    '      "n_dates": 4\n' +
    '    },\n' +
    '    "per_date_totals": {\n' +
    '      "2023-11-02": 0.0,\n' +
    '      "2023-11-03": 0.0,\n' +
    '      "2023-11-04": 255.44942904166666,\n' +
    '      "2023-11-05": 0\n' +
    '    },\n' +
    '    "per_installation_totals": {\n' +
    '      "DIAPURWF1": 0,\n' +
    '      "ERGT01": 0,\n' +
    '      "ERGTO1": 0,\n' +
    '      ... and so on for all installations ...\n' +
    '    },\n' +
    '    "extrema": {\n' +
    '      "global_min": -0.1095,\n' +
    '      "global_max": 145.70458333333332,\n' +
    '      "min_point": { "installation": "HUGSF1", "date": "2023-11-04", "mw": -0.1095 },\n' +
    '      "max_point": { "installation": "WAUBRAWF", "date": "2023-11-04", "mw": 145.70458333333332 }\n' +
    '    },\n' +
    '    "data_quality": { "skipped_rows": 2, "out_of_scope_date_rows": 1 }\n' +
    '  }\n' +
    '}',
  success: true,
  timestamp: 2025-09-07T21:47:06.722Z
}`
export const aggregatorResult_4 = `{
  agentName: 'Installation Time-Series Aggregator',
  result: '{\n' +
    '  "xDomain": ["11/02/2023","11/03/2023","11/04/2023","11/05/2023"],\n' +
    '  "series": [\n' +
    '    {\n' +
    '      "id": "BUTLERSG",\n' +
    '      "energy_source": "Hydro",\n' +
    '      "values": [{"date":"11/02/2023", "mw":0}, {"date":"11/03/2023", "mw":0}, {"date":"11/04/2023", "mw":0}, {"date":"11/05/2023", "mw":9.391665583333333}]\n' +
    '    },\n' +
    '    {\n' +
    '      "id": "CAPTL_WF",\n' +
    '      "energy_source": "Wind",\n' +
    '      "values": [{"date":"11/02/2023", "mw":0}, {"date":"11/03/2023", "mw":0}, {"date":"11/04/2023", "mw":0}, {"date":"11/05/2023", "mw":25.20872}]\n' +
    '    },\n' +
    '    ...\n' +
    '  ],\n' +
    '  "yDomain": [-5, 25],\n' +
    '  "yTicks": [-5, 0, 5, 10, 15, 20, 25],\n' +
    '  "tickFormatHint": "auto-2dp",\n' +
    '  "stats": {\n' +
    '    "counts": {\n' +
    '      "total_rows": 0,\n' +
    '      "processed_rows": 20,\n' +
    '      "n_installations": 19,\n' +
    '      "n_energy_sources": 7,\n' +
    '      "n_dates": 1\n' +
    '    },\n' +
    '    "per_date_totals": {\n' +
    '      "11/05/2023": 93.56824208333334\n' +
    '    },\n' +
    '    "per_installation_totals": {\n' +
    '      "BUTLERSG": 9.391665583333333,\n' +
    '      "CAPTL_WF": 25.20872,\n' +
    '      ...\n' +
    '    },\n' +
    '    "extrema": {\n' +
    '      "global_min": -1.1,\n' +
    '      "global_max": 25.20872,\n' +
    '      "min_point": {"installation":"RPCG", "date":"11/05/2023", "mw":-1.1},\n' +
    '      "max_point": {"installation":"CAPTL_WF", "date":"11/05/2023", "mw":25.20872}\n' +
    '    },\n' +
    '    "data_quality": {\n' +
    '      "skipped_rows": 2,\n' +
    '      "out_of_scope_date_rows": 0\n' +
    '    }\n' +
    '  }\n' +
    '}',
  success: true,
  timestamp: 2025-09-07T21:47:21.738Z
}
`;

export const aggregatorResult_1_1 = `{
  agentName: 'Grid-Line Data Analyzer',
  result: '{\n' +
    '  "chart_type": "line",\n' +
    '  "x_values": ["11/02/2023","11/03/2023","11/04/2023","11/05/2023"],\n' +
    '  "date_range": { "start": "11/02/2023", "end": "11/05/2023" },\n' +
    '  "installations": ["BARCSF1","BUTLERSG","CAPTL_WF","CHALLHWF","CLOVER","CLUNY","CULLRGWF","DIAPURWF1","ERGT01","ERGTO1","GBO1","GRIFSF1","HUGSF1","KEPBG1","LRSF1","MLSP1","MLWF1","PALOONA","REPULSE"],\n' +
    '  "installation_count": 19,\n' +
    '  "energy_sources": ["Solar","Hydro","Wind", "Diesel", "Battery","Coal"],\n' +
    '  "mw_range_raw": { "min": -0.17600000000000002, "max": 28.973424166666664 },\n' +
    '  "y_axis": {\n' +
    '    "unit": "MW/Hr",\n' +
    '    "domain": { "min": -5, "max": 30 },\n' +
    '    "tick_step": 5,\n' +
    '    "ticks": [-5, 0, 5, 10, 15, 20, 25, 30]\n' +
    '  },\n' +
    '  "series": [\n' +
    '    {\n' +
    '      "installation": "BARCSF1",\n' +
    '      "points": [\n' +
    '        { "date": "11/02/2023", "MW": 0.10000000000000002 },\n' +
    '        { "date": "11/03/2023", "MW": null },\n' +
    '        { "date": "11/04/2023", "MW": null },\n' +
    '        { "date": "11/05/2023", "MW": null }\n' +
    '      ]\n' +
    '    },\n' +
    '    ... (similary for each installation) ...\n' +
    '  ],\n' +
    '  "notes": {\n' +
    '    "aggregation": "sum per installation per date",\n' +
    '    "negative_values_possible": true,\n' +
    '    "missing_values": "null to create line gaps",\n' +
    '    "decimals": "preserve source precision; round for display only"\n' +
    '  }\n' +
    '}',
  success: true,
  timestamp: 2025-09-16T02:17:24.448Z
}

`;

export const aggregatorResult_1_2 = `{
  agentName: 'Grid-Line Data Analyzer',
  result: '{\n' +
    '  "chart_type": "line",\n' +
    '  "x_values": ["11/02/2023","11/03/2023","11/04/2023","11/05/2023"],\n' +
    '  "date_range": { "start": "11/02/2023", "end": "11/05/2023" },\n' +
    '  "installations": ["ROTALLA1","RPCG","SHOAL1","WAUBRAWF","WOOLNTH1","YAMBUKWF","YSWF1","BARCSF1","BUTLERSG","CAPTL_WF","CHALLHWF","CLOVER","CLUNY","CULLRGWF","DIAPURWF1","ERGT01","ERGTO1","GBO1","GRIFSF1","HUGSF1"],\n' +
    '  "installation_count": 20,\n' +
    '  "energy_sources": ["Solar","Coal","Natural Gas","Wind","Hydro","Diesel"],\n' +
    '  "mw_range_raw": { "min": -0.19299999999999998, "max": 46.83083333333334 },\n' +
    '  "y_axis": {\n' +
    '    "unit": "MW/Hr",\n' +
    '    "domain": { "min": -5, "max": 50 },\n' +
    '    "tick_step": 10,\n' +
    '    "ticks": [-5, 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50]\n' +
    '  },\n' +
    '  "series": [\n' +
    '    {\n' +
    '      "installation": "<installation_id>",\n' +
    '      "points": [\n' +
    '        { "date": "11/02/2023", "MW": <number|null> },\n' +
    '        { "date": "11/03/2023", "MW": <number|null> },\n' +
    '        { "date": "11/04/2023", "MW": <number|null> },\n' +
    '        { "date": "11/05/2023", "MW": <number|null> }\n' +
    '      ]\n' +
    '    },\n' +
    '    .\n' +
    '    .\n' +
    '    .\n' +
    '  ],\n' +
    '  "notes": {\n' +
    '    "aggregation": "sum per installation per date",\n' +
    '    "negative_values_possible": true,\n' +
    '    "missing_values": "null to create line gaps",\n' +
    '    "decimals": "preserve source precision; round for display only"\n' +
    '  }\n' +
    '}\n' +
    '\n' +
    'Please note that this is a template and the actual values for "points" in each "series" and for every "installation" need to be populated by following the steps described in tasks from the original task description. Even though the exact calculations per installation per date were not possible due to the task limitation (lack of raw data for all the installations), by applying the plan laid out, one could easily compute the data points for the series.',
  success: true,
  timestamp: 2025-09-16T02:17:58.155Z
}
`;

export const aggregatorResult_1_3 = `{
  agentName: 'Grid-Line Data Analyzer',
  result: '{\n' +
    '  "chart_type": "line",\n' +
    '  "x_values": ["11/02/2023","11/03/2023","11/04/2023","11/05/2023"],\n' +
    '  "date_range": { "start": "11/02/2023", "end": "11/05/2023" },\n' +
    '  "installations": ["KEPBG1","LRSF1","MLSP1","MLWF1","PALOONA","REPULSE","ROTALLA1","RPCG","SHOAL1","WAUBRAWF","WOOLNTH1","YAMBUKWF","YSWF1","BARCSF1","BUTLERSG","CAPTL_WF","CHALLHWF","CLOVER","CLUNY","CULLRGWF"],\n' +
    '  "installation_count": 20,\n' +
    '  "energy_sources": ["Battery","Solar","Wind","Hydro","Coal","Natural Gas"],\n' +
    '  "mw_range_raw": { "min": -0.006666666666666667, "max": 68.01666666666667 },\n' +
    '  "y_axis": {\n' +
    '    "unit": "MW/Hr",\n' +
    '    "domain": { "min": -5, "max": 70 },\n' +
    '    "tick_step": 15,\n' +
    '    "ticks": [-5, 10, 25, 40, 55, 70]\n' +
    '  },\n' +
    '  "series": [\n' +
    '    {\n' +
    '      "installation": "KEPBG1",\n' +
    '      "points": [\n' +
    '        { "date": "11/02/2023", "MW": null },\n' +
    '        { "date": "11/03/2023", "MW": 0.0 },\n' +
    '        { "date": "11/04/2023", "MW": null },\n' +
    '        { "date": "11/05/2023", "MW": null }\n' +
    '      ]\n' +
    '    },\n' +
    '    ...\n' +
    '  ],\n' +
    '  "notes": {\n' +
    '    "aggregation": "sum per installation per date",\n' +
    '    "negative_values_possible": true,\n' +
    '    "missing_values": "null to create line gaps",\n' +
    '    "decimals": "preserve source precision; round for display only"\n' +
    '  }\n' +
    '}',
  success: true,
  timestamp: 2025-09-16T02:18:16.104Z
}
`;

export const aggregatorResult_1_4 = `{
  agentName: 'Grid-Line Data Analyzer',
  result: '{\n' +
    '  "chart_type": "line",\n' +
    '  "x_values": ["11/02/2023","11/03/2023","11/04/2023","11/05/2023"],\n' +
    '  "date_range": { \n' +
    '      "start": "11/02/2023", \n' +
    '      "end": "11/05/2023" \n' +
    '  },\n' +
    '  "installations": ["DIAPURWF1", "ERGT01", "ERGTO1", "GBO1", "GRIFSF1", "HUGSF1", "KEPBG1", "LRSF1", "MLSP1", "MLWF1", "PALOONA", "REPULSE", "ROTALLA1", "RPCG", "SHOAL1", "WAUBRAWF", "WOOLNTH1", "YAMBUKWF", "YSWF1", "BARCSF1"],\n' +
    '  "installation_count": 20,\n' +
    '  "energy_sources": ["Wind", "Diesel", "Coal", "Solar", "Hydro", "Natural Gas"],\n' +
    '  "mw_range_raw": { \n' +
    '      "min": -0.1095, \n' +
    '      "max": 145.70458333333332 \n' +
    '  },\n' +
    '  "y_axis": {\n' +
    '    "unit": "MW/Hr",\n' +
    '    "domain": { \n' +
    '        "min": -1, \n' +
    '        "max": 150 \n' +
    '    },\n' +
    '    "tick_step": 30,\n' +
    '    "ticks": [-1, 0, 30, 60, 90, 120, 150]\n' +
    '  },\n' +
    '  "series": [\n' +
    '    // for each installation\n' +
    '    {\n' +
    '        "installation": "<installation_id>",\n' +
    '        "points": [\n' +
    '            {"date": "11/02/2023", "MW": null},\n' +
    '            {"date": "11/03/2023", "MW": null},\n' +
    '            {"date": "11/04/2023", "MW": <number|null>},\n' +
    '            {"date": "11/05/2023", "MW": <number|null>}\n' +
    '        ]\n' +
    '    },\n' +
    '    ....\n' +
    '  ],\n' +
    '  "notes": {\n' +
    '    "aggregation": "sum per installation per date",\n' +
    '    "negative_values_possible": true,\n' +
    '    "missing_values": "null to create line gaps",\n' +
    '    "decimals": "preserve source precision; round for display only"\n' +
    '  }\n' +
    '}',
  success: true,
  timestamp: 2025-09-16T02:18:36.308Z
}
`;

export const aggregatorResult_1_5 =  `{
  agentName: 'Grid-Line Data Analyzer',
  result: '{\n' +
    '  "chart_type": "line",\n' +
    '  "x_values": ["11/02/2023","11/03/2023","11/04/2023","11/05/2023"],\n' +
    '  "date_range": { "start": "11/02/2023", "end": "11/05/2023" },\n' +
    '  "installations": ["BUTLERSG","CAPTL_WF","CHALLHWF","CLOVER","CLUNY","CULLRGWF","DIAPURWF1","ERGT01","ERGTO1","GBO1","GRIFSF1","HUGSF1","KEPBG1","LRSF1","MLSP1","MLWF1","PALOONA","REPULSE","ROTALLA1","RPCG"],\n' +
    '  "installation_count": 20,\n' +
    '  "energy_sources": ["Hydro","Wind","Diesel","Solar","Coal"],\n' +
    '  "mw_range_raw": { "min": -1.1, "max": 25.20872 },\n' +
    '  "y_axis": {\n' +
    '    "unit": "MW/Hr",\n' +
    '    "domain": { "min": -5, "max": 30 },\n' +
    '    "tick_step": 5,\n' +
    '    "ticks": [-5, 0, 5, 10, 15, 20, 25, 30]\n' +
    '  },\n' +
    '  "series": [\n' +
    '    {\n' +
    '      "installation": "BUTLERSG",\n' +
    '      "points": [\n' +
    '        { "date": "11/02/2023", "MW": null },\n' +
    '        { "date": "11/03/2023", "MW": null },\n' +
    '        { "date": "11/04/2023", "MW": null },\n' +
    '        { "date": "11/05/2023", "MW": 9.391665583333333 }\n' +
    '      ]\n' +
    '    },\n' +
    '    {\n' +
    '      "installation": "CAPTL_WF",\n' +
    '      "points": [\n' +
    '        { "date": "11/02/2023", "MW": null },\n' +
    '        { "date": "11/03/2023", "MW": null },\n' +
    '        { "date": "11/04/2023", "MW": null },\n' +
    '        { "date": "11/05/2023", "MW": 25.20872 }\n' +
    '      ]\n' +
    '    },\n' +
    '    // . . .\n' +
    '    // [Repeat the above per-installation template for all other installations from the list, substituting actual MW values or null as per the data]\n' +
    '    // . . .\n' +
    '  ],\n' +
    '  "notes": {\n' +
    '    "aggregation": "sum per installation per date",\n' +
    '    "negative_values_possible": true,\n' +
    '    "missing_values": "null to create line gaps",\n' +
    '    "decimals": "preserve source precision; round for display only"\n' +
    '  }\n' +
    '}',
  success: true,
  timestamp: 2025-09-16T02:19:01.024Z
}`;

export const D3JSCoordinatingAgentFinalResult = ` {
  agentName: 'D3JSCoordinatingAgent',
  result: 'For the D3 Coding Agent\n' +
    '\n' +
    'Goal\n' +
    '- Build a multi-series line chart showing MW/Hr per installation across dates. CSV will be provided at runtime.\n' +
    '\n' +
    'Data schema (expected columns)\n' +
    '- date: string in format MM/DD/YYYY (e.g., "11/02/2023")\n' +
    '- installation: string (e.g., "BARCSF1")\n' +
    '- MW: number (may be negative; decimals present)\n' +
    '- energy_source: string (one of: Solar, Wind, Hydro, Diesel, Battery, Coal, Natural Gas)\n' +
    '\n' +
    'Parsing and aggregation\n' +
    '- Parse date with d3.timeParse("%m/%d/%Y").\n' +
    '- Aggregate to “sum per installation per date”.\n' +
    '- Create a complete date axis from the min to max date present in the file (unique sorted dates).\n' +
    '- For each installation, produce a series with one point per x-axis date; use null for missing values to create line gaps.\n' +
    '\n' +
    'X-axis\n' +
    '- Type: time scale.\n' +
    '- Default x_values (based on analysis): ["11/02/2023","11/03/2023","11/04/2023","11/05/2023"]\n' +
    '- Default date_range: start "11/02/2023", end "11/05/2023"\n' +
    '- At runtime, derive from CSV (do not rely on defaults if data differs).\n' +
    '\n' +
    'Y-axis\n' +
    '- Unit: MW/Hr\n' +
    '- Negative values are possible (keep zero baseline visible).\n' +
    '- Decimals: preserve source precision; round only for display (e.g., 2–3 decimals in tooltip/axis).\n' +
    '- From analyses, observed raw ranges:\n' +
    '  - min ≈ -0.193 to -0.0067\n' +
    '  - max ≈ 28.97, 46.83, 68.02, up to 145.70\n' +
    '- Provide a safe default domain and ticks when preconfiguring:\n' +
    '  - Default domain: [-1, 150]\n' +
    '  - Default ticks: [-1, 0, 30, 60, 90, 120, 150] (tick_step 30)\n' +
    '- Recommended runtime logic:\n' +
    '  - Compute minRaw, maxRaw over aggregated MW values.\n' +
    '  - If minRaw < 0, yMin = Math.min(-1, Math.floor(minRaw)); else yMin = 0.\n' +
    '  - yMax = “nice” round-up above maxRaw (e.g., to nearest 10/15/30 depending on magnitude).\n' +
    '  - Example heuristics (based on seen maxima):\n' +
    '    - maxRaw ≤ 30 → domain [-5, 30], step 5\n' +
    '    - 30 < maxRaw ≤ 50 → domain [-5, 50], step 10\n' +
    '    - 50 < maxRaw ≤ 70 → domain [-5, 70], step 15\n' +
    '    - maxRaw ≤ 150 → domain [-1, 150], step 30\n' +
    '\n' +
    'Chart and labels\n' +
    '- chart_type: line\n' +
    '- X label: Date\n' +
    '- Y label: MW/Hr\n' +
    '- Title (optional): MW/Hr by Installation over Time\n' +
    '\n' +
    'Series structure (for reference)\n' +
    '- For each installation:\n' +
    '  - { installation: "<id>", points: [ {date: <Date>, MW: <number|null>}, ... ] }\n' +
    '- Missing values should be null to render gaps.\n' +
    '\n' +
    'Known installation IDs observed (derive from data at runtime; list below can help pre-assign colors/order if present)\n' +
    '- BARCSF1, BUTLERSG, CAPTL_WF, CHALLHWF, CLOVER, CLUNY, CULLRGWF, DIAPURWF1, ERGT01, ERGTO1, GBO1, GRIFSF1, HUGSF1, KEPBG1, LRSF1, MLSP1, MLWF1, PALOONA, REPULSE, ROTALLA1, RPCG, SHOAL1, WAUBRAWF, WOOLNTH1, YAMBUKWF, YSWF1\n' +
    '\n' +
    'Energy sources and suggested color mapping (stable legend; use when energy_source present)\n' +
    '- Solar: #FDB714\n' +
    '- Wind: #2CA02C\n' +
    '- Hydro: #1F77B4\n' +
    '- Diesel: #7F7F7F\n' +
    '- Battery: #9467BD\n' +
    '- Coal: #8C564B\n' +
    '- Natural Gas: #17BECF\n' +
    '\n' +
    'Runtime robustness\n' +
    '- Trim and case-normalize headers if needed; allow mapping to expected keys {date, installation, MW, energy_source}.\n' +
    '- Coerce MW with Number(); treat non-numeric or empty as 0 during aggregation only if that reflects business rules; otherwise exclude and let missing roll up to null points.\n' +
    '- Ensure unique dates are aligned across all series so lines share the same x positions.\n' +
    '- Render a horizontal y=0 line for readability when negatives exist.\n' +
    '\n' +
    'Notes from analysis to honor\n' +
    '- Aggregation: sum per installation per date.\n' +
    '- negative_values_possible: true\n' +
    '- missing_values: null to create line gaps\n' +
    '- decimals: preserve source precision; round for display only.',
  success: true,
  timestamp: 2025-09-16T23:04:31.760Z
}`;

export const D3JSCodeingAgentReuslt = ``

export const d3ChallengeResult1 = `{
  agentName: 'D3AnalysisChallengingAgent',
  result: '{\n' +
    '  "success": false,\n' +
    '  "critique": [\n' +
    '    {\n' +
    '      "issue": "Ambiguous chart specification",\n' +
    '      "detail": "The report proposes possible approaches (multi-series lines vs totals-by-day bars) without committing to a single chart. A coding agent needs one definitive chart type and data schema."\n' +
    '    },\n' +
    '    {\n' +
    '      "issue": "Incomplete series for multi-series plot",\n' +
    '      "detail": "Series arrays are truncated and cannot support installation-level lines or stacked/grouped bars. Without full per-installation data, a multi-series chart is not implementable."\n' +
    '    },\n' +
    '    {\n' +
    '      "issue": "Inconsistent date formats and counts",\n' +
    '      "detail": "Cycles mix MM/DD/YYYY and ISO formats. Cycle_3 lists four xDomain dates but n_dates = 1. Cycle_3 also has total_rows 0 with processed_rows 20. These inconsistencies must be resolved or avoided by using a chart that depends only on normalized per-date totals."\n' +
    '    },\n' +
    '    {\n' +
    '      "issue": "Axis ticks and formatting ambiguous",\n' +
    '      "detail": "y-axis guidance mixes automatic and fixed ticks; 'tickFormatHint: auto-2dp is not a concrete D3 format string. A coding agent needs explicit tick values or a tick count and an exact format."\n" +
    '    },\n' +
    '    {\n' +
    '      "issue": "Missing axis labels, units, and legend guidance",\n' +
    '      "detail": "Units (MW) are mentioned but not specified as axis labels. No color scale or legend spec is provided if multiple series were intended."\n' +
    '    },\n' +
    '    {\n' +
    '      "issue": "Deduplication guidance is non-operational",\n' +
    '      "detail": "The report advises deduplication by (installation, date) but does not provide the actual keys or data needed to perform it. This is moot if we only chart per-date totals."\n' +
    '    },\n' +
    '    {\n' +
    '      "issue": "Negative values policy unclear",\n' +
    '      "detail": "Negative MW values exist at installation level, but the chosen chart type determines whether to include negatives. For totals-by-day bars, totals provided are non-negative; for lines, negatives must be displayed. The report does not fix this choice."\n' +
    '    }\n' +
    '  ],\n' +
    '  "recommended_spec": {\n' +
    '    "chart_type": "bar_daily_totals",\n' +
    '    "rationale": "Only per-date totals are reliably available without risk of duplication and without needing full installation series. This yields a clear, implementable 2D chart.",\n' +
    '    "data": [\n' +
    '      { "date": "2023-11-02", "total_mw": 69.91014775 },\n' +
    '      { "date": "2023-11-03", "total_mw": 154.96340849999997 },\n' +
    '      { "date": "2023-11-04", "total_mw": 335.03266120833333 },\n' +
    '      { "date": "2023-11-05", "total_mw": 93.56824208333334 }\n' +
    '    ],\n' +
    '    "x_axis": {\n' +
    '      "scale": "band",\n' +
    '      "domain": ["2023-11-02", "2023-11-03", "2023-11-04", "2023-11-05"],\n' +
    '      "tick_values": ["2023-11-02", "2023-11-03", "2023-11-04", "2023-11-05"],\n' +
    '      "tick_format": "%Y-%m-%d",\n' +
    '      "label": "Date"\n' +
    '    },\n' +
    '    "y_axis": {\n' +
    '      "scale": "linear",\n' +
    '      "domain": [0, 350],\n' +
    '      "tick_values": [0, 50, 100, 150, 200, 250, 300, 350],\n' +
    '      "tick_format": ".2f",\n' +
    '      "label": "Power (MW)"\n' +
    '    },\n' +
    '    "encoding": {\n' +
    '      "bar_color": "#4e79a7",\n' +
    '      "bar_padding_inner": 0.2,\n' +
    '      "bar_padding_outer": 0.1\n' +
    '    },\n' +
    '    "accessibility": {\n' +
    '      "title": "Total Power by Day (MW)",\n' +
    '      "subtitle": "Dates normalized to ISO (YYYY-MM-DD); totals derived from consolidated cycles",\n' +
    '      "aria_description": "A bar chart showing total MW for each date from 2023-11-02 to 2023-11-05."\n' +
    '    },\n' +
    '    "tooltips": {\n' +
    '      "format": {\n' +
    '        "date": "%Y-%m-%d",\n' +
    '        "value": ".2f"\n' +
    '      },\n' +
    '      "content": ["date", "total_mw"]\n' +
    '    },\n' +
    '    "notes": [\n' +
    '      "Per-date totals are assumed deduplicated; if cycles overlapped, upstream must deduplicate. Given current information, this is the safest renderable view.",\n' +
    '      "All dates are treated as categories; no timezone assumptions are required."\n' +
    '    ]\n' +
    '  },\n' +
    '  "alternative_spec_if_full_series_provided": {\n' +
    '    "chart_type": "multi_series_line",\n' +
    '    "requirements": [\n' +
    '      "Complete per-installation series data for each date",\n' +
    '      "Unique key (installation_id, date) for deduplication"\n' +
    '    ],\n' +
    '    "x_axis": {\n' +
    '      "scale": "time",\n' +
    '      "domain": ["2023-11-02", "2023-11-05"],\n' +
    '      "tick_format": "%Y-%m-%d",\n' +
    '      "label": "Date"\n' +
    '    },\n' +
    '    "y_axis": {\n' +
    '      "scale": "linear",\n' +
    '      "domain": [-1.1, 145.70458333333332],\n' +
    '      "ticks": "auto_nice",\n' +
    '      "tick_format": ".2f",\n' +
    '      "label": "Power (MW)"\n' +
    '    },\n' +
    '    "series": {\n' +
    '      "color_by": "energy_source_or_installation",\n' +
    '      "missing_values": "null_breaks_line"\n' 
    '    }\n' +
    '  },\n' +
    '  "open_questions": [\n' +
    '    "Confirm the intended chart: is a totals-by-day bar chart acceptable given missing series data?",\n' +
    '    "Should y-axis ticks be fixed as provided or use a specific count (e.g., 7) with nice()?",\n' +
    '    "Any preference on color palette or branding guidelines?",\n' +
    '    "Do you require data labels on bars, and if so, at what precision?"\n' +
    '  ]\n' +
    '}',
  success: true,
  timestamp: 2025-09-11T08:45:38.567Z
}`

export const d3CoordinatorChallengeResponse = `{
  agentName: 'D3JSCoordinatingAgent',
  result: '{\n' +
    '  "agentName": "D3JSCoordinatingAgent",\n' +
    '  "result": {\n' +
    '    "decision": "Render a single 2D bar chart of daily totals. Multi-series views are deferred until complete per-installation series are available.",\n' +
    '    "chart_spec": {\n' +
    '      "chart_type": "bar_daily_totals",\n' +
    '      "accessibility": {\n' +
    '        "title": "Total Power by Day (MW)",\n' +
    '        "subtitle": "Dates normalized to ISO (YYYY-MM-DD); totals consolidated across cycles",\n' +
    '        "aria_description": "A bar chart showing total MW for each date from 2023-11-02 to 2023-11-05."\n' +
    '      },\n' +
    '      "data": [\n' +
    '        { "date": "2023-11-02", "total_mw": 69.91014775 },\n' +
    '        { "date": "2023-11-03", "total_mw": 154.96340849999997 },\n' +
    '        { "date": "2023-11-04", "total_mw": 335.03266120833333 },\n' +
    '        { "date": "2023-11-05", "total_mw": 93.56824208333334 }\n' +
    '      ],\n' +
    '      "x_axis": {\n' +
    '        "scale": "band",\n' +
    '        "domain": ["2023-11-02", "2023-11-03", "2023-11-04", "2023-11-05"],\n' +
    '        "tick_values": ["2023-11-02", "2023-11-03", "2023-11-04", "2023-11-05"],\n' +
    '        "tick_format": "%Y-%m-%d",\n' +
    '        "label": "Date"\n' +
    '      },\n' +
    '      "y_axis": {\n' +
    '        "scale": "linear",\n' +
    '        "domain": [0, 350],\n' +
    '        "tick_values": [0, 50, 100, 150, 200, 250, 300, 350],\n' +
    '        "tick_format": ".2f",\n' +
    '        "label": "Power (MW)"\n' +
    '      },\n' +
    '      "encoding": {\n' +
    '        "bar_color": "#4e79a7",\n' +
    '        "bar_padding_inner": 0.2,\n' +
    '        "bar_padding_outer": 0.1\n' +
    '      },\n' +
    '      "tooltips": {\n' +
    '        "format": { "date": "%Y-%m-%d", "value": ".2f" },\n' +
    '        "fields": ["date", "total_mw"]\n' +
    '      },\n' +
    '      "notes": [\n' +
    '        "Per-date totals are used to avoid inconsistencies and missing series; treat dates as categorical labels.",\n' +
    '        "Negative installation-level values are not displayed here; totals provided are non-negative.",\n' +
    '        "Upstream should ensure totals are deduplicated if cycles overlap."\n' +
    '      ]\n' +
    '    }\n' +
    '  },\n' +
    '  "success": true,\n' +
    '  "timestamp": "2025-09-11T00:00:00.000Z"\n' +
    '}',
  success: true,
  timestamp: 2025-09-11T21:57:30.746Z
}`

export const d3CoordinatorChallengeResponse1 = `{
  agentName: 'D3JSCoordinatingAgent',
  result: Agent: D3 Coding Agent\n +
    'Objective: Implement a 2D multi-line chart (one series per installation) from CSV with correct data processing, zero-filling, energy source mode, and y-axis computed via nice-step. Output must match the specified shape.\n' +
    '\n' +
    'Chart type\n' +
    '- multi_line_per_installation\n' +
    '\n' +
    'xDomain\n' +
    '- ["2023-11-02", "2023-11-03", "2023-11-04", "2023-11-05"] (fixed order)\n' +
    '\n' +
    'Input columns\n' +
    '- date/time (format: MM/DD/YYYY)\n' +
    '- installation (string)\n' +
    '- energy_source (string)\n' +
    '- MW (number; may be negative, zero, or positive)\n' +
    '\n' +
    'Data processing\n' +
    '- Parse date/time with input format and normalize to output format YYYY-MM-DD.\n' +
    '- Keep only rows whose normalized date is in xDomain.\n' +
    '- Keep negative and zero MW values.\n' +
    '- Skip rows where MW is non-numeric; count them.\n' +
    '- For each (installation, date), sum MW over duplicate rows.\n' +
    '- Determine energy_source per installation as the statistical mode across its processed rows; on tie, use "Mixed".\n' +
    '- For each installation, ensure exactly four values ordered by xDomain; fill missing dates with mw = 0.\n' +
    '- Compute per_installation_totals = sum of its four mw values.\n' +
    '- Compute per_date_totals = sum across installations per date.\n' +
    '\n' +
    'Series construction\n' +
    '- Each series item: { id: installation, energy_source: derived or "Mixed", values: [{ date: "YYYY-MM-DD", mw: number }] } with exactly four values in xDomain order.\n' +
    '- Sort series descending by per_installation_totals.\n' +
    '\n' +
    'Y-axis rules\n' +
    '- Collect all mw across all series values (after zero-fill).\n' +
    '- global_min = min(all mw), global_max = max(all mw).\n' +
    '- If global_min == global_max:\n' +
    '  - epsilon = max(0.01 * abs(global_max), 1.0).\n' +
    '  - y_min = global_min - epsilon; y_max = global_max + epsilon.\n' +
    '  - Else: y_min = global_min; y_max = global_max.\n' +
    '- target_tick_count = 6.\n' +
    '- Nice-step algorithm:\n' +
    '  - raw_step = (y_max - y_min) / target_tick_count.\n' +
    '  - k = floor(log10(abs(raw_step))) (handle raw_step == 0 by using k = 0).\n' +
    '  - base = 10^k.\n' +
    '  - multipliers = [1, 2, 2.5, 5, 10].\n' +
    '  - m = smallest multiplier >= raw_step / base; if none, use 10.\n' +
    '  - nice_step = m * base.\n' +
    '  - y_min_nice = floor(y_min / nice_step) * nice_step.\n' +
    '  - y_max_nice = ceil(y_max / nice_step) * nice_step.\n' +
    '  - y_ticks = sequence from y_min_nice to y_max_nice inclusive with step nice_step.\n' +
    '- tickFormatHint:\n' +
    '  - If abs(y_max_nice) < 1 or nice_step < 1 -> "auto-3dp"\n' +
    '  - Else if nice_step < 10 -> "auto-2dp"\n' +
    '  - Else -> "auto-0dp"\n' +
    '\n' +
    'Output shape\n' +
    '- {\n' +
    '    xDomain: ["2023-11-02","2023-11-03","2023-11-04","2023-11-05"],\n' +
    '    series: Array<{ id: string, energy_source: string, values: Array<{ date: string, mw: number }> }>,\n' +
    '    yDomain: [y_min_nice, y_max_nice],\n' +
    '    yTicks: Array<number>,\n' +
    '    tickFormatHint: string,\n' +
    '    stats: {\n' +
    '      counts: {\n' +
    '        total_rows: number,\n' +
    '        processed_rows: number,\n' +
    '        n_installations: number,\n' +
    '        n_energy_sources: number,\n' +
    '        n_dates: 4\n' +
    '      },\n' +
    '      per_date_totals: { [date: string]: number },\n' +
    '      per_installation_totals: { [installation: string]: number },\n' +
    '      extrema: {\n' +
    '        global_min: number,\n' +
    '        global_max: number,\n' +
    '        min_point: { installation: string, date: string, mw: number },\n' +
    '        max_point: { installation: string, date: string, mw: number }\n' +
    '      },\n' +
    '      data_quality: {\n' +
    '        skipped_rows: number,               // non-numeric MW\n' +
    '        out_of_scope_date_rows: number      // dates not in xDomain\n' +
    '      }\n' +
    '    }\n' +
    '  }\n' +
    '\n' +
    'D3 implementation notes\n' +
    '- X-axis: either\n' +
    '  - time scale: parse YYYY-MM-DD to Date objects for x positions; ticks formatted as YYYY-MM-DD; or\n' +
    '  - point/band scale with string xDomain; keep labels as provided.\n' +
    - Ensure each series has four points (post zero-fill) to draw continuous lines across the four x positions.\n' +
    '- Legend order = series sorted by per_installation_totals descending.\n' +
    '\n' +
    Acceptance checklist\n' +
    '- Exactly four x-axis categories in order.\n' +
    '- Each installation has four values (zeros filled where missing).\n' +
    '- Y-domain includes negatives if present; computed via nice-step (~6 ticks).\n' +
    '- Series include energy_source derived by mode or "Mixed".\n' +
     Output includes xDomain, series, yDomain, yTicks, tickFormatHint, and stats.`

export const d3jsCodeUpdateResult = ` {
  agentName: 'VisualizationCoordinatingAgent',
  result: '[AGENT: D3 Line Chart Interaction Analyst, D3-LINE-ANALYST-01]\n' +
    'Your task\n' +
    '- You will receive d3.js code for a multi-series line chart depicting MW per hour of electricity from multiple energy suppliers over a 4-year period. The chart includes a legend mapping each supplie
r to a line.\n' +
    '- The user requirement: Clicking a legend item toggles the corresponding line to appear more luminous (on/off switch). No other behavior changes unless specified.\n' +
    '\n' +
    'What to analyze in the provided code\n' +
    '1) Line rendering\n' +
    '   - How each series/line is created: element type (e.g., path), grouping structure, and where data is bound.\n' +
    '   - How series identity is encoded: keys, ids, classes, or data attributes that link a line to a supplier.\n' +
    '   - Styling approach: how color, stroke width, opacity, and filters are assigned (inline styles, CSS classes, scales).\n' +
    '   - Any existing state classes (e.g., selected, active, hidden) that might be reused.\n' +
    '\n' +
    '2) Legend construction\n' +
    '   - How legend items are generated: data join, element structure (group/rect/text), and series identity carried on legend items.\n' +
    '   - Event handling currently present on legend items (hover, click, show/hide).\n' +
    '   - Visual indication of legend item state (e.g., bold text, swatch border) and how it is applied.\n' +
    '\n' +
    '3) Interaction wiring\n' +
    '   - The mechanism to map a legend item to its corresponding line(s).\n' +
    '   - Existing interaction patterns you must not break (e.g., filtering, hover highlight).\n' +
    '   - Where in the codebase interactions are attached (initialization vs. update cycle) to ensure state persists across updates/resizes.\n' +
    '\n' +
    'Your deliverables (no code; outline only)\n' +
    '1) Summary findings to assist the coding agent\n' +
    '   - Describe succinctly how lines are created and identified.\n' +
    '   - Describe succinctly how legend items are created and how they map to lines.\n' +
    '   - Identify the best attachment point for the legend click handler and how to access the corresponding line selection.\n' +
    '   - Identify the existing styling hooks that can be leveraged to create a luminous look, and any gaps to fill.\n' +
    '\n' +
    '2) Clear, concise implementation requirements to toggle line luminosity via legend click\n' +
    '   Provide a step-by-step outline that covers:\n' +
    '   - State management\n' +
    '     - How to represent the on/off highlight state per series (e.g., a boolean flag in data or a DOM class on both legend item and line).\n' +
    '     - Default state on load (all off).\n' +
    '     - Behavior on repeated clicks: toggle that series only; do not affect other series unless otherwise required.\n' +
    '   - Selection mapping\n' +
    '     - Reliable way to reference the specific line(s) from a legend item using the series key/id that exists in both.\n' +
    '   - Visual treatment for “luminous” state\n' +
    '     - Define what “more luminous” means in this chart’s context, such as:\n' +
    '       - Increased stroke brightness relative to its base color.\n' +
    '       - Increased stroke width for emphasis.\n' +
    '       - Higher opacity for the highlighted line and reduced opacity for non-highlighted lines only if desirable and non-destructive to comparison.\n' +
    '       - Optional halo/glow effect using a non-destructive visual cue that contrasts well against the background.\n' +
    '     - Specify that the treatment must be reversible and consistent across redraws.\n' +
    '   - Legend feedback\n' +
    '     - Toggle a clear visual indicator on the legend item when active (e.g., bold label, highlighted swatch, or marker) aligned with existing styling conventions.\n' +
    '   - Accessibility and usability\n' +
    '     - Ensure keyboard accessibility for toggling via legend (e.g., focusable items with Enter/Space support).\n' +
    '     - Provide ARIA/state indication updates where applicable.\n' +
    '     - Maintain sufficient contrast for the luminous state.\n' +
    '   - Integration and lifecycle\n' +
    '     - Where to add event binding so it survives data updates, transitions, and responsive redraws.\n' +
    '     - Ensure transitions, if any, are consistent and do not conflict with existing animations.\n' +
    '     - Confirm the behavior with any existing legend interactions (e.g., if legend already filters/hides, decide precedence or combine behaviors).\n' +
    '   - Performance and robustness\n' +
    '     - Avoid expensive recalculations; rely on class/state toggles rather than full re-render.\n' +
    '     - Handle datasets with many series without interaction lag.\n' +
    '\n' +
    'Assumptions and decisions to clarify (note any that apply in your findings)\n' +
    '- Single vs. multiple concurrent highlights: default to independent toggles per legend item (allow multiple lines to be highlighted simultaneously).\n' +
    '- Whether non-highlighted lines should be dimmed when any highlight is active; if this is not desired, all non-highlighted lines remain unchanged.\n' +
    '- Whether clicking an already highlighted legend item turns it off (required) and what happens if all are off (normal baseline view).\n' +
    '- Interaction priority if legend currently controls visibility: highlighting should not hide lines; if both exist, specify combined rules.\n' +
    '\n' +
    'Acceptance criteria for the coding agent\n' +
    '- Clicking a legend item toggles the corresponding line’s luminous state on/off.\n' +
    '- The luminous state is visually distinct, accessible, and consistent after chart updates/resizes.\n' +
    '- Legend items visibly reflect their line’s current state.\n' +
    '- Multiple series can be highlighted independently unless otherwise specified.\n' +
    '- No code regressions to existing interactions or performance.\n' +
    '\n' +
    'Output format you must produce\n' +
    '- Section 1: Summary findings (concise bullets).\n' +
    '- Section 2: Implementation requirements (ordered steps with bullets for each step).\n' +
    '- Section 3: Assumptions/decisions and any open questions if the code reveals ambiguities.\n' +
    '\n' +
    'Constraints\n' +
    '- Do not include code or API calls; provide only analysis and step-by-step guidance.\n' +
    '- Keep recommendations specific to the observed code structure and naming where possible.\n' +
    '\n' +
    'Quality checklist before submitting\n' +
    '- Mapping between legend items and lines is clearly explained.\n' +
    '- State representation and toggling behavior are unambiguous.\n' +
    '- Visual specification for “luminous” is actionable without prescribing exact code.\n' +
    '- Accessibility and persistence across updates are addressed.\n' +
    '- Edge cases and conflicts with existing behavior are considered.\n' +
    '[/AGENT]',
  success: true,
  timestamp: 2025-09-29T20:44:07.094Z
} `;

export const validationFixedSyntaxResult = ` {
  agentName: 'ValidatingAgent',
  result: '{\n' +
    '  "success": false,\n' +
    '  "errors": [\n' +
    '    "Agents are not delimited with the required [AGENT: name, id] ... [/AGENT] tags.",\n' +
    '    "Some task details deviate from the user’s specification (e.g., CSV path must be C:/repos/SAGAMiddleware/data/two_days.csv)."\n' +
    '  ],\n' +
    '"solution": "[AGENT: Energy CSV Coding Agent, ECGA-01]\\nYou are a coding agent. Your task is to output a complete, runnable Python script that reads an Excel-exported CSV and normalizes it into a long-format table with columns: date/time, installation, energy_source, MW.\\n\\nContext and input details:\\n- CSV file path: C:/repos/SAGAMiddleware/data/two_days.csv\\n- The first row contains merged category labels (e.g., Solar, Wind, etc.) represented by commas spanning cells; the second row contains the actual column headers (e.g., date/time, BARCSF1, GRIFSF1, ...).\\n- Use the second row as headers when reading the CSV.\\n- Sample first 3 rows to illustrate structure:\\n,,,Solar,,,,,,,,Wind,,,,,Natural Gas,,,Hydro,,,,,Diseal,,Battry,Coal,\\ndate/time,BARCSF1,GRIFSF1,HUGSF1,LRSF1,MLSP1,ROTALLA1,CAPTL_WF,CHALLHWF,CULLRGWF,DIAPURWF1,MLWF1,WAUBRAWF,WOOLNTH1,YAMBUKWF,YSWF1,SHOAL1,BUTLERSG,CLOVER,CLUNY,PALOONA,REPULSE,ROWALLAN,RUBICON,ERGT01,GBO1,KEPBG1,ERGTO1,RPCG\\n11/02/2023 4:00,0.1,0.001526,-0.176,0.005,0.037,0,6.685649,26.2,11.83,,1.335,0,55.12,2,1.8,22,9.399999,0,9.957885,0,15.1632,0,0,0,0,0,0,16.3\\n\\nMapping between energy sources and installation columns (use exactly as provided):\\ncategoryMapping = {\\n  'Solar': ['BARCSF1', 'GRIFSF1', 'HUGSF1', 'LRSF1', 'MLSP1', 'ROTALLA1'],\\n  'Wind': ['CAPTL_WF', 'CHALLHWF', 'CULLRGWF', 'DIAPURWF1', 'MLWF1', 'WAUBRAWF', 'WOOLNTH1', 'YAMBUKWF', 'YSWF1'],\\n  'Natural Gas': ['SHOAL1'],\\n  'Hydro': ['BUTLERSG', 'CLOVER', 'CLUNY', 'PALOONA', 'REPULSE'],\\n  'Diesel': ['ERGT01', 'GBO1'],\\n  'Battery': ['KEPBG1'],\\n  'Coal': ['ERGTO1', 'RPCG']\\n}\\n\\nScript requirements and behavior:\\n- Read the CSV with pandas using the second row as the header (header=1). Strip whitespace from column names to match date/time exactly.\\n- Use categoryMapping to associate each installation column with an energy_source. Create a reverse map for installation -> energy_source.\\n- Be robust to missing columns: if any mapped installation column is absent in the CSV, skip it gracefully without failing.\\n- Reshape the data to long format with columns exactly: date/time, installation, energy_source, MW.\\n  - Keep the original date/time string format (do not reformat dates).\\n  - Convert MW values to numeric using pandas to_numeric with errors='coerce'.\\n- Sort the result by date/time and installation.\\n- The output should be a unified long-format table representing each installation’s MW by time and energy source (e.g., a row like: 11/02/2023 4:00,BARCSF1,solar,0.1). Writing to a CSV file is acceptable but not required; printing to stdout is acceptable.\\n- Include all necessary imports; the script must be runnable as-is (may include if __name__ == '__main__').\\n\\nABSOLUTE REQUIREMENTS:\\n- Output ONLY Python code\\n- First character must be Python code (import, def, or variable)\\n- Last character must be Python code\\n- Zero explanatory text\\n- Zero markdown\\n[/AGENT]\\n\\n[AGENT: MCP Python Tool Caller, MPTC-01]\\nYou are a tool-calling agent. Your task is to call the MCP server to execute the Python code produced by the coding agent.\\n\\nPerform exactly this JSON-RPC 2.0 request to the MCP server, calling the execute_python tool:\\n{\\n  \\"jsonrpc\\": \\"2.0\\",\\n  \\"id\\": 3,\\n  \\"method\\": \\"tools/call\\",\\n  \\"params\\": {\\n    \\"name\\": \\"execute_python\\",\\n    \\"arguments\\": {\\n      \\"code\\": {code}\\n    }\\n  }\\n}\\n\\nInstructions:\\n- Replace {code} with the exact Python code generated by the coding agent.\\n- Ensure the code is passed as the value of the \\"code\\" field.\\n- Do not modify \\"jsonrpc\\", \\"id\\", \\"method\\", or \\"name\\".\\n- Do not add any extra commentary or fields to the request.\\n- Do not add orchestration; only perform the specified tool call.\\n[/AGENT]"\n+
    '}',
  success: true,
  timestamp: 2025-10-02T21:44:29.436Z
}`

export const flowDefiningAgentResult_ = `{
  agentName: 'FlowDefiningAgent',
  result: '<!DOCTYPE html>\n' +
    '<html>\n' +
    '  <head>\n' +
    '    <meta charset="utf-8" />\n' +
    '    <title>Agent Flow</title>\n' +
    '  </head>\n' +
    '  <body>\n' +
    '    <flow>ECGA-01 -> MPTC-01</flow>\n' +
    '    {"toolUsers": ["MCP Python Tool Caller"]}\n' +
    '  </body>\n' +
    '</html>',
  success: true,
  timestamp: 2025-10-03T04:33:30.405Z
}`

export const flowDefiningAgentResult = `
{
  agentName: 'FlowDefiningAgent',
  result: '<!DOCTYPE html>\n' +
    '<html>\n' +
    '  <head>\n' +
    '    <meta charset="UTF-8" />\n' +
    '    <title>Agent Flow and Tool Users</title>\n' +
    '  </head>\n' +
    '  <body>\n' +
    '    <div><flow>agent_001 -> agent_002 -> agent_003 -> agent_004 -- agent_005</flow></div>\n' +
    '    <div>{"toolUsers": ["Data Loader", "Data Filter", "Data Transformer", "Data Aggregator", "Data Exporter"]}</div>\n' +
    '  </body>\n' +
    '</html>',
  success: true,
  timestamp: 2025-10-26T04:14:06.736Z
}
`

export const genReflectSVGResult = `{
  agentName: 'GeneratingAgent',
  result: '{\n' +
    '  "success": true,\n' +
    '  "interpretation": {\n' +
    '    "chart": {\n' +
    '      "title": "MW/Hr by Installation over Time",\n' +
    '      "size": {\n' +
    '        "width": 1000,\n' +
    '        "height": 630\n' +
    '      },\n' +
    '      "plot_area": {\n' +
    '        "translate": [70, 50],\n' +
    '        "inner_size": {\n' +
    '          "width": 900,\n' +
    '          "height": 370\n' +
    '        }\n' +
    '      },\n' +
    '      "type": "multi-series line chart",\n' +
    '      "units": "MW/Hr"\n' +
    '    },\n' +
    '    "axes": {\n' +
    '      "x": {\n' +
    '        "label": "Date",\n' +
    '        "domain_pixels": [0.5, 900.5],\n' +
    '        "ticks": [\n' +
    '          {"x": 0.5, "label": "11/02/2023"},\n' +
    '          {"x": 300.5, "label": "11/03/2023"},\n' +
    '          {"x": 600.5, "label": "11/04/2023"},\n' +
    '          {"x": 900.5, "label": "11/05/2023"}\n' +
    '        ],\n' +
    '        "label_rotation_deg": -35,\n' +
    '        "tick_anchor": "end",\n' +
    '        "x_to_date_map_pixels": {\n' +
    '          "0": "11/02/2023",\n' +
    '          "300": "11/03/2023",\n' +
    '          "600": "11/04/2023",\n' +
    '          "900": "11/05/2023"\n' +
    '        }\n' +
    '      },\n' +
    '      "y": {\n' +
    '        "label": "MW/Hr",\n' +
    '        "domain_value_range": [-20, 160],\n' +
    '        "domain_pixels": [370.5, 0.5],\n' +
    '        "ticks": [\n' +
    '          {"y": 370.5, "value": -20},\n' +
    '          {"y": 329.3888888889, "value": 0},\n' +
    '          {"y": 288.2777777778, "value": 20},\n' +
    '          {"y": 247.1666666667, "value": 40},\n' +
    '          {"y": 206.0555555556, "value": 60},\n' +
    '          {"y": 164.9444444444, "value": 80},\n' +
    '          {"y": 123.8333333333, "value": 100},\n' +
    '          {"y": 82.7222222222, "value": 120},\n' +
    '          {"y": 41.6111111111, "value": 140},\n' +
    '          {"y": 0.5, "value": 160}\n' +
    '        ],\n' +
    '        "pixel_to_value": "value = (329.3888888889 - y) / 2.0555555556"\n' +
    '      },\n' +
    '      "gridlines": [\n' +
    '        {"orientation": "horizontal", "y": 328.8888888889, "stroke_dasharray": "4,3", "meaning": "approximate 0 baseline"}\n' +
    '      ]\n' +
    '    },\n' +
    '    "legend": [\n' +
    '      {"name": "BARCSF1", "color": "#FDB714"},\n' +
    '      {"name": "BUTLERSG", "color": "#1F77B4"},\n' +
    '      {"name": "CAPTL_WF", "color": "#2CA02C"},\n' +
    '      {"name": "CHALLHWF", "color": "#2CA02C"},\n' +
    '      {"name": "CLOVER", "color": "#1F77B4"},\n' +
    '      {"name": "CLUNY", "color": "#1F77B4"},\n' +
    '      {"name": "CULLRGWF", "color": "#2CA02C"},\n' +
    '      {"name": "DIAPURWF1", "color": "#2CA02C"},\n' +
    '      {"name": "ERGT01", "color": "#7F7F7F"},\n' +
    '      {"name": "ERGTO1", "color": "#8C564B"},\n' +
    '      {"name": "GBO1", "color": "#7F7F7F"},\n' +
    '      {"name": "GRIFSF1", "color": "#FDB714"},\n' +
    '      {"name": "HUGSF1", "color": "#FDB714"},\n' +
    '      {"name": "KEPBG1", "color": "#9467BD"},\n' +
    '      {"name": "LRSF1", "color": "#FDB714"},\n' +
    '      {"name": "MLSP1", "color": "#FDB714"},\n' +
    '      {"name": "MLWF1", "color": "#2CA02C"},\n' +
    '      {"name": "PALOONA", "color": "#1F77B4"},\n' +
    '      {"name": "REPULSE", "color": "#1F77B4"},\n' +
    '      {"name": "ROTALLA1", "color": "#FDB714"},\n' +
    '      {"name": "RPCG", "color": "#8C564B"},\n' +
    '      {"name": "SHOAL1", "color": "#17BECF"},\n' +
    '      {"name": "WAUBRAWF", "color": "#2CA02C"},\n' +
    '      {"name": "WOOLNTH1", "color": "#2CA02C"},\n' +
    '      {"name": "YAMBUKWF", "color": "#2CA02C"},\n' +
    '      {"name": "YSWF1", "color": "#2CA02C"}\n' +
    '    ],\n' +
    '    "series_mapping_method": "Legend order matches path order; colors are reused across multiple series, so order is used to disambiguate.",\n' +
    '    "series": [\n' +
    '      {"name": "BARCSF1", "color": "#FDB714", "points": [{"x": 0, "y": 328.683}, {"x": 300, "y": 328.889}, {"x": 600, "y": 328.683}, {"x": 900, "y": 328.889}]},\n' +
    '      {"name": "BUTLERSG", "color": "#1F77B4", "points": [{"x": 0, "y": 309.567}, {"x": 300, "y": 309.584}, {"x": 600, "y": 309.584}, {"x": 900, "y": 309.584}]},\n' +
    '      {"name": "CAPTL_WF", "color": "#2CA02C", "points": [{"x": 0, "y": 312.903}, {"x": 300, "y": 328.889}, {"x": 600, "y": 274.983}, {"x": 900, "y": 277.071}]},\n' +
    '      {"name": "CHALLHWF", "color": "#2CA02C", "points": [{"x": 0, "y": 280.035}, {"x": 300, "y": 260.576}, {"x": 600, "y": 272.635}, {"x": 900, "y": 298.278}]},\n' +
    '      {"name": "CLOVER", "color": "#1F77B4", "points": [{"x": 0, "y": 328.906}, {"x": 300, "y": 328.599}, {"x": 600, "y": 328.903}, {"x": 900, "y": 328.901}]},\n' +
    '      {"name": "CLUNY", "color": "#1F77B4", "points": [{"x": 0, "y": 291.443}, {"x": 300, "y": 316.29}, {"x": 600, "y": 308.698}, {"x": 900, "y": 312.017}]},\n' +
    '      {"name": "CULLRGWF", "color": "#2CA02C", "points": [{"x": 0, "y": 309.25}, {"x": 300, "y": 313.286}, {"x": 600, "y": 292.948}, {"x": 900, "y": 284.318}]},\n' +
    '      {"name": "DIAPURWF1", "color": "#2CA02C", "points": [], "note": "no path data"},\n' +
    '      {"name": "ERGT01", "color": "#7F7F7F", "points": [{"x": 0, "y": 328.889}, {"x": 300, "y": 328.889}, {"x": 600, "y": 328.889}, {"x": 900, "y": 328.889}]},\n' +
    '      {"name": "ERGTO1", "color": "#8C564B", "points": [{"x": 0, "y": 328.889}, {"x": 300, "y": 328.889}]},\n' +
    '      {"name": "GBO1", "color": "#7F7F7F", "points": [{"x": 0, "y": 328.889}, {"x": 300, "y": 328.889}, {"x": 600, "y": 328.889}, {"x": 900, "y": 301.735}]},\n' +
    '      {"name": "GRIFSF1", "color": "#FDB714", "points": [{"x": 0, "y": 328.886}, {"x": 300, "y": 328.886}, {"x": 600, "y": 328.886}, {"x": 900, "y": 328.886}]},\n' +
    '      {"name": "HUGSF1", "color": "#FDB714", "points": [{"x": 0, "y": 329.251}, {"x": 300, "y": 329.286}, {"x": 600, "y": 329.114}, {"x": 900, "y": 329.016}]},\n' +
    '      {"name": "KEPBG1", "color": "#9467BD", "points": [{"x": 0, "y": 328.889}, {"x": 300, "y": 328.889}, {"x": 600, "y": 328.889}, {"x": 900, "y": 328.889}]},\n' +
    '      {"name": "LRSF1", "color": "#FDB714", "points": [{"x": 0, "y": 328.879}, {"x": 300, "y": 328.881}, {"x": 600, "y": 328.909}, {"x": 900, "y": 328.84}]},\n' +
    '      {"name": "MLSP1", "color": "#FDB714", "points": [{"x": 0, "y": 328.813}, {"x": 300, "y": 328.885}, {"x": 600, "y": 328.796}, {"x": 900, "y": 328.889}]},\n' +
    '      {"name": "MLWF1", "color": "#2CA02C", "points": [{"x": 0, "y": 324.917}, {"x": 300, "y": 311.476}, {"x": 600, "y": 312.383}, {"x": 900, "y": 317.594}]},\n' +
    '      {"name": "PALOONA", "color": "#1F77B4", "points": [{"x": 0, "y": 328.889}, {"x": 300, "y": 277.724}, {"x": 600, "y": 297.85}, {"x": 900, "y": 326.042}]},\n' +
    '      {"name": "REPULSE", "color": "#1F77B4", "points": [{"x": 0, "y": 269.332}, {"x": 300, "y": 309.469}, {"x": 600, "y": 297.427}, {"x": 900, "y": 301.533}]},\n' +
    '      {"name": "ROTALLA1", "color": "#FDB714", "points": [{"x": 0, "y": 328.889}, {"x": 300, "y": 328.889}, {"x": 600, "y": 328.889}, {"x": 900, "y": 328.889}]},\n' +
    '      {"name": "RPCG", "color": "#8C564B", "points": [{"x": 0, "y": 298.227}, {"x": 300, "y": 298.467}, {"x": 600, "y": 300.831}, {"x": 900, "y": 331.15}]},\n' +
    '      {"name": "SHOAL1", "color": "#17BECF", "points": [{"x": 0, "y": 283.667}, {"x": 300, "y": 283.667}, {"x": 600, "y": 283.667}, {"x": 900, "y": 283.667}]},\n' +
    '      {"name": "WAUBRAWF", "color": "#2CA02C", "points": [{"x": 0, "y": 328.889}, {"x": 300, "y": 328.889}, {"x": 600, "y": 29.385}, {"x": 900, "y": 127.61}]},\n' +
    '      {"name": "WOOLNTH1", "color": "#2CA02C", "points": [{"x": 0, "y": 232.626}, {"x": 300, "y": 189.077}, {"x": 600, "y": 250.932}, {"x": 900, "y": 329.778}]},\n' +
    '      {"name": "YAMBUKWF", "color": "#2CA02C", "points": [{"x": 0, "y": 326.063}, {"x": 300, "y": 304.0}, {"x": 600, "y": 282.091}, {"x": 900, "y": 304.856}]},\n' +
    '      {"name": "YSWF1", "color": "#2CA02C", "points": [{"x": 0, "y": 326.902}, {"x": 300, "y": 318.114}, {"x": 600, "y": 319.313}, {"x": 900, "y": 322.568}]}\n' +
    '    ],\n' +
    '    "notes": [\n' +
    '      "X-axis labels are rotated -35 degrees for readability.",\n' +
    '      "Multiple legend entries share colors; series identification is by legend order.",\n' +
    '      "Dashed horizontal line marks the zero baseline approximately at y ≈ 328.889 px."\n' +
    '    ]\n' +
    '  }\n' +
    '}',
  success: true,
  timestamp: 2025-10-08T23:27:07.479Z
}`

export const genReflectSVGResult_1 = `{
  agentName: 'GeneratingAgent',
  result: '{\n' +
    '  "success": true,\n' +
    '  "interpretation": {\n' +
    '    "file_path": "C:\\\\repos\\\\SAGAMiddleware\\\\output\\\\d3-visualizations\\\\D3JSCodingAgent-output.svg",\n' +
    '    "chart_title": "MW/Hr by Installation over Time",\n' +
    '    "svg_size": {\n' +
    '      "width": 1000,\n' +
    '      "height": 630\n' +
    '    },\n' +
    '    "plot_group_transform": {\n' +
    '      "translate": [70, 50]\n' +
    '    },\n' +
    '    "plot_area": {\n' +
    '      "width": 900,\n' +
    '      "height": 370\n' +
    '    },\n' +
    '    "axes": {\n' +
    '      "x": {\n' +
    '        "label": "Date",\n' +
    '        "ticks": [\n' +
    '          {\n' +
    '            "x": 0.5,\n' +
    '            "label": "11/02/2023",\n' +
    '            "rotation": -35\n' +
    '          },\n' +
    '          {\n' +
    '            "x": 300.5,\n' +
    '            "label": "11/03/2023",\n' +
    '            "rotation": -35\n' +
    '          },\n' +
    '          {\n' +
    '            "x": 600.5,\n' +
    '            "label": "11/04/2023",\n' +
    '            "rotation": -35\n' +
    '          },\n' +
    '          {\n' +
    '            "x": 900.5,\n' +
    '            "label": "11/05/2023",\n' +
    '            "rotation": -35\n' +
    '          }\n' +
    '        ],\n' +
    '        "domain_path": "M0.5,6V0.5H900.5V6"\n' +
    '      },\n' +
    '      "y": {\n' +
    '        "label": "MW/Hr",\n' +
    '        "ticks": [\n' +
    '          { "y": 370.5, "label": "-20.00" },\n' +
    '          { "y": 329.38888888888886, "label": "0.00" },\n' +
    '          { "y": 288.27777777777777, "label": "20.00" },\n' +
    '          { "y": 247.16666666666669, "label": "40.00" },\n' +
    '          { "y": 206.05555555555557, "label": "60.00" },\n' +
    '          { "y": 164.94444444444443, "label": "80.00" },\n' +
    '          { "y": 123.83333333333334, "label": "100.00" },\n' +
    '          { "y": 82.72222222222221, "label": "120.00" },\n' +
    '          { "y": 41.61111111111113, "label": "140.00" },\n' +
    '          { "y": 0.5, "label": "160.00" }\n' +
    '        ],\n' +
    '        "domain_path": "M-6,370.5H0.5V0.5H-6",\n' +
    '        "scale_mapping": "Linear; value ≈ (329.3889 − y) × (20 / 41.1111) ≈ (329.3889 − y) × 0.486. Higher values are plotted higher (smaller y)."\n' +
    '      }\n' +
    '    },\n' +
    '    "reference_lines": [\n' +
    '      {\n' +
    '        "type": "horizontal",\n' +
    '        "y": 328.88888888888886,\n' +
    '        "style": "dashed",\n' +
    '        "color": "#aaa",\n' +
    '        "note": "Near y=0 baseline (tick at 329.3889)"\n' +
    '      }\n' +
    '    ],\n' +
    '    "series_summary": {\n' +
    '      "count": 26,\n' +
    '      "by_color_count": {\n' +
    '        "#FDB714": 6,\n' +
    '        "#1F77B4": 5,\n' +
    '        "#2CA02C": 9,\n' +
    '        "#7F7F7F": 2,\n' +
    '        "#8C564B": 2,\n' +
    '        "#9467BD": 1,\n' +
    '        "#17BECF": 1\n' +
    '      },\n' +
    '      "x_sample_positions": [0, 300, 600, 900],\n' +
    '      "notable_patterns": [\n' +
    '        "Multiple constant or near-constant lines at y≈328.889 (near 0 MW/Hr).",\n' +
    '        "One series with a very high point: y=29.385 at x=600 (≈150–160 MW/Hr).",\n' +
    '       "One path element is empty (no 'd' attribute content).",\n` +
    '        "Several series show moderate variability between dates."\n' +
    '      ],\n' +
    '      "integrity_checks": {\n' +
    '        "empty_series_paths": 1,\n' +
    '        "all_series_have_4_x_points_expected": false,\n' +
    '        "comment": "Some series are flat lines; at least one series path is empty."\n' +
    '      }\n' +
    '    },\n' +
    '    "legend": {\n' +
    '      "position_transform": [70, 490],\n' +
    '      "items": [\n' +
    '        { "label": "BARCSF1", "color": "#FDB714" },\n' +
    '        { "label": "BUTLERSG", "color": "#1F77B4" },\n' +
    '        { "label": "CAPTL_WF", "color": "#2CA02C" },\n' +
    '        { "label": "CHALLHWF", "color": "#2CA02C" },\n' +
    '        { "label": "CLOVER", "color": "#1F77B4" },\n' +
    '        { "label": "CLUNY", "color": "#1F77B4" },\n' +
    '        { "label": "CULLRGWF", "color": "#2CA02C" },\n' +
    '        { "label": "DIAPURWF1", "color": "#2CA02C" },\n' +
    '        { "label": "ERGT01", "color": "#7F7F7F" },\n' +
    '        { "label": "ERGTO1", "color": "#8C564B" },\n' +
    '        { "label": "GBO1", "color": "#7F7F7F" },\n' +
    '        { "label": "GRIFSF1", "color": "#FDB714" },\n' +
    '        { "label": "HUGSF1", "color": "#FDB714" },\n' +
    '        { "label": "KEPBG1", "color": "#9467BD" },\n' +
    '        { "label": "LRSF1", "color": "#FDB714" },\n' +
    '        { "label": "MLSP1", "color": "#FDB714" },\n' +
    '        { "label": "MLWF1", "color": "#2CA02C" },\n' +
    '        { "label": "PALOONA", "color": "#1F77B4" },\n' +
    '        { "label": "REPULSE", "color": "#1F77B4" },\n' +
    '        { "label": "ROTALLA1", "color": "#FDB714" },\n' +
    '        { "label": "RPCG", "color": "#8C564B" },\n' +
    '        { "label": "SHOAL1", "color": "#17BECF" },\n' +
    '        { "label": "WAUBRAWF", "color": "#2CA02C" },\n' +
    '        { "label": "WOOLNTH1", "color": "#2CA02C" },\n' +
    '        { "label": "YAMBUKWF", "color": "#2CA02C" },\n' +
    '        { "label": "YSWF1", "color": "#2CA02C" }\n' +
    '      ],\n' +
    '      "note": "Colors are reused across multiple installations; color alone does not uniquely identify a series."\n' +
    '    },\n' +
    '    "semantics": {\n' +
    '      "chart_type": "Multi-series line chart (time series)",\n' +
    '      "x_dimension": "Date (4 daily ticks: 11/02/2023 to 11/05/2023)",\n' +
    '      "y_dimension": "MW/Hr (range approx -20 to 160)",\n' +
     '     "encoding": "Each path with class series represents an installations MW/Hr over time; legend maps color to installation name.",\n '+
    '      "layout": "Margins via group translate(70,50); x-axis at bottom (translate(0,370)); y-axis at left."\n' +
    '    },\n' +
    '    "issues_and_recommendations": [\n' +
     '    "One series path has an empty d attribute; remove or populate with data.",\n' +
    '     "Dashed reference line at y=328.889 does not exactly match the 0.00 tick at y=329.389; align for accuracy.",\n' +
    '      "Because colors are reused across many series, consider unique styling (e.g., dashes or markers) or interactive legend to disambiguate."\n' +
    '    ]\n' +
    '  }\n' +
    '}'
 ' success: true,' +
 ' timestamp: 2025-10-10T03:22:00.210Z'

 export const genReflectValidateResponse = `{
  agentName: 'ValidatingAgent',
  result: '{\n' +
    '  "affirmed": "yes",\n' +
    '  "reasons": "The SVG renders a multi-series line chart with consistent x-date ticks (11/02–11/05/2023), labeled axes (Date, MW/Hr), a visible y=0 baseline, and multiple series paths aligned to shared x positions. Legend lists the expected installations with st
able colors. Series with missing points manifest as shortened/empty paths, producing gaps.",\n' +
    '  "checks": {\n' +
    '    "chart_type_line": true,\n' +
    '    "x_axis_time_dates_present": true,\n' +
    '    "date_range_complete_for_shown_data": true,\n' +
    '    "y_axis_supports_negative_and_zero": true,\n' +
    '    "labels_present": true,\n' +
    '    "title_present": true,\n' +
    '    "series_share_x_positions": true,\n' +
    '    "line_gaps_for_missing_values": true,\n' +
    '    "legend_present_with_known_installations": true\n' +
    '  },\n' +
    '  "notes_unverifiable_from_svg": [\n' +
    '    "Runtime CSV parsing and header normalization",\n' +
    '    "Aggregation rule (sum per installation per date)",\n' +
    '    "Dynamic domain/tick heuristics and nice rounding",\n' +
    '    "Energy source to color mapping correctness (no energy_source field in SVG)"\n' +
    '  ],\n' +
    '  "minor_discrepancies": [\n' +
    '    "Zero baseline dashed line is at y=328.8889 px while the 0.00 tick is at y=329.3889 px (~0.5 px offset). Aligning them would be cleaner.",\n' +
    '    "DIAPURWF1 renders an empty path; consider omitting the path or indicating 'No data' to avoid confusion.",\n' +
    '    "Y-axis domain/ticks use [-20,160] with step 20 rather than the suggested defaults; acceptable, but consider 'nice' ticks tuned to the data."\n' +
    '  ],\n' +
    '  "enhancements": [\n' +
    '    "Align the zero baseline exactly to the y=0 tick position from the scale.",\n' +
    '    "Add y-axis gridlines for each major tick to improve readability across many series.",\n' +
    '    "Use d3.line().defined(...) to explicitly break lines at nulls and optionally render small gaps or markers for missing points.",\n' +
    '    "Provide interactivity: tooltips with date/MW values, series hover highlight, and legend toggles to isolate series.",\n' +
    '    "Clip lines to the plot area with a clipPath to prevent any overflow.",\n' +
    '    "Consider adaptive time tick formatting and density for longer date ranges (e.g., d3.timeFormat with multi-format).",\n' +
    '    "If color encodes energy_source, add a secondary legend grouping or annotate legend entries by source; otherwise, vary stroke-dasharray per series to disambiguate repeated colors.",\n' +
    '    "Show a subtle horizontal reference line at y=0 with a label '0' or use a stronger style when negatives are present."\n' +
    '  ]\n' +
    '}',
  success: true,
  timestamp: 2025-10-10T06:35:03.119Z
}`


 //validation false: d3JSValidation1.txt
 export const d3jsValidationSuccess = `agentName: 'ValidatingAgent',
  result: '{\n' +
    '  "success": true,\n' +
'}'`

export const agentConstructorInput = `[AGENT: PythonDataProcessingAgent, DATA-PROC-01]
You are a Python coding agent specialized in CSV data processing. Your task is to generate executable Python code that processes energy generation data.

**CONTEXT**:
You will process a CSV file containing 5-minute interval energy generation data from multiple installations across different energy types (Solar, Wind, Natural Gas, Hydro, Diesel, Battery, Coal). You must filter by date and time, aggregate to hourly data, transform from wide to long format, and output both CSV and JSON metadata.

**CRITICAL TECHNICAL SPECIFICATIONS**:

1. **File Encoding**:
   - Input file has UTF-8 BOM encoding
   - MUST use: encoding='utf-8-sig'
   - Failure to do so will cause parsing errors

2. **CSV Structure**:
   - File has 2 header rows creating pandas MultiIndex
   - MUST use: header=[0,1]
   - This creates tuple columns like ('Solar', 'BARCSF1') and ('', 'date/time')

3. **Column Flattening** (CRITICAL - prevents KeyError):
   - MultiIndex columns are tuples: (energy_type, installation_name)
   - For date/time column: tuple is ('', 'date/time')
   - For installations: tuple is (energy_type, installation_name)
   - **MUST extract only the second element of each tuple**: col[1]
   - Result must be: ['date/time', 'BARCSF1', 'GRIFSF1', 'CAPTL_WF', ...]
   - DO NOT use '_'.join() or any string concatenation
   - Example code: df.columns = [col[1] for col in df.columns]

4. **Date Format** (CRITICAL - American format):
   - Format in CSV: MM/DD/YYYY H:MM (e.g., 11/02/2023 6:00)
   - Pandas format string: '%m/%d/%Y %H:%M'
   - Month comes FIRST, then day (NOT day/month/year)
   - Failure to use correct format causes parsing failures

5. **Data Cleaning**:
   - Convert empty cells to 0
   - Preserve negative values (do not convert to 0)
   - Use: pd.to_numeric(errors='coerce').fillna(0)

**INPUT DATA**:
- File path: C:/repos/SAGAMiddleware/data/two_days.csv
- Date format: MM/DD/YYYY H:MM
- Interval: 5 minutes (12 readings per hour)

**ENERGY SOURCE MAPPING** (ONLY include these installations):
python
energy_mapping = {
    'BARCSF1': 'Solar', 'GRIFSF1': 'Solar', 'HUGSF1': 'Solar',
    'LRSF1': 'Solar', 'MLSP1': 'Solar', 'ROTALLA1': 'Solar',
    'CAPTL_WF': 'Wind', 'CHALLHWF': 'Wind', 'CULLRGWF': 'Wind',
    'DIAPURWF1': 'Wind', 'MLWF1': 'Wind', 'WAUBRAWF': 'Wind',
    'WOOLNTH1': 'Wind', 'YAMBUKWF': 'Wind', 'YSWF1': 'Wind',
    'SHOAL1': 'Natural Gas',
    'BUTLERSG': 'Hydro', 'CLOVER': 'Hydro', 'CLUNY': 'Hydro',
    'PALOONA': 'Hydro', 'REPULSE': 'Hydro',
    'ERGT01': 'Diesel', 'GBO1': 'Diesel',
    'KEPBG1': 'Battery',
    'ERGTO1': 'Coal', 'RPCG': 'Coal'
}

Note: ROWALLAN and RUBICON exist in CSV but MUST be excluded (not in mapping).

**REQUIRED TRANSFORMATIONS**:

1. **Filter Data**:
   - Date: 11/02/2023 only
   - Time: 06:00 to 18:00 (inclusive)
   - Multi-line boolean conditions MUST use parentheses or backslash continuation
   - Example: df = df[(df['date/time'].dt.date == target_date) & \
                      (df['date/time'].dt.hour >= 6) & \
                      (df['date/time'].dt.hour <= 18)]

2. **Hourly Aggregation** (CRITICAL - must group correctly):
   - MUST group by BOTH (hour, installation) - NOT by hour alone
   - Each installation must be aggregated separately
   - Method: SUM all 5-minute readings within each hour
   - Result: Each installation has 13 hourly values (hours 6-18 inclusive)
   - Steps:
     a. Extract hour from datetime
     b. Transform wide to long format first (datetime, installation, MW)
     c. Group by (datetime.floor('H'), installation) and SUM
     d. This ensures each installation's readings are summed per hour

3. **Wide to Long Transformation**:
   - Use pd.melt() to transform
   - id_vars: ['date/time']
   - value_vars: All installation columns (those in energy_mapping.keys())
   - var_name: 'installation' (NOT 'variable')
   - value_name: 'MW'
   - Filter: Keep only installations in energy_mapping
   - Add column 'energy_source' by mapping installation names

4. **Output CSV**:
   - Path: C:/repos/SAGAMiddleware/data/hourly_energy_data.csv
   - Columns (exact order): date/time,installation,energy_source,MW
   - Date format in output: MM/DD/YYYY HH:MM (e.g., '11/02/2023 06:00')
   - Sort by: date/time first, then installation
   - Include index=False in to_csv()

5. **Output JSON Metadata**:
   - Print to console (will be captured by tool)
   - Structure:
  python
   {
       "installation_count": <number of unique installations>,
       "mw_min": <minimum MW value>,
       "mw_max": <maximum MW value>,
       "unique_installations": <list of installation names>,
       "date_ranges": {"start": "MM/DD/YYYY HH:MM", "end": "MM/DD/YYYY HH:MM"},
       "chart_type": "line",
       "energy_sources": <list of unique energy sources>
   }
   

**STRICT CODE OUTPUT RULES**:
1. Output ONLY executable Python code
2. First character must be 'i' from 'import'
3. Last character must be ')' from final print() statement
4. Zero markdown formatting (NO python, NO backticks, NO code fences)
5. Zero explanatory text before, during, or after code
6. Zero comments in code
7. Multi-line boolean expressions MUST wrap in parentheses or use backslash
8. Operations that don't modify in-place MUST reassign (e.g., df = df.sort_values())

**COMMON ERRORS TO PREVENT**:
❌ Using '%d/%m/%Y' instead of '%m/%d/%Y' (wrong date format)
❌ Using '_'.join() for column flattening (creates 'Solar_BARCSF1')
❌ Grouping by hour only instead of (hour, installation)
❌ Multi-line boolean with & at line end without parentheses
❌ Using sort_values() without reassignment (df = df.sort_values(...))
❌ Using 'variable' instead of 'installation' as column name
❌ Not filtering out ROWALLAN and RUBICON
❌ Wrong time range (must be 6-18 inclusive, which is 13 hours)

**VALIDATION CHECKLIST**:
✓ Column flattening uses col[1] to extract installation names
✓ Date parsing uses '%m/%d/%Y %H:%M' format string
✓ Filtering keeps hours 6 through 18 (13 hours total)
✓ Grouping by (hourly_datetime, installation) for aggregation
✓ Output columns are: date/time, installation, energy_source, MW
✓ JSON metadata includes all required fields
✓ Code has no syntax errors and runs without KeyError

**CODE STRUCTURE** (implement this exactly):
import pandas as pd
import json
from datetime import datetime

# Read CSV with correct encoding and headers
# Flatten columns to get installation names
# Parse date/time column with correct format
# Filter by date (11/02/2023) and time (6-18)
# Keep only columns in energy_mapping
# Transform wide to long format
# Add energy_source column using mapping
# Extract hour and group by (hour, installation) to sum
# Sort by date/time and installation
# Write to CSV with exact column order
# Generate metadata dictionary
# Print metadata as JSON


Generate the complete Python code now.
[/AGENT]

[AGENT: PythonExecutionAgent, EXEC-01]
You are a tool-calling agent responsible for executing Python code using an MCP server.

**YOUR ROLE**:
You will receive Python code in your context. Your task is to execute this code using the execute_python MCP tool.

**CONTEXT**:
The Python code you receive has been generated by the PythonDataProcessingAgent. It processes energy generation CSV data, filters by date and time, aggregates to hourly intervals, and outputs:
1. A CSV file at: C:/repos/SAGAMiddleware/data/hourly_energy_data.csv
2. JSON metadata printed to console

**YOUR TASK**:
1. Take the Python code provided in your context
2. Call the MCP server's execute_python tool
3. Pass the code exactly as provided

**MCP TOOL CALL SPECIFICATION**:
json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "execute_python",
    "arguments": {
      "code": "<PLACE_THE_PYTHON_CODE_HERE>"
    }
  }
}


**IMPORTANT**:
- The placeholder '{code}' in the tool call must be replaced with the actual Python code from your context
- Do not modify the code
- Do not add explanations
- Execute the tool call and capture the output
- The output will include:
  - Any print statements (JSON metadata)
  - Confirmation that the CSV file was written
  - Any errors that occurred

**OUTPUT**:
Pass the complete output from the MCP tool call to the next agent. This should include:
- The JSON metadata printed by the Python script
- Any status messages or errors
- Confirmation of file creation

Execute the tool call now.
[/AGENT]

[AGENT: DataAnalysisAgent, ANALYSIS-01]
You are a data analysis agent responsible for interpreting the output from the Python execution and preparing instructions for the D3.js visualization agent.

**CONTEXT**:
You will receive structured output from the PythonExecutionAgent, which executed a Python script that:
1. Processed energy generation CSV data
2. Filtered data for date 11/02/2023, times 06:00-18:00
3. Aggregated 5-minute intervals to hourly data
4. Transformed from wide to long format
5. Output a CSV file: C:/repos/SAGAMiddleware/data/hourly_energy_data.csv
6. Generated JSON metadata about the processed data

**YOUR TASK**:
Analyze the JSON metadata output and determine if there is sufficient structural and semantic information for the D3.js coding agent to create a line graph visualization WITHOUT direct access to the CSV file (due to context window constraints).

**WHAT TO ANALYZE**:
1. **Data Structure**:
   - CSV columns: date/time, installation, energy_source, MW
   - Number of unique installations
   - List of unique installations
   - Energy source types present
   - Date/time range covered

2. **Data Semantics**:
   - MW values represent megawatt-hours of energy generation
   - Time series data with hourly intervals
   - Multiple installations grouped by energy source type
   - Date format: MM/DD/YYYY HH:MM

3. **Chart Requirements**:
   - Chart type: Line graph
   - X-axis: Time (hourly intervals from 06:00 to 18:00)
   - Y-axis: MW (megawatt-hours)
   - Multiple lines: One per energy type (NOT per installation)
   - Data needs to be aggregated by energy source
   - Interactive legend required

4. **Data Ranges**:
   - Minimum MW value (for Y-axis scaling)
   - Maximum MW value (for Y-axis scaling)
   - Time range (for X-axis)

**YOUR OUTPUT**:
Generate clear, structured instructions for the D3.js coding agent that includes:

1. **Data Structure Specification**:
   - CSV format and column names
   - Expected data types
   - How to group installations by energy_source

2. **Aggregation Requirements**:
   - Data must be aggregated: Sum MW values by (datetime, energy_source)
   - This groups all installations of the same energy type together
   - Example: All Solar installations (BARCSF1, GRIFSF1, etc.) summed for each hour

3. **Visualization Specifications**:
   - Line chart with time on X-axis
   - MW on Y-axis
   - One line per energy source (Solar, Wind, Hydro, Natural Gas, Coal, Battery, Diesel)
   - Different colors for each energy source
   - Interactive legend (click to show/hide lines)
   - Tooltips showing exact values on hover
   - Axis labels and title

4. **Technical Details**:
   - File to load: 'hourly_energy_data.csv' (use d3.csv())
   - Date parsing format needed
   - Scale types (time scale for X, linear for Y)
   - Suggested dimensions and margins

5. **Data Availability Confirmation**:
   - Confirm that the metadata provides enough information about:
     - Column structure
     - Data ranges for axis scaling
     - Energy source types for legend
     - Time range for X-axis domain

Based on the metadata, provide complete instructions that will enable the D3.js agent to create the visualization without needing to see the raw CSV data.

**OUTPUT FORMAT**:
Structure your output as clear, numbered instructions covering all aspects above. Be explicit about data transformations, aggregations, and visual encodings.
[/AGENT]

[AGENT: D3VisualizationAgent, VIZ-01]
You are a D3.js coding agent specialized in creating interactive data visualizations.

**CONTEXT**:
You will receive detailed instructions from the DataAnalysisAgent that includes:
1. Clear requirements for a line graph visualization
2. Structure and semantics of the energy generation data
3. Aggregation and transformation specifications

**YOUR TASK**:
Generate a complete, self-contained HTML file with embedded JavaScript that creates an interactive line graph showing energy generation by energy type over time (06:00-18:00 on 11/02/2023).

**DATA SOURCE**:
- Use d3.csv() to load: 'hourly_energy_data.csv'
- CSV columns: date/time, installation, energy_source, MW
- You must aggregate the data: Group by (date/time, energy_source) and SUM the MW values
- This combines all installations of each energy type into a single line

**VISUALIZATION REQUIREMENTS**:

1. **Chart Type**: Line graph
2. **X-Axis**: Time (hourly from 06:00 to 18:00)
3. **Y-Axis**: MW (megawatt-hours)
4. **Lines**: One line per energy_source (Solar, Wind, Hydro, Natural Gas, Coal, Battery, Diesel)
5. **Colors**: Distinct color for each energy source
6. **Interactive Legend**:
   - Show all energy sources
   - Click to toggle visibility of lines
   - Visual indication of active/inactive state
7. **Tooltips**: Show energy_source, time, and exact MW value on hover
8. **Labels**: Clear axis labels and chart title

**D3.JS IMPLEMENTATION REQUIREMENTS**:

1. **Library**:
   - Use: <script src="https://d3js.org/d3.v7.min.js"></script>
   - Must be D3.js version 7

2. **Data Loading & Processing**:
   javascript
   d3.csv('hourly_energy_data.csv').then(function(data) {
     // Parse dates
     // Convert MW to numbers
     // Aggregate by energy_source and datetime
     // Group data for line generator
   });
   

3. **Scales**:
   - X-axis: d3.scaleTime() for temporal data
   - Y-axis: d3.scaleLinear() for MW values
   - Color: d3.scaleOrdinal() for energy sources

4. **Line Generator**:
   - Use d3.line() to create path data
   - Map x to datetime and y to aggregated MW

5. **Interactivity**:
   - Legend items clickable
   - Lines fade in/out on legend click
   - Hover tooltips with data details

**ABSOLUTE REQUIREMENTS**:
1. Output ONLY a complete HTML document
2. First character must be: <
3. Last character must be: >
4. Zero explanatory text before or after the HTML
5. Zero markdown formatting (NO html, NO javascript, NO backticks)
6. All JavaScript must be embedded in <script> tags within the HTML
7. All CSS must be embedded in <style> tags within the HTML
8. The HTML must be fully self-contained and executable

**CODE STRUCTURE** (implement this exactly):

<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Energy Generation Line Graph</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        /* Styling for chart, axes, legend, tooltips */
    </style>
</head>
<body>
    <div id="chart"></div>
    <script>
        // Set dimensions and margins
        // Create SVG
        // Load CSV data with d3.csv('hourly_energy_data.csv')
        // Parse dates and convert MW to numbers
        // Aggregate data by (datetime, energy_source) using d3.rollup
        // Prepare nested data structure for lines
        // Create scales (time, linear, ordinal)
        // Create axes
        // Create line generator
        // Draw lines with distinct colors
        // Create interactive legend
        // Add tooltips on hover
        // Add axis labels and title
    </script>
</body>
</html>


**CHART SPECIFICATIONS**:
- Dimensions: 900px wide × 600px tall (adjust margins for axes and legend)
- Margins: {top: 40, right: 200, bottom: 60, left: 80}
- Title: "Energy Generation by Type - February 11, 2023 (06:00-18:00)"
- X-axis label: "Time"
- Y-axis label: "Energy Generation (MW)"
- Legend position: Right side of chart

**DATA AGGREGATION EXAMPLE**:
javascript
// Use d3.rollup to aggregate
const aggregated = d3.rollup(
  data,
  v => d3.sum(v, d => d.MW),  // Sum MW values
  d => d['date/time'],         // Group by datetime
  d => d.energy_source         // Then by energy_source
);


Generate the complete HTML file now with embedded D3.js visualization code.
[/AGENT]

<flow>PythonDataProcessingAgent -> PythonExecutionAgent -> DataAnalysisAgent -> D3VisualizationAgent</flow>

{"toolUsers": ["PythonExecutionAgent"]}`

export const agentConstructorPythonOutput = `  import pandas as pd
import json
from datetime import datetime

# Read CSV with correct encoding and headers
df = pd.read_csv('C:/repos/SAGAMiddleware/data/two_days.csv', encoding='utf-8-sig', header=[0,1])

# Flatten columns to get installation names
df.columns = [col[1] for col in df.columns]

# Parse date/time column with correct format
df['date/time'] = pd.to_datetime(df['date/time'], format='%m/%d/%Y %H:%M')

# Filter by date (11/02/2023) and time (6-18)
df = df[(df['date/time'].dt.date == datetime.strptime('11/02/2023', '%m/%d/%Y').date()) &
        (df['date/time'].dt.hour >= 6) &
        (df['date/time'].dt.hour <= 18)]

# Keep only columns in energy_mapping
energy_mapping = {
    'BARCSF1': 'Solar', 'GRIFSF1': 'Solar', 'HUGSF1': 'Solar',
    'LRSF1': 'Solar', 'MLSP1': 'Solar', 'ROTALLA1': 'Solar',
    'CAPTL_WF': 'Wind', 'CHALLHWF': 'Wind', 'CULLRGWF': 'Wind',
    'DIAPURWF1': 'Wind', 'MLWF1': 'Wind', 'WAUBRAWF': 'Wind',
    'WOOLNTH1': 'Wind', 'YAMBUKWF': 'Wind', 'YSWF1': 'Wind',
    'SHOAL1': 'Natural Gas',
    'BUTLERSG': 'Hydro', 'CLOVER': 'Hydro', 'CLUNY': 'Hydro',
    'PALOONA': 'Hydro', 'REPULSE': 'Hydro',
    'ERGT01': 'Diesel', 'GBO1': 'Diesel',
    'KEPBG1': 'Battery',
    'ERGTO1': 'Coal', 'RPCG': 'Coal'
}
df = df[['date/time'] + [col for col in df.columns if col in energy_mapping.keys()]]

# Transform wide to long format
df_melted = pd.melt(df, id_vars=['date/time'], value_vars=energy_mapping.keys(),
                    var_name='installation', value_name='MW')

# Add energy_source column using mapping
df_melted['energy_source'] = df_melted['installation'].map(energy_mapping)

# Extract hour and group by (hour, installation) to sum
df_melted['date/time'] = df_melted['date/time'].dt.floor('H')
df_grouped = df_melted.groupby(['date/time', 'installation', 'energy_source']).sum().reset_index()

# Sort by date/time and installation
df_sorted = df_grouped.sort_values(['date/time', 'installation'])

# Write to CSV with exact column order
df_sorted.to_csv('C:/repos/SAGAMiddleware/data/hourly_energy_data.csv', index=False,
                 columns=['date/time', 'installation', 'energy_source', 'MW'], date_format='%m/%d/%Y %H:%M')

# Generate metadata dictionary
metadata = {
    "installation_count": df_sorted['installation'].nunique(),
    "mw_min": df_sorted['MW'].min(),
    "mw_max": df_sorted['MW'].max(),
    "unique_installations": df_sorted['installation'].unique().tolist(),
    "date_ranges": {"start": df_sorted['date/time'].min().strftime('%m/%d/%Y %H:%M'),
                    "end": df_sorted['date/time'].max().strftime('%m/%d/%Y %H:%M')},
    "chart_type": "line",
    "energy_sources": df_sorted['energy_source'].unique().tolist()
}

# Print metadata as JSON
print(json.dumps(metadata, indent=4))`

export const agentConstructorPythonExecutionError = `{
  agentName: 'PythonExecutionAgent',
  result: {"content":[],"success":false,"stdout":"","stderr":"File \\"C:\\\\repos\\\\codeGen-mcp-server\\\\workspace\\\\script_1761109959675.py\\", line 12\\r\\n       
  'Solar': ['BARCSF1', 'GRIFSF1', 'HUGSF1', 'LRSF1', 'MLSP1', 'ROTALLA1'],\\r\\n
  ^\\r\\nSyntaxError: unterminated string literal (detected at line 12)",
  "error":"Command failed: py \\"C:\\\\repos\\\\codeGen-mcp-server\\\\workspace\\\\script_1761109959675.py\\"\\n  File \\"C:\\\\repos\\\\codeGen-mcp-server\\\\workspace\\\\script_1761109959675.py\\", line 12\\r\\n    '    
  'Solar': ['BARCSF1', 'GRIFSF1', 'HUGSF1', 'LRSF1', 'MLSP1', 'ROTALLA1'],\\r\\n^\\r\\nSyntaxError: unterminated string literal (detected at line 12)\\r\\n","filename":"script_1761109959675.py",
  success: true,
  timestamp: 2025-10-22T05:12:39.879Z
}`

export const agentConstructorPythonExecutionOK = ` {
  content: [],
  success: true,
  stdout: '{\r\n' +
    '    "installation_count": 26,\r\n' +
    '    "mw_min": -43.2,\r\n' +
    '    "mw_max": 1309.72297,\r\n' +
    '    "unique_installations": [\r\n' +
    '        "BARCSF1",\r\n' +
    '        "BUTLERSG",\r\n' +
    '        "CAPTL_WF",\r\n' +
    '        "CHALLHWF",\r\n' +
    '        "CLOVER",\r\n' +
    '        "CLUNY",\r\n' +
    '        "CULLRGWF",\r\n' +
    '        "DIAPURWF1",\r\n' +
    '        "ERGT01",\r\n' +
    '        "ERGTO1",\r\n' +
    '        "GBO1",\r\n' +
    '        "GRIFSF1",\r\n' +
    '        "HUGSF1",\r\n' +
    '        "KEPBG1",\r\n' +
    '        "LRSF1",\r\n' +
    '        "MLSP1",\r\n' +
    '        "MLWF1",\r\n' +
    '        "PALOONA",\r\n' +
    '        "REPULSE",\r\n' +
    '        "ROTALLA1",\r\n' +
    '        "RPCG",\r\n' +
    '        "SHOAL1",\r\n' +
    '        "WAUBRAWF",\r\n' +
    '        "WOOLNTH1",\r\n' +
    '        "YAMBUKWF",\r\n' +
    '        "YSWF1"\r\n' +
    '    ],\r\n' +
    '    "date_ranges": {\r\n' +
    '        "start": "11/02/2023 06:00",\r\n' +
    '        "end": "11/02/2023 18:00"\r\n' +
    '    },\r\n' +
    '    "chart_type": "line",\r\n' +
    '    "energy_sources": [\r\n' +
    '        "Solar",\r\n' +
    '        "Hydro",\r\n' +
    '        "Wind",\r\n' +
    '        "Diesel",\r\n' +
    '        "Coal",\r\n' +
    '        "Battery",\r\n' +
    '        "Natural Gas"\r\n' +
    '    ]\r\n' +
    '}',
  stderr: "C:\\repos\\codeGen-mcp-server\\workspace\\script_1761203100992.py:43: FutureWarning: 'H' is deprecated and will be removed in a future version, please use 'h' instead.\r\n" +
    "  df_melted['date/time'] = df_melted['date/time'].dt.floor('H')",
  filename: 'script_1761203100992.py'
}`

export const dataLoaderPython = ` import os
from datetime import date
import pandas as pd

FILE_PATH = r"C:/repos/SAGAMiddleware/data/two_days.csv"

EXPECTED_TOTAL_LINES = 530
EXPECTED_DATA_ROWS = 528
DATE_COL = "date/time"
DATETIME_FORMAT = "%m/%d/%Y %H:%M"

ALL_COLUMNS_EXPECTED = [
    "date/time","BARCSF1","GRIFSF1","HUGSF1","LRSF1","MLSP1","ROTALLA1",
    "CAPTL_WF","CHALLHWF","CULLRGWF","DIAPURWF1","MLWF1","WAUBRAWF","WOOLNTH1","YAMBUKWF","YSWF1",
    "SHOAL1",
    "BUTLERSG","CLOVER","CLUNY","PALOONA","REPULSE","ROWALLAN","RUBICON",
    "ERGT01","GBO1",
    "KEPBG1",
    "ERGTO1","RPCG"
]

def load_data(file_path: str = FILE_PATH) -> pd.DataFrame:
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found at: {file_path}")

    with open(file_path, "rb") as f:
        total_lines = sum(1 for _ in f)
    if total_lines != EXPECTED_TOTAL_LINES:
        raise ValueError(f"Unexpected total line count: {total_lines}. Expected {EXPECTED_TOTAL_LINES}.")

    try:
        df = pd.read_csv(file_path, encoding="utf-8-sig", header=1)
    except UnicodeDecodeError as e:
        raise ValueError("Failed to read CSV with utf-8-sig encoding.") from e

    if df.shape[0] != EXPECTED_DATA_ROWS:
        raise ValueError(f"Unexpected number of data rows: {df.shape[0]}. Expected {EXPECTED_DATA_ROWS}.")

    if DATE_COL not in df.columns:
        bom_col = next((c for c in df.columns if c.endswith(DATE_COL)), None)
        if bom_col:
            df.rename(columns={bom_col: DATE_COL}, inplace=True)
        else:
            raise KeyError(f"Missing required column '{DATE_COL}' in CSV header.")

    missing = [c for c in ALL_COLUMNS_EXPECTED if c not in df.columns]
    if missing:
        raise KeyError(f"CSV is missing expected columns: {missing}")

    try:
        df["datetime"] = pd.to_datetime(df[DATE_COL], format=DATETIME_FORMAT, errors="raise")
    except Exception as e:
        raise ValueError("Datetime parsing failed. Ensure format is '%m/%d/%Y %H:%M' (e.g., 11/02/2023 6:00).") from e

    min_dt, max_dt = df["datetime"].min(), df["datetime"].max()
    if not (min_dt.date() <= date(2023, 11, 2) and max_dt.date() >= date(2023, 11, 3)):
        raise ValueError(f"Unexpected datetime span: {min_dt} to {max_dt}. Expected coverage across 2023-11-02 to 2023-11-03.")

    diffs = df["datetime"].sort_values().diff().dropna().dt.total_seconds().unique().tolist()
    if 300.0 not in diffs:
        raise ValueError(f"5-minute interval (300s) not detected. Found unique diffs (s): {diffs}")

    return df`

    export const dataFilterPython= `import pandas as pd

INSTALLATIONS_INCLUDED = [
    "BARCSF1","GRIFSF1","HUGSF1","LRSF1","MLSP1","ROTALLA1",
    "CAPTL_WF","CHALLHWF","CULLRGWF","DIAPURWF1","MLWF1","WAUBRAWF","WOOLNTH1","YAMBUKWF","YSWF1",
    "SHOAL1",
    "BUTLERSG","CLOVER","CLUNY","PALOONA","REPULSE",
    "ERGT01","GBO1",
    "KEPBG1",
    "ERGTO1","RPCG"
]

START = pd.Timestamp("2023-11-02 06:00")
END = pd.Timestamp("2023-11-02 18:55")
EXPECTED_ROWS = 13 * 12

def filter_data(df: pd.DataFrame) -> pd.DataFrame:
    if "datetime" not in df.columns:
        raise KeyError("Input DataFrame missing 'datetime' column from loader.")
    df = df.copy()
    df["datetime"] = pd.to_datetime(df["datetime"], errors="coerce")
    if df["datetime"].isna().any():
        raise ValueError("Found non-parsable datetimes after coercion.")
    mask = (df["datetime"] >= START) & (df["datetime"] <= END)
    df_f = df.loc[mask].copy()
    if df_f.shape[0] != EXPECTED_ROWS:
        raise ValueError(f"Filtered rows {df_f.shape[0]} != expected {EXPECTED_ROWS} for 06:00-18:55.")
    if df_f["datetime"].dt.date.nunique() != 1 or df_f["datetime"].dt.date.iloc[0].isoformat() != "2023-11-02":
        raise ValueError("Filtered data contains dates outside 2023-11-02.")
    missing = [c for c in INSTALLATIONS_INCLUDED if c not in df_f.columns]
    if missing:
        raise KeyError(f"Missing expected installation columns: {missing}")
    cols_to_keep = ["datetime"] + INSTALLATIONS_INCLUDED
    df_f = df_f[cols_to_keep].sort_values("datetime").reset_index(drop=True)
    if df_f.shape[0] != EXPECTED_ROWS:
        raise ValueError("Unexpected change in row count after column selection.")
    if list(df_f.columns) != cols_to_keep:
        raise ValueError("Column set/order mismatch after selection of 26 installations.")
    return df_f

if "df" in globals() and isinstance(df, pd.DataFrame):
    filtered_df = filter_data(df)`

    export const dataTransformerPython = `import pandas as pd

INSTALLATIONS_INCLUDED = [
    "BARCSF1","GRIFSF1","HUGSF1","LRSF1","MLSP1","ROTALLA1",
    "CAPTL_WF","CHALLHWF","CULLRGWF","DIAPURWF1","MLWF1","WAUBRAWF","WOOLNTH1","YAMBUKWF","YSWF1",
    "SHOAL1",
    "BUTLERSG","CLOVER","CLUNY","PALOONA","REPULSE",
    "ERGT01","GBO1",
    "KEPBG1",
    "ERGTO1","RPCG"
]

INSTALLATION_TO_TYPE = {
    "BARCSF1":"Solar","GRIFSF1":"Solar","HUGSF1":"Solar","LRSF1":"Solar","MLSP1":"Solar","ROTALLA1":"Solar",
    "CAPTL_WF":"Wind","CHALLHWF":"Wind","CULLRGWF":"Wind","DIAPURWF1":"Wind","MLWF1":"Wind","WAUBRAWF":"Wind","WOOLNTH1":"Wind","YAMBUKWF":"Wind","YSWF1":"Wind",
    "SHOAL1":"Natural Gas",
    "BUTLERSG":"Hydro","CLOVER":"Hydro","CLUNY":"Hydro","PALOONA":"Hydro","REPULSE":"Hydro",
    "ERGT01":"Diesel","GBO1":"Diesel",
    "KEPBG1":"Battery",
    "ERGTO1":"Coal","RPCG":"Coal"
}

EXPECTED_ROWS_LONG = 156 * 26

def transform_data(df_f: pd.DataFrame) -> pd.DataFrame:
    if "datetime" not in df_f.columns:
        raise KeyError("Input DataFrame missing 'datetime' column.")
    df_f = df_f.copy()
    df_f["datetime"] = pd.to_datetime(df_f["datetime"], errors="coerce")
    if df_f["datetime"].isna().any():
        raise ValueError("Invalid 'datetime' values after parsing.")
    df_f["hour"] = df_f["datetime"].dt.hour.astype(int)
    df_long = df_f.melt(
        id_vars=["datetime", "hour"],
        value_vars=INSTALLATIONS_INCLUDED,
        var_name="installation",
        value_name="power"
    )
    df_long["power"] = pd.to_numeric(df_long["power"], errors="coerce").fillna(0.0)
    df_long["energy_type"] = df_long["installation"].map(INSTALLATION_TO_TYPE)
    if df_long.shape[0] != EXPECTED_ROWS_LONG:
        raise ValueError(f"Unexpected long format row count: {df_long.shape[0]} != {EXPECTED_ROWS_LONG}")
    if df_long["energy_type"].isna().any():
        missing_installations = df_long.loc[df_long["energy_type"].isna(), "installation"].unique().tolist()
        raise KeyError(f"Missing energy_type mapping for installations: {missing_installations}")
    hours_set = set(df_long["hour"].unique().tolist())
    expected_hours = set(range(6, 19))
    if hours_set != expected_hours:
        raise ValueError(f"Hour values mismatch. Found {sorted(hours_set)}, expected 6..18.")
    return df_long
DATA TRANS CODE  {"agentName":"ValidatingAgent","result":"import pandas as pd

INSTALLATIONS_INCLUDED = [
    "BARCSF1","GRIFSF1","HUGSF1","LRSF1","MLSP1","ROTALLA1",
    "CAPTL_WF","CHALLHWF","CULLRGWF","DIAPURWF1","MLWF1","WAUBRAWF","WOOLNTH1","YAMBUKWF","YSWF1",
    "SHOAL1",
    "BUTLERSG","CLOVER","CLUNY","PALOONA","REPULSE",
    "ERGT01","GBO1",
    "KEPBG1",
    "ERGTO1","RPCG"
]

INSTALLATION_TO_TYPE = {
    "BARCSF1":"Solar","GRIFSF1":"Solar","HUGSF1":"Solar","LRSF1":"Solar","MLSP1":"Solar","ROTALLA1":"Solar",
    "CAPTL_WF":"Wind","CHALLHWF":"Wind","CULLRGWF":"Wind","DIAPURWF1":"Wind","MLWF1":"Wind","WAUBRAWF":"Wind","WOOLNTH1":"Wind","YAMBUKWF":"Wind","YSWF1":"Wind",
    "SHOAL1":"Natural Gas",
    "BUTLERSG":"Hydro","CLOVER":"Hydro","CLUNY":"Hydro","PALOONA":"Hydro","REPULSE":"Hydro",
    "ERGT01":"Diesel","GBO1":"Diesel",
    "KEPBG1":"Battery",
    "ERGTO1":"Coal","RPCG":"Coal"
}

EXPECTED_ROWS_LONG = 156 * 26

def transform_data(df_f: pd.DataFrame) -> pd.DataFrame:
    if "datetime" not in df_f.columns:
        raise KeyError("Input DataFrame missing 'datetime' column.")
    df_f = df_f.copy()
    df_f["datetime"] = pd.to_datetime(df_f["datetime"], errors="coerce")
    if df_f["datetime"].isna().any():
        raise ValueError("Invalid 'datetime' values after parsing.")
    df_f["hour"] = df_f["datetime"].dt.hour.astype(int)
    df_long = df_f.melt(
        id_vars=["datetime", "hour"],
        value_vars=INSTALLATIONS_INCLUDED,
        var_name="installation",
        value_name="power"
    )
    df_long["power"] = pd.to_numeric(df_long["power"], errors="coerce").fillna(0.0)
    df_long["energy_type"] = df_long["installation"].map(INSTALLATION_TO_TYPE)
    if df_long.shape[0] != EXPECTED_ROWS_LONG:
        raise ValueError(f"Unexpected long format row count: {df_long.shape[0]} != {EXPECTED_ROWS_LONG}")
    if df_long["energy_type"].isna().any():
        missing_installations = df_long.loc[df_long["energy_type"].isna(), "installation"].unique().tolist()
        raise KeyError(f"Missing energy_type mapping for installations: {missing_installations}")
    hours_set = set(df_long["hour"].unique().tolist())
    expected_hours = set(range(6, 19))
    if hours_set != expected_hours:
        raise ValueError(f"Hour values mismatch. Found {sorted(hours_set)}, expected 6..18.")
    return df_long"`

    export const dataAggregatorPython = `import pandas as pd

EXPECTED_HOURS = list(range(6, 19))  # 6..18 inclusive
EXPECTED_INSTALLATIONS = 26
EXPECTED_ROWS = len(EXPECTED_HOURS) * EXPECTED_INSTALLATIONS  # 338
EXPECTED_READINGS_PER_HOUR = 12  # 5-min intervals

def aggregate_hourly(df_long: pd.DataFrame) -> pd.DataFrame:
    required_cols = {"datetime", "hour", "installation", "power", "energy_type"}
    if not required_cols.issubset(df_long.columns):
        missing = list(required_cols - set(df_long.columns))
        raise KeyError(f"Input missing required columns: {missing}")

    counts = df_long.groupby(["hour", "installation"]).size().reset_index(name="n")
    if counts.empty:
        raise ValueError("No readings provided.")
    if (counts["n"] != EXPECTED_READINGS_PER_HOUR).any():
        rng = (counts["n"].min(), counts["n"].max())
        raise ValueError(
            f"Each [hour, installation] must have exactly {EXPECTED_READINGS_PER_HOUR} readings. Found range: {rng[0]}..{rng[1]}"
        )

    et_nunique = (
        df_long.groupby(["hour", "installation"])["energy_type"]
        .nunique(dropna=True)
        .reset_index(name="k")
    )
    if (et_nunique["k"] != 1).any():
        raise ValueError("Each [hour, installation] must have a single unique energy_type.")

    df_hourly = (
        df_long.groupby(["hour", "installation"], as_index=False)
        .agg(total_power=("power", "sum"), energy_type=("energy_type", "first"))
    )
    df_hourly = df_hourly[["hour", "installation", "energy_type", "total_power"]]

    if df_hourly.shape[0] != EXPECTED_ROWS:
        raise ValueError(
            f"Aggregated row count {df_hourly.shape[0]} != expected {EXPECTED_ROWS} (13 hours × 26 installations)."
        )

    hours = sorted(df_hourly["hour"].unique().tolist())
    if hours != EXPECTED_HOURS:
        raise ValueError(f"Hour set mismatch. Found {hours}, expected {EXPECTED_HOURS}.")

    per_hour_counts = df_hourly.groupby("hour").size()
    if not (per_hour_counts == EXPECTED_INSTALLATIONS).all():
        raise ValueError(
            "Each hour must contain exactly 26 installations after aggregation."
        )

    unique_installations = df_hourly["installation"].nunique()
    if unique_installations != EXPECTED_INSTALLATIONS:
        raise ValueError(
            f"Unique installations {unique_installations} != expected {EXPECTED_INSTALLATIONS}."
        )

    if df_hourly["total_power"].isna().any():
        raise ValueError("NaN detected in 'total_power' after aggregation.")

    return df_hourly`

    export const dataExporterPython = `  import os
import pandas as pd

OUTPUT_PATH = r"C:/repos/SAGAMiddleware/data/processed_hourly.csv"

def export_csv(df_hourly: pd.DataFrame, output_path: str = OUTPUT_PATH) -> str:
    required_cols = ["hour", "installation", "energy_type", "total_power"]
    missing = [c for c in required_cols if c not in df_hourly.columns]
    if missing:
        raise KeyError(f"Hourly DataFrame missing required columns: {missing}")
    df = df_hourly.copy()
    hour_numeric = pd.to_numeric(df["hour"], errors="coerce")
    if hour_numeric.isna().any():
        raise TypeError("Column 'hour' must be convertible to integer.")
    df["hour"] = hour_numeric.astype(int)
    df_sorted = df.sort_values(by=["hour", "installation"]).reset_index(drop=True)
    df_out = df_sorted[required_cols]
    out_dir = os.path.dirname(output_path)
    if out_dir and not os.path.exists(out_dir):
        os.makedirs(out_dir, exist_ok=True)
    df_out.to_csv(output_path, index=False, encoding="utf-8")
    if not os.path.exists(output_path):
        raise IOError(f"Failed to write output CSV to {output_path}")
    test_df = pd.read_csv(output_path)
    if test_df.shape[0] != df_out.shape[0]:
        raise ValueError(f"Row count mismatch after write: {test_df.shape[0]} vs {df_out.shape[0]}")
    return output_path`

export const dataExporterPythonresult = ` {
  agentName: 'ToolCallingAgent',
  result: '"[MCP-SERVER] Loaded DataFrame as: _loaded_df - shape=(338, 4)\\r\\nC:/repos/SAGAMiddleware/data/processed_hourly.csv"',
  success: true,
  timestamp: 2025-10-27T22:17:59.250Z
}`

export { csvContent, agentData };