// SAGA state management for visualization workflow

export interface SagaState {
  id: string;
  status: 'initializing' | 'gathering_requirements' | 'filtering_data' | 'specifying_chart' | 'generating_report' | 'coding_visualization' | 'awaiting_human_approval' | 'completed' | 'failed';
  currentTransaction: number;
  totalTransactions: number;
  
  
  errors: string[];
  startTime: Date;
  endTime?: Date;
  compensations: CompensationAction[];
}

export interface CompensationAction {
  transactionId: string;
  agentName: string;
  action: 'cleanup_thread' | 'release_data' | 'reset_state' | 'notify_failure';
  executed: boolean;
  timestamp: Date;
}

export interface SagaTransaction {
  id: string;
  name: string;
  agentName: string;
  agentType?: 'tool' | 'processing';
  dependencies: string[];
  transactionSetId?: string;
  transactionPrompt?: string,
  compensationAgent?: string;
  compensationAction?: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'compensated';
  iterationGroup?: string; // For grouping transactions that iterate together
  iterationRole?: 'coordinator' | 'fetcher' | 'processor' | 'saver' | 'generator' | 'reflector'; // Role in iteration cycle
}

// New interfaces for iteration management
export interface IterationState {
  transactionGroupId: string;
  currentIteration: number;
  chunkIds: string[];
  currentChunkIndex: number;
  currentChunkId?: string;
  maxIterations?: number;
  iterationResults: any[];
  finalizationCondition?: string; // Function name or condition
  metadata: {
    collectionName?: string;
    totalChunks?: number;
    processedChunks: number;
    startTime: Date;
    lastIterationTime?: Date;
  };
}

export interface IterationConfig {
  groupId: string;
  maxIterations?: number;
  chunkBatchSize?: number;
  finalizationCondition?: (state: IterationState) => boolean;
  onIterationComplete?: (iteration: number, result: any) => void;
  onGroupComplete?: (state: IterationState) => void;
}

// Configuration for the human-in-the-loop system
export interface HumanInLoopConfig {
  // Timeout configurations (in milliseconds)
  //timeouts: TimeoutStrategy;
  
  // Service endpoints
  services: {
    ragService: string;
    codingService: string;
    humanInterface: string;
    persistence: string;
  };
  
  // Event bus configuration
  eventBus: {
    url: string;
    topics: string[];
    retryAttempts: number;
  };
  
  // Human interface configuration
  humanInterface: {
    approvalBaseUrl: string;
    emailNotifications: boolean;
    slackNotifications?: boolean;
    webhookUrl?: string;
  };
  
  // Persistence configuration
  persistence: {
    provider: 'database' | 'file' | 'redis';
    connectionString?: string;
    retentionDays: number;
    backupEnabled: boolean;
  };
}

export const agentDefinitionPrompt = `You have two tasks:
1. Your task is to depict the flow of data processing in a set of agents. The agents are defined below by this format: [AGENT name, id]instructions[/AGENT]
In a multi-agent environment, the flow of information from one agent to another can be one of these four configurations which are mutually exclusive and self-contained, 
that is in their own transaction set:
A. Singletons: Data_Saving_Id
B. Self-referencing: Data_Processing_Id_1 -> Data_Processing_Id_1
C. Linear chain: Data_Presenting_Id -> Data_Processing_Id_1...->Data_processing_Id_n
D. Cyclic chain: Data_Fetching_Id -> Data_Processing_Id_1 ->...->Data_Rpocessing_Id_n -> Data_Fetching_Id 
The context in which the agents operate will indicate to you into which category they naturally fall.
Particular contexts where the agent is not part of the intrinsic flow but logically connected runs extraneously in the infrastructure. One such is Data saving agent which runs only after all the 
data is fetched and processed by other agents. Such agents will be depicted at the end of the chain as --agent_id

Following your understanding of the flows, your final output will have this format:
<flow>The agent ids depicted as descibed</flow>. For example:
<flow>Data_Fetching_Id -> Data_Processing_Id_1 -> Data_Processing_Id_2 ->...-> Data_Rpocessing_Id_n -> Data_Fetching_Id  -- Data_Saving_Id</flow> substituting for the real agent ids.
Remember the ids are in [AGENT name, id] and you only examine as far as each agent's end tag: [/AGENT]. Anything outside these tags is irrelvant for your purposes.
2. Your second task is to nominate those agents which are tool users and provide their names in the following format:
{"toolUsers": [agent names]}. NOTE: singletons are not tool users. In this case return {"toolUsers": []}
`;
//cyclic task 
//Checks that user query has correctly been parsed as [AGENT: etc]
export const dataValidatingAgentPrompt = `You will validate two inputs, one against the other. The first input is a set of instructions for the building of two agents.
The second input is the formatted construction of those agents. There are certain rules that you must understand from the first input to determine if the second input follows the rules.
The rules are:
1. Does the output create two distinct agents with their tasks clearly defined based on your analysis of the first input?
2. Are the agents clearly delimited with these tags: '[AGENT: agent name, agent Id ]' followed by the instructions then ending with '[/AGENT]' or '[ / AGENT]?
If these rules are not met, rectify the output accordingly`;

export const SVGInterpreterPrompt = `You will be provided with a set of  SVG elements. Examine closely the structure and semantics of the elements. Provide a concise and
structured output eliciting the meaning and structure of the SVG elements.`

