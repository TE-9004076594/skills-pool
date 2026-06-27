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
