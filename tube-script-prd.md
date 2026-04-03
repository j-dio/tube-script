# Product Requirements Document (PRD)

## TubeScript — YouTube Transcript Extractor

**Version:** 1.0.0
**Author:** Dio
**Date:** April 3, 2026
**Status:** Draft
**License:** MIT (Open Source)

---

## 1. Overview

### 1.1 Problem Statement

Extracting a YouTube video transcript for use in an LLM is a tedious, multi-step manual process: expand the video description, scroll to the bottom, click "Show Transcript," toggle off timestamps, highlight the entire transcript body, and copy. This workflow breaks focus, wastes time, and yields raw text bloated with filler content (sponsor callouts, subscribe reminders, generic intros) that burns tokens and dilutes LLM output quality.

### 1.2 Proposed Solution

TubeScript is a free, open-source Chrome extension that reduces this entire workflow to a single click. It extracts the video transcript, strips timestamps, removes common filler phrases via a built-in filter, prepends video metadata for context, and copies clean, dense text directly to the user's clipboard.

### 1.3 Target Users

- Developers, researchers, and knowledge workers who regularly feed YouTube video content into LLMs (ChatGPT, Claude, Gemini, etc.)
- Students and note-takers who extract video content for summarization or study
- Content creators who repurpose video transcripts into articles, threads, or documentation

### 1.4 Success Metrics

| Metric | Target |
|---|---|
| Time-to-transcript (click → clipboard) | < 2 seconds for videos under 2 hours |
| Chrome Web Store rating | ≥ 4.5 stars |
| Weekly active users (3 months post-launch) | 1,000+ |
| GitHub stars (3 months post-launch) | 100+ |

---

## 2. Technical Architecture

### 2.1 Tech Stack

| Layer | Technology |
|---|---|
| Platform | Chrome Extension (Manifest V3) |
| Language | TypeScript |
| UI Framework | React |
| Build Tool | Vite + CRXJS or Plasmo |
| Styling | Tailwind CSS |
| Testing | Vitest + Playwright (E2E) |

### 2.2 Extension Architecture

```
┌─────────────────────────────────────────────────┐
│                  CHROME EXTENSION                │
│                                                  │
│  ┌──────────┐  ┌────────────┐  ┌─────────────┐  │
│  │  Popup   │  │  Content   │  │  Service     │  │
│  │  (React) │  │  Script    │  │  Worker      │  │
│  │          │  │            │  │  (Background)│  │
│  │ Status   │  │ DOM Button │  │              │  │
│  │ Toast    │  │ Inject     │  │ Transcript   │  │
│  │ Display  │◄─┤            │◄─┤ Extraction   │  │
│  │          │  │ Page Data  │  │ Filtering    │  │
│  │          │  │ Relay      │  │ Clipboard    │  │
│  └──────────┘  └────────────┘  └─────────────┘  │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Content Script** — Injected into YouTube pages. Responsible for:
- Extracting the `ytInitialPlayerResponse` or `ytInitialData` object from the page context
- Injecting the optional "Extract Transcript" button into the YouTube DOM
- Relaying extracted page data to the service worker
- Displaying the toast notification on success/failure

**Service Worker (Background)** — Manifest V3 background process. Responsible for:
- Receiving raw transcript data from the content script
- Parsing caption tracks and selecting the best available track
- Running the timestamp stripping and filler filtering pipeline
- Assembling the final output (metadata + clean transcript)
- Writing to the clipboard via the Offscreen Document API (MV3 requirement)
- Sending status messages back to the content script / popup

**Popup (React)** — Minimal UI shown when clicking the extension icon. Responsible for:
- Triggering the extraction flow
- Displaying extraction status (loading, success, error)
- Showing word count of extracted text

### 2.3 Transcript Extraction Strategy

**Primary method — `ytInitialPlayerResponse` parsing:**

YouTube embeds player data including caption track metadata in a JavaScript object on the page. The content script will:

1. Access the `ytInitialPlayerResponse` object from the page's `window` context (via an injected `<script>` tag or `window.postMessage` relay, since content scripts cannot directly access page JS variables).
2. Navigate to `captions.playerCaptionsTracklistRenderer.captionTracks`.
3. Select the best caption track using this priority:
   - Manual captions in the user's browser language
   - Manual captions in the video's default language
   - Auto-generated captions in the user's browser language
   - Auto-generated captions in any available language
4. Fetch the transcript XML/JSON from the caption track's `baseUrl`.
5. Parse the response into an array of `{ text, startTime, duration }` segments.

**Fallback method — YouTube Data API (not included in V1):**

If the internal API structure changes significantly, a future version could use the official YouTube Data API with an API key. Excluded from V1 to keep the extension zero-config and avoid API key management.

### 2.4 Clipboard Strategy (Manifest V3)

Manifest V3 service workers do not have DOM access and cannot use `navigator.clipboard.writeText()` directly. The solution:

1. **Offscreen Document** — Create a short-lived offscreen document with the `clipboard-write` reason.
2. The service worker sends the final text to the offscreen document via `chrome.runtime.sendMessage`.
3. The offscreen document writes to the clipboard using the standard Clipboard API, then self-closes.

Alternatively, the content script (which does have DOM access) can handle the clipboard write directly after receiving the processed text back from the service worker.

---

## 3. Feature Specification

### 3.1 Core Features (V1 Scope)

#### F1 — One-Click Transcript Extraction

| Property | Detail |
|---|---|
| **Trigger** | User clicks the extension icon in the toolbar OR clicks an injected button on the YouTube page |
| **Behavior** | Extract transcript → strip timestamps → filter filler → prepend metadata → copy to clipboard |
| **Output** | Clean text string on the system clipboard |
| **Performance Target** | < 2 seconds end-to-end for videos ≤ 2 hours |

#### F2 — Metadata Header

Every copied transcript is prepended with a metadata block:

```
---
Title: How to Build a Chrome Extension in 2026
Channel: Fireship
URL: https://www.youtube.com/watch?v=dQw4w9WgXcQ
---