export const pythonCodeValidatingAgentPrompt = `You will validate python code. You will examine the code to determine:
1. Are there any syntax errors
2. Is the code complete
4. Does the code use python libraries such as pandas
If there are problems, for each problem show the problem line of code, show the fix for that problem, provide a comment about the problem. Thus provide this output for all problems.
If there are no problems, simply return: {success: true}`

export const d3CodeValidatingAgentPrompt = `You will validate d3 js code. You will examine the code to determine:
1. Are there any syntax errors
2. Is the code complete, for example, there is a beginning <html> and a concluding </html> tag
4. Does the code use d3 js libraries such as d3.axisLeft(), d3.axisBottom(), d3.line and other functions from "https://d3js.org/d3.v7.min.js"
If there are problems, for each problem show the problem line of code, show the fix for that problem, provide a comment about the problem. Thus provide this output for all problems.
If there are no problems, simply return: {success: true}`;

export const csvAnalysisRefectingAgentPrompt_ = `You will be given a summary of data and instructions that are intended to provide enough information to a coding agent to create a 2-d graph of data.
The data is provided as a csv file. But the coding agent whose task is to build the code to generate the graph cannot be provided the csv file at build time because of size constraints.
Therefore, a report is provided by another agent to assist the coding agent. Your task is to challenge and question the report in terms of being clear, logical and concise. Examine the report and think how well 
the coding agent would have a clear understanding of what it must do. Are all categories provided? Is there a min and max and tick values for the axes? Challenge the report. You must provide a critique`;

export const csvAnalysisRefectingAgentPrompt = `You will be given a summary of data and instructions that are intended to provide enough information to a coding agent to create a 2-d graph of data.
The d3 js coding agent can only be provided the csv data at run time. At build time the coding agent is provided with a synopsis of the data. Examine this synopsis. Ask yourself can a d3 js code build the code using this synopsis. What changes would you make to
the synopsis to assist the coding agent. What information should be added? What information can be removed which appears unnecessary. Remember all the csv data cannot be provided at build time.`;

export const groupingAgentPrompt = `Your role is coordination based on your analysis of errors in python code. 
You will receive the output of a tool call which runs python code sent to it. This output will register either success or failure. In the case of failure, 
you will provide a report to the coding agent with your interpretation of the error and the likely causes. The coding agent is then responsible to fix the error. If there
are no errors then simply provide the tool response to the coding agent. `;

export const codingAgentErrorPrompt = `The code you created has errors. Look at the errors and a fix that has been provided. You can also see the code with errors. 
Understand the problems and provide clean and complete python code that fixes the problems. You will find the problem in <context></context>. Your previous incorrect code is:
`
export const D3JSCoordinatingAgentAnalysis = `Your role is validator acting on behalf of a d3 js coding agent. THe coding agent will be provided with a csv data file at run time. But because of size constraints in the Context Window, this file cannot be  provided to the
coding agent at build time. Therefore, an analysis of the csv data is provided in your <context>. Examine this analysis and extract the minimum amount of information to assist the coding agent. For example, you will provide data points for the x-y axes.
You will provide the labels for the data items.  Provide as much information as you think is required to assist the coding agent to create code at build time remembering that the csv data will be provided at run time`;

export const D3JSCodeValidationResultPrompt = `You are a coding agent working in a team of other agents. You have these tasks:
1. <Think> about the code in PREVIOUS CODE and identify problems
2. Look at the EVALUATION of the previous code 
3. Update the code following fixes suggested in the EVALUATION`;

export const D3JSCodeValidationResultPrompt__ = `You are a coding agent working in a team of other agents. You have these tasks:
1. <Think> about the code in PREVIOUS CODE and identify problems
2. Look at the EVALUATION of the previous code 
3. Write the code following any instructions in the evaluation
4. Check that your new code meets the instructions of the evaluation`;

export const D3JSCodeValidationResultPrompt_ = `You are a coding agent working in a team of other agents. You have these tasks:
1. Understand the user requirement for the d3 js code you must code
2. <Think> about the code
3. Look at the EVALUATION of the previous code 
4. Write the code following any instructions in the evaluation`;

export const SVGValidationPrompt = `You are a validating and advising agent. You will receive information concernning requirements for a 2-d graphical representation of structured data and you will receive another agent's summaary of the SVG elements which represents
the graphical display of that data. Therefore, you have these tasks:
1. You will understand the requirements and their analogus structure of the SVG elements
2. You will look at the agent's report. The basis of which is the SVG representation
Finally, you will affirm or not that the requirements seem to be met by providing {affirmed: yes/no}. In case of the negative provide explanations.
As a bonus in the affirmative case, can you see any enhancements that could be made. You will find the actual SVG elements enclosed`

export const D3JSCoordinatingAgentChallengePrompt = `In <context> are 2 items: 1. Your initial report which summarized csv data and provided instructions for generating code to produce a 2-d graph baed on the csv data ; 2. A critique of your initial report.
Your task is to apply the critique to your initial report. You must provide the next report as concisely as possible meeting the issues raised in the critique. Importantly, remember this is for a coding agent which only requires the specification. 
You must provide new instructiosn as succinctly as possible`
/*
FORBIDDEN ACTIONS:
❌ Do NOT summarize the input you receive  
❌ Do NOT comment on the input you receive
❌ Do NOT interpret what you receive
❌ Do NOT provide any other output than that specifically requested: 

Your output will consist of one line of information delimited by <flow> and </flow>. If there is more information than this then  you have failed in your task! Do exactly as requested: no more and no less.
*/

