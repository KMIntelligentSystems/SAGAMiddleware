

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

export const visCodeWriterResult = `python
import pandas as pd

# Load the data
df = pd.read_csv('C:/repos/SAGAMiddleware/data/Output_one_hour_normalized.csv')

# Ensure MW is numeric
df['MW'] = pd.to_numeric(df['MW'], errors='coerce')

# Convert date/time to datetime format and extract the date
df['date/time'] = pd.to_datetime(df['date/time']).dt.date

# Group by day, installation, and energy_source to compute the mean of MW
df = df.groupby(['date/time', 'installation', 'energy_source'], as_index=False)['MW'].mean()

# Convert 'date/time' back to string format
df['date/time'] = df['date/time'].apply(lambda x: x.strftime('%m/%d/%Y'))

# Sort the dataframe
df = df.sort_values(by=['date/time', 'installation', 'energy_source'])

# Save the dataframe to csv
df.to_csv('C:/repos/SAGAMiddleware/data/Output_one_hour_normalized_daily_avg.csv', index=False)
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

export const pythonLogCodeResult = ` {
  "content": [],
  "success": true,
  "stdout": "",
  "stderr": "",
  "filename": "script_1756934015527.py"
}

`;

export { csvContent, agentData };