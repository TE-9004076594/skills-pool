---
name: android-network-bug-debugger
description: Debug Android network-related bugs including request failure, auth expiry, retry loops, parsing errors, offline behavior, timeout handling, and stale response races.
license: MIT
compatibility: Works with any Android project. Use alongside openspec workflow skills for structured bug investigation.
metadata:
  author: ai-coding
  version: "1.0"
---

# Android Network Bug Debugger

## Purpose
Use this skill for:
- API request failures
- intermittent loading failure
- auth/token refresh bugs
- timeout or retry problems
- offline/weak-network defects
- parsing compatibility issues
- stale response overwriting newer UI state

## Goals
- identify whether the bug is transport, auth, parsing, caching, concurrency, or UI-state related
- trace request lifecycle from trigger to UI update
- recommend robust fixes for weak and unstable network conditions
- define tests for retries, expiry, and out-of-order results

## Inputs
Useful inputs:
- request/response logs
- Chucker or OkHttp logs
- API status codes
- parsing exceptions
- repository/use-case code
- interceptor/auth refresh code
- retry policy
- reproduction steps
- offline behavior expectations

## Workflow

### 1. Classify failure type
Decide whether the bug is mainly:
- connectivity failure
- timeout
- TLS/certificate/config issue
- auth failure
- server error handling bug
- parsing/schema compatibility issue
- caching/staleness issue
- concurrency/race issue
- duplicate request issue
- offline UX issue

### 2. Trace request lifecycle
Inspect:
- trigger point
- repository/data source layer
- interceptors
- auth refresh path
- parser/serializer
- result mapping
- UI state update and error presentation

### 3. Look for common bugs
Check for:
- infinite refresh loops
- duplicate retries
- retrying non-idempotent requests unsafely
- swallowing HTTP error body
- treating cancellation as failure
- stale response overwriting newer request result
- missing timeout handling
- parser crash on missing/extra fields
- loading state never cleared

### 4. Recommend fix
Prefer:
- explicit error mapping
- token refresh serialization / single-flight
- idempotent retry policy
- stale-result protection
- tolerant parsing where contract allows
- clear offline/timeout user states
- cancellation-aware coroutine handling

Avoid:
- retrying everything blindly
- hiding all failures behind generic messages
- UI updates from obsolete requests
- blocking token refresh on main thread

### 5. Validation
Include:
- airplane mode
- slow network
- timeout simulation
- expired token
- duplicate tap / repeated request
- out-of-order response scenario
- schema backward compatibility checks

## Output Format
1. **Network Bug Summary**
2. **Failure Class**
3. **Likely Root Cause**
4. **Suspect Files / Request Path**
5. **Recommended Fix**
6. **Edge Cases To Retest**
7. **Regression Tests To Add**

## Good Fix Patterns
- map transport/auth/server/parsing errors separately
- serialize token refresh
- ignore stale responses for obsolete screen state
- use exponential backoff where safe
- clear loading in success/failure/cancel paths
- preserve error detail for diagnosis

## Anti-Patterns
- global catch with generic "network error"
- multiple refresh attempts racing
- retry loops without cap
- parsing with overly strict assumptions when API evolves
