---
name: openspec-trace-logger
description: TEMPORARY diagnostic probe — instrument suspected call chain with structured logs to collect runtime evidence, then remove all instrumentation after analysis. The log code is NEVER delivered. Use when static analysis is inconclusive and runtime observation of the code flow would reveal the bug.
license: MIT
compatibility: Android (Gradle) projects. Works standalone or as a follow-up step within openspec-android-bug investigation.
metadata:
  author: openspec
  version: "1.0"
---

# Trace Logger — temporary diagnostic probe

**⚠️ CRITICAL RULE**: The log code you insert exists only to collect runtime evidence. It is **never** committed, **never** shipped, **never** kept after analysis. Every single instrumentation statement must be removed before the session ends (or before applying any real fix). Think of it as attaching temporary probes to a circuit — you remove them once you've seen the waveform.

Instrument the call chain with structured trace logs to diagnose runtime behavior.

**When to use**:
- The bug is not reproducible from a single stack trace (e.g., intermittent, timing-dependent, state-driven)
- A suspected code path must be confirmed or ruled out at runtime
- The order of callbacks, lifecycle events, or async results is unclear
- Static analysis (code reading, CodeGraph exploration) was inconclusive
- You need to observe the actual data flowing through a chain of function calls

**When NOT to use**:
- The bug has a clear single-frame cause visible in a stack trace (use `android-crash-analyzer` directly)
- The issue is purely a UI/layout problem (use `android-ui-regression-checker`)
- The bug is a missing permission or manifest misconfiguration

---

**Input**: One of:
- An entry point (class + method name, e.g., `LoginRepository.authenticate`)
- A bug description pointing at a flow ("user sees stale data after pull-to-refresh")
- A suspected chain ("I think the callback from the network request arrives after the fragment is destroyed")
- Nothing (will be prompted)

---

**Steps**

1. **Collect the instrumentation target**

   If no entry point is given, use the **AskUserQuestion tool** (open-ended, no preset options) to ask:
   > "What code flow do you want to trace? Give me the entry point (e.g., `LoginRepository.authenticate`) or describe the behavior."

   From the answer, derive:
   - **Entry point**: the starting class + method
   - **Suspicion**: the behavior you expect to observe (e.g., "callback arrives after view destroyed")
   - **Scope**: whether to trace forward (callees), backward (callers), or both

2. **Discover the call chain with CodeGraph**

   a. **Run CodeGraph exploration** against the entry point:
      ```bash
      codegraph explore "<entry class> <entry method>"
      ```
      - If the entry point is a class name, use just the class name
      - If it's a method, use `ClassName.methodName`
      - For multiple entry points, run multiple explores

   b. **Build the call chain**. From the CodeGraph results, collect:
      - **Upstream callers** of the entry point (who invokes it)
      - **Downstream callees** from the entry point (what it invokes)
      - **Async boundaries** (coroutine launches, Flow collections, callback registrations, Rx subscriptions, executor submits)
      - **Lifecycle hooks** the chain crosses (`onCreate`, `onResume`, `onDestroyView`, `onDestroy`)

   c. **Visualize the chain** before instrumenting, so the user can confirm scope:

      ```
      ┌─────────────────────────────────────────────────────────┐
      │  CALL CHAIN: LoginRepository.authenticate              │
      └─────────────────────────────────────────────────────────┘

      [UPSTREAM]                    [ENTRY]                  [DOWNSTREAM]
      LoginActivity.onLoginClick ──► LoginRepository ───┬──► AuthApi.login (suspend)
                                  ▲   .authenticate       ├──► TokenCache.store
                                  │                       ├──► UserRepository.refresh
                                  │                       └──► Analytics.logEvent
                                  │
                       ┌──────────┘
                       │
                       │ (async: launch on IO)
                       ▼
                    LoginViewModel.signIn (UI trigger)

      ⚡ Async boundaries: 1 (coroutine scope = viewModelScope)
      🔄 Lifecycle hooks traversed: onCreate → onResume
      ```

   d. **Confirm scope with the user** before instrumenting. Present the chain and ask:
      - Which functions to include (all in chain / entry + direct callees only)
      - Whether async boundaries should be traced across threads
      - Whether to include third-party SDK calls (typically NO — instrument only app code)

   > If CodeGraph returns thin results, fall back to `rg`/grep to find references and call sites manually.

3. **Detect the logging framework**

   Inspect the project to choose the right logging API:

   | Signal | Use |
   |--------|-----|
   | `com.jakewharton.timber.Timber` in imports or `Timber.plant` in Application | **Timber**: `Timber.tag(TAG).d("... %s", value)` |
   | `kotlinx-coroutines` and coroutine scopes present | Include thread + dispatcher info in logs |
   | Kotlin sources (`*.kt`) | Use string templates: `"param=$param"` |
   | Java sources (`*.java`) | Use `String.format` or concatenation |
   | Nothing special detected | Default to `android.util.Log`: `Log.d(TAG, "...")` |

   Also check for any project-wide `LogTree` or `DebugLogger` utility and prefer that over raw `Log.d`.

