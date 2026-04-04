type Props = {
  className?: string
}

/**
 * Raster brand mark from `public/tubescript-logo.png` (high-res source; scales down in UI).
 */
export function TubeScriptLogoMark({ className }: Props) {
  return (
    <img
      src={chrome.runtime.getURL('tubescript-logo.png')}
      alt=""
      aria-hidden
      decoding="async"
      width={2000}
      height={2000}
      className={className}
    />
  )
}
