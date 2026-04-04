/**
 * Stage 6: PREPEND METADATA — PRD §3.1 F2, §5.1
 *
 * Output format (Markdown/YAML-compatible, as specified in the PRD):
 *
 *   ---
 *   Title: <title>
 *   Channel: <channelName>
 *   URL: <videoUrl>
 *   ---
 *
 *   <transcript body>
 *
 * The `---` fence is chosen for its Markdown front-matter compatibility,
 * making it trivial for downstream LLM prompts to parse the metadata block.
 */

export interface TranscriptMeta {
  videoId: string
  title: string
  channelName: string
  videoUrl: string
  /** Caption track kind — used to prepend an accuracy warning for auto-generated tracks. */
  kind?: 'asr' | 'manual'
}

export function prependMetadataHeader(body: string, meta: TranscriptMeta): string {
  const lines: string[] = ['---', `Title: ${meta.title}`, `Channel: ${meta.channelName}`, `URL: ${meta.videoUrl}`, '---', '']

  if (meta.kind === 'asr') {
    lines.push('[Auto-generated transcript: spelling and grammar may be imperfect]', '')
  }

  return `${lines.join('\n')}\n${body}`
}
