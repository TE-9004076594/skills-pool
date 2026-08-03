---
name: openspec-apply
description: Implement tasks from an OpenSpec change. Use when the user wants to start implementing, continue implementation, or work through tasks.
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.4.1"
---

Implement tasks from an OpenSpec change.

**Input**: Optionally specify a change name. If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **Select the change**

   If a name is provided, use it. Otherwise:
   - Infer from conversation context if the user mentioned a change
   - Auto-select if only one active change exists
   - If ambiguous, run `openspec list --json` to get available changes and use the **AskUserQuestion tool** to let the user select

   Always announce: "Using change: <name>" and how to override (e.g., `/opsx:apply <other>`).

2. **Check status to understand the schema**
   ```bash
   openspec status --change "<name>" --json
   ```
   Parse the JSON to understand:
   - `schemaName`: The workflow being used (e.g., "spec-driven")
   - `planningHome`, `changeRoot`, and `actionContext`: planning scope and edit constraints
   - Which artifact contains the tasks (typically "tasks" for spec-driven, check status for others)

3. **Get apply instructions**

   ```bash
   openspec instructions apply --change "<name>" --json
   ```

   This returns:
   - `contextFiles`: artifact ID -> array of concrete file paths (varies by schema - could be proposal/specs/design/tasks or spec/tests/implementation/docs)
   - Progress (total, complete, remaining)
   - Task list with status
   - Dynamic instruction based on current state

   **Handle states:**
   - If `state: "blocked"` (missing artifacts): show message, suggest using openspec-continue-change
   - If `state: "all_done"`: congratulate, suggest archive
   - Otherwise: proceed to implementation

   **Workspace guard:** If status JSON reports `actionContext.mode: "workspace-planning"` and `allowedEditRoots` is empty, explain that full workspace apply is not supported in this slice. Treat linked repos and folders as read-only context, ask the user to select an affected area through an explicit implementation workflow, and STOP before editing files.

4. **Baseline health check (fail-fast gate)**

   Before reading context and exploring, verify the project currently builds. Iterating on a broken baseline wastes time and creates false-positive test failures.

   - **Gradle wrapper:** `./gradlew :app:assembleDebug` (or the root module affected). Run only on modules that exist.
   - **Pass** → proceed.
   - **Fail** → stop, show the compile errors, and ask the user whether to:
     1. Fix the baseline first (exit apply, fix, come back), or
     2. Force-continue knowing the baseline is broken (record this risk in the change).

   Skip this gate only if `openspec instructions apply --json` indicated a docs-only change (e.g., spec updates with no code tasks).

5. **Read context files**

   Read every file path listed under `contextFiles` from the apply instructions output.
   The files depend on the schema being used:
   - **spec-driven**: proposal, specs, design, tasks
   - Other schemas: follow the contextFiles from CLI output

6. **Explore codebase with CodeGraph**

   Before implementing, use CodeGraph to understand the codebase areas affected by the change:

   a. **Extract key terms** from the task descriptions and change artifacts (proposal, design, tasks)

   b. **Run codegraph explore** to gather relevant code context:
      ```bash
      codegraph explore "<key terms>"
      ```
      - Focus on terms that describe specific features, modules, or components mentioned in tasks
      - If tasks span multiple topics, run multiple explore commands

   c. **Use codegraph findings** during implementation:
      - Reference discovered symbols, files, and patterns when writing code
      - Use call paths to understand integration points before modifying them
      - Leverage relationships to avoid introducing inconsistencies

   > The codegraph context helps ground implementation in the actual codebase structure, reducing the risk of breaking integrations.

6b. **Query CodeKB knowledge on demand** (if CodeKB is initialized)

   During implementation, use CodeKB to respect design constraints and conventions:

   ```bash
   # Retrieve constraints for the affected module before writing code
   codekb_search("<module terms>", { knowledge_types: ["decision", "rule"] })
   codekb_conventions("<affected domain>")

   # Understand the symbol being modified — surface known issues before changing it
   codekb_explain("<symbol being modified>")
   ```

   **When to query**:
   - Before implementing a behavior change — check for related business rules and design decisions
   - Before modifying a symbol with `known_issues` — verify the historical bug pattern still applies
   - When a task's acceptance criteria seem to conflict with existing conventions — confirm via `codekb_ask`

   **Commit-triggered sync**: after each commit, CodeKB's Git hook automatically updates the index and marks affected knowledge as `potentially_stale` (no manual action needed).

