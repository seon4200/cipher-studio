// Acceptance measurement for SEMANTIC ASSET RELEVANCE GATE V1.
//
// BEFORE is not a guess: it is the rule that shipped, recomputed here over the same frozen
// provider answers. AFTER is the gate. Both run in the same process, over the same rows, so the
// comparison cannot drift.

const { app } = require('electron')
const fs = require('fs')
const path = require('path')
const { SEMANTIC_RELEVANCE_GATE_CALIBRATION_V1 } = require('../../fixtures/semantic-relevance-gate-calibration-v1')
const { SEMANTIC_RELEVANCE_GATE_HOLDOUT_V1 } = require('../../fixtures/semantic-relevance-gate-holdout-v1')

const REPO_ROOT = path.resolve(__dirname, '../../..')
const OUTPUT = path.join(__dirname, 'evidence.json')

const canonical = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
const words = value => canonical(value).split(' ').filter(Boolean)

/**
 * The rule as it shipped at 88ee9ed: query words (minus the ENGLISH decoration only) against the
 * tag set, one match is enough, and >= 2 progresses to download. Reproduced verbatim so the
 * before/after numbers describe the real regression and not a strawman.
 */
function legacyScore (row) {
  const target = words(row.candidate.query).filter(word => word !== 'isolated')
  const tagWords = new Set(String(row.candidate.tags).split(',').flatMap(tag => words(tag)))
  const matching = target.filter(word => tagWords.has(word)).length
  if (matching === target.length && target.length) return 3
  return matching ? 2 : 1
}

function main (bundle) {
  const asConcept = value => ({ originalTerm: value, normalizedTerm: value, aliases: [value],
    subject: 'object', importance: 3, preferredRole: 'hero', evidence: 'direct-timed-token' })
  const judge = row => {
    const expansion = bundle.expandConceptLexiconV1(row.concept)[0]
    const context = bundle.relevanceConceptContextV1({ concept: asConcept(row.concept),
      ...(expansion ? { lexicon: expansion.entry } : {}), level: 'exact', siblingConcepts: [] })
    const tags = String(row.candidate.tags).split(',').map(value => value.trim()).filter(Boolean)
    const verdict = bundle.evaluateSemanticRelevanceV1({ provider: 'pixabay-images',
      descriptors: tags, authority: 'third-party-tags' }, context)
    const hero = bundle.relevanceAdmitsRoleV1(verdict.relevanceClass, 'hero')
    const support = bundle.relevanceAdmitsRoleV1(verdict.relevanceClass, 'support')
    return { verdict, decision: hero ? 'hero' : support ? 'support' : 'reject' }
  }

  const measure = (label, rows) => {
    const counters = {
      candidatesEvaluated: rows.length,
      exact: 0, strong: 0, related: 0, weak: 0, unrelated: 0, rejected: 0,
      acceptedHero: 0, acceptedSupport: 0,
      // Every row is a photo candidate, so anything the gate rejects is rejected before the
      // download and therefore before any background-removal pass.
      photoRejectedBeforeCutout: 0, photoCutoutAttempted: 0,
      editorialOnly: 0,
    }
    let legacyAdmitted = 0; let legacyBad = 0
    let gateAdmitted = 0; let gateBad = 0
    const detail = []
    for (const row of rows) {
      const { verdict, decision } = judge(row)
      const bucket = verdict.relevanceClass.toLowerCase()
      counters[bucket]++
      if (decision === 'reject') { counters.rejected++; counters.photoRejectedBeforeCutout++ }
      else {
        counters.photoCutoutAttempted++
        if (decision === 'hero') counters.acceptedHero++; else counters.acceptedSupport++
      }
      const legacyAccepts = legacyScore(row) >= 2
      if (legacyAccepts) { legacyAdmitted++; if (row.expected === 'reject') legacyBad++ }
      if (decision !== 'reject') { gateAdmitted++; if (row.expected === 'reject') gateBad++ }
      detail.push({ id: row.id, concept: row.concept, pixabayId: row.candidate.id,
        expected: row.expected, legacyScore: legacyScore(row), legacyAccepted: legacyAccepts,
        relevanceClass: verdict.relevanceClass, relevanceFocus: verdict.relevanceFocus,
        matchLevel: verdict.matchLevel, rejectionReason: verdict.rejectionReason,
        relevanceEvidence: verdict.relevanceEvidence, decision })
    }
    // A scene whose every candidate is rejected falls back to editorial text.
    counters.editorialOnly = rows.every(row => judge(row).decision === 'reject') ? 1 : 0
    const rate = (bad, admitted) => admitted ? Number((bad / admitted).toFixed(3)) : 0
    const agreed = rows.filter(row => {
      const { decision } = judge(row)
      return row.expected === 'reject' ? decision === 'reject' : decision !== 'reject'
    }).length
    return {
      label, counters,
      agreement: Number((agreed / rows.length).toFixed(3)),
      agreed, total: rows.length,
      BAD_ASSET_RATE_BEFORE: rate(legacyBad, legacyAdmitted),
      BAD_ASSET_RATE_AFTER: rate(gateBad, gateAdmitted),
      admittedBefore: legacyAdmitted, admittedAfter: gateAdmitted,
      badAdmittedBefore: legacyBad, badAdmittedAfter: gateBad,
      detail,
    }
  }

  const calibration = measure('CALIBRATION', SEMANTIC_RELEVANCE_GATE_CALIBRATION_V1)
  const holdout = measure('HOLDOUT', SEMANTIC_RELEVANCE_GATE_HOLDOUT_V1)
  const evidence = {
    acceptanceVersion: 1,
    gateVersion: bundle.SEMANTIC_RELEVANCE_GATE_VERSION,
    generatedAt: new Date().toISOString(),
    thresholds: {
      descriptorWindow: bundle.RELEVANCE_DESCRIPTOR_WINDOW_V1,
      focusMedium: bundle.RELEVANCE_FOCUS_MEDIUM_V1,
      focusHigh: bundle.RELEVANCE_FOCUS_HIGH_V1,
    },
    calibration, holdout,
    visualVerdict: 'PENDING_HUMAN_REVIEW',
  }
  fs.writeFileSync(OUTPUT, JSON.stringify(evidence, null, 1))
  const line = value => console.log(
    `${value.label.padEnd(12)} admitted ${String(value.admittedBefore).padStart(3)} -> ${String(value.admittedAfter).padStart(3)} | ` +
    `bad ${String(value.badAdmittedBefore).padStart(2)} -> ${String(value.badAdmittedAfter).padStart(2)} | ` +
    `BAD_ASSET_RATE ${value.BAD_ASSET_RATE_BEFORE} -> ${value.BAD_ASSET_RATE_AFTER} | agreement ${value.agreement}`)
  line(calibration)
  line(holdout)
  console.log('\nCALIBRATION_COUNTERS=' + JSON.stringify(calibration.counters))
  console.log('HOLDOUT_COUNTERS=' + JSON.stringify(holdout.counters))
  console.log('EVIDENCE=' + path.relative(REPO_ROOT, OUTPUT).replace(/\\/g, '/'))
  console.log('visualVerdict=PENDING_HUMAN_REVIEW')
}

app.whenReady().then(() => {
  let code = 0
  try {
    main(require(path.join(REPO_ROOT, 'dist-electron', 'main', 'index.js')))
  } catch (error) {
    console.error('FALLO', error && error.stack ? error.stack : error)
    code = 1
  }
  app.exit(code)
})
