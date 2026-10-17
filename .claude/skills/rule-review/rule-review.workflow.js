export const meta = {
  name: 'rule-review',
  description: 'Rule-by-rule review of a PR diff: one verifier per business rule, then a skeptic per flag',
  whenToUse: 'A PR that touches money, concurrency, the schema, or personal data',
  phases: [
    { title: 'Classify', detail: 'pick the rules that the diff can touch', model: 'haiku' },
    { title: 'Verify', detail: 'one agent per rule, clean context' },
    { title: 'Skeptic', detail: 'one agent per flag tries to refute it', model: 'opus' },
  ],
}

// args: { pr: 40 } or { range: 'origin/main..HEAD' }.
// Optional: head (a commit to read whole files from), rules (rule IDs that replace the classifier's pick).
const input = args || {}
if (!input.pr && !input.range) throw new Error('args needs pr (a number) or range ("base..head")')

const TARGET = input.pr ? `pull request #${input.pr}` : `the range ${input.range}`
const DIFF = input.pr ? `gh pr diff ${input.pr}` : `git diff ${input.range}`
const FILES = input.pr ? `gh pr diff ${input.pr} --name-only` : `git diff --name-only ${input.range}`
const HEAD = input.head || (input.range ? input.range.split(/\.{2,3}/)[1] : null)
const READ_FILE = HEAD ? `\`git show ${HEAD}:<path>\`` : 'the working tree'
const DESCRIPTION = input.pr ? `\`gh pr view ${input.pr} --json title,body\`` : `\`git log --format=%B ${input.range}\``
const RUBRIC = '.claude/skills/rule-review/rubric.md'
const READ_ONLY = 'Read only: do not edit files, commit, push, or post comments.'
const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 }

const CLASSIFY = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'What the diff changes, in 2 sentences' },
    rules: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'BR-n or AG-*' },
          text: { type: 'string', description: 'The rule text, copied from its source' },
          why: { type: 'string', description: 'Which changed file or function can touch it' },
        },
        required: ['id', 'text', 'why'],
      },
    },
  },
  required: ['summary', 'rules'],
}

const VERIFY = {
  type: 'object',
  properties: {
    rule: { type: 'string' },
    verdict: { type: 'string', enum: ['clean', 'flag'] },
    checked: { type: 'string', description: 'The files, functions, and paths you examined, in 1-3 sentences' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'file:line at the PR head' },
          evidence: { type: 'string', description: 'At most 5 lines of quoted code' },
          scenario: { type: 'string', description: 'Inputs and order of requests that end in the broken rule' },
        },
        required: ['location', 'evidence', 'scenario'],
      },
    },
  },
  required: ['rule', 'verdict', 'checked', 'findings'],
}

const SKEPTIC = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['confirmed', 'false_positive'] },
    severity: { type: 'string', enum: ['high', 'medium', 'low'] },
    introduced: { type: 'boolean', description: 'True when the diff adds or changes the lines that cause it' },
    reason: { type: 'string', description: '1-3 sentences that name the decisive line or state' },
    fix: { type: 'string', description: 'One concrete change' },
  },
  required: ['verdict', 'severity', 'introduced', 'reason', 'fix'],
}

phase('Classify')
const forced = Array.isArray(input.rules) && input.rules.length ? input.rules : null
const picked = await agent(
  `You pick the rules that ${TARGET} in the MONSPORT repository could break. ${READ_ONLY}

1. List the changed files with \`${FILES}\`, then read the diff with \`${DIFF}\`. Read the description with ${DESCRIPTION}.
2. Read docs/requirements/business-rules.md (BR-1 to BR-32) and the section "Rule catalogue" of ${RUBRIC} (AG-* rules).
3. ${
    forced
      ? `Return exactly these rules: ${forced.join(', ')}. Copy the text of each from its source.`
      : `Return every rule that a changed line, or code that a changed line calls, could break. Always include AG-SCOPE. When unsure, include the rule: a later agent checks each one, and a missed rule is never checked.`
  }
Copy the rule text from its source. Return the IDs in the order of the source documents.`,
  { label: 'classify', phase: 'Classify', model: 'haiku', effort: 'low', schema: CLASSIFY },
)
if (!picked || !picked.rules.length) throw new Error('The classifier returned no rules')
const rules = picked.rules
if (!forced && !rules.some((r) => r.id === 'AG-SCOPE')) log('The classifier left out AG-SCOPE. Check the paths by hand.')
log(`${rules.length} rules to verify: ${rules.map((r) => r.id).join(', ')}`)

const verifyPrompt = (rule) => `You check ONE rule against ${TARGET} in the MONSPORT repository. ${READ_ONLY}

Rule ${rule.id}: ${rule.text}
The diff in short: ${picked.summary}
Why this rule may apply: ${rule.why}

1. Read the sections "Verdicts", "Evidence", and the AG-SCOPE note of ${RUBRIC}.
2. Read the diff with \`${DIFF}\`. Read whole changed files from ${READ_FILE}.
3. Follow the code past the hunks: callers, the services that lock the same rows, the Prisma schema and migrations in apps/api/prisma, the Zod schemas in packages/shared/src, the guards.
4. Decide whether any path at the PR head breaks this rule: normal use, concurrent requests, boundary times, retries, error paths.

Return "flag" with one finding per distinct violation, or "clean" with an empty findings list. Check only rule ${rule.id}.`

