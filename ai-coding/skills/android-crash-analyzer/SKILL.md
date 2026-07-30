---
name: android-crash-analyzer
description: Analyze Android crash logs, identify likely root cause, narrow suspect code paths, and propose safe fixes with verification steps.
license: MIT
compatibility: Works with any Android project. Use alongside openspec workflow skills for structured bug investigation.
metadata:
  author: ai-coding
  version: "1.0"
---

# Android Crash Analyzer

## Purpose
Use this skill when investigating Android app crashes such as:
- `NullPointerException`
- `IllegalStateException`
- `IndexOutOfBoundsException`
- `ClassCastException`
- `ConcurrentModificationException`
- Fragment/Activity transaction crashes
- crashes reported from production logs or QA reproduction

## Goals
- Extract the actual crash signal from logs
- Find the first relevant application stack frame
- Identify the most likely root cause, not just the symptom
- Map the crash to lifecycle state, threading context, and data state
- Recommend the smallest safe fix
- Suggest regression tests and validation steps

## Inputs
Expect one or more of:
- Logcat crash output
- stack trace
- reproduction steps
- device model / Android version
- app state when crash happened
- related source files
- PR or commit diff if the crash was introduced recently

## Workflow

### 1. Identify the crash signature
Determine:
- exception type
- exception message
- crashing thread
- process name
- timestamp if relevant
- whether the app crashed in app code, SDK code, or framework code

### 2. Find the first meaningful app frame
Walk the stack trace from top to bottom and identify:
- the first stack frame owned by the app
- the caller chain leading into it
- any lifecycle callback involved:
  - `onCreate`, `onStart`, `onResume`, `onPause`, `onStop`, `onDestroy`
  - `onViewCreated`, `onDestroyView`

Ignore noisy wrapper frames unless they affect control flow.

### 3. Classify the crash
Classify into one of these buckets:
- nullability bug
- invalid lifecycle state
- threading issue
- stale reference / destroyed UI object
- bad cast or deserialization issue
- invalid list/map access
- duplicate navigation or fragment transaction
- third-party SDK misuse
- corrupted persisted state
- defensive check missing

### 4. Form a root-cause hypothesis
Explain:
- what object/state was invalid
- why it became invalid
- what sequence likely led there
- whether the issue is deterministic or race-dependent
- whether config change / background restore / async callback may be involved

### 5. Locate suspect code
Inspect:
- exact crashing line if available
- surrounding method
- caller methods
- related lifecycle owners
- async callbacks, coroutine launches, Flow collectors, observers, adapters, and navigation calls

### 6. Recommend the smallest safe fix
Prefer:
- proper null handling
- lifecycle-aware collection
- state validation before use
- guarding fragment transactions
- moving work to the correct lifecycle callback
- ensuring model/UI synchronization
- removing unsafe assumptions

Avoid:
- broad try/catch that hides the bug
- replacing root cause analysis with logging only
- using `!!` unless fully justified
- adding arbitrary delays to "fix" race conditions

### 7. Define verification
Always provide:
- how to reproduce before fix
- how to validate after fix
- what regression tests to add
- edge cases to retest

## Output Format
Respond with these sections:

1. **Crash Summary**
2. **Likely Root Cause**
3. **Suspect Files / Methods**
4. **Recommended Fix**
5. **Why This Fix Is Safe**
6. **Validation Steps**
7. **Regression Tests To Add**

## Heuristics
- For `NullPointerException`, identify why the value can be null at runtime despite assumptions.
- For `IllegalStateException`, check lifecycle ordering and duplicate calls.
- For Fragment crashes, inspect transaction timing and `isAdded`, `isStateSaved`, view lifecycle, and navigation duplication.
- For coroutine-related crashes, check whether the coroutine outlives the UI scope.
- For adapter/list crashes, inspect concurrent mutation and stale position usage.
- For serialization/parsing crashes, inspect backward compatibility and missing fields.

## Good Fix Patterns
- Replace unsafe UI access after `onDestroyView`
- Use `viewLifecycleOwner.lifecycleScope`
- Use `repeatOnLifecycle`
- Null-check restored state
- Validate intent extras / arguments
- Snapshot list data before async use
- Ensure navigation is idempotent

## Anti-Patterns
- swallowing exception without investigation
- force unwraps
- catching `Exception` around the whole screen
- retry loops without state correction
- "works on my device" conclusions without lifecycle review

## CodeGraph Integration

CodeGraph helps ground crash diagnosis in the actual codebase structure. Run it before proposing a fix.

**When to run CodeGraph**:
- During step 4 (root-cause hypothesis) — explore the crash site and related call paths
- During step 5 (locate suspect code) — use CodeGraph to find all callers and callees of the crashing method
- After classifying the crash type, refine the fix scope with CodeGraph

```bash
codegraph explore "<crash class or method>"
```

**What to look for from CodeGraph results**:
- **Upstream callers**: who invokes the method that crashed (could reveal null arguments, bad state)
- **Downstream callees**: what the method calls (could reveal where the actual exception originates)
- **Async boundaries**: coroutine launch points, callback registrations crossing lifecycle boundaries
- **State owners**: which ViewModel/state holder owns the data involved in the crash
- **Lifecycle hooks**: whether the crash path crosses `onDestroy` boundaries

**Scope note**: CodeGraph does not reliably index XML layouts, `AndroidManifest.xml`, or Gradle build scripts. For crashes involving resource lookups, manifest-declared components, or dependency version issues, supplement with `rg`/`find`. Also scan `settings.gradle` for multi-module dependencies on the affected module.

**Fallback**: If `codegraph explore` returns no meaningful results, proceed without it — CodeGraph is an enhancement, not a blocker. Fall back to `rg`/grep for manual crash-site search.