[transcript body starts here]
```

The separator format (`---`) is chosen for Markdown/YAML compatibility, making it easy to parse in LLM prompts.

#### F3 — Timestamp Stripping

All timestamp indicators are removed from the transcript text. This includes:

- YouTube's native timestamp format (e.g., `0:00`, `12:34`, `1:02:15`)
- Bracketed timestamps (e.g., `[00:00]`, `[12:34]`)
- Parenthetical timestamps

Segments are joined with a single space. Consecutive whitespace is collapsed.

#### F4 — Filler Phrase Filtering

A built-in, hardcoded filter removes common non-content phrases from transcripts. The filter operates at the sentence/segment level using regex pattern matching.

**Filter categories and example patterns:**

| Category | Example Phrases |
|---|---|
| Subscribe / Engagement | "smash that like button", "don't forget to subscribe", "hit the bell icon", "leave a comment below" |
| Channel Intros | "hey guys welcome back to my channel", "what's up everyone", "welcome back to another video" |
| Sponsor Segments | "this video is sponsored by", "a huge thanks to our sponsor", "use code [WORD] for [X]% off" |
| Outros | "thanks for watching", "see you in the next one", "peace out", "until next time" |
| Filler / Stalling | "um", "uh", "you know", "like I said", "basically", "so yeah" |

**Implementation details:**

- Patterns are stored in a dedicated `filters.ts` module as an array of `RegExp` objects organized by category.
- Matching is case-insensitive.
- Filtering is performed at the segment level (each transcript segment is evaluated independently).
- A segment is removed only if it matches a filter pattern AND is below a character length threshold (to prevent false positives on long, substantive segments that happen to contain a filler phrase).
- Partial matches within longer segments strip only the matched substring, not the entire segment.

**False positive mitigation:**

- Short filler phrases like "you know" are only stripped as standalone segments or at segment boundaries, not from mid-sentence content.
- A segment length guard (e.g., segments > 200 characters are never fully removed) prevents accidental deletion of substantive content.

#### F5 — Toast Notification

After the clipboard write completes, a non-intrusive toast notification appears overlaid on the YouTube page:

- **Success:** "✓ Transcript copied — 2,847 words" (auto-dismisses after 3 seconds)
- **Error — No transcript:** "✗ No transcript available for this video"
- **Error — Other:** "✗ Something went wrong. Try refreshing the page."

The toast is injected as a Shadow DOM element to avoid style conflicts with YouTube's CSS.

#### F6 — Injected DOM Button (Optional Trigger)

In addition to the toolbar icon, a small button is injected below the YouTube video player (near the like/share buttons area). This provides a contextual trigger without requiring the user to look at the browser toolbar.

- Button label: "Copy Transcript" with a clipboard icon
- Styled to blend with YouTube's native UI (matching font, border radius, color scheme)
- Only visible on video watch pages (`/watch?v=`)

### 3.2 Out of Scope (V1)

| Feature | Reasoning |
|---|---|
| Firefox support | Targeting Chrome-first; Firefox port planned for V2 |
| User-configurable filter lists | Keep UI minimal; revisit based on user feedback |
| Side panel / preview UI | V1 is clipboard-only for speed; preview adds complexity |
| Multi-language selector | V1 auto-selects best available track; manual selection in V2 |
| YouTube Data API integration | Avoid API key complexity; internal parsing is sufficient |
| Transcript summarization | Out of scope; the LLM handles this downstream |
| Export to file (`.txt`, `.md`) | Clipboard-only for V1 |
| SponsorBlock API integration | Would improve sponsor detection but adds external dependency |

---

## 4. User Flow

```
User navigates to a YouTube video
          │
          ▼
   ┌──────────────┐
   │ Is it a       │──── No ───► Extension remains idle
   │ /watch page?  │
   └──────┬───────┘
          │ Yes
          ▼
   Injected "Copy Transcript" button appears
          │
          ▼
   User clicks the button (or toolbar icon)
          │
          ▼
   Content script extracts page data
   (ytInitialPlayerResponse)
          │
          ▼
   ┌──────────────────┐
   │ Caption tracks    │──── No ───► Toast: "No transcript available"
   │ available?        │
   └──────┬───────────┘
          │ Yes
          ▼
   Service worker fetches transcript
   from best available caption track
          │
          ▼
   Processing pipeline:
   1. Parse segments
   2. Strip timestamps
   3. Apply filler filters
   4. Join into clean text
   5. Prepend metadata header
          │
          ▼
   Copy to clipboard
          │
          ▼
   Toast: "✓ Transcript copied — X words"
