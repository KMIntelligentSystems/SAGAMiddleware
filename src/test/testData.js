

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

export { csvContent };