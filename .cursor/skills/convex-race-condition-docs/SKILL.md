---
name: convex-race-condition-docs
description: Write and rewrite race condition analysis documents for this project's Convex meeting backend with a clear structure, preserved findings, and practical concurrency reasoning. Use when auditing contention in this repo, reviewing OCC-related risks in meeting flows, or rewriting project docs about retries, hot documents, and concurrency behavior.
---

# Convex Race Condition Docs

## Instructions

Use this skill when the task is to create, refresh, or rewrite a concurrency analysis document for this repository's Convex meeting backend.

The goal is to produce a document that is technically accurate, easy to scan, and useful for engineering prioritization in this codebase.

## Project Context

This skill is specific to this repository.

Assume the analysis is about this meeting system unless the user explicitly scopes it narrower:

- the backend is Convex-based
- the core coordination document is usually `meetings`
- important concurrent actors are typically admins, moderators, participants, reconnecting clients, and background jobs
- the most important flows are usually meeting control, speaker state, queue transitions, polls, attendance, and join/connect behavior
- docs should be written in english even though user-facing product copy is in swedish

## Core Rules

- Read the relevant Convex code before editing the document.
- Follow `AGENTS.md` and read `src/convex/_generated/ai/guidelines.md` before making Convex claims.
- Distinguish between true correctness bugs and ordinary OCC retry behavior.
- Focus on practical failure modes: retry exhaustion, transient user-facing failures, hot documents, duplicate operations, and sequencing bugs.
- Treat each analysis as a fresh review of the current codebase, not as an update that inherits conclusions from older reports.
- Rewrite the analysis document from scratch each time. Do not "patch" the previous report section-by-section as if it were source truth.
- Use any older analysis only as historical context to verify, retire, or replace conclusions.
- If the user explicitly wants a prior finding preserved, re-express it in the new document only after re-validating it against current code.
- Write docs in english unless the user explicitly asks otherwise.

## Document Workflow

Use this workflow:

1. Identify the scope of the analysis.
2. Read the relevant mutations, queries, helpers, and schema/index definitions in this repository.
3. Map each sensitive flow to:
   - documents read
   - documents written
   - likely concurrent actors
   - expected behavior under overlap
4. Write from a fresh-code review mindset, using older analysis only as historical context to verify or retire.
5. Classify each issue:
   - active correctness risk
   - contention / retry risk
   - resolved concern
   - low-risk pattern currently mitigated by OCC or UI behavior
6. Rewrite the entire document into a clean structure from top to bottom.
7. Do not incrementally patch the previous document structure; replace it with a fresh analysis.
8. If the user explicitly protected prior findings, carry them over only after re-validation.
9. Add missing context, interpretation, and next-action guidance.

## Recommended Structure

Use this structure unless the user requests something else:

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

### 1) [Finding title]

## Interpretation

## Notes

## Summary

### Risk Summary

