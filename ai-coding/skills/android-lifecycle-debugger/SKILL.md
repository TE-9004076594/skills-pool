---
name: android-lifecycle-debugger
description: Debug Android lifecycle-related bugs involving Activity, Fragment, ViewModel, process death, state restoration, and async callbacks that outlive UI state.
license: MIT
compatibility: Works with any Android project. Use alongside openspec workflow skills for structured bug investigation.
metadata:
  author: ai-coding
  version: "1.0"
---

# Android Lifecycle Debugger

## Purpose
Use this skill when bugs are likely tied to:
- Activity/Fragment lifecycle mismatch
- rotation or configuration changes
- process death and restore
- duplicate requests after recreation
- blank screens after back navigation
- callbacks updating destroyed views
- state loss in navigation or forms

## Goals
- Map the bug to lifecycle transitions
- identify state ownership mistakes
- find async work that outlives the correct scope
- propose lifecycle-safe fixes
- recommend restoration and regression coverage

## Inputs
Useful inputs:
- reproduction steps
- whether rotation/background/restore is involved
- Activity/Fragment/ViewModel code
- navigation code
- observer/Flow/coroutine code
- state restoration logic
- logs or stack traces

## Workflow

### 1. Determine lifecycle scenario
Check whether the issue occurs during:
- initial creation
- configuration change
- background → foreground
- process recreation
- fragment replacement
- navigation back stack restore
- `onDestroyView` followed by late callback
- multi-window or permission flow interruption

### 2. Identify state owner
Determine where state currently lives:
- View
- Fragment field
- Activity field
- ViewModel
- SavedStateHandle
- bundle/arguments
- repository/cache
- singleton/static object

Assess whether that ownership is correct.

### 3. Inspect async work
Look for:
- `lifecycleScope.launch`
- `viewLifecycleOwner.lifecycleScope.launch`
- `GlobalScope`
- Flow collection
- LiveData observation
- callbacks from SDK/network/database
- delayed posts/handlers
- navigation events re-emitting after recreation

### 4. Find lifecycle mismatch
Common patterns:
- view binding accessed after `onDestroyView`
- observer attached to wrong lifecycle owner
- request starts in Fragment but result returns after view is gone
- duplicate collectors after recreation
- one-time event emitted multiple times
- state stored in Fragment field but lost on recreation
- transaction/navigation executed after state saved

### 5. Recommend fix
Prefer:
- moving UI collection to `viewLifecycleOwner`
- using `repeatOnLifecycle`
- storing durable state in ViewModel/SavedStateHandle
- separating view state from one-off effects
- making navigation events idempotent
- restoring state explicitly after process death

Avoid:
- static mutable state for screen restoration
- lifecycle-unaware observers
- non-null assertions on binding outside safe window
- relying on screen not being recreated

### 6. Validation
Always include:
- rotate screen during critical flow
- background then foreground
- kill process and restore
- navigate back/forward rapidly
- repeated tap or duplicate event testing

## Output Format
1. **Lifecycle Scenario**
2. **State Ownership Analysis**
3. **Bug Mechanism**
4. **Suspect Files / Lifecycle Boundaries**
5. **Recommended Fix**
6. **State-Restore Checks**
7. **Regression Tests To Add**

## Good Fix Patterns
- collect Flow with `repeatOnLifecycle(Lifecycle.State.STARTED)`
- observe with `viewLifecycleOwner`
- clear binding in `onDestroyView`
- store UI state in `ViewModel`
- store restorable state in `SavedStateHandle`
- gate one-off navigation events

## Anti-Patterns
- using Fragment fields as durable state
- collecting in wrong scope
- updating views from callbacks after view destruction
- navigation calls without destination/state checks

## CodeGraph Integration

CodeGraph helps trace lifecycle-related code paths, state owners, and async callbacks.

**When to run CodeGraph**:
- During step 2 (identify state owner) — explore which class owns the state involved
- During step 3 (inspect async work) — find coroutine scopes, callback registrations, and their lifecycle bindings
- During step 4 (find lifecycle mismatch) — trace whether async work outlives its lifecycle owner

```bash
codegraph explore "<lifecycle owner class or callback method>"
```

**What to look for from CodeGraph results**:
- **Lifecycle owners**: Activity, Fragment, ViewModel, custom scope holders
- **Async callback sites**: coroutine `launch`/`async`, Rx subscriptions, `Handler.post`, `addCallback` registrations
- **Scope bindings**: whether the coroutine scope is `viewModelScope`, `lifecycleScope`, or a custom scope
- **Cleanup points**: `onDestroyView`, `onCleared`, `DisposableHandle`, `Closeable` implementations
- **State restoration**: `SavedStateHandle`, `onSaveInstanceState` call sites, ViewModel state holders
- **Observer/collector lifecycles**: `collectAsState`, `observe`, `addObserver` — whether they are properly scoped

**Scope note**: CodeGraph does not reliably index XML layouts (data bindings, view IDs) or `AndroidManifest.xml` (`configChanges`, process death config). For lifecycle bugs involving configuration changes or process death restoration, supplement with `rg`/`find` on `AndroidManifest.xml` and layout files.

**Fallback**: If `codegraph explore` returns no meaningful results, proceed without it — CodeGraph is an enhancement, not a blocker. Fall back to `rg`/grep for manual lifecycle call-site search.
