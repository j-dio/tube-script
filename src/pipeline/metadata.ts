/** Stage 6: PREPEND METADATA (PRD §3.1 F2, §5.1). */
export function prependMetadataHeader(
  body: string,
  meta: { title: string; channel: string; url: string },
): string {
  const header = `---\nTitle: ${meta.title}\nChannel: ${meta.channel}\nURL: ${meta.url}\n---\n\n`
  return `${header}${body}`
}