```

---

## 5. Data Flow & Processing Pipeline

### 5.1 Pipeline Stages

```
Raw Caption Data (XML/JSON from YouTube)
  │
  ├─► Stage 1: PARSE
  │     Extract text segments from caption track response
  │     Output: Array<{ text: string, start: number, duration: number }>
  │
  ├─► Stage 2: DECODE
  │     Decode HTML entities (&amp; → &, &#39; → ', etc.)
  │     Normalize Unicode characters
  │     Output: Array<string>
  │
  ├─► Stage 3: STRIP TIMESTAMPS
  │     Remove inline timestamp references via regex
  │     Output: Array<string>
  │
  ├─► Stage 4: FILTER FILLER
  │     Apply category-based regex filters
  │     Remove/trim matching segments
  │     Apply length guard (do not remove segments > threshold)
  │     Output: Array<string>
  │
  ├─► Stage 5: NORMALIZE
  │     Collapse consecutive whitespace
  │     Trim leading/trailing whitespace per segment
  │     Remove empty segments
  │     Join segments with single space
  │     Output: string
  │
  ├─► Stage 6: PREPEND METADATA
  │     Add title, channel, URL header block
  │     Output: string (final)
  │
  └─► Stage 7: CLIPBOARD WRITE
        Copy final string to system clipboard
        Return word count for toast
```

### 5.2 Data Contracts

**Message: Content Script → Service Worker**

```typescript
interface TranscriptRequest {
  type: "EXTRACT_TRANSCRIPT";
  payload: {
    videoId: string;
    title: string;
    channelName: string;
    videoUrl: string;
    captionTracks: CaptionTrack[];
  };
}

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind: "asr" | "manual"; // asr = auto-generated
  name: string;
}
```

**Message: Service Worker → Content Script**

```typescript
interface TranscriptResponse {
  type: "TRANSCRIPT_RESULT";
  payload:
    | { success: true; wordCount: number }
    | { success: false; error: string };
}
```

---

## 6. Error Handling

| Scenario | Detection | User-Facing Message | Technical Action |
|---|---|---|---|
| Not a YouTube watch page | URL check in content script | None (extension stays idle) | Do not inject button |
| No caption tracks available | Empty `captionTracks` array | "No transcript available for this video" | Show error toast |
| Caption fetch fails (network) | HTTP error on baseUrl fetch | "Something went wrong. Try refreshing." | Log error, retry once |
| Transcript is empty after filtering | Zero segments remain post-pipeline | "Transcript was too short to extract" | Show warning toast |
| Clipboard write fails | Offscreen document error | "Couldn't copy to clipboard. Check permissions." | Log error |
| YouTube DOM structure changed | Extraction returns null/undefined | "Something went wrong. Try refreshing." | Log error for debugging |

---

## 7. Project Structure

```
tubescript/
├── public/
│   ├── icons/
│   │   ├── icon-16.png
│   │   ├── icon-32.png
│   │   ├── icon-48.png
│   │   └── icon-128.png
│   └── offscreen.html
├── src/
│   ├── background/
│   │   └── service-worker.ts        # MV3 background logic
│   ├── content/
│   │   ├── index.ts                 # Content script entry
│   │   ├── extractor.ts             # ytInitialPlayerResponse parsing
│   │   ├── dom-button.ts            # Injected button logic
│   │   └── toast.ts                 # Shadow DOM toast component
│   ├── offscreen/
│   │   └── clipboard.ts             # Offscreen clipboard writer
│   ├── pipeline/
│   │   ├── parser.ts                # Stage 1: Caption XML/JSON parser
│   │   ├── decoder.ts               # Stage 2: HTML entity decoding
│   │   ├── timestamps.ts            # Stage 3: Timestamp stripping
│   │   ├── filters.ts               # Stage 4: Filler phrase filters
│   │   ├── normalizer.ts            # Stage 5: Whitespace normalization
│   │   └── metadata.ts              # Stage 6: Metadata header assembly
│   ├── popup/
│   │   ├── Popup.tsx                # React popup component
│   │   └── index.tsx                # Popup entry point
│   ├── shared/
│   │   ├── types.ts                 # Shared TypeScript interfaces
│   │   ├── constants.ts             # Extension-wide constants
│   │   └── messages.ts              # Message type definitions
│   └── styles/
│       └── toast.css                # Toast notification styles
├── tests/
│   ├── unit/
│   │   ├── parser.test.ts
│   │   ├── filters.test.ts
│   │   ├── timestamps.test.ts
│   │   └── normalizer.test.ts
│   └── e2e/
│       └── extraction.test.ts
├── manifest.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── package.json
├── LICENSE
└── README.md
```

---

## 8. Manifest V3 Configuration

```json
{
  "manifest_version": 3,
  "name": "TubeScript",
  "version": "1.0.0",
  "description": "One-click YouTube transcript extraction. Clean, dense, clipboard-ready.",
  "permissions": [
    "activeTab",
    "clipboardWrite",
    "offscreen"
  ],
  "host_permissions": [
    "https://www.youtube.com/*"
  ],
  "background": {
    "service_worker": "src/background/service-worker.ts",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["https://www.youtube.com/watch*"],
      "js": ["src/content/index.ts"],
      "css": [],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "src/popup/index.html",
    "default_icon": {
      "16": "public/icons/icon-16.png",
      "32": "public/icons/icon-32.png",
      "48": "public/icons/icon-48.png",
      "128": "public/icons/icon-128.png"
    }
  },
  "icons": {
    "16": "public/icons/icon-16.png",
    "48": "public/icons/icon-48.png",
    "128": "public/icons/icon-128.png"
  }
}
```

---

## 9. Testing Strategy

### 9.1 Unit Tests (Vitest)

| Module | Test Cases |
|---|---|
| `parser.ts` | Correctly parses YouTube caption XML; handles malformed XML gracefully; handles empty responses |
| `decoder.ts` | Decodes all common HTML entities; handles already-decoded text; handles Unicode edge cases |
| `timestamps.ts` | Strips `0:00`, `12:34`, `1:02:15` formats; strips bracketed timestamps; does not strip non-timestamp number patterns (e.g., "100 million") |
| `filters.ts` | Removes exact filler matches; removes regex pattern matches; preserves long substantive segments containing filler substrings; does not false-positive on legitimate content |
| `normalizer.ts` | Collapses whitespace; trims segments; removes empties; joins correctly |
| `metadata.ts` | Formats header correctly; handles special characters in titles |

### 9.2 Integration Tests

- Full pipeline test: raw caption XML → final clipboard string, validated against expected output for known YouTube videos
- Message passing: content script → service worker → offscreen document round-trip

### 9.3 E2E Tests (Playwright)

- Load extension on a YouTube video page → verify injected button appears
- Click button → verify toast appears with word count
- Verify clipboard contents match expected processed transcript

### 9.4 Test Fixtures

Maintain a `/tests/fixtures/` directory with saved caption XML responses from real YouTube videos (varied types: tutorial, podcast, music video with lyrics, auto-generated captions, non-English) to enable deterministic unit testing without network calls.

---

## 10. Performance Requirements

| Metric | Target | Measurement |
|---|---|---|
| Extraction + processing time | < 2s for videos ≤ 2 hours | `performance.now()` instrumentation |
| Extension memory footprint | < 50MB during processing | Chrome Task Manager |
| Injected button render time | < 500ms after page load | Content script timing |
| Toast render time | < 100ms after pipeline completes | Mutation observer timing |

---

## 11. Privacy & Security

- **No data collection.** TubeScript does not collect, store, or transmit any user data or transcript content.
- **No external network requests.** All processing happens locally. The only network request is the caption track fetch to YouTube's own servers.
- **No analytics or telemetry.** Zero tracking.
- **Minimal permissions.** Only `activeTab`, `clipboardWrite`, and `offscreen` are requested.
- **Content Security Policy.** Strict CSP in manifest; no `eval()` or inline scripts.

---

## 12. Release Plan

### Phase 1 — Development (Weeks 1–3)

- Week 1: Project scaffolding, transcript extraction logic, pipeline stages 1–3
- Week 2: Pipeline stages 4–6, clipboard integration, toast notification, injected button
- Week 3: Popup UI, error handling, unit tests, integration tests

### Phase 2 — Polish & Testing (Week 4)

- E2E tests across diverse video types (short, long, auto-captions, no captions, live streams)
- Edge case hardening
- README, LICENSE, contribution guidelines
- Extension icons and Chrome Web Store assets (screenshots, description, promo images)

### Phase 3 — Launch (Week 5)

- Publish to Chrome Web Store
- Push repository to GitHub (public)
- Share on relevant communities (Reddit, Hacker News, X/Twitter)

---

## 13. Future Roadmap (Post-V1)

| Version | Features |
|---|---|
| V1.1 | User-configurable filter lists; toggle to include/exclude metadata |
| V1.2 | Firefox support (WebExtension port) |
| V1.3 | Multi-language transcript selector; side panel preview |
| V2.0 | SponsorBlock API integration for precise sponsor segment removal; export to `.md` / `.txt` file; keyboard shortcut trigger |

---

## 14. Open Questions

| # | Question | Owner | Status |
|---|---|---|---|
| 1 | Should auto-generated captions include a quality warning in the metadata header? | Dio | Open |
| 2 | What is the maximum transcript length we support before warning the user? | Dio | Open |
| 3 | Should we detect YouTube SPA navigation and re-inject the button, or rely on MutationObserver? | Dev | Open |
| 4 | Do we handle YouTube Shorts (different URL pattern, different DOM)? | Dio | Open |

---

*This document is the single source of truth for TubeScript V1. All implementation decisions should reference this PRD. Update this document as open questions are resolved.*
