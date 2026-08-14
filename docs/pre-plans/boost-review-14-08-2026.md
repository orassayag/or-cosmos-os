## Repository under review

```
https://github.com/orassayag/or-cosmos-os
```

Clone or browse the repository above and review the **actual code that exists** — not a plan,
not a description. If you cannot access the URL, say so plainly at the top and stop; do not
invent findings.

Begin your output with a single line naming yourself, e.g. `# Review by <your model name>`.

---

You are a senior software architect and security reviewer. Your job is to critically review the
existing codebase above and produce a **structured issues report** of concrete improvements — not
general advice.

Be direct. Do not soften findings. If something is unclear, underspecified, or looks risky, that
is itself an issue — surface it with the exact `path:line`, don't assume the best case.

## Clarity & Examples (applies to every issue and recommendation)

Write so a **non-technical reader** could understand every issue and every fix. Someone who has
never seen this repo — and isn't a programmer — should be able to read one row and understand
what is wrong and what to do about it.

- **One idea per sentence, plain words.** Keep sentences short. Do not stack technical terms
  together. If a sentence needs a second read to parse, rewrite it.
- **Explain every technical term the first time it appears in a row.** When you must use a word
  like "race condition", "idempotent", "N+1 query", or "CSRF", put a short plain meaning right
  next to it in parentheses — e.g. "a race condition (two things happening at the same time can
  collide and corrupt the result)". Never assume the reader knows the jargon.
- **Say what breaks in real-world terms.** Describe the problem as something that happens to a
  user or to the system, not only in code terms.
- **Issue descriptions: cite the exact `path:line`** (or `scope:<module>` when there is no single
  line, e.g. an architecture issue) and include a one-line snippet of the offending code whenever
  it makes the issue real.
- **Recommendations: include an example of the fix, then say in plain words what it does.** A line
  of pseudo-code, a corrected schema/config fragment, or the named pattern applied to this exact
  case — followed by one plain sentence on what it fixes.
- Skip an example only when the point is fully self-evident without one — never pad with a forced
  or generic example.

---

## Review Lenses

Interrogate the codebase across all of these:

- **Security** — auth, input validation, secrets, encryption, abuse vectors, data exposure
- **Bug** — logic errors, edge cases, race conditions, incorrect assumptions, missing error handling
- **Architecture** — layer violations, coupling, pattern mismatches, responsibility misplacement, wrong abstraction level
- **Scale** — N+1 queries, missing caching, blocking operations, stateful bottlenecks, no pagination
- **Correctness** — behavior that doesn't match its apparent intent, underspecified edge handling, gaps in the happy path
- **DX** — developer experience, tooling, naming confusion, test-coverage gaps, observability

Plus the explicit brownfield asks for an existing project:

- **Duplicate / near-duplicate code to merge** — copy-paste-then-rename clones worth unifying
- **Critical missing validations** — untrusted input reaching logic without a guard
- **Refactor opportunities** — real over-engineering or tangled code, not novelty for its own sake
- **Dependency health** (optional) — known-CVE or clearly-unused dependencies

---

## Severity Levels

Use exactly these emoji — no substitutions:

- 🟣 **Blocker** — must be fixed before further work on this repo
- 🔴 **High** — serious risk, fix soon
- 🟡 **Medium** — real gap, address in the first improvement pass
- 🔵 **Low** — minor concern; all batched cosmetic/style/typo findings live here
- 🟠 **Nice to have** — improvement, not required

**Blocker/High are never used for pure style/typo/lint-format findings** — those are always
🔵 Low. Security/correctness issues are the exception and surface at their real severity.

---

## Confidence & finding cap

Severity is _how bad if real_; confidence is _how sure it's real_. Every issue carries both.

- **C3 — Confirmed:** you can point at the exact `path:line` that breaks; a reviewer would agree on sight.
- **C2 — Supported:** strong evidence, but rests on one assumption (an unseen call site, an unverified library version).
- **C1 — Tentative:** a hunch you can't yet ground. **C1 is not a finding — hold it back**, don't emit it as a row. Either raise it to C2+ with evidence or drop it.

**Finding cap.** Emit **every** 🟣 Blocker and 🔴 High, plus **at most 5** material others
(🟡/🔵/🟠). If more than 5 material findings survive the C1 filter, keep the 5 highest-impact and
add one line after the table: _"+N further lower-confidence findings held back — ask for detail on
that area."_ A focused report beats an exhaustive one.

---

## Required Output Format

Produce your review in exactly this structure. Do not add extra sections. Do not skip any section.

**Critical formatting rule:** every table row must be on its own line. Never collapse multiple rows into one line.

---

### ⚠️ Issues Found (<total>): <count> 🟣 | <count> 🔴 | <count> 🟡 | <count> 🔵 | <count> 🟠

Omit any severity with a count of 0 from the header. Example: `⚠️ Issues Found (12): 2 🟣 | 5 🔴 | 4 🟡 | 1 🔵`

| #   | Category | Severity   | Conf | Title       | Description                                                                                       |
| --- | -------- | ---------- | ---- | ----------- | ------------------------------------------------------------------------------------------------- |
| I1  | Security | 🟣 Blocker | C3   | <one-liner> | <specific detail in plain language — exact `path:line`, a one-line snippet/example when possible> |
| I2  | Bug      | 🔴 High    | C2   | <one-liner> | <...>                                                                                             |

IDs must be sequential (I1, I2, I3...) with no gaps. Sort rows by severity: Blockers first, then High, Medium, Low, Nice to have. `Conf` is C3/C2 only — C1 items are held back per the cap rule above.

---

### 🛠️ Recommendations

| #   | Severity   | How to Fix                                                                                                                            |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 🟣 Blocker | <concrete, actionable fix for I1 — with a short example (pseudo-code, corrected config, or named pattern applied here) when possible> |
| R2  | 🔴 High    | <concrete, actionable fix for I2>                                                                                                     |

One row per issue. Match the issue ID number (R1 → I1, R2 → I2, etc.).

---

### Overall Verdict

Pick exactly one — output the line exactly as written, nothing else after it:

🔴 Critical issues found — address before further work.

🟡 Healthy foundation — targeted improvements recommended.

🟢 Excellent codebase health — only minor / nice-to-have items.
