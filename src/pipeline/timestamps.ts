/**
 * Stage 3: STRIP TIMESTAMPS — PRD §3.1 F3, §5.1
 *
 * Formats stripped:
 *   Bracketed      [0:00]  [12:34]  [1:02:15]
 *   Parenthetical  (0:00)  (12:34)  (1:02:15)
 *   Plain           0:00    12:34    1:02:15
 *
 * The bracketed/parenthetical alternatives are listed first so their wrapper
 * characters are consumed before the plain fallback can match the inner digits,
 * preventing orphaned `[]` or `()` being left in the text.
 *
 * The plain alternative uses `\b` word boundaries and `\d{1,2}` (1–2 digit
 * groups) so multi-digit numbers without colons — e.g. "100 apples" — are
 * never matched.
 */
const TIMESTAMP_RE =
  /\[\d{1,2}:\d{2}(?::\d{2})?\]|\(\d{1,2}:\d{2}(?::\d{2})?\)|\b\d{1,2}:\d{2}(?::\d{2})?\b/g

/**
 * Strips all timestamp occurrences from each segment string.
 * Surrounding whitespace is intentionally left in place — Stage 5 (normalizer)
 * collapses consecutive whitespace across the full pipeline output.
 */
export function stripTimestampsFromSegments(segments: string[]): string[] {
  return segments.map((s) => s.replace(TIMESTAMP_RE, ''))
}
