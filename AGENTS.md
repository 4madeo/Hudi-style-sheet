# Hudi Development Agent Instructions

## Operating Mode

Default mode is SPEED MODE.

If the user begins a request with:

CAUTIOUS:
SAFE:
REVIEW:

switch into CAUTIOUS MODE for that request only.

After completing that request, automatically return to SPEED MODE.

## SPEED MODE

Assume the user prefers rapid iteration.

In SPEED MODE:

* Execute immediately.
* Make reasonable assumptions.
* Do not ask for permission for routine development work.
* Prefer implementation over discussion.
* Prefer progress over certainty.
* If multiple solutions are reasonable, choose one and proceed.
* Briefly mention assumptions when relevant.

A working implementation is generally more valuable than a lengthy plan.

## CAUTIOUS MODE

In CAUTIOUS MODE:

* Explain intended changes before making them.
* Highlight tradeoffs.
* Ask for confirmation before major architectural changes.
* Avoid making assumptions.
* Prefer discussion before implementation.

Use CAUTIOUS MODE only when explicitly requested.

## Browser And Preview Policy

Do NOT automatically:

* Start temporary HTTP servers.
* Start Vite preview.
* Start Next.js dev servers.
* Start React dev servers.
* Start localhost servers.
* Open Playwright.
* Open Puppeteer.
* Open browser automation.
* Take screenshots.
* Perform visual verification.

For frontend work:

* Modify the code.
* Explain the expected visual result.
* Let the user verify visually.

Only perform browser verification if the user explicitly requests it.

For local checks in this project, do not use port 5174. It is reserved by another VS Code project. If the user explicitly asks for a local preview, use another available local port such as 5180 and stop any temporary preview server after verification.

## Frontend Development Philosophy

This project prioritizes iteration speed.

When working on UI:

* Focus on achieving the intended visual result.
* Use modern CSS techniques.
* Prefer simple implementations over excessive abstraction.
* Avoid premature optimization.
* Avoid overengineering component structures.

Visual polish is important.

Do not remove visual flair solely for simplicity.

## CSS Guidelines

Prefer:

* CSS variables.
* Flexbox.
* Grid.
* Modern CSS features.
* Smooth transitions.
* Lightweight animations.

Avoid:

* Unnecessary utility proliferation.
* Deep nesting.
* Excessive specificity.
* Large CSS frameworks unless already present.

When implementing visual effects:

* Build the effect directly.
* Do not spend time debating alternatives unless requested.

## Verification Philosophy

Use the minimum validation necessary.

Preferred order:

1. Typecheck.
2. Lint.
3. Build.

Do not repeatedly run identical validation commands.

Do not perform expensive validation loops unless requested.

## File Modifications

You may:

* Create files.
* Modify files.
* Rename files.
* Refactor files.

without requesting approval.

Only ask before:

* Deleting significant functionality.
* Removing large sections of code.
* Changing architecture substantially.
* Touching production infrastructure.
* Handling secrets or credentials.

## Communication Style

Please reduce/remove the number of bullet points used in responses. Use bullets only when there is a clear list.

Keep responses concise.

After completing work, provide:

1. What changed.
2. Files modified.
3. Any remaining issues.

Avoid lengthy explanations unless requested.

## Performance Expectations

Optimize for developer velocity.

Avoid:

* Re-reading the same files repeatedly.
* Re-running the same commands repeatedly.
* Excessive repository scanning.
* Unnecessary research.
* Defensive over-analysis.

When uncertain:

Make the most reasonable assumption and continue.

## Git Policy

Do not:

* Create commits.
* Create branches.
* Push changes.

Only modify the working tree.

## Hudi Design Direction

When making design decisions:

* Favor delightful interactions.
* Favor playful presentation.
* Favor clean, premium aesthetics.
* Favor Wii-era friendliness and approachability.
* Favor subtle motion and polish.
* Favor designs that feel crafted rather than corporate.

Avoid:

* Enterprise SaaS aesthetics.
* Excessive minimalism.
* Generic startup landing page patterns.
* Overly dark, aggressive gaming aesthetics.

The desired feeling is:

"Friendly, magical, polished, playful, and premium."

## Escalation Rules

Do not ask for approval unless:

1. Real money may be spent.
2. Production systems may be modified.
3. Secrets may be exposed.
4. Data may be permanently deleted.
5. The user explicitly requested CAUTIOUS MODE.

Everything else: proceed.
