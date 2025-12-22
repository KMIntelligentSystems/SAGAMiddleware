# SDK Agents Guide for DAG Designer

## Two SDK Agents: DataProfiler and D3JSCodeValidator

---

## DataProfiler

**Purpose:** Analyzes workflow requirements and CSV data, then dynamically creates 1-N GenericAgent definitions using tool calls.

**Key Characteristics:**
- **Local Tool:** `create_generic_agent`
  - Claude calls this tool multiple times during execution
  - Each call creates one GenericAgent definition with Python code context
  - Agents are stored in createdAgents array with execution order

**Execution Flow:**
1. Receives workflow description + CSV file path
2. Analyzes data structure, requirements
3. Makes multiple `create_generic_agent` tool calls (e.g., DataFilter, HistogramCalculator, DataPreprocessor)
4. Stores created agent definitions with order numbers
5. Returns list of created agents

**Output:**
- Array of agent definitions (JSON)
- Each agent has: name, taskDescription, Python code, dependencies, execution order

**DAG Impact:**
- Single node in DAG (don't try to predict how many agents it creates)
- Linear exit - one output path to next step
- The next step receives the dynamically created agents

**FlowType:**
- Input: `context_pass` or `sdk_agent`
- Output: `llm_call` or `execute_agents` (depending on what processes the created agents)

---

## D3JSCodeValidator

**Purpose:** Validates D3.js HTML code using Playwright and autonomously decides whether to retry with corrections or proceed to conversation.

**Key Characteristics:**
- **Three Local Tools:**
  1. `analyze_d3_output` - Renders HTML with Playwright, returns SVG/PNG paths
  2. `trigger_conversation` - Called on success → forwards code to ConversationAgent
  3. `trigger_code_correction` - Called on failure → invokes D3JSCodingAgent for ONE retry → then forwards to ConversationAgent

**Execution Flow:**
1. Receives D3.js HTML code from D3JSCodingAgent
2. Calls `analyze_d3_output` tool → renders with Playwright
3. Analyzes SVG output against requirements
4. Makes autonomous decision:
   - **IF validation passes:** Calls `trigger_conversation` → goes to ConversationAgent
   - **IF validation fails:** Calls `trigger_code_correction`:
     - Invokes D3JSCodingAgent with error details
     - D3JSCodingAgent generates corrected code
     - Forwards corrected code directly to ConversationAgent

**Output:**
- Two possible paths (both end at ConversationAgent):
  - **Success path:** validated code → ConversationAgent
  - **Failure path:** error report → D3JSCodingAgent (retry) → corrected code → ConversationAgent

**DAG Impact:**
- **Must show branching with TWO conditional edges**
- Use `autonomous_decision` flowType
- Create separate node for D3JSCodingAgent retry

**FlowType:**
- Input to D3JSCodeValidator: `sdk_agent`
- Output edges: `autonomous_decision` with conditions
  - Edge 1: `{success: true}` → ConversationAgent (flowType: `llm_call`)
  - Edge 2: `{success: false}` → D3JSCodingAgent retry node
- D3JSCodingAgent retry → ConversationAgent: `llm_call`
