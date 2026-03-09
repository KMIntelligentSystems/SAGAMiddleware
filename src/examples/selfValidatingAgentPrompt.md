# Self-Validating Agent Prompt Pattern

## Pattern: Agent validates its own work before returning results

This prompt structure forces the agent to validate results against known constraints BEFORE considering the task complete.

---

## Example: Wage Interval Processing with Built-in Validation

```markdown
You are a Python Data Processing Specialist with MANDATORY SELF-VALIDATION.

**Context:**
- Wage Intervals File: c:/repos/sagaMiddleware/OES Interval 2005.CSV
- BLS Wage Data: c:/repos/sagaMiddleware/national_may2005_dl.CSV

**CRITICAL CONSTRAINT:**
The BLS file contains HIERARCHICAL DATA with aggregate rows.
- Row 1: "All Occupations" = 130,307,840 employees (REFERENCE TOTAL)
- Some rows are CATEGORY AGGREGATES (e.g., "Management occupations")
- Other rows are DETAILED OCCUPATIONS (e.g., "Chief executives")
- Aggregates ALREADY INCLUDE their detail rows - DO NOT DOUBLE COUNT

---

## PROCESSING STEPS (Execute in Order):

### STEP 1: Data Exploration & Validation Planning
1. Read both CSV files
2. Identify the "All Occupations" total (this is your REFERENCE)
3. Examine the `occ_code` column structure:
   - Codes ending in `-0000` are typically aggregates
   - Codes with 4 digits (XX-XXXX) are typically details
4. Check the `group` column for "major", "minor" indicators
5. DECIDE: What filter will prevent double-counting?

### STEP 2: Data Filtering
Apply your chosen filter to EXCLUDE aggregate rows:
- Option A: Filter out codes ending in `-0000`
- Option B: Filter out rows where `group` == "major"
- Option C: Keep only most granular occupation codes

PRINT: "Filtered data: X rows removed, Y rows retained"

### STEP 3: Process Wage Intervals
- Match h_mean values to wage intervals
- Sum tot_emp per interval
- Collect occupations per interval

### STEP 4: MANDATORY VALIDATION (DO NOT SKIP!)

**Validation Checks:**

✓ **CHECK 1: Total Sanity**
```python
total_employees = sum of all interval employee counts
reference_total = 130_307_840  # From "All Occupations"

if total_employees > reference_total * 1.1:  # Allow 10% variance
    print("❌ ERROR: Total exceeds reference by more than 10%")
    print(f"   Your total: {total_employees:,}")
    print(f"   Reference:  {reference_total:,}")
    print(f"   Ratio: {total_employees/reference_total:.2f}x")
    print("   LIKELY CAUSE: Double-counting aggregate rows")
    print("   ACTION: Review filtering logic in Step 2")
    STOP AND FIX BEFORE PROCEEDING
```

✓ **CHECK 2: US Workforce Sanity**
```python
us_workforce_2005 = 140_000_000  # Approximate US civilian workforce

if total_employees > us_workforce_2005:
    print("❌ CRITICAL ERROR: Total exceeds entire US workforce!")
    print(f"   Your total: {total_employees:,}")
    print(f"   US workforce: {us_workforce_2005:,}")
    STOP AND FIX BEFORE PROCEEDING
```

✓ **CHECK 3: Interval Reasonableness**
```python
for each interval:
    if interval.employees > reference_total:
        print(f"❌ ERROR: Interval {interval.name} has more employees than total workforce")
        STOP AND FIX BEFORE PROCEEDING
```

✓ **CHECK 4: Distribution Sanity**
```python
# No single interval should have >60% of workforce
max_interval_pct = (max_interval_count / total_employees) * 100

if max_interval_pct > 60:
    print(f"❌ WARNING: One interval contains {max_interval_pct:.1f}% of all employees")
    print("   This suggests possible double-counting")
    REVIEW BEFORE PROCEEDING
```

### STEP 5: If ALL validations pass, generate outputs

**Only if validation passes:**
1. Save employee counts CSV
2. Save occupations CSV
3. Print summary statistics
4. Print "✅ VALIDATION PASSED" message

### STEP 6: Final Summary

Print:
```
PROCESSING COMPLETE
==================
Validation Status: [PASSED/FAILED]
Total Employees: X (Y% of reference total)
Intervals with data: Z/12
Largest interval: [name] with X employees (Y%)
```

---

## KEY PRINCIPLE:

**Validate BEFORE saving outputs, not after!**

If validation fails, the agent should:
1. Print the error
2. Diagnose the issue
3. Fix the filtering logic
4. Re-run processing
5. Re-validate
6. Only save outputs if validation passes
```

---

## Why This Works:

1. **Explicit constraints** stated upfront
2. **Reference values** provided (130M employees)
3. **Validation checks** are MANDATORY steps, not optional
4. **Conditional output** - only save if validation passes
5. **Self-correction** - agent knows to fix and retry

---

## Usage:

Use this prompt pattern when:
- ✅ Processing hierarchical data (aggregates + details)
- ✅ Data has known totals or constraints
- ✅ Domain knowledge provides sanity checks
- ✅ Errors would be expensive to fix later
- ✅ Single-agent execution is preferred

---

## Trade-off:

**Pros:**
- Single agent handles everything
- Faster (no multi-agent overhead)
- Self-correcting

**Cons:**
- Longer prompt (more tokens)
- Agent must remember to validate
- Less separation of concerns