const skepticPrompt = (rule, f) => `A verifier flagged a possible violation of rule ${rule.id} in ${TARGET} in the MONSPORT repository. Try to refute it. ${READ_ONLY}

Rule ${rule.id}: ${rule.text}
Location: ${f.location}
Evidence:
${f.evidence}
Scenario: ${f.scenario}

1. Read all of ${RUBRIC}.
2. Open the location from ${READ_FILE} and the code it depends on. Read the diff with \`${DIFF}\` to see which lines this change added.
3. Walk the scenario one step at a time against the real code: transactions, row locks and their order, unique and check constraints, guards, Zod validation. Find the line that stops it.
4. Choose "false_positive" when a line stops the scenario, or the scenario needs a state that cannot occur. Choose "confirmed" when nothing stops it. When nothing stops it but you doubt it happens in practice, choose "confirmed" with the lowest severity that fits and state the doubt in reason.`

phase('Verify')
const results = await pipeline(
  rules,
  (rule) => agent(verifyPrompt(rule), { label: `verify:${rule.id}`, phase: 'Verify', schema: VERIFY }),
  (v, rule) => {
    if (!v) return { rule, v: null, judged: [] }
    if (v.verdict !== 'flag' || !v.findings.length) return { rule, v, judged: [] }
    return parallel(
      v.findings.map((f, i) => () =>
        agent(skepticPrompt(rule, f), {
          label: `skeptic:${rule.id}#${i + 1}`,
          phase: 'Skeptic',
          model: 'opus',
          schema: SKEPTIC,
        })
          .catch(() => null)
          .then((s) => ({ ...f, rule: rule.id, skeptic: s })),
      ),
    ).then((judged) => ({ rule, v, judged: judged.filter(Boolean) }))
  },
)

const done = results.filter(Boolean)
const failed = rules.filter((r) => !done.some((d) => d.rule.id === r.id && d.v)).map((r) => r.id)
const clean = done.filter((d) => d.v && (d.v.verdict === 'clean' || !d.v.findings.length)).map((d) => d.rule.id)
const all = done.flatMap((d) => d.judged)
const unverified = all.filter((f) => !f.skeptic)
const dismissed = all.filter((f) => f.skeptic && f.skeptic.verdict === 'false_positive')
const confirmed = all
  .filter((f) => f.skeptic && f.skeptic.verdict === 'confirmed')
  .sort((a, b) => SEVERITY_ORDER[a.skeptic.severity] - SEVERITY_ORDER[b.skeptic.severity] || a.rule.localeCompare(b.rule))
const introduced = confirmed.filter((f) => f.skeptic.introduced)
const older = confirmed.filter((f) => !f.skeptic.introduced)
const count = (list, sev) => list.filter((f) => f.skeptic.severity === sev).length
const item = (f, i) => `${i + 1}. **${f.skeptic.severity}** | ${f.rule} | \`${f.location}\`\n   ${f.skeptic.reason}\n   Fix: ${f.skeptic.fix}`

const lines = [
  `## Rule review of ${TARGET}`,
  '',
  `**${introduced.length} confirmed violations** (${count(introduced, 'high')} high, ${count(introduced, 'medium')} medium, ${count(introduced, 'low')} low) in ${rules.length - failed.length} rules checked. ${older.length} more are older than this change. The skeptic dismissed ${dismissed.length} of ${all.length} flags, and ${unverified.length} are not verified.`,
  '',
]
if (introduced.length) lines.push('### Confirmed', '', ...introduced.map(item), '')
if (older.length) lines.push('### Older than this change', '', ...older.map(item), '')
if (unverified.length) {
  lines.push('### Not verified (the skeptic failed)', '', ...unverified.map((f) => `- ${f.rule} | \`${f.location}\`: ${f.scenario}`), '')
}
lines.push('### Rules checked', '', `- Clean: ${clean.join(', ') || 'none'}`)
if (failed.length) lines.push(`- Not checked (the verifier failed): ${failed.join(', ')}`)
lines.push('')
if (dismissed.length) {
  lines.push('### Dismissed flags', '', ...dismissed.map((f) => `- ${f.rule} | \`${f.location}\`: ${f.skeptic.reason}`), '')
}
lines.push('<sub>Skill `rule-review`: one verifier per rule, one skeptic per flag.</sub>')

return {
  comment: lines.join('\n'),
  counts: { rules: rules.length - failed.length, unverified: unverified.length, flags: all.length, confirmed: introduced.length, older: older.length, dismissed: dismissed.length },
  confirmed,
  dismissed,
  failed,
}
