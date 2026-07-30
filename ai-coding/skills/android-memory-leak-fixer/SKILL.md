---
name: android-memory-leak-fixer
description: Analyze Android memory leaks and OOM-related retention paths, especially Activity, Fragment, Context, View, coroutine, adapter, and listener leaks.
license: MIT
compatibility: Works with any Android project. Use alongside openspec workflow skills for structured bug investigation.
metadata:
  author: ai-coding
  version: "1.0"
---

# Android Memory Leak Fixer

## Purpose
Use this skill for:
- LeakCanary reports
- memory growth after repeated navigation
- OOM symptoms
- retained Activities/Fragments/Views
- listeners or callbacks never released
- bitmap/cache over-retention

## Goals
- Trace the retention chain
- distinguish intentional cache retention from leaks
- identify the owning reference that should be released
- recommend a fix that preserves behavior
- define verification with leak and memory checks

## Inputs
Useful inputs:
- LeakCanary report
- heap analysis summary
- retained object type
- reproduction flow
- source files around listeners, adapters, bindings, ViewModels, caches
- image loading / bitmap handling code

## Workflow

### 1. Identify retained object
Determine:
- what object is leaking
- whether it should have been garbage collected
- whether it is tied to Activity, Fragment, View, Context, adapter, or background task

### 2. Walk the retention path
Find:
- strong reference chain
- the first suspicious owner
- whether the owner is lifecycle-aware
- whether the reference is static, singleton, long-lived scope, callback, coroutine, or observer

### 3. Classify the leak
Common buckets:
- Fragment view binding leak
- adapter holds Activity/View reference
- singleton holds Context
- listener/callback not removed
- coroutine/job outlives screen
- LiveData/Flow observer not cleared
- Handler/Runnable delayed reference
- WebView/View retained
- bitmap/cache too large or not evicted

### 4. Recommend fix
Prefer:
- clearing references at the correct lifecycle boundary
- using application context only when appropriate
- removing listeners/observers
- using weak reference only if ownership is truly optional
- moving long-lived work to correct scope
- bounding caches

Avoid:
- using weak references everywhere as a blanket solution
- disabling LeakCanary instead of fixing leak
- clearing state too early and breaking functionality

### 5. Consider OOM angle
If memory leak is part of OOM symptoms, also inspect:
- bitmap decode sizes
- cache growth
- repeated object accumulation
- list diff churn or snapshot retention
- large bundles/intents

### 6. Validation
Provide:
- reproduction loop to verify no retained instances
- LeakCanary recheck guidance
- navigation repetition counts
- memory profiler checks if relevant

## Output Format
1. **Leak Summary**
2. **Retention Path Interpretation**
3. **Likely Leak Owner**
4. **Recommended Fix**
5. **Why This Fix Works**
6. **Validation Steps**
7. **Regression Risks**

## Good Fix Patterns
- set Fragment binding to null in `onDestroyView`
- unregister listeners in matching lifecycle callback
- avoid storing Activity Context in singleton
- cancel screen-scoped jobs
- bound image/cache memory
- detach adapters/views when lifecycle ends

## Anti-Patterns
- weak-referencing every field blindly
- clearing references before UI lifecycle truly ends
- keeping hidden static caches without limits

## CodeGraph Integration

CodeGraph helps trace retention paths and identify leak patterns in the codebase.

**When to run CodeGraph**:
- During step 1 (identify retained object) — explore the suspected leaked class and its references
- During step 2 (walk the retention path) — use CodeGraph to find all references to the retained object
- During step 3 (classify the leak) — understand the reference chain structure

```bash
codegraph explore "<leaked class or suspected holder>"
```

**What to look for from CodeGraph results**:
- **Static references**: `companion object`, static fields, singleton patterns holding references
- **Listener/callback registrations**: `addListener`, `addObserver`, event bus subscriptions not removed
- **Anonymous/inner class references**: non-static inner classes, lambdas capturing outer class instances
- **Coroutine scope leaks**: coroutine `launch` in Activity/Fragment without proper scope cancellation
- **Cached collections**: static LruCache, HashMap, or lists that grow unbounded
- **View references**: Fragment views retained after `onDestroyView`, adapter references to old context

**Scope note**: CodeGraph does not reliably index Gradle build scripts or ProGuard rules. For memory issues involving dependency versions or obfuscation that masks leak sources, supplement with `rg`/`find` on `build.gradle` and `proguard-rules.pro`.

**Fallback**: If `codegraph explore` returns no meaningful results, proceed without it — CodeGraph is an enhancement, not a blocker. Fall back to `rg`/grep for manual retention-path search.
