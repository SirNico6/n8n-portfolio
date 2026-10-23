# Knowledge base

The real asset of this project. How fast project N+1 gets delivered depends on
what was written down during project N. Feeding this is not optional
documentation: it is half the work.

## Layout

**`patterns/`** — one file per reusable pattern. What problem it solves, when to
apply it, the snippet, and how to verify it works.

**`gotchas/`** — one file per service or API. This is what is worth gold and what
the competition does not have: authentication traps, rate limits and what they
return when exceeded, how pagination behaves, which fields are mandatory even
when the docs say otherwise, which errors are transient and which are permanent.
One line per finding, dated.

**`snippets/`** — Code-node JavaScript ready to paste. Each one carries its own
assertions and runs standalone with `node <file>`.

## Maintenance rule

When closing a case or a paid job, before calling it done: **every surprise
found gets written down here.** If something failed in a way that was not
documented anywhere, that is the most valuable entry of the day.
