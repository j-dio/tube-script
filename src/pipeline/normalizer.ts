/**
 * Stage 5: NORMALIZE — PRD §5.1
 *
 * Processing order per the PRD contract:
 *   1. Collapse consecutive whitespace within each segment.
 *   2. Trim leading/trailing whitespace from each segment.
 *   3. Remove segments that are completely empty after trimming.
 *   4. Join remaining segments with a single space.
 *
 * This stage receives segments that may contain residual whitespace left by
 * Stage 3 (timestamp stripping) and Stage 4 (filler filtering), so the
 * per-segment collapse happens before the join.
 */
export function normalizeTranscriptBody(segments: string[]): string {
  return segments
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 0)
    .join(' ')
}