7. **Set up Git branch for reviewability**

   Changes produced by apply should be reviewable and traceable. Before editing code:

   a. **Check Git status** — ensure working tree is clean (`git status`). If dirty, warn the user to commit or stash first.

   b. **Create a feature branch** from the current branch (typically `main` or `develop`):
      ```bash
      git checkout -b "opsx/<change-name>"
      ```
      - Use the change name as the branch suffix (kebab-case)
      - If the branch already exists, ask whether to reuse it or create a new one with a timestamp suffix

   c. **Commit strategy** — recommend committing after each task (or group of related tasks) so the PR diff is reviewable:
      - Commit message format: `<type>(<scope>): <description>` (e.g., `feat(auth): add OAuth token refresh`)
      - Reference the change name in the commit body for traceability: `OpenSpec change: add-user-auth`

   d. **If Git is not available or the user opts out**, note this in the change and proceed — but recommend setting up Git before archive.

8. **Show current progress**

   Display:
   - Schema being used
   - Progress: "N/M tasks complete"
   - Remaining tasks overview
   - Dynamic instruction from CLI

9. **Implement tasks (loop until done or blocked)**

   Before the first edit, **check parallel-change conflicts**: run `openspec list --json` and, for every other active change, skim its artifact files (`proposal.md` / `tasks.md`) to see if any touches the same modules or source files the current change plans to modify. If a conflict is detected, print an overlap table and ask the user to confirm the order before continuing:

   ```
   ⚠️ Module conflict detected
   Module / file       | This change    | Other active change
   :feature:login       | "add-oauth"    | "rework-auth"
   ```

   Then, for each pending task:
   - Show which task is being worked on
   - **Use CodeGraph when task is unclear**: If a task's scope or affected areas are ambiguous, run `codegraph explore "<task keywords>"` to get immediate code context
   - Make the code changes required
   - Keep changes minimal and focused
   - Mark task complete in the tasks file: `- [ ]` → `- [x]`
   - Continue to next task

   **Pause if:**
   - Task is unclear even after codegraph exploration → ask for clarification
   - Implementation reveals a design issue → suggest updating artifacts
   - Error or blocker encountered → report and wait for guidance
   - User interrupts

10. **On completion or pause, show status**

   Display:
   - Tasks completed this session
   - Overall progress: "N/M tasks complete"
   - If all done: suggest archive
   - If paused: explain why and wait for guidance

**Output During Implementation**

```
## Implementing: <change-name> (schema: <schema-name>)

Working on task 3/7: <task description>
[...implementation happening...]
✓ Task complete

Working on task 4/7: <task description>
[...implementation happening...]
✓ Task complete
```

**Output On Completion**

```
## Implementation Complete

**Change:** <change-name>
**Schema:** <schema-name>
**Progress:** 7/7 tasks complete ✓

### Completed This Session
- [x] Task 1
- [x] Task 2
...

All tasks complete! Ready to archive this change.
```

**Output On Pause (Issue Encountered)**

```
## Implementation Paused

**Change:** <change-name>
**Schema:** <schema-name>
**Progress:** 4/7 tasks complete

### Issue Encountered
<description of the issue>

**Options:**
1. <option 1>
2. <option 2>
3. Other approach

What would you like to do?
```

**Guardrails**
- Keep going through tasks until done or blocked
- Always read context files before starting (from the apply instructions output)
- If task is ambiguous, pause and ask before implementing
- If implementation reveals issues, pause and suggest artifact updates
- **Use CodeGraph proactively** - run `codegraph explore` to understand codebase areas before making changes, and when encountering ambiguous tasks
- Keep code changes minimal and scoped to each task
- **Add or update tests for behavior changes** - when a task adds/changes behavior, add or update the corresponding unit test in the module's `src/test/...` source set (or instrumented test for UI/integration). Do not mark a behavior task complete without test coverage unless the task is purely non-functional (e.g., docs, rename).
- Update task checkbox immediately after completing each task
- Pause on errors, blockers, or unclear requirements - don't guess
- Use contextFiles from CLI output, don't assume specific file names
- When tasks are done, recommend running `/opsx:verify` to compile, lint, and run affected-module unit tests before archiving
- If `codegraph explore` returns no meaningful results, proceed without it — CodeGraph is an enhancement, not a blocker. Fall back to `rg`/grep for manual code search.

**Fluid Workflow Integration**

This skill supports the "actions on a change" model:

- **Can be invoked anytime**: Before all artifacts are done (if tasks exist), after partial implementation, interleaved with other actions
- **Allows artifact updates**: If implementation reveals design issues, suggest updating artifacts - not phase-locked, work fluidly
