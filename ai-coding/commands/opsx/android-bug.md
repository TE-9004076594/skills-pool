---
name: OPSX: Android Bug
description: Investigate and propose a fix for an Android bug using OpenSpec workflow
category: Workflow
tags: [workflow, android, bug, experimental]
---

Investigate and propose a fix for an Android bug. This command works like `/opsx:propose` but specialized for Android bug investigation.

It creates an OpenSpec change with all artifacts (proposal, design, tasks) grounded in Android bug analysis using triage, CodeGraph, and specialized debugging skill routing.

When the change is ready, use standard `/opsx:explore`, `/opsx:apply`, `/opsx:sync`, `/opsx:archive` commands.

---

**Input**: The argument after `/opsx:android-bug` is the bug description or report. Could be:
- A crash log or stack trace
- An ANR report
- A bug description: "app crashes when rotating while network request is in flight"
- A short report: "memory leak in login flow"
- Nothing (will be prompted)

**Steps**

1. **Gather bug context**

   If no specific bug info provided, use the **AskUserQuestion tool** (open-ended, no preset options) to ask:
   > "What Android bug are you investigating? Share a description, stack trace, or any details."

   Normalize the report: extract symptom, exact trigger, expected vs actual result, frequency, reproducibility, device/OS/build, first-seen version.

   **IMPORTANT**: Do NOT proceed without understanding the bug.

2. **Perform Android bug triage**

   The first debugging step must always be triage. Do not skip it, even if the category seems obvious.

   a. **Determine primary category** by identifying the strongest signal:

      | Category | Strong Signals |
      |----------|---------------|
      | **Crash** | `FATAL EXCEPTION`, stack trace, process death after interaction |
      | **ANR / Freeze** | "Application Not Responding", frozen UI, watchdog timeout, main-thread blocked stack |
      | **Lifecycle / State** | Bug appears on rotate/background/foreground, callback after screen leave, state lost after process death, Fragment transaction timing |
      | **Memory Leak / OOM** | LeakCanary trace, retained Activity/Fragment/View, repeated navigation grows memory, bitmap-heavy flows |
      | **Network / Data Flow** | Auth/token issues, timeouts, stale response races, stuck loading tied to requests |
      | **UI / Rendering / Interaction** | Visible layout issue, click interception, item flicker, wrong state rendering, theme/RTL issues |

   b. **Assign primary + secondary categories**:
      - Always assign exactly one primary category
      - Add secondary categories when cross-domain (e.g., Crash + Lifecycle, ANR + Network, UI + Lifecycle)
      - Document why the classification fits

   c. **Route to specialized debugging skill** (for reference during investigation):
      - Crash → `android-crash-analyzer`
      - ANR / Freeze → `android-anr-investigator`
      - Lifecycle / State → `android-lifecycle-debugger`
      - Memory Leak / OOM → `android-memory-leak-fixer`
      - Network / Data Flow → `android-network-bug-debugger`
      - UI / Rendering / Interaction → `android-ui-regression-checker`

   d. **Build investigation plan**: what to inspect first, what logs/traces/tests to gather, what fix style is safest, what regression checks must follow.

3. **Define OpenSpec contract**

   For this bug, infer or define:
   - **Expected behavior** - what should happen
   - **Actual behavior** - what actually happens
   - **Invariants** - conditions that must always hold true
   - **Constraints** - lifecycle, threading, async callback, network retry/cancellation, UI rendering, restoration/persistence
   - **Acceptance criteria** - how to verify the fix
   - **Edge cases** - boundary conditions

4. **Run CodeGraph exploration for codebase context**

   Use CodeGraph to analyze the bug's code-path and impact:

   a. **Extract key technical terms** from the bug description - focus on Android-specific terms (activities, fragments, view models, services, receivers, etc.)

   b. **Run codegraph explore** to gather relevant code context:
      ```bash
      codegraph explore "<key terms>"
      ```
      - If the bug has multiple components, run multiple explore commands

   c. **Analyze CodeGraph findings**:
      - Likely entry points
      - State owners
      - Lifecycle owners
      - Async boundaries
      - Request/data flow
      - UI update points
      - Downstream impact surface

   d. **Document suspect areas**:
      - Suspect files / methods / components
      - Code paths involved
      - Integration points that may be affected

   > The codegraph findings will be used when creating proposal and design artifacts.

5. **Create the change directory**
   ```bash
   openspec new change "<bug-name>"
   ```
   Derive a kebab-case name from the bug (e.g., "login-memory-leak-on-rotation" or from a short bug summary).

6. **Get the artifact build order**
   ```bash
   openspec status --change "<bug-name>" --json
   ```
   Parse the JSON to get:
   - `applyRequires`: array of artifact IDs needed before implementation (e.g., `["tasks"]`)
   - `artifacts`: list of all artifacts with their status and dependencies
   - `planningHome`, `changeRoot`, `artifactPaths`, and `actionContext`: path and scope context

7. **Create artifacts in sequence until apply-ready**

   Use the **TodoWrite tool** to track progress through the artifacts.

   **Use Android bug context**: When creating each artifact, incorporate:
   - Bug triage classification (from step 2)
   - OpenSpec contract (from step 3)
   - CodeGraph findings (from step 4)
   - Specialized debugging skill routing

   Loop through artifacts in dependency order (artifacts with no pending dependencies first):

   a. **For each artifact that is `ready` (dependencies satisfied)**:
      - Get instructions:
        ```bash
        openspec instructions <artifact-id> --change "<bug-name>" --json
        ```
      - Read any completed dependency files for context
      - Create the artifact file using `template` as the structure and write it to `resolvedOutputPath`
      - **For the proposal artifact**: Capture bug classification, behavior contract, and impact analysis
      - **For the design artifact**: Include root-cause analysis, smallest-safe-fix direction, validation steps, and regression test suggestions
      - **For the tasks artifact**: Include debugging steps, fix implementation, and validation tasks
      - Apply `context` and `rules` as constraints - but do NOT copy them into the file
      - Show brief progress: "Created <artifact-id>"

   b. **Continue until all `applyRequires` artifacts are complete**
      - After creating each artifact, re-run `openspec status --change "<bug-name>" --json`
      - Check if every artifact ID in `applyRequires` has `status: "done"` in the artifacts array
      - Stop when all `applyRequires` artifacts are done

   c. **If an artifact requires user input** (unclear context):
      - Use **AskUserQuestion tool** to clarify
      - Then continue with creation

8. **Show final status**
   ```bash
   openspec status --change "<bug-name>"
   ```

**Output**

After completing all artifacts, summarize with full Android bug investigation context:

### Bug Triage Summary
- **Primary Category**: <category>
- **Secondary Categories**: <categories>
- **Why This Classification Fits**: <key clues>
- **Most Likely Root-Cause Patterns**: <ranked mechanisms>

### OpenSpec Contract
- **Expected**: <behavior>
- **Actual**: <behavior>
- **Invariants**: <key invariants>
- **Constraints**: <lifecycle, threading, etc.>

### CodeGraph Codebase Context
- **Entry Points**: <relevant symbols/files>
- **State / Lifecycle Owners**: <identified owners>
- **Suspect Files / Methods / Components**: <key findings>
- **Impact Surface**: <downstream areas affected>

### Artifacts Created
- **Proposal**: <path> (bug classification, scope, impact)
- **Design**: <path> (root cause, fix direction, validation)
- **Tasks**: <path> (debugging, fix, validation steps)

### Next Steps
- **Run `/opsx:explore <bug-name>`** to investigate further
- **Run `/opsx:apply <bug-name>`** to start implementing the fix
- **Run `/opsx:sync <bug-name>`** to sync spec changes if needed
- **Run `/opsx:archive <bug-name>`** when the bug fix is complete

**Android-Specific Investigation Guardrails**
- Always check for destroyed-view access, stale async callbacks, duplicate collectors/observers
- Consider configuration-change effects, background/foreground transitions, process death restoration
- Check for main-thread misuse and incorrect state ownership
- Do not mask crashes with broad exception handling

**Investigation Checklists (by category)**

**If Crash Suspected**: exception type, first app frame, lifecycle state, async callbacks, recent nullability/casting/state changes.

**If ANR Suspected**: main thread stack, blocking call, database/network/disk access, lock contention, startup critical path.

**If Lifecycle Suspected**: owner of state, observer/collector scope, `onDestroyView` safety, restore path, navigation idempotency.

**If Memory Suspected**: retention path, leaked owner, listener/callback release, cache size and eviction, bitmap decode and reuse.

**If Network Suspected**: request trigger, timeout/retry policy, auth refresh flow, parsing assumptions, stale result handling.

**If UI Suspected**: layout hierarchy, state source, adapter binding or Compose state, click/focus/inset behavior, font scale/dark mode/RTL/screen size.

**Artifact Creation Guidelines**

- Follow the `instruction` field from `openspec instructions` for each artifact type
- The schema defines what each artifact should contain - follow it
- Read dependency artifacts for context before creating new ones
- Use `template` as the structure for your output file - fill in its sections
- **IMPORTANT**: `context` and `rules` are constraints for YOU, not content for the file
  - Do NOT copy `<context>`, `<rules>`, `<project_context>` blocks into the artifact
  - These guide what you write, but should never appear in the output

**Anti-Patterns (Do Not)**
- Jump directly to a code fix before classification is complete
- Ignore lifecycle boundaries
- Treat visible UI issues as purely visual without checking state
- Mask crashes with broad exception handling
- Recommend broad refactors before narrowing the bug mechanism
- Apply fixes before checking lifecycle and threading implications

**Guardrails**
- Create ALL artifacts needed for implementation (as defined by schema's `apply.requires`)
- Always perform bug triage before jumping to code analysis or fix
- Always consider Android lifecycle and threading constraints
- Always read dependency artifacts before creating a new one
- If context is critically unclear, ask the user - but prefer running `codegraph explore` with different terms to find relevant code
- If a change with that name already exists, ask if user wants to continue it or create a new one
- Verify each artifact file exists after writing before proceeding to next
- This command is compatible with all other `/opsx:*` commands