4. **Define the trace-logging contract**

   Before writing any `Log.d` calls, commit to these conventions so all instrumented functions are consistent:

   - **TAG**: `[TRACE-<shortName>]` where `<shortName>` is the entry point (e.g., `[TRACE-LOGIN]`). Uppercase. Unique enough not to collide with app logs.
   - **Log level**: `DEBUG` by default. Use `VERBOSE` only for high-frequency inner loops.
   - **Entry log**: at the top of each function
     - Function name (with param values)
     - Caller name if it helps disambiguate overloaded paths
     - Current thread and (if coroutine) coroutine context dispatcher
   - **Exit log**: before each `return`
     - Function name
     - Return value (or `Unit`/`void`)
     - Elapsed time since entry (using `System.currentTimeMillis()` deltas for coarse, `SystemClock.elapsedRealtimeNanos()` for fine)
   - **Key-state log**: after any significant state mutation (ViewModel state, LiveData/StateFlow emit, cache write, database transaction)
   - **Exception log**: in every `catch` — log the exception plus the function name and params that led to it
   - **Lifecycle log**: in `onCreate/onStart/onResume/onPause/onStop/onDestroyView/onDestroy` (only when the chain crosses lifecycle boundaries)

   **Template (Kotlin)**:
   ```kotlin
   fun authenticate(credentials: Credentials): AuthResult {
       val traceStart = SystemClock.elapsedRealtime()
       Log.d(TAG, "▶ authenticate(credentials=${credentials.masked()}) [${Thread.currentThread().name}]")
       try {
           // ... original body ...
           val result = ...
           Log.d(TAG, "◀ authenticate → $result [${SystemClock.elapsedRealtime() - traceStart}ms]")
           return result
       } catch (e: Exception) {
           Log.e(TAG, "✗ authenticate threw on ${credentials.masked()}: ${e.message}", e)
           throw e
       }
   }
   ```

   **Rules**:
   - Never log PII (tokens, passwords, email addresses in plain text). Use mask helpers or log `hashCode()` for opaque identification.
   - Never log on the main thread if the function can be called at high frequency (add rate-limiting or drop the log).
   - Keep log messages short enough to survive logcat's per-line truncation (~4096 bytes).

5. **Performance guardrail — detect high-frequency / looping patterns (mandatory)**

   Before instrumenting any function, inspect its body and call sites for indicators that it runs at high frequency:
   - Inside a `while (true)`, `for` loop with unbounded iteration, or event pump
   - Called from `onDraw`, `onLayout`, `onScroll`, `onTick`, `onSensorChanged`
   - Called from RxJava `Observable` / Flow `map`/`flatMap` with no throttle
   - Called from a `RecyclerView.Adapter.onBindViewHolder` or `DiffUtil`
   - Called from `Handler.postDelayed` with sub-100ms intervals
   - Any function with a `@OnPropertyChanged` / observer pattern that fires on every keystroke

   **If ANY of the above are detected, apply one of these mitigations** (choose the least intrusive):

   | Mitigation | When to use | Template |
   |------------|-------------|----------|
   | **Skip instrumentation** | Function is clearly high-frequency and the chain of interest is upstream/downstream | Remove it from the instrumentation list; add a note: "[SKIP] `<func>` — high-freq, trace caller instead" |
   | **Rate-limit via timestamp** | Function is important but called frequently | `if (SystemClock.elapsedRealtime() - lastLogTime > 500) { Log.d(...); lastLogTime = SystemClock.elapsedRealtime() }` |
   | **Counter + flush** | Need to know *how many* calls without per-call logs | `if (callCount++ % 100 == 0) Log.d(TAG, "⚡ $callCount calls so far")` |
   | **Single-shot only** | First call is enough to observe the behavior | `if (!logged) { Log.d(...); logged = true }` (using a field-level flag) |

   **Anti-pattern (DO NOT)**: Instrumenting a function inside a tight render loop, a scroll handler, or an unbounded `while` without any mitigation. This can cause ANR, logcat flood, or frame drops on the device under test.

   Add to the phase-2 output summary a **Performance notes** section listing every function skipped or rate-limited and the reason.