export const sagaPrompt = `Role and Purpose
You are the Data Pipeline Coordinator Meta-Agent. Your role is to analyze user-provided data requirements and generate specific, actionable instructions for a sequence of data processing agents. You must create concrete instructions using the user's actual data structure, field names, and requirements - not generic examples.
Agent Capabilities Knowledge
You have access to these agents with the following capabilities:
Available Agents:
{
"DataFilteringAgent": {
"primary_function": "Execute MCP tools with structured queries",
"specializations": ["Handle JSON query parameters", "Process pagination", "Return raw API responses"]



},
"DataExtractingAgent": {
"primary_function": "Extract and flatten nested data structures into uniform arrays",
"specializations": ["Handle nested object extraction", "Preserve field ordering", "Filter unwanted metadata"]
},
"DataNormalizatingAgent": {
"primary_function": "Standardize field formats and data types across records",
"specializations": ["Convert date/time formats", "Standardize text fields", "Normalize numeric precision"]
},
"DataGroupingAgent": {
"primary_function": "Organize records into hierarchical structures based on specified keys",
"specializations": ["Multi-level grouping", "Time-based grouping", "Preserve or summarize records within groups"]
},
"DataAggregatingAgent": {
"primary_function": "Compute summary statistics and transform grouped data into final output format",
"specializations": ["Mathematical aggregations", "Array value extractions", "Custom business logic calculations"]
}
}
Required Input Format
You will receive user input containing:

Data Structure: Example data format from vector store/database
Query Parameters: Collection name, filters, limits, tool name, etc.
Transformation Requirements: Specific normalization, grouping, and aggregation needs
Desired Output: The exact final structure format

Input Processing Rules
When you receive user input, extract and analyze:

Data Structure: The actual format of data in the vector store/database
Query Parameters: Collection name, filters, limits, tool name
Transformation Requirements: Specific normalization, grouping, and aggregation needs
Output Format: The exact final structure the user wants

Critical Instructions

Use ACTUAL user data: All examples must use the user's specific field names, data types, and structure
Be CONCRETE: No generic examples like "user_id", "name", "age" - use the user's real fields
Follow EXACT requirements: Match the user's specified transformations precisely
Maintain data flow: Ensure each agent's output matches the next agent's expected input

Required Output Format - CRITICAL
You MUST use this exact format for each agent's instructions:
[AGENT: DataFilteringAgent]
[Instructions here]
Expected Input: [Description]
Expected Output: [Description]
Example Output:
jsonCopy[JSON example]
[/AGENT]
[AGENT: DataExtractingAgent]
[Instructions here]
Expected Input: [Description]
Expected Output: [Description]
Example Output:
jsonCopy[JSON example]
[/AGENT]
[AGENT: DataNormalizingAgent]
[Instructions here]
Expected Input: [Description]
Expected Output: [Description]
Example Output:
jsonCopy[JSON example]
[/AGENT]
[AGENT: DataGroupingAgent]
[Instructions here]
Expected Input: [Description]
Expected Output: [Description]
Example Output:
jsonCopy[JSON example]
[/AGENT]
[AGENT: DataAggregatingAgent]
[Instructions here]
Expected Input: [Description]
Expected Output: [Description]
Example Output:
jsonCopy[JSON example]
[/AGENT]
Format Rules - DO NOT DEVIATE

Opening tag: [AGENT: agent_name] (with colon and space)
Closing tag: [/AGENT] (NOT [/agent_name])
Agent names: Use exactly 'DataFilteringAgent', 'DataExtractingAgent', 'DataNormalizingAgent', 'DataGroupingAgent', 'DataAggregatingAgent'
Include Expected Input, Expected Output, and Example Output sections for each agent
JSON examples must be properly formatted with triple backticks

Agent Instruction Generation Rules
For DataFilteringAgent - CRITICAL EXACT JSON REQUIREMENT:
MANDATORY TEMPLATE TO USE:
CopyYou are the DataFilteringAgent. Your ONLY task is to execute the structured_query tool with the EXACT JSON parameters provided below. 

**CRITICAL RULES - NO EXCEPTIONS:**
1. Use the JSON parameters EXACTLY as shown below
2. Do NOT add any fields (especially "search_text")
3. Do NOT remove any fields  
4. Do NOT modify field names or values
5. Do NOT interpret or transform the query in any way
6. ONLY change the {page} placeholder to the actual page number

**MANDATORY JSON PARAMETERS TO USE:**
json
[Insert user's exact query JSON here]
EXECUTE THIS EXACT TOOL CALL:
structured_query([Insert user's exact query JSON here])
FORBIDDEN ACTIONS:
❌ Do NOT add "search_text" field
❌ Do NOT convert "metadata_filters" to anything else
❌ Do NOT change any field names
❌ Do NOT add any additional parameters
❌ Do NOT remove any existing parameters
❌ Do NOT modify the structure in any way
YOUR RESPONSE MUST BE:

Execute structured_query tool with the exact JSON above
Return the raw API response without modification

Execute the tool call now using the exact parameters specified above.
Copy
**FORBIDDEN MODIFICATIONS for DataFilteringAgent:**
❌ Converting metadata_filters to search_text
❌ Changing field names or structure
❌ Interpreting or transforming any part of the query
❌ Adding fields not in the original query
❌ Removing fields from the original query

**REQUIRED BEHAVIOR for DataFilteringAgent:**
✅ Pass the complete JSON exactly as the user provided it
✅ Only substitute the {page} placeholder with actual page number
✅ Preserve all original field names and structure
✅ Maintain exact same nesting and data types

### For DataExtractingAgent:
- Reference the user's specific nested structure (e.g., "energy_generation" objects)
- Use the user's actual field names in examples
- Preserve any ordering requirements specified by user

### For DataNormalizatingAgent:
- Apply the user's specific transformation rules (e.g., "Convert date to YYYY-MM-DD format")
- Use the user's actual field names
- Show before/after examples with user's data

### For DataGroupingAgent:  
- Group by the user's specified keys
- Create the exact structure format the user requested
- Use user's actual field names and grouping requirements

### For DataAggregatingAgent:
- Transform into the user's specified final format
- Use the user's actual field names
- Show the exact output structure the user wants

## Input Validation
If you receive a request without complete user specifications, respond with:

"I need the following information to generate specific agent instructions:

1. **Data Structure**: What does the actual data look like in your vector store? (Provide example record)
2. **Query Parameters**: What is your exact structured query? (JSON format)  
3. **Tool Name**: What MCP tool should be called?
4. **Transformations**: What specific normalization, grouping, and aggregation do you need?
5. **Desired Output**: What should the final result structure look like? (Provide example)

Please provide these details so I can generate concrete instructions using your actual field names and requirements."

## Validation Requirements
Before generating instructions, verify:
- [ ] All examples use user's actual field names
- [ ] Data transformations match user's specific requirements  
- [ ] Output formats match user's desired structure
- [ ] Data flow is consistent between agents
- [ ] No generic placeholder data is used
- [ ] DataFilteringAgent uses the mandatory exact JSON template

## Error Prevention
- **NEVER** use generic examples like "user_data", "name", "age"
- **ALWAYS** use the user's specific field names like "energy_generation", "datetime", "category_type"
- **NEVER** assume data structure - use exactly what the user provides
- **ALWAYS** match the user's exact output format requirements
- **CRITICAL**: Follow the '[AGENT: agent_name]...[/AGENT]' format exactly
- **CRITICAL**: For DataFilteringAgent, always use the mandatory template that prevents JSON modifications

## Success Criteria
Your instructions are successful when:
1. Each agent receives clear, specific instructions using user's actual data
2. All examples contain the user's real field names and structure
3. The processing pipeline produces exactly the output format the user specified
4. Data flows correctly from one agent to the next
5. No generic placeholder data appears anywhere in the instructions
6. The exact '[AGENT: agent_name]...[/AGENT]' format is used consistently
7. DataFilteringAgent receives the restrictive template that prevents JSON modifications

Now process the user's requirements and generate the specific agent instructions using the required format.Add to Conversation`

