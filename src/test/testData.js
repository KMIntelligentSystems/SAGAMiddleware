

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

export const D3JSCoordinatingAgentFinalResult = `{
  agentName: 'D3JSCoordinatingAgent',
  result: 'Consolidated summary across cycles (20-row analyses) for D3JS Coordinating Agent\n' +
    '\n' +
    'Cycle-by-cycle summaries (as provided)\n' +
    '- cycle_0\n' +
    '  - xDomain: ["11/02/2023", "11/03/2023", "11/04/2023", "11/05/2023"]\n' +
    '  - Example series entry: BARCSF1 (Solar) values: 11/02 0.1 MW; 11/03 0; 11/04 0; 11/05 0; (... truncated)\n' +
    '  - yDomain: [-5, 25]; yTicks: [-5, 0, 5, 10, 15, 20, 25]; tickFormatHint: auto-2dp\n' +
    '  - Stats.counts: total_rows 20; processed_rows 20; n_installations 16; n_energy_sources 5; n_dates 4\n' +
    '  - Stats.per_date_totals: 11/02 69.91014775; 11/03 0; 11/04 0; 11/05 0\n' +
    '  - Stats.extrema: global_min -0.176 at HUGSF1 on 11/02; global_max 28.973424166666664 at REPULSE on 11/02\n' +
    '  - Data quality: skipped_rows 1; out_of_scope_date_rows 0\n' +
    '  - Timestamp: 2025-09-07T21:46:25.531Z\n' +
    '\n' +
    '- cycle_1\n' +
    '  - xDomain: ["11/02/2023", "11/03/2023", "11/04/2023", "11/05/2023"]\n' +
    '  - Example series entries: KEPBG1 (Battery) all zeros; LRSF1 (Solar) 11/03 0.004; MLSP1 (Solar) 11/03 0.002; (... truncated)\n' +
    '  - yDomain: [-1, 70]; yTicks: [-1, 0, 10, 20, 30, 40, 50, 60, 70]; tickFormatHint: auto-1dp\n' +
    '  - Stats.counts: total_rows 160; processed_rows 160; n_installations 22; n_energy_sources 6; n_dates 4\n' +
    '  - Stats.per_date_totals: 11/02 0; 11/03 154.96340849999997; 11/04 79.58323216666667; 11/05 0\n' +
    '  - Stats.extrema: global_min -0.006666666666666667 at CLOVER on 11/04; global_max 68.01666666666667 at WOOLNTH1 on 11/03\n' +
    '  - Data quality: skipped_rows 0; out_of_scope_date_rows 0\n' +
    '  - Timestamp: 2025-09-07T21:46:50.798Z\n' +
    '\n' +
    '- cycle_2\n' +
    '  - xDomain: ["2023-11-02", "2023-11-03", "2023-11-04", "2023-11-05"] (ISO format)\n' +
    '  - Example series entries: DIAPURWF1 (Wind) all zeros; ERGT01 (Diesel) all zeros; ERGTO1 (Coal) all zeros; (... truncated)\n' +
    '  - yDomain: [-0.1095, 145.70458333333332]; yTicks: [-0.2, 0, 20, 40, 60, 80, 100, 120, 140, 160]; tickFormatHint: auto-2dp\n' +
    '  - Stats.counts: total_rows 500; processed_rows 20; n_installations 20; n_energy_sources 6; n_dates 4\n' +
    '  - Stats.per_date_totals: 2023-11-02 0; 2023-11-03 0; 2023-11-04 255.44942904166666; 2023-11-05 0\n' +
    '  - Stats.extrema: global_min -0.1095 at HUGSF1 on 2023-11-04; global_max 145.70458333333332 at WAUBRAWF on 2023-11-04\n' +
    '  - Data quality: skipped_rows 2; out_of_scope_date_rows 1\n' +
    '  - Timestamp: 2025-09-07T21:47:06.722Z\n' +
    '\n' +
    '- cycle_3\n' +
    '  - xDomain: ["11/02/2023", "11/03/2023", "11/04/2023", "11/05/2023"]\n' +
    '  - Example series entries: BUTLERSG (Hydro) 11/05 9.391665583333333; CAPTL_WF (Wind) 11/05 25.20872; (... truncated)\n' +
    '  - yDomain: [-5, 25]; yTicks: [-5, 0, 5, 10, 15, 20, 25]; tickFormatHint: auto-2dp\n' +
    '  - Stats.counts: total_rows 0; processed_rows 20; n_installations 19; n_energy_sources 7; n_dates 1\n' +
    '  - Stats.per_date_totals: 11/05 93.56824208333334\n' +
    '  - Stats.extrema: global_min -1.1 at RPCG on 11/05; global_max 25.20872 at CAPTL_WF on 11/05\n' +
    '  - Data quality: skipped_rows 2; out_of_scope_date_rows 0\n' +
    '  - Timestamp: 2025-09-07T21:47:21.738Z\n' +
    '\n' +
    '\n' +
    'Consolidated synthesis for graph construction\n' +
    '- Normalized xDomain (union of all cycles):\n' +
    '  - Canonical (ISO): ["2023-11-02", "2023-11-03", "2023-11-04", "2023-11-05"]\n' +
    '  - Note: cycles 0, 1, 3 used "MM/DD/YYYY"; cycle 2 used ISO. Downstream should normalize to a single format (recommend ISO).\n' +
    '- Global yDomain and ticks:\n' +
    '  - Global yDomain: [-1.1, 145.70458333333332] (min from cycle_3 RPCG; max from cycle_2 WAUBRAWF)\n' +
    '  - Suggested yTicks: use D3 automatic ticks with nice() across this domain; if fixed ticks are required, one workable set is [-2, 0, 20, 40, 60, 80, 100, 120, 140, 160]\n' +
    '  - tickFormatHint: standardize to auto-2dp to safely display small decimals (e.g., 0.004) and high-precision maxima (e.g., 28.973424…)\n' +
    '- Consolidated per-date totals (summing reported per-cycle values; dates normalized to ISO):\n' +
    '  - 2023-11-02: 69.91014775\n' +
    '  - 2023-11-03: 154.96340849999997\n' +
    '  - 2023-11-04: 335.03266120833333 (79.58323216666667 + 255.44942904166666)\n' +
    '  - 2023-11-05: 93.56824208333334\n' +
    '  - Caution: This assumes no duplicate installation-date rows across cycles; if cycles overlapped, these totals would overcount. Deduplicate by (installation, date, interval) before final aggregation.\n' +
    '- Global extrema across all cycles:\n' +
    '  - global_min: -1.1 at RPCG on 2023-11-05\n' +
    '  - global_max: 145.70458333333332 at WAUBRAWF on 2023-11-04\n' +
    '- Data quality aggregate:\n' +
    '  - Total processed_rows (as reported): 20 + 160 + 20 + 20 = 220\n' +
    '  - Skipped_rows sum: 1 + 0 + 2 + 2 = 5\n' +
    '  - Out_of_scope_date_rows sum: 0 + 0 + 1 + 0 = 1\n' +
    '  - Notable inconsistencies:\n' +
    '    - Date format mismatch (MM/DD/YYYY vs ISO)\n' +
    '    - cycle_3 reports xDomain with four dates but n_dates = 1; ensure missing dates are explicitly represented (0 or null) or excluded consistently\n' +
    '    - cycle_1 counts indicate 160 processed rows within a single cycle that’s expected to contain 20 rows\n' +
    '- Coverage observations:\n' +
    '  - n_installations reported per cycle: 16, 22, 20, 19; true union size cannot be determined from truncated series (“...”). Energy sources observed across cycles: at least 7.\n' +
    '\n' +
    'Validator’s assessment of sufficiency for constructing the 2D graph\n' +
    '- What is sufficient now:\n' +
    '  - A consistent xDomain can be established (the same four dates).\n' +
    '  - A safe global yDomain and reasonable tick strategy can be set from the extrema.\n' +
    '  - Aggregated per-date totals can support a totals-by-day series or bars if desired.\n' +
    '- What is insufficient or risky for a full multi-series time-series plot:\n' +
    '  - Series data are truncated (“...”) in every cycle; you cannot render all installation-level lines without the complete series arrays.\n' +
    '  - Potential duplication across cycles cannot be ruled out; totals may overcount unless deduplicated.\n' +
    '  - Mixed date formats will break time parsing unless normalized; cycle_3’s n_dates inconsistency could mislead scale or imputation if not handled.\n' +
    '  - Mixed tickFormatHints (auto-1dp vs auto-2dp) should be standardized to avoid inconsistent label precision.\n' +
    '- Recommended actions for D3JS Coordinating Agent:\n' +
    '  - Normalize all dates to ISO (YYYY-MM-DD) before merging.\n' +
    '  - Deduplicate by unique key (installation_id, date) when consolidating series across cycles.\n' +
    '  - Merge series arrays across cycles into a single series[] keyed by installation, preserving energy_source.\n' +
    '  - Use the consolidated global yDomain [-1.1, 145.70458333333332]; apply d3.scaleLinear().nice() for tick calculation; clamp to domain.\n' +
    '  - Standardize formatting to 2 decimal places for y-axis labels; optionally drop trailing zeros for compactness.\n' +
    '  - Treat missing installation-date values explicitly (null for gaps if you want line breaks, or 0 if domain logic requires zero).\n' +
    '  - Keep negative MW values; they are present and affect domain and interpretation.\n' +
    '  - Validate per-cycle counts vs the “20 rows per cycle” expectation; if cycle_1 indeed aggregated more than 20 rows, confirm ingestion boundaries to avoid double counting.\n' +
    '\n' +
    'If you want a single consolidated specification scaffold for the renderer (with only safe, non-invented fields):\n' +
    '- xDomain: ["2023-11-02", "2023-11-03", "2023-11-04", "2023-11-05"]\n' +
    '- yDomain: [-1.1, 145.70458333333332]\n' +
    '- yTicks: let D3 compute with nice(); or use [-2, 0, 20, 40, 60, 80, 100, 120, 140, 160]\n' +
    '- tickFormatHint: auto-2dp\n' +
    '- per_date_totals: as listed above\n' +
    '- extrema:\n' +
    '  - min_point: { installation: "RPCG", date: "2023-11-05", mw: -1.1 }\n' +
    '  - max_point: { installation: "WAUBRAWF", date: "2023-11-04", mw: 145.70458333333332 }\n' +
    '- notes:\n' +
    '  - series arrays provided in cycles are incomplete and must be reassembled from full data to render all installations\n' +
    '  - mixed date formats and possible cycle overlap should be resolved during consolidation',
  success: true,
  timestamp: 2025-09-09T00:29:56.139Z
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
    '      "missing_values": "null_breaks_line"\n' +
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

export { csvContent, agentData };