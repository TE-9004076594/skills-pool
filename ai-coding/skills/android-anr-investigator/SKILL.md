---
name: android-anr-investigator
description: Investigate Android ANRs and severe UI stalls by analyzing main-thread blocking, binder waits, lock contention, disk/network work, and rendering delays.
license: MIT
compatibility: Works with any Android project. Use alongside openspec workflow skills for structured bug investigation.
metadata:
  author: ai-coding
  version: "1.0"
---

# Android ANR Investigator

## Purpose
Use this skill for:
- ANR reports
- app freeze complaints
- "click does nothing"
- long startup hangs
- blocked navigation
- jank severe enough to appear frozen

## Goals
- Identify what the main thread was blocked on
- Distinguish CPU-heavy work from I/O wait or lock contention
- Find the responsible code path
- Propose targeted fixes with low regression risk
- Suggest observability and performance regression checks

## Inputs
Useful inputs include:
- ANR traces
- main thread stack
- all-thread dump
- reproduction steps
- startup flow details
- logs around freeze time
- related source files
- performance traces (Perfetto / systrace) if available

## Workflow

### 1. Identify ANR type
Determine whether it is likely:
- input dispatch timeout
- broadcast receiver timeout
- service timeout
- startup hang
- background-to-foreground resume hang
- render stall / long frame burst

### 2. Inspect main thread state
Find whether the main thread is:
- running CPU-heavy work
- waiting on a monitor/lock
- blocked on binder
- blocked on disk I/O
- blocked on network
- blocked on `Future`, `CountDownLatch`, `join`, or `runBlocking`
- doing expensive layout/measure/draw work

### 3. Correlate with app code
Locate:
- first app-owned frame on main thread
- caller chain
- related worker thread if main thread is waiting
- lock owner if contention is visible

### 4. Classify root cause
Common classes:
- synchronous disk read/write on main thread
- database access on main thread
- blocking IPC/binder call
- image decode on main thread
- expensive JSON parsing
- startup dependency chain too long
- deadlock or lock contention
- misuse of coroutines (`runBlocking`, bad dispatcher choice)
- RecyclerView / Compose overwork
- repeated invalidation or render loop

### 5. Recommend fix
Prefer:
- moving work off main thread
- reducing startup critical path
- precomputing or caching expensive work
- replacing blocking waits with async flow
- reducing lock scope
- using structured concurrency properly
- incremental rendering or lazy loading

Avoid:
- arbitrary thread sleeps
- masking ANR by delaying UI work without fixing dependency chain
- adding retries on main thread
- overusing global scopes

### 6. Define validation
Provide:
- how to measure before/after
- what traces/logging to capture
- scenarios to retest on low-end devices
- startup, resume, navigation, and rotation checks

## Output Format
1. **ANR Summary**
2. **Main Thread Blocker**
3. **Likely Root Cause**
4. **Suspect Files / Call Paths**
5. **Recommended Fix**
6. **Performance Validation**
7. **Regression Risks**

## Heuristics
- Treat `runBlocking` on main thread as a strong smell.
- Treat Room/database access on main thread as a high-priority suspect.
- If main thread waits on a lock, inspect the lock holder and lock scope.
- If startup is slow, separate must-have initialization from deferrable initialization.
- If UI rendering is expensive, inspect repeated binds, deep nesting, and recomposition churn.

## Good Fix Patterns
- switch to `Dispatchers.IO` for disk/database
- replace blocking call with suspend API
- defer noncritical initialization
- reduce synchronized region
- cache parsed/config objects
- paginate or lazy-render large lists

## Anti-Patterns
- suppressing ANR symptoms with loading spinners alone
- moving everything to background without lifecycle ownership
- increasing timeouts without analysis
- keeping startup "synchronous for simplicity"