export const transactionGroupConversationPrompt = `
Your role is to group transactions for topographically ordered agents executing the transactional flow. 
You will coalesce the user requirements into a set of instructions for agents participating in data operations. Specifically, the temporality of data fetching, manipulating and saving to a vector store. You are a transaction operator providing user requirements to
the agents involved in the process and finally, providing input into the data saving. 
These agents are in your transaction group. The purpose of the group concerns data operations. The agents tasks are:
**DataLoadingAgent**
This is a MCP tool calling agent. Its task is to provide to provide instructions to a tool to enable the tool to load data to a store.
**DataFilteringAgent**
This is a MCP tool calling agent. Its task is to provide a structured query on a collection using user provided requirements. The querying of the collection returns data in manageable chunks. Hence, this agent will always be part of a cyclic operations until all chunks are retrieved. You will receive information from this agent directly concerning the finalization of data fetching. 
**DataExtractingAgent**
This is a processing agent. It receives input from the DataFilteringAgent one chunk at a time. Its task is to flatten the JSON which is how the records are stored in the collection.
**DataNormalizingAgent**
This is a processing agent. It receives input from the DataExtractingAgent. It will follow user requirements to standardise a particular attribute, such as the date attribute.
**DataGroupingAgent**
This is a processing agent. It receives input from the DataNormalizingAgent. It groups the data following user input.
**DataAggregatingAgent**
This is a processing agent. It receives input from the DataGroupingAgent. It will be provided with instructions in how to aggregate the data. It is the last agent in the cycle.
**DataSavingAgent**
This is a tool calling agent. You will interact directly with this agent providing user requirements about saving the data to stora. This is a temporally ordered agent in that it is called when all the data processing has finalized.
**ConversationAgent**
This is a processing agent. You will receive the user requirements from this agent. This agent is independent of you. It is the conduit of information to you. 

There are three sets of tranactions to be run in order:
1. Load the data to a store using the information in Step 1: Data Loading
2. Fetch and process the data following the instructions for Step 2: Data Coordination
3. Save the processed data from step 2 to permanent storeage using the instructions for Step 3: Data Saving

Therefore, you will be aware of and participate in each step of the flow. The difficulty is the temporality of the flows. Therefore, it is critical that you pass on knowledge and complete understanding of the current context to the next set of transactional agents.
As your role is organizing the transactional flow, you will be the first agent in each of the step sets except step 1 where you will get instructions from the ConversationAgent conveying user requirements. Therefore, you will be sending your complete analysis and understanding 
to yourself. You will be identified as 'TransactionGroupingAgent'. 

You will find the user's requirement for the three steps in <content>(user requirement steps)</context>. Extract the instructions for each step.

This is the start of the process. You are at step 1. Therefore, provide the instructions to DataLoadingAgent. The format for this agent and all the agents is of the form: [AGENT: agent name]user's instructions[/AGENT]. For step 1, you will provide:
[AGENT: DataLoadingAgent]user's instructions for data to process and provide instructions that the data loading agent must provide the user's instructions without modification[/AGENT]. You must pass on the instuctions precisely as you find them at step 1 of the user input and place them betweem [AGENT: DataLoadingAgent] and [/AGENT].
The DataFilteringAgent needs to be provided with constraints. Add this to [AGENT:  DataFilteringAgent]:
"**FORBIDDEN MODIFICATIONS for DataFilteringAgent:**
❌ Converting metadata_filters to search_text
❌ Changing field names or structure
❌ Interpreting or transforming any part of the query
❌ Adding fields not in the original query
❌ Removing fields from the original query"
as well as the user instructions and end with [/AGENT]

You must pay close attention to any instructions marked **CRITICAL**

`;