### Recommended next actions
```

## Writing Guidance

### Metadata

At least, include ai model name and datetime.

### Explain Convex Correctly

When discussing concurrency in this project's Convex backend:

- Explain that Convex uses optimistic concurrency control (OCC).
- Explain that Convex does not provide uniqueness constraints or other relational database-style constraints by default.
- Explain that mutations run as transactions on a read snapshot; if any document read by the mutation changes before commit, Convex retries the mutation.
- Do not claim that two concurrent mutations can both commit from the same initial read state when that read set changes.
- For patterns like `read existing -> delete existing -> insert new`, avoid claiming both concurrent writers can pass the same initial read and both commit; once the first commit changes the read input, the other attempt is retried against a new snapshot.
- Do not call every query-then-update pattern a bug.
- Treat many overlaps as retry scenarios unless there is a clear path to silent inconsistency or broken sequencing.
- Highlight hot-document risk when many mutations patch the same document.

### Rewriting vs Patching

Default behavior: rewrite the full analysis document every time.

- do not treat the previous report as a base document to patch
- do not preserve old structure just because it already exists
- do not carry findings forward automatically without re-checking current code
- prefer replacing the entire document with a newly written analysis

### Default Analysis Posture

By default, create a new analysis each time.

- do not assume an older report is still accurate
- verify current behavior from the code before repeating prior conclusions
- treat previous analysis as historical context, not source truth
- explicitly note when an older concern is now resolved, outdated, or no longer applicable

If a user explicitly asks to preserve prior findings:

- re-check each preserved item against current code first
- keep only the substance that is still correct
- place it into the newly rewritten document rather than editing around the old document

### Handling Resolved Issues From Older Docs

Do not keep resolved issues mixed into the main active findings section unless the user explicitly wants historical carry-over.

Preferred handling:

- if an issue was active in the previous analysis and is now resolved, list it in a separate section such as `Resolved Since Previous Review`
- if an issue was already marked as solved/resolved in an older analysis before the current review, it can be removed entirely
- make it obvious that carried-over resolved items are no longer active risks
- avoid inflating the current risk picture by listing closed items alongside active findings without separation

### Add Missing Context

If useful, add:

- what code paths were reviewed
- what kinds of real-world concurrency were considered
- why a risk is bursty versus constant
- whether the main concern is data corruption, retries, or UX degradation
- what would justify revisiting the analysis later

## Default Real-World Considerations

Unless the user or this codebase points to a different reality, assume these baseline conditions and tailor them to the meeting flow being reviewed:

- concurrency is usually bursty, not constant
- the highest-risk moments are simultaneous clicks, reconnect storms, refresh retries, and multi-tab behavior
- most users do not create sustained parallel write load, but admins, moderators, or automated retries can
- a shared top-level document is more likely to be a contention hotspot than a correctness bug by default
- the most likely production symptom is "the action did not go through" rather than silent corruption
- background jobs, scheduled actions, and UI retries can amplify overlap even when human actor count is low

When writing the `Real-World Conditions Considered` section, start from these assumptions and then replace any that are contradicted by this repository's implementation or product behavior.

## Shared `meetings` Document Hotspot

In this project, the `meetings` document is often the primary contention hotspot because multiple flows patch it directly.

Default framing to reuse when it matches this codebase:

- several control flows may converge on the same `meetings` document
- this is usually a burst-risk driven by simultaneous admin/moderator actions, reconnect storms, or repeated clicks
- the likely issue is transient mutation failure or "button did not work" UX, not confirmed silent corruption
- if active actors are few, describe the risk as bursty rather than continuous
- if contention rises, recommend splitting high-churn sub-state into separate documents or tables

Common examples of high-churn `meetings` state include:

- agenda or poll wiring
- speaker queue or current speaker transitions
- moderation flags and user request state
- break, reply, or point-of-order state

Use wording like this when appropriate:

- "Several flows patch the same `meetings` document, making it the main shared-write hotspot."
- "For typical meetings, actor concurrency is small, so conflicts are usually bursty rather than continuous."
- "The main practical impact is occasional retry-driven failure and perceived control unreliability under spikes."

## Analysis Checklist

Before finishing, verify:

- [ ] The document has a clear heading hierarchy.
- [ ] Findings are easy to scan.
- [ ] Any preserved findings were not substantively changed.
- [ ] Convex OCC behavior is described accurately.
- [ ] The summary matches the actual findings.
- [ ] Recommended next actions are practical and proportional.

## Example Positioning

Use wording like this when appropriate:

- "The main active risk is contention on a shared high-churn document, not confirmed silent corruption."
- "Under Convex OCC, the likely user-facing symptom is retry-driven failure or latency during bursts."
- "This item appears resolved in the current implementation and is kept here for audit completeness."

## Additional Resources

- For concrete usage patterns, see [examples.md](examples.md)

## Anti-Patterns

Avoid:

- overstating theoretical races as confirmed bugs
- patching the old report instead of rewriting it from scratch
- mixing old and current code paths without marking older analysis as outdated
- leaving the document as a flat list without summary or interpretation
