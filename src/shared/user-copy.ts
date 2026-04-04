/** Shown in toasts, popup, and pipeline errors so expectations stay consistent. */

export const USER_HINT_SUBTITLES = 'Turn on subtitles (CC), then try again.'

export const USER_HINT_FIRST_TAB =
  'First time TubeScript on this tab? Reload the page once, then turn on CC if needed.'

/** Full troubleshooting line for capture / generic failures. */
export const USER_HINT_EXTRACT_RETRY = `${USER_HINT_SUBTITLES} ${USER_HINT_FIRST_TAB}`

/**
 * Same guidance as {@link USER_HINT_EXTRACT_RETRY}, as ordered steps for popup UI.
 * (Error strings keep the single paragraph for toasts / narrow surfaces.)
 */
export const USER_HINT_EXTRACT_STEPS = [
  'Turn on subtitles (CC) on the YouTube player.',
  'If this tab is new to TubeScript, reload the page once.',
  'Click Extract Transcript again (CC must stay on).',
] as const

export const ERR_NO_CAPTION_TRACKS = `No transcript available for this video. ${USER_HINT_EXTRACT_RETRY}`

export const ERR_COULD_NOT_CAPTURE_CAPTIONS = `Could not capture captions. ${USER_HINT_EXTRACT_RETRY}`

export const ERR_SOMETHING_WENT_WRONG = `Something went wrong. ${USER_HINT_EXTRACT_RETRY}`

/** Service worker asleep or not yet listening (common right after install or idle wake). */
export const ERR_EXTENSION_NOT_REACHABLE = `Could not reach TubeScript. Open the TubeScript toolbar menu once or refresh this tab, then try again. ${USER_HINT_EXTRACT_RETRY}`

/** Native tooltip on the injected watch-page button (keep under ~200 chars for readability). */
export const COPY_TRANSCRIPT_BUTTON_TITLE = `Copy transcript (title, channel, URL). ${USER_HINT_SUBTITLES} ${USER_HINT_FIRST_TAB}`