/*
As well as the user requirement add this message after [AGENT DataLoadingAgent]
**FORBIDDEN MODIFICATIONS for DataLoadingAgent:**
❌ Changing field names or structure
❌ Interpreting or transforming any part of the query
❌ Adding fields not in the original query
❌ Removing fields from the original query
This will ensure that the agent passes the full instructions to the data store.
2. [AGENT: DataFilteringAgent]user's instructions to you[/AGENT]. 
 [AGENT: DataFilteringAgent]user's instructions to you[/AGENT]
[AGENT: DataExtractingAgent]user's instructions to you[/AGENT]
[AGENT: DataNormalizingAgent]user's instructions to you[/AGENT]
[AGENT: DataGroupingAgent]user's instructions to you[/AGENT]
[AGENT: DataAggregatingAgent]user's instructions to you[/AGENT]. These will be instructions concerning the data fetching and manipulating. Therefore, you must pass on your understanding of the agents as defined above in this flow in order for you to give 
the assistance required to understand how to provide meaningful instructions to these agents. The 
3. [AGENT: DataSaving]Instructions for data saving[/AGENT]


3. [AGENT: DataSaving]Instructions for data saving[/AGENT]
For example: between [AGENT: DataFilteringAgent] and [/AGENT] provide the precise instructions for the structured query tool. Likewise for the other agents. Your output will be a list of all these agents properly formatted with their precise user instructions and examples.
The DataFilteringAgent needs to be provided with constraints. Add this to [AGENT:  DataFilteringAgent]:
"**FORBIDDEN MODIFICATIONS for DataFilteringAgent:**
❌ Converting metadata_filters to search_text
❌ Changing field names or structure
❌ Interpreting or transforming any part of the query
❌ Adding fields not in the original query
❌ Removing fields from the original query"
as well as the user instructions and end with [/AGENT]`
 */

export const transactionGroupPrompt = `To understand your role and your activity to this point look at your <context></context>. There you will find previous interactions concerning the three steps for data processing: loading, processing and saving. 
You are up to Step 2 now. You must provide the instructions for building each of the agents involved in data processing, pay close attention to these agents:
**DataFilteringAgent**
**DataExtractingAgent**
**DataNormalizingAgent**
**DataGroupingAgent**
**DataAggregatingAgent**
You will find the user requirements for Step 2 under User Requirments. Align each of these agents with the instructions and examples provided at Step 2. You will format the instructions for each agent as:

[AGENT: DataFilteringAgent]user's instructions to you and instructions from you emphasizing that the structured query must be used exactly as provided without modification[/AGENT]
[AGENT: DataExtractingAgent]user's instructions to you[/AGENT]
[AGENT: DataNormalizingAgent]user's instructions to you[/AGENT]
[AGENT: DataGroupingAgent]user's instructions to you[/AGENT] 
`;

export const transactionSavingPrompt = `To understand your role and your activity to this point look at your <context></context>. There you will find previous interactions concerning the three steps for data processing: loading, processing and saving. 
You are up to Step 3 now. You must provide the user's instructions for Data Saving to the DataSavingAgent. Ensure the instructions are placed between [AGENT DataSavingAgent] and [/AGENT]`;


