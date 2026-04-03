/** Stage 5: NORMALIZE — whitespace, join (PRD §5.1). */
export function normalizeTranscriptBody(segments: string[]): string {
  return segments.join(' ').trim()
}
