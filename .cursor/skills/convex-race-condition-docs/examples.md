# Examples

## Example 1: Fresh analysis document

Use this pattern when the user asks for a new race condition or contention review.

### User request

```text
Audit the Convex backend for race conditions and write a report.
```

### Recommended approach

1. Read `AGENTS.md`.
2. Read `src/convex/_generated/ai/guidelines.md`.
3. Read the relevant Convex files involved in writes, counters, joins, queueing, and scheduling.
4. Identify shared documents and query-then-write paths.
5. Separate:
   - correctness risks
   - OCC retry behavior
   - resolved or low-risk items
6. Write the report using the standard structure from `SKILL.md`.

### Example output shape

```markdown
# Race Condition Analysis

## Document Metadata

- **Analysis date:** 2026-03-23
- **Backend:** Convex

## Purpose

This document reviews concurrency-sensitive paths in the current backend.

## Executive Summary

Most overlapping writes appear to be handled by Convex OCC. The main operational risk is contention on shared high-churn documents, which is more likely to produce retries and transient failures than silent corruption.

## Scope

### Reviewed Areas

- `src/convex/admin/*.ts`
- `src/convex/users/*.ts`

### Review Method

Each sensitive flow was mapped to the documents it reads and writes, then classified by likely concurrent outcome.

## Concurrency Model

Convex uses optimistic concurrency control, so conflicting mutations are retried instead of silently committing inconsistent state.

## Findings

### 1) Shared write hotspot on `meetings`

**Severity:** Medium  
**Type:** Contention / retry risk

Several mutations patch the same `meetings` document.

**Impact:** intermittent failures during bursts of admin activity.

## Summary

### Recommended next actions

1. Add retry-aware UI handling.
2. Add metrics around mutation failure spikes.
3. Split high-churn state if contention increases.
```

## Example 2: Rewrite existing document without changing findings

Use this pattern when the user asks for a rewrite, cleanup, or restructuring pass and explicitly wants the findings preserved.

### User request

```text
Rewrite this file. Add missing information where needed. Don't change the content in the findings items. Fix heading levels and such.
```

### Recommended approach

1. Read the current document completely.
2. Identify which sections are protected by the user's instruction.
3. Read the underlying Convex code to confirm the surrounding framing is still accurate.
4. Rewrite:
   - title
   - metadata
   - introduction/purpose
   - scope and method
   - concurrency model explanation
   - summary and next actions
5. Keep the finding items substantively unchanged.
6. Normalize heading levels so the document reads as one coherent report.

### Example transformation

#### Weak structure

```markdown
# Race Condition Analysis (Convex)

## Introduction

...

## Findings

## 1) High contention hotspot on `meetings` document

...

## 2) `recountParticipants` async sequencing (resolved)

...
```

#### Improved structure

```markdown
# Race Condition Analysis

## Document Metadata

## Purpose

## Executive Summary

## Scope

### Reviewed Areas

### Review Method

### Real-World Conditions Considered

## Concurrency Model

## Findings

### 1) High contention hotspot on `meetings` document

...

### 2) `recountParticipants` async sequencing (resolved)

...

## Interpretation

## Summary
```

### What to preserve

Keep these parts intact unless the user explicitly allows changes:

- finding titles
- severity labels
- type labels
- impact/status text
- recommendation text inside the findings

### What to improve

Improve these freely if they do not alter the finding meaning:

- heading hierarchy
- section ordering
- duplicated or weak framing
- missing summary context
- explanation of OCC and practical risk
