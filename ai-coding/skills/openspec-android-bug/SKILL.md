---
name: openspec-android-bug
description: Investigate and propose a fix for an Android bug using OpenSpec workflow. Use when the user reports an Android crash, ANR, memory leak, lifecycle issue, network bug, or UI rendering problem.
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.4.1"
---

Investigate and propose a fix for an Android bug. This skill works like openspec-propose but specialized for Android bug investigation.

It creates an OpenSpec change with all artifacts (proposal, design, tasks) grounded in Android bug analysis using triage, CodeGraph, and specialized debugging skill routing.

When the change is ready, use openspec-apply to implement, openspec-sync-specs to sync specs, and openspec-archive to archive.

---

**Input**: The bug description or report from the user. Could be:
- A crash log or stack trace
- An ANR report
- A bug description: "app crashes when rotating while network request is in flight"
- A short report: "memory leak in login flow"
- Nothing (will be prompted)

**Steps**

1. **Gather bug context**

   **CodeGraph scope for Android projects**: CodeGraph is optimized for source-code symbols (Kotlin/Java classes, functions, call paths). It does NOT reliably index:
   - XML layouts (`res/layout/*.xml`)
   - AndroidManifest.xml
   - Gradle build scripts (`build.gradle` / `build.gradle.kts`, `settings.gradle`)
   - Resources (`strings.xml`, `colors.xml`, `dimens.xml`)
   - Proguard/R8 rules
   - Multi-module `:module:path` declarations

   **When CodeGraph results are thin or miss the target, supplement with**:
   - `find` / `rg` for XML/resource/manifest files
   - `./gradlew :module:dependencies` for dependency resolution
   - `adb` command output (see step 1 below)

   If no specific bug info provided, use the **AskUserQuestion tool** (open-ended, no preset options) to ask:
   > "What Android bug are you investigating? Share a description, stack trace, or any details."

   Normalize the report: extract symptom, exact trigger, expected vs actual result, frequency, reproducibility, device/OS/build, first-seen version.

   **Collect raw diagnostics with the right source.** Depending on what's available, gather logs from these sources (ask the user which apply; only run device commands if a device/emulator is connected — check `adb devices`):

   | Signal | Source / command |
   |--------|------------------|
   | Live crash / logcat | `adb logcat -d` (dump) or `adb logcat -b crash -d` (crash buffer) |
   | Full device report | `adb bugreport <out.zip>` — contains logcat, ANR traces, dumpsys |
   | Native crash (tombstone) | `adb pull /data/tombstones/` (or from bugreport) |
   | ANR traces | `/data/anr/traces.txt` or the `anr/` folder inside a bugreport |
   | Play Console / Crashlytics export | user-provided stack trace file or paste |

   **Deobfuscate before analysis (critical for release builds).** Production stack traces from R8/ProGuard are obfuscated and will point at meaningless symbols:
   - Locate the matching `mapping.txt` for the crashing build (under `app/build/outputs/mapping/<variant>/mapping.txt`, or the artifact archived for that release).
   - Use `retrace` to restore real symbols:
     ```bash
     retrace mapping.txt obfuscated_stacktrace.txt
     ```
     (`retrace` ships with the Android SDK build-tools / R8; `ndk-stack` + symbol libs for native tombstones.)
   - If no `mapping.txt` is available for the build, tell the user the analysis is on obfuscated symbols and confidence is reduced — ask them to supply the mapping for that version.

   **IMPORTANT**: Do NOT proceed without understanding the bug. For any release-build crash, deobfuscate first — analyzing obfuscated frames wastes the investigation.

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
       | **Gallery / Media** | Empty photo list, image load/save/delete failure, wrong orientation, MediaStore query issues, Scoped Storage migration on Android 10+/13+/14+, Glide/Coil/Picasso errors, photo-picker failures, HEIC/WEBP decode |
       | **Camera** | Camera won't open, preview black/screen corruption, capture failure or hang, front/rear switch issues, flash/focus/exposure wrong, Camera2/CameraX session lifecycle, `ImageReader` buffer full, device/HAL compatibility |

   b. **Assign primary + secondary categories**:
      - Always assign exactly one primary category
      - Add secondary categories when cross-domain (e.g., Crash + Lifecycle, ANR + Network, UI + Lifecycle)
      - Document why the classification fits

   c. **Load the specialized debugging skill** for the primary category. Do NOT treat it as optional reference — actually invoke it with the **Skill tool** so its detailed workflow, heuristics, and anti-patterns govern the investigation:
       - Crash → `android-crash-analyzer`
       - ANR / Freeze → `android-anr-investigator`
       - Lifecycle / State → `android-lifecycle-debugger`
       - Memory Leak / OOM → `android-memory-leak-fixer`
       - Network / Data Flow → `android-network-bug-debugger`
       - UI / Rendering / Interaction → `android-ui-regression-checker`
       - Gallery / Media → `android-gallery-bugfix-skill`
       - Camera → `android-camera-bugfix-skill`

      - **Load the primary category's skill via the Skill tool** and follow its workflow for the deep analysis.
      - If secondary categories were assigned, also load those skills and reconcile their guidance (e.g., a Crash+Lifecycle bug loads both `android-crash-analyzer` and `android-lifecycle-debugger`).
      - Carry the specialized skill's output sections (root cause, suspect files, recommended fix, validation steps, regression tests) forward into the OpenSpec contract and artifacts below.

   d. **Build investigation plan**: what to inspect first, what logs/traces/tests to gather, what fix style is safest, what regression checks must follow. If the bug cannot be reproduced from source alone, or multiple categories fit equally well from the symptom, plan to invoke **`openspec-trace-logger`** as a runtime-evidence step before committing to a design.

   e. **Check Android platform constraints (mandatory for every triage)**. These are first-class constraints that frequently cause or shape bugs — evaluate all of them, not just the ones most obvious from the symptom:

      | Constraint | What to check | Common bug triggers |
      |------------|---------------|---------------------|
      | **Permissions** | `AndroidManifest.xml` `<uses-permission>` declarations; runtime permission requests; `permission_group` | Crash when feature added without permission; denied permission not handled; scoped storage migration |
      | **Privacy / Data** | PII handling, user data export, `DataStore`/`SharedPreferences` contents, clipboard use, advertising ID, Google Play data safety form coverage | Fix that adds logging of user data; missing data deletion path; third-party SDK collecting beyond declared |
      | **API Level compat** | `minSdk` vs `targetSdk`; version-gated APIs (e.g., `NotificationChannel` requires API 26+); background execution limits (`API 26+`); scoped storage (`API 29+`); predictive back (`API 33+`) | `NoSuchMethodError` on older devices; behavioral differences post-targetSdk bump; background service restrictions |
      | **Device fragmentation** | Screen sizes/densities; tablet vs phone layouts; foldable/unfolded states; hardware keyboard; stylus | Layout breaks on tablet; crash on fold; click target too small on low-dpi |
      | **Obfuscation / R8** | `proguard-rules.pro`; `consumer-rules.pro`; reflection-based code; `KEEP` rules for serialization | Crash only in release build; missing class after shrink |
      | **Play / Play Services** | App signing, Google Play policy, background location restrictions, family policy | Rejection from Play; policy-violating feature |

      - Record any constraint that is **relevant** to this bug under an `impacts:` section.
      - Mark as **not applicable** explicitly if evaluated and ruled out — this prevents future re-investigation.
      - If a constraint is suspected but cannot be ruled out from the current information, list it under `suspected_impacts` and design the fix to be conservative in that dimension.