export const transactionGroupPrompt_ = `
Your role is to coalesce the user requirements into a set of instructions for agents participating in data operations. Specifically, the temporality of data fetching, manipulating and saving to a vector store. You are a transaction operator providing user requirements to
the agents involved in the process and finally, providing input into the data saving. 
These agents are in your transaction group. The purpose of the group concerns data operations. The agents tasks are:
**DataFilteringAgent**
This is a MCP tool calling agent. Its task is to provide a structured query on a collection using user provided requirements. The querying of the collection returns data in manageable chunks. Hence, this agent will always be part of a cyclic operations until all chunks are retrieved. You will receive information from this agent directly concerning the finalization of data fetching. 
**DataExtractingAgent**
This is a processing agent. It receives input from the DataFilteringAgent one chunk at a time. Its task is to flatten the JSON which is how the records are stored in the collection.
**DataNormalizingAgent**
This is a processing agent. It receives input from the DataExtractingAgent. It will follow user requirements to standardise a particular attribute, such as the date attribute.
**DataGroupingAgent**
This is a processing agent. It receives input from the DataNormalizingAgent. It groups the data following user input.
**DataAggregatingAgent**
This is a processing agent. It receives input from the DataGroupingAgent. It will be provided with instructions in how to group the data. It is the last agent in the cycle.
**DataCoordinatingAgent**
This is a processing agent. You will provide inputs to this agent based on user requirements for data based operations. You will interact with this agent directly. This agent then dynamically builds all of the data processing agents dealing with the structured data query .
**DataSavingAgent**
This is a tool calling agent. You will interact directly with this agent providing user requirements about saving the data to stora. This is a temporally ordered agent in that it is called when all the data processing has finalized.
**ConversationAgent**
This is a processing agent. You will receive the user requirements from this agent. This agent is independent of you. It is the conduit of information to you. 

**Your Tasks**
1. You will receive user requirements from the user via the ConversationAgent regarding the data operations. Specifically, it will provide this information:
   -The JSON format of the data in the vector store
   -The structured query which you must pass to DataCoordinatingAgent without modification or interpretation.
   -The tool name
   -The data normalizing requirements
   -The data grouping requirements
   -The data aggregating requirements
2. You will determine what information each agent needs from the details of the requirements. 
3. You will provide that information to DataCoordinatingAgent in a meaningful way so each agent will have the specific information they require for their tasks.
4. You will be alerted by the DataFilteringAgent which is the start and finish of the chunk fetching cycle:
  -Has more chunks will be false. This will signal the data is ready for storage
5. You will provide the necessary information to the data saving tool:
  -Name of MCP tool which will do further operations on the data in the MCP server.
  -Name of the collection where the data will be stored in the vector store.
  -Name of file path where the data will be saved
  -Example of the type of data to be saved
Do not pass this information to DataCoordinatingAgent. You will provide the information to the DataSavingAgent after the processing by the DataCoordinating agent. Thus the data coordination is Phase 1 and the data saving is Phase 2.

Each of these items will come with examples.

**CRITICAL**
Phase 1
Provide the requirements and examples without modification. However, provide additional information which may enable DataCoordinatingAgent to build better instructions for creating the data management agents dynamically. 
For example, provide the agent's name with its specific requirements and examples.
Phase 2
Provide the information required to save the data`

export const SAGA_CONVERSATION_TRANSACTIONS: SagaTransaction[] = [
  // Transaction Set 1: Requirements Gathering SAGA
  {
    id: 'tx-2',
    name: 'Define agents',
    agentName: 'TransactionGroupingAgent',
    dependencies: ['tx-3'],
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  },
  { id: 'tx-3',
    name: 'Validator',
    agentName: 'ValidatingAgent',
     dependencies: ['tx-2'],
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  }/*,
  { id: 'tx-2',
    name: 'Define flows',
    agentName: 'TransactionGroupingAgent',
     dependencies: [],
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  }*/
];
//this.agentFlows.push(['tx-2', 'tx-2']) to use agentDefinitionPrompt in sagaCoord constructor


export const SAGA_AGENT_GEN_TRANSACTIONS: SagaTransaction[] = [
  { id: 'tx-2',
    name: 'Coordinator',
    agentName: 'TransactionGroupingAgent',
     dependencies: [],
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  }
];

export const SAGA_D3_AGENT_GEN_TRANSACTIONS: SagaTransaction[] = [
  { id: 'tx-5',
    name: 'Coordinator',
    agentName: 'D3JSCoordinatingAgent',
     dependencies: [],
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  }
];


export const SAGA_CODE_VALIDATION_TRANSACTIONS: SagaTransaction[] = [
  // Transaction Set 1: Requirements Gathering SAGA
  { id: 'tx-2',
    name: 'Coordinator',
    agentName: 'TransactionGroupingAgent',
     dependencies: ['tx-2'],
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  }
];

export const SAGA_VISUALIZATION_TRANSACTIONS: SagaTransaction[] = [
  // Transaction Set 1: Requirements Gathering SAGA
  {
    id: 'tx-4',
    name: 'Define agents',
    agentName: 'VisualizationCoordinatingAgent',
    dependencies: ['tx-3'],
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  },
  { id: 'tx-3',
    name: 'Validator',
    agentName: 'ValidatingAgent',
     dependencies: ['tx-2'],
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  },
  {   id: 'tx-4',
    name: 'Define agents',
    agentName: 'VisualizationCoordinatingAgent',
    dependencies: [],
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  }
];

export const SAGA_D3_ANALYSIS_TRANSACTIONS: SagaTransaction[] = [
  // Transaction Set 1: Requirements Gathering SAGA
  {
    id: 'tx-5',
    name: 'Define agents',
    agentName: 'D3JSCoordinatingAgent',
    dependencies: ['tx-5'],
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  }
];

export const SAGA_D3_RESULTS_TRANSACTIONS: SagaTransaction[] = [
  // Transaction Set 1: Requirements Gathering SAGA
  {
    id: 'tx-5',
    name: 'Coordinate Coding',
    agentName: 'D3JSCoordinatingAgent',
    dependencies: ['tx-6'],
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  }, {
    id: 'tx-6',
    name: 'Challenge Analysis',
    agentName: 'D3AnalysisChallengingAgent',
    dependencies: [],
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  }
];

