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

## CodeGraph Integration

CodeGraph helps trace network request lifecycles, data flow, and error handling paths.

**When to run CodeGraph**:
- During step 2 (trace request lifecycle) — explore the request initiation, interceptors, and response handling
- During step 3 (look for common bugs) — find auth token flows, retry logic, caching layers
- During step 4 (recommend fix) — verify the full request/response data path

```bash
codegraph explore "<repository, API service, or interceptor class>"
```

**What to look for from CodeGraph results**:
- **Request initiation**: ViewModel/Repository methods that call the API service
- **Auth/interceptor chain**: OkHttp interceptors, token refresh logic, header injection
- **Response handling**: JSON parsing, model mapping, error type conversion
- **Caching layer**: Room cache, in-memory cache, DataStore updates after network response
- **Retry logic**: `retryWhen`, `retry`, custom retry loops, exponential backoff
- **Cancellation**: coroutine cancellation handling, `onCleared` disposal of in-flight requests
- **Timeout configuration**: OkHttp client builder, per-call timeouts, connection pool settings

**Scope note**: CodeGraph does not reliably index AndroidManifest.xml (network permissions, `network_security_config`), Gradle build scripts (OkHttp/Retrofit dependency versions), or XML resource files (base URLs in string resources). For network bugs involving manifest config or build dependencies, supplement with `rg`/`find` on `AndroidManifest.xml` and `build.gradle`.

**Fallback**: If `codegraph explore` returns no meaningful results, proceed without it — CodeGraph is an enhancement, not a blocker. Fall back to `rg`/grep for manual request-flow search.
