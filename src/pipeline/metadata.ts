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
}

export function prependMetadataHeader(body: string, meta: TranscriptMeta): string {
  const header = [
    '---',
    `Title: ${meta.title}`,
    `Channel: ${meta.channelName}`,
    `URL: ${meta.videoUrl}`,
    '---',
    '',
  ].join('\n')

  return `${header}\n${body}`
}
