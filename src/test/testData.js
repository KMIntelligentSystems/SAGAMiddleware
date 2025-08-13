

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
/*

 The import error in sagaCoordinator.ts:23 occurred because the file was trying to import csvContent as a named export, but testData.js exports it as part of a default export object. I changed the import to use the default export pattern and
  destructure csvContent from it.

  Changed the import to use CommonJS require() syntax since testData.js uses module.exports (CommonJS) rather than       
  ES6 export default.

*/

export { csvContent, agentData };