6. **Instrument the call chain**

   For each function in the confirmed chain:

   a. **Open the file** and locate the function. Read it in full before editing.
   b. **Add the tracing statements** per the contract in step 4.
   c. **Preserve original behavior exactly** — logs must be purely observational.
      - Do NOT reorder code, change return values, or add branches (except the `try`/`catch` wrapper where none existed).
      - If the function is already inside a `try`/`catch`, add the exit log inside the existing blocks rather than adding another wrapper.
   d. **If Timber is the chosen backend**, set the tag at the module level when possible, not per function call:
      ```kotlin
      private val TAG = "TRACE-LOGIN"
      ```
      and use `Timber.tag(TAG).d(...)` consistently, or a `TimberForest` scoped to the trace session.
   e. **Mark every instrumented function** with a one-line comment above its first trace log so the removal step (step 9) can find them mechanically:
      ```kotlin
      // @TRACE-LOGIN — instrumented for <bug-description>, remove after diagnosis
      fun authenticate(credentials: Credentials): AuthResult {
      ```

7. **Provide log-capture instructions**

   Tell the user how to run the app and capture the trace. Include a ready-to-copy adb filter command:

   ```bash
   # Capture only trace-logger output (Android 7+)
   adb logcat -v threadtime | grep -E "\[TRACE-(LOGIN)\]"
   ```

   And a reproduction checklist:
   - What exact steps to take in the app to exercise the chain
   - What expected log sequence looks like (ordered list of function entry/exit)
   - What an anomalous sequence would look like (e.g., exit before an async callee returns, missing lifecycle log, unexpected thread, missing state log)

   Example of what to look for:
   ```
   Expected chain:
   ▶ LoginViewModel.signIn
   ▶   LoginRepository.authenticate
   ▶     AuthApi.login                ← suspend, expected ~200ms
   ◀     AuthApi.login → Result.Success [214ms]
   ▶     TokenCache.store
   ◀     TokenCache.store [3ms]
   ◀   LoginRepository.authenticate → AuthResult.Ok [221ms]
   ◀ LoginViewModel.signIn

   Anomalous if:
   - AuthApi.login exits with Result.Failure (auth bug)
   - AuthApi.login never exits (coroutine cancellation / ANR)
   - Order is wrong (e.g., TokenCache.store before login returns — stale token reuse)
   - signIn is called from onDestroy (post-lifecycle call)
   ```

8. **Analyze captured logs**

   When the user provides captured log output, perform the analysis:

   a. **Sequence check**: did the logs appear in the expected order? Any missing entries or exits?
   b. **Timing check**: are any spans unexpectedly long (>100ms on main thread, >500ms on IO)?
   c. **Thread check**: does any function run on a thread it shouldn't? (main-thread IO, IO-thread UI mutation)
   d. **State check**: did state mutations (ViewModel, Flow emit, DB write) happen in the expected order and with expected values?
   e. **Lifecycle check**: if the chain crosses lifecycle boundaries, did the lifecycle log appear in the expected phase?
   f. **Exception check**: were any exceptions caught and logged? What triggered them?
   g. **Produce a diagnosis**:
      - Most likely root cause (ranked)
      - The specific log lines that support it
      - Whether the root cause confirms or refutes the original suspicion from step 1
      - If the trace is still inconclusive, recommend narrowing (instrument a deeper callee) or widening (add a parallel path)

   Present findings in the OpenSpec contract form (`Expected / Actual / Invariants / Constraints`) so the output slots directly into `openspec-android-bug` if the user is in a bug investigation.

9. **Cleanup (mandatory — session is not complete until this runs)**

   Trace logs are diagnostic scaffolding. They must not exist in the codebase after this session. After the diagnosis is complete:

   - Ask the user to confirm they have captured the logs they need
   - **Mechanically remove every instrumented statement** by searching for the trace marker pattern:
     ```bash
     rg -l "// @TRACE-" .
     ```
     For every match, remove:
     - The `// @TRACE-...` marker comment
     - The `traceStart` timing variable (if added)
     - The `Log.d/Log.e/Timber.tag(TAG).*` trace calls inside that function
     - Any `try`/`catch` wrapper you added (restore original structure)
     - Restore the function to its pre-instrumentation state
   - **Re-run `rg "// @TRACE-" .`** to confirm zero matches remain. If any match remains, remove it before proceeding.
   - Run `./gradlew :<module>:assembleDebug` after cleanup to confirm the code still compiles
   - If the project uses Git, run `git diff` to double-check nothing is left behind

   **Offer a `git`-based safety net up front**:
   > "Want me to `git stash -u` or create a throwaway branch before instrumenting? That way cleanup is one `git checkout` if anything goes wrong."

   If the user wants to keep the instrumentation "for later", **politely refuse and explain**: this skill's output is intended as a temporary diagnostic probe. Keeping it in source pollutes git history, risks merge conflicts, and violates the session's contract. Offer instead to re-run `/opsx:trace-log` from scratch when they need it again — it's a 2-minute operation.

