# Project TODOs (lightweight tracker)

Engineering backlog items that are not yet issue-tracker tickets. Remove or move items when done.

## Meeting lifecycle (polish)

- **Scheduled status:** Either wire UI/API transitions that set `status: scheduled`, or stop exposing it until the product uses it (today new meetings stay `draft` until `toggleMeeting` sets `active`/`closed`).
- **Draft vs join:** Decide whether join-by-code should be allowed while `status === draft` (or only after explicit “publish” / `scheduled`). Document the rule; align connect and admin UX with it.
- **status vs isOpen:** Document the intended invariant (e.g. `isOpen === true` implies `active`, closed session implies `closed`) and audit any drift in readers/writers.

## Documentation hygiene

- **README:** Update the “Product snapshot” line that still says in-app provisioning is missing; it now exists under `/meetings` for platform admins (`docs/ROADMAP.md`).

## No votes?

Handle case when noone submits a vote