export const SAGA_D3_CODING_TRANSACTIONS: SagaTransaction[] = [
  // Transaction Set 1: Requirements Gathering SAGA
   {
    id: 'tx-7',
    name: 'd3 js Code',
    agentName: 'D3JSCodingAgent',
    dependencies: [],//with 'tx-3' cannot find tx-3: 🔄 Executing Transaction: Validator (tx-3)IN SINNGLETON look at SAGA_VISUALIZATION_TRANSACTIONS
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  },
  { id: 'tx-3',
    name: 'Validator',
    agentName: 'ValidatingAgent',
    dependencies: ['tx-7'],
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  }, {
    id: 'tx-7',
    name: 'd3 js Code',
    agentName: 'D3JSCodingAgent',
    dependencies: [],
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  }
];

// Transaction definitions for visualization SAGA
export const SAGA_TRANSACTIONS: SagaTransaction[] = [
  // Transaction Set 1: Requirements Gathering SAGA
 /* {
    id: 'tx-1',
    name: 'Start Conversation',
    agentName: 'ConversationAgent',
    dependencies: [],
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  },*/
  { id: 'tx-2',
    name: 'Index files',
    agentName: 'TransactionGroupingAgent',
     dependencies: [],
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  }/*
    agentName: 'DataCoordinatingAgent',
    dependencies: [],
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  }*/,
  {
    id: 'tx-4',
    name: 'Apply RAG Tool',
    agentName: 'DataFilteringAgent',
    dependencies: ['tx-4-1'],
    compensationAction: 'cleanup_thread',
    status: 'pending'
  },
  {
    id: 'tx-4-1',
    name: 'Data Extractor',
    agentName: 'DataExtractingAgent',
    dependencies: ['tx-4-2'], // Depends on DataPresentingAgent
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  },
   {
    id: 'tx-4-2',
    name: 'Data Normalizer',
    agentName:  'DataNormalizingAgent',
    dependencies: ['tx-4-3'], // Depends on DataExtractingAgent
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  },
   {
    id: 'tx-4-3',
    name: 'Data Grouper',
    agentName:  'DataGroupingAgent',
    dependencies: ['tx-4-4'], // Depends on DataNormalizingAgent
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  },
   {
    id: 'tx-4-4',
    name: 'Data Finalizer',
    agentName:  'DataAggregatingAgent',
    dependencies: ['tx-4'],// Depends on DataGroupingAgent and cycles back to DataFilteringAgent
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  }
];

export const SAGA_CONTINUATION: SagaTransaction[] = [
  { id: 'tx-2',
    name: 'Index files',
    agentName: 'TransactionGroupingAgent',
     dependencies: ['tx-5'],
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  },
   {
    id: 'tx-5',
    name: 'Data Finalizer',
    agentName:  'DataSavingAgent',
    dependencies: ['tx-5'],// Depends on DataGroupingAgent and cycles back to DataFilteringAgent
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  }];

// Multi-Set Transaction Architecture Interfaces

export interface TransactionSet {
  id: string;
  name: string;
  description: string;
  prompt?: string;
  transactionSetId?: string;
  transactions: SagaTransaction[];
  dependencies?: string[]; // Other set IDs this set depends on
  executionCondition?: (context: any) => boolean; // Optional condition for execution
  transitionRules?: SetTransitionRule[]; // How to transition to next sets
}

export interface SetTransitionRule {
  sourceSetId: string;
  targetSetId: string;
  transitionCondition?: (result: any) => boolean;
  contextMapping?: { [sourceKey: string]: string }; // Map context keys between sets
}

export interface TransactionSetCollection {
  id: string;
  name: string;
  description: string;
  sets: TransactionSet[];
  executionOrder: string[]; // Ordered list of set IDs to execute
  globalTransitionRules?: SetTransitionRule[];
  metadata?: {
    version: string;
    author?: string;
    created: Date;
    lastModified?: Date;
  };
}

export interface SetExecutionContext {
  setId: string;
  setName: string;
  executionOrder: number;
  totalSets: number;
  previousSetResults?: { [setId: string]: any };
  sharedContext?: { [key: string]: any };
}

export interface SetExecutionResult {
  setId: string;
  success: boolean;
  result: any;
  error?: string;
  executionTime: number;
  transactionResults: { [transactionId: string]: any };
  metadata: {
    startTime: Date;
    endTime: Date;
    transactionsExecuted: number;
    transactionsFailed: number;
  };
}

export interface AnalysisResult {
  isErrorFree: boolean;
  errorDetails?: string;
  message: string;
}

// Default Transaction Set Collection SAGA_CONVERSATION_TRANSACTIONS
export const DEFAULT_SAGA_COLLECTION: TransactionSetCollection = {
  id: 'default-saga-collection',
  name: 'Default SAGA Workflow',
  description: 'Standard data processing and saving workflow',
  sets: 
  
  [
    { id: 'data-loading-set',
      name: 'Data Loading Pipeline',
      description: 'Final transaction grouping and data saving with self-referencing iterations',
      prompt: '',//transactionGroupConversationPrompt,
      transactions: SAGA_CONVERSATION_TRANSACTIONS
    },
    { id: 'agent-generating-set',
      name: 'Agent Generating Pipeline',
      description: 'Final transaction grouping and data saving with self-referencing iterations',
      prompt: agentDefinitionPrompt,
      transactions: SAGA_AGENT_GEN_TRANSACTIONS
    }
  ],
  executionOrder: ['data-loading-set', 'agent-generating-set'],
  metadata: {
    version: '1.0.0',
    created: new Date()
  }
};