---

**Output**

The skill produces the following across its lifecycle:

### Phase 1 — Chain Discovery
```
## Call Chain Trace: <entry point>

### Scope
- Entry: <class.method>
- Direction: upstream + downstream (or forward only / backward only)
- App-code only: yes (third-party SDKs excluded)

### Chain (visualized)
<ASCII diagram from step 2.c>

### Async boundaries
- <list>

### Lifecycle hooks reached
- <list>

### Confirmed instrumentation targets
- Function 1 (path)
- Function 2 (path)
- ...
```

### Phase 2 — Instrumentation Summary
```
## Instrumentation Complete

- **TAG**: [TRACE-<shortName>]
- **Logging backend**: Timber.d / Log.d / project Timber tree
- **Functions instrumented**: N
- **Filter command**:
  adb logcat -v threadtime | grep -E "\[TRACE-<SHORTNAME>\]"
- **Performance notes**:
  - Skipped: <func> (called from onDraw — would flood logcat)
  - Rate-limited 500ms: <func> (scroll handler)
  - Single-shot: <func> (first call is enough to observe)
- **Reproduction steps to exercise the chain**:
  1. ...
  2. ...
- **Expected ordered log sequence**:
  ▶ A → ▶ B → ▶ C → ◀ C → ◀ B → ◀ A
- **What to watch for**:
  - <anomalous pattern 1>
  - <anomalous pattern 2>
```

### Phase 3 — Diagnosis
```
## Trace Analysis: <entry point>

### Observed sequence
<ordered list of captured logs>

### Findings
- **Sequence issue**: <yes/no — details>
- **Timing issue**: <yes/no — details>
- **Thread issue**: <yes/no — details>
- **State issue**: <yes/no — details>
- **Lifecycle issue**: <yes/no — details>
- **Exception caught**: <yes/no — details>

### Root Cause (ranked)
1. <most likely> — supported by logs at line X, Y
2. ...

### Contract
- **Expected**: <behavior>
- **Actual**: <behavior>
- **Invariants**: <...>
- **Constraints**: <threading, lifecycle, ...>

### Recommendation
- Continue to `/opsx:android-bug` with this diagnosis, OR
- Run `/opsx:apply` directly if the fix is clear
```

### Phase 4 — Cleanup
```
## Trace Logs Removed

- **Files restored**: N
- **Build verification**: ✅ `assembleDebug` passed (or ❌ — see errors)
- **Remaining @TRACE markers**: 0
- **git diff**: clean (or link to review)
```

---

**Integration with other skills**

- `openspec-android-bug` — call this skill when the bug's OpenSpec contract requires runtime confirmation; its output feeds the contract's Actual Behavior section
- `android-crash-analyzer` — use after trace-logger when a trace reveals an exception in the chain
- `android-lifecycle-debugger` — use when the trace shows a post-lifecycle callback
- `android-network-bug-debugger` — use when the trace reveals a request/response anomaly
- `openspec-apply` — after diagnosis, apply the fix as a normal change

**Guardrails**
- **This skill is a diagnostic aid, not a code change.** Every line of trace-log instrumentation is temporary scaffolding intended only to collect runtime evidence and help analyze a problem. **None of the instrumentation code survives past the session.** Treat it as a throwaway probe, exactly like attaching an oscilloscope to a live circuit.
- **Never ship, commit, or archive trace-log instrumentation.** It must not appear in the PR, the archive snapshot, or any git history intended for review. It is diagnostic noise that obscures the real fix.
- **Always clean up before proposing any next action** (apply, explore, archive). Leaving trace logs in place is a session defect.
- **Never instrument inside tight loops, `onDraw`/`onLayout`/scroll handlers, or unbounded `while` without a mitigation (skip / rate-limit / counter / single-shot). See step 5.**
- Never log PII. If in doubt, hash or mask: `token.hashCode()`, `credentials.masked()`.
- Never change control flow while instrumenting. Logs are read-only observations.
- Prefer Timber over raw `Log.d` when the project uses Timber — mixed backends confuse filtering.
- If CodeGraph cannot resolve the call chain, fall back to manual reference search (`rg`/grep), do not hallucinate chain members. If `codegraph explore` returns no meaningful results, proceed without it — CodeGraph is an enhancement, not a blocker.
- Always present the chain diagram to the user for confirmation BEFORE modifying any file.
- Always offer `git` safety net (stash or branch) before instrumenting.
- Always run `assembleDebug` after cleanup to confirm no residue.
- If the chain is longer than ~20 functions, propose instrumenting only the critical segment first and expanding if inconclusive.
- If the user is inside an active OpenSpec change, store the trace-log **diagnosis output** alongside the change artifacts so it persists into the archive — never the instrumented source code itself.
