/**
 * Stage 4: FILTER FILLER — PRD §3.1 F4, §5.1
 *
 * Two pattern tiers:
 *
 * SUBSTRING_PATTERNS — Long-form filler phrases safe to strip as substrings.
 *   • Short segment (≤ LENGTH_GUARD): if any matches, the entire segment is removed.
 *   • Long segment  (> LENGTH_GUARD): only the matched substring is stripped;
 *     the rest of the segment is preserved (prevents false deletions of
 *     substantive content that incidentally contains a filler phrase).
 *
 * WHOLE_SEGMENT_PATTERNS — Short standalone filler words ("um", "you know", …).
 *   • Anchored with ^ and $ so they only match when the trimmed segment IS the
 *     phrase — never as a substring inside a longer sentence.
 *   • Applied only to short segments (≤ LENGTH_GUARD).
 */

const LENGTH_GUARD = 200

// ─── Substring patterns ───────────────────────────────────────────────────────

// `gi` flags: case-insensitive + global replace in long-segment mode.
// Ordering within each category is most-to-least specific to avoid partial
// shadowing (e.g. the full intro phrase before the short "hey everyone" variant).

const SUBSTRING_PATTERNS: RegExp[] = [
  // Engagement / CTAs
  /don'?t forget to (?:like,?\s*and\s*)?subscribe/gi,
  /smash that like button/gi,
  /hit the bell (?:icon|notification|button)/gi,
  /leave a comment (?:down )?below/gi,
  /like and subscribe/gi,
  /if you (?:enjoyed|liked) (?:this )?video/gi,
  /drop a like if you (?:enjoyed|liked)/gi,

  // Channel intros (long-form only; short standalone variants live below)
  /(?:hey|hi) (?:guys|everyone|y'all|folks),?\s*welcome back to (?:my |the )?channel/gi,
  /welcome back to (?:another|the|my) (?:video|episode|channel)/gi,

  // Sponsor segments
  /this (?:video|episode) is (?:sponsored|brought to you) by/gi,
  /today's (?:video|episode) is (?:sponsored|brought to you) by/gi,
  /brought to you by/gi,
  /a huge thanks to (?:our |my )?sponsor/gi,
  /use code \w+ (?:at checkout )?for \d+%? off/gi,

  // Outros
  /thanks for watching/gi,
  /see you in the next (?:one|video)/gi,
  /see you next (?:time|week|video)/gi,
  /until next time/gi,
  /if you made it this far/gi,
  /peace out/gi,
]

// ─── Whole-segment patterns ───────────────────────────────────────────────────

// No `g` flag — used with .test() for an anchored whole-segment check only.
// Trailing punctuation variants (comma, period, exclamation) are included to
// cover natural speech cadences captured by auto-generated captions.

const WHOLE_SEGMENT_PATTERNS: RegExp[] = [
  /^u+m+[,.]?$/i,
  /^u+h+[,.]?$/i,
  /^you know[,.]?$/i,
  /^like i said[,.]?$/i,
  /^basically[,.]?$/i,
  /^so yeah[,!.]?$/i,
  /^right[,!.]?$/i,
  /^i mean[,.]?$/i,
  /^to be (?:honest|fair)[,.]?$/i,
  /^what's up (?:everyone|guys|y'all|folks)[,!.?]?$/i,
  /^and that's (?:it|all)(?: (?:for today|for now|folks))?[!.?]?$/i,
]

// ─── Exported filter ──────────────────────────────────────────────────────────

export function filterFillerSegments(segments: string[]): string[] {
  return segments.map((seg) => {
    const trimmed = seg.trim()

    if (trimmed.length <= LENGTH_GUARD) {
      // Short segment: remove entirely if any pattern fires.
      if (
        WHOLE_SEGMENT_PATTERNS.some((p) => p.test(trimmed)) ||
        SUBSTRING_PATTERNS.some((p) => trimmed.match(p) !== null)
      ) {
        return ''
      }
      return seg
    }

    // Long segment: strip matched substrings; never delete the whole segment.
    let result = trimmed
    for (const p of SUBSTRING_PATTERNS) {
      result = result.replace(p, '')
    }
    return result.replace(/\s{2,}/g, ' ').trim()
  })
}