3. **Define OpenSpec contract**

   For this bug, infer or define:
   - **Expected behavior** - what should happen
   - **Actual behavior** - what actually happens
   - **Invariants** - conditions that must always hold true
   - **Constraints** - lifecycle, threading, async callback, network retry/cancellation, UI rendering, restoration/persistence
   - **Platform constraints (from triage 2.e)** - which of the six platform dimensions (permissions, privacy/data, API-level compat, device fragmentation, obfuscation, Play/Play-Services) are relevant, which rule out, which suspected. Carry the `impacts:` and `suspected_impacts:` output through to the design and tasks.
   - **Reproduction steps** - the exact, ordered steps that trigger the bug. Capture the current reproduction outcome as the **failing baseline** (what happens today). If the user cannot provide reliable repro steps, record this as a known risk — a fix without a reproduction is unverifiable.
   - **Acceptance criteria** - how to verify the fix. MUST include: (1) the reproduction steps no longer produce the bug, and (2) a **regression test** that fails before the fix and passes after.
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

   d. **Supplement CodeGraph with direct file inspection** (CodeGraph may not cover these):
      - `AndroidManifest.xml` — permissions, exported components, intent filters, backup rules
      - `res/layout/*.xml` — view hierarchy, IDs, click listeners, data binding
      - `build.gradle` / `build.gradle.kts` — dependencies, min SDK, target SDK, ProGuard rules
      - `res/values/*.xml` — strings, dimensions, styles, colors
      - `settings.gradle` — multi-module structure
      - Use `rg` (ripgrep) or `find` to locate these artifacts when the bug involves UI, permissions, configuration changes, or dependency issues

   d. **Document suspect areas**:
      - Suspect files / methods / components
      - Code paths involved
      - Integration points that may be affected

   > The codegraph findings will be used when creating proposal and design artifacts.

