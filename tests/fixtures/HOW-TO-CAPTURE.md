# How to Capture `ytInitialPlayerResponse`

This fixture powers the unit tests for `parser.ts`. Follow these steps once on any
YouTube video page to populate `sample-yt-player-response.json`.

---

## Steps

1. Open a YouTube video in Chrome — pick one that has **both** auto-generated (ASR)
   and manually-uploaded captions for maximum parser coverage.
   (e.g. an official channel video; check Settings > Subtitles to see track options)

2. Open Chrome DevTools: `F12` or `Ctrl+Shift+I`

3. Go to the **Console** tab.

4. Run this command — it copies the full payload directly to your clipboard:

   ```js
   copy(JSON.stringify(ytInitialPlayerResponse, null, 2))
   ```

5. Open `tests/fixtures/sample-yt-player-response.json` and paste.

---

## What you're capturing

`ytInitialPlayerResponse` is the large JSON object YouTube injects into every watch
page via a `<script>` tag. The fields our parser needs are:

| Path | Description |
|------|-------------|
| `videoDetails.videoId` | The video ID string |
| `videoDetails.title` | Video title |
| `videoDetails.author` | Channel name |
| `videoDetails.lengthSeconds` | Duration as a string |
| `captions.playerCaptionsTracklistRenderer.captionTracks[]` | Array of tracks |
| `captionTracks[n].baseUrl` | Fetch URL for the raw XML transcript |
| `captionTracks[n].languageCode` | e.g. `"en"`, `"es"` |
| `captionTracks[n].kind` | `"asr"` = auto-generated, `""` = manual |
| `captionTracks[n].name.simpleText` | Human-readable track name |

---

## Notes

- If `ytInitialPlayerResponse` is `undefined`, refresh the page and run the command
  immediately after the YouTube player finishes loading.
- The captured JSON is typically 1–3 MB — that is expected; commit the full file.
- The `baseUrl` values contain short-lived auth tokens. They are fine for snapshot
  tests (we mock the fetch), but do **not** use them as live URLs in CI.