//If errors then call this: 1. transactionGroupingAgent but flow is set in sagaCoordinator constructor  this.agentFlows.push(['tx-4','tx-3', 'tx-4']) which 
//cycles to fix the error
export const SAGA_CODE_VALIDATION_COLLECTION: TransactionSetCollection = {
  id: 'saga-validation-collection',
  name: 'SAGA Validation Flow',
  description: 'Standard validating',
  sets: 
  [
     { id: 'code-validating-set',
      name: 'Code Validating Pipeline',
      description: 'Final transaction grouping and data saving with self-referencing iterations',
      prompt: groupingAgentPrompt,
      transactions: SAGA_CODE_VALIDATION_TRANSACTIONS
    }
  ],
  executionOrder: [ 'code-validating-set'],
  metadata: {
    version: '1.0.0',
    created: new Date()
  }
};
//1. VisualizationCoordinatingAgent tx-4 creates PandasDailyAveragingCoder
export const SAGA_VISUALIZATION_COLLECTION: TransactionSetCollection = {
  id: 'visualization-saga-collection',
  name: 'Visualization SAGA Workflow',
  description: 'Standard data processing and saving workflow',
  sets: 
  
  [
    { id: 'visualization-loading-set',
      name: 'Data Loading Pipeline',
      description: 'Final transaction grouping and data saving with self-referencing iterations',
      prompt: '',//transactionGroupConversationPrompt,
      transactions: SAGA_VISUALIZATION_TRANSACTIONS //Provides the flow and tool calls for agentParser tx-4 -> tx-3 -> tx-4
    },
    { id: 'agent-generating-set',
      name: 'Agent Generating Pipeline',
      description: 'Final transaction grouping and data saving with self-referencing iterations',
      prompt: agentDefinitionPrompt, //used for second use of transactionGroupingAgent - npt needed for d3 analysis agent creator,
      transactions: SAGA_AGENT_GEN_TRANSACTIONS //tx-2
    }
  ],
  executionOrder: ['visualization-loading-set', 'agent-generating-set'],
  metadata: {
    version: '1.0.0',
    created: new Date()
  }
};

// D3 js coordinator creates analyzing agent D3 js agent tx-5 to analyse csv 
export const SAGA_D3_AGENT_GEN_COLLECTION: TransactionSetCollection = {
  id: 'saga-d3-agent-gen-collection',
  name: 'SAGA Validation Flow',
  description: 'Standard validating',
  sets: 
  [
     { id: 'd3js-agent-gen-set',
      name: 'Coordinator',
      description: 'Final transaction grouping and data saving with self-referencing iterations',
      prompt: '',
      transactions: SAGA_D3_AGENT_GEN_TRANSACTIONS //d3js-agent-gen-set'
    }
  ],
  executionOrder: ['c'],
  metadata: {
    version: '1.0.0',
    created: new Date()
  }
};

//analyzing agent D3 js agent tx-5 analyse csv, collate results, provide results to coding agent 
export const SAGA_D3JS_COLLECTION: TransactionSetCollection = {
  id: 'd3js-collection',
  name: 'D3 js SAGA Workflow',
  description: 'Standard data processing and saving workflow',
  sets: 
  
  [
    { id: 'd3js-analysis-set',
      name: 'D3 Analysis Pipeline',
      description: 'Provide analysis of csv file',
      prompt: '',//transactionGroupConversationPrompt,
      transactions: SAGA_D3_ANALYSIS_TRANSACTIONS //Provides the flow and tool calls for agentParser
    },
    { id: 'd3js-results-set',
      name: 'D3 Results Pipeline',
      description: 'Final transaction grouping and data saving with self-referencing iterations',
      prompt:  D3JSCoordinatingAgentAnalysis,
      transactions: SAGA_D3_RESULTS_TRANSACTIONS
    }
  ],
  executionOrder: ['d3js-analysis-set', 'd3js-results-set'],
  metadata: {
    version: '1.0.0',
    created: new Date()
  }
};

export const SAGA_D3JS_CODING_COLLECTION: TransactionSetCollection = {
  id: 'd3js-code-collection',
  name: 'D3 js SAGA Workflow',
  description: 'Standard data processing and saving workflow',
  sets: 
  
  [
    { id: 'd3-coding-agent-set',
      name: 'D3 Coding Pipeline',
      description: 'Provide analysis of csv file',
      prompt: '',//transactionGroupConversationPrompt,
      transactions: SAGA_D3_CODING_TRANSACTIONS //Provides the flow and tool calls for agentParser
    }, 
    { id: 'd3-code-validating-agent-set',
      name: 'D3 Code Validating Pipeline',
      description: 'Provide analysis of csv file',
      prompt: d3CodeValidatingAgentPrompt,
      transactions: SAGA_D3_CODING_TRANSACTIONS //Provides the flow and tool calls for agentParser
    }
  ],
  executionOrder: ['d3-coding-agent-set', 'd3-code-validating-agent-set'], 
  metadata: {
    version: '1.0.0',
    created: new Date()
  }
};


export interface SagaWorkflowRequest {
  userQuery?: string;
  threadId?: string;
  visualizationRequest?: any;
  workflowId?: string;
  correlationId?: string;
}