4b. **Retrieve CodeKB bug patterns & design intent** (if CodeKB is initialized)

   Bug investigation benefits from historical defect patterns and design intent:

   ```bash
   # Search bug patterns related to the symptom (bug-pattern type is auto-boosted)
   codekb_search("<bug symptom keywords>", { knowledge_types: ["bug-pattern", "decision"] })

   # Explain suspect symbols to surface known issues and conventions
   codekb_explain("<suspect class or method>")
   ```

   **What to look for**:
   - **`known_issues`** — historical bug patterns attached to the suspect symbol (severity-sorted); the fix must not reintroduce them
   - **Design intent** — why the module was designed this way; compare current code against the intent to detect violations
   - **Coding conventions** — the fix should respect project conventions (e.g., thread-safety, error handling)
   - **`codekb_ask("<module> 的设计意图是什么")`** — when the module design rationale is unclear

   Carry findings into the OpenSpec contract (step 3) as constraints and into the design artifact.

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
      - **For the tasks artifact**: Include debugging steps, fix implementation, and validation tasks. The tasks list MUST, in order, contain:
        1. A **write-the-failing-regression-test** task FIRST — add a unit test (or instrumented test if UI/integration) that reproduces the bug and currently FAILS. Reference the exact test source set / module (e.g., `:feature:login/src/test/...`).
        2. The **root-cause fix** task(s) — the smallest safe change from the design.
        3. A **verify-the-fix** task — confirm the regression test now passes and the reproduction steps no longer trigger the bug.
        4. A **regression-scope** task — run affected-module unit tests and Android Lint (`/opsx:verify`) to ensure no new breakage.
        Do NOT produce a tasks list that fixes code without an accompanying failing-then-passing test.
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

### Platform Constraints (from triage 2.e)
- **Relevant**: <permissions, privacy, API-level, fragmentation, obfuscation, Play constraints that apply>
- **Not applicable**: <dimensions evaluated and ruled out>
- **Suspected (cannot rule out yet)**: <dimensions still under investigation — design conservatively>

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
- Use **openspec-apply** to start implementing the fix
- Use **openspec-trace-logger** if runtime evidence is still needed to confirm the diagnosis before applying
- Use **openspec-sync-specs** to sync spec changes if needed
- Use **openspec-archive** when the bug fix is complete

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

**If Gallery / Media Suspected**: Android version & permission model (9/10/13/14), MediaStore query projection/selection/sortOrder, `IS_PENDING` toggle, URI access pattern (content vs file), EXIF orientation handling, image-loading library lifecycle (Glide/Coil/Picasso), RecyclerView adapter bind/recycle cancellation, OOM sampling, save/delete path and RecoverableSecurityException handling, `READ_MEDIA_VISUAL_USER_SELECTED` handling on Android 14+.

**If Camera Suspected**: CAMERA permission grant state, camera open/close pairing, CaptureSession create/close pairing, Surface lifecycle alignment with PreviewView/TextureView, ImageReader buffer close on every image path, front/rear switch sequence (stop abort close reopen create), flash/AF/AE modes re-queried per cameraId, hardware capability level (FULL/LIMITED/LEGACY), CameraX bindToLifecycle/unbindAll pairing, background/foreground camera release and reopen, device HAL differences.

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
- Always load the specialized debugging skill for the primary (and any secondary) category via the Skill tool - do not just name it
- Always consider Android lifecycle and threading constraints
- Always capture reproduction steps and a failing-baseline; a fix with no way to verify it is incomplete
- Always require a regression test that fails before the fix and passes after - encode it as the FIRST task in tasks.md
- Always read dependency artifacts before creating a new one
- If context is critically unclear, ask the user - but prefer running `codegraph explore` with different terms to find relevant code
- If a change with that name already exists, ask if user wants to continue it or create a new one
- Verify each artifact file exists after writing before proceeding to next
- If `codegraph explore` returns no meaningful results, proceed without it — CodeGraph is an enhancement, not a blocker. Fall back to `rg`/grep for manual code search.
