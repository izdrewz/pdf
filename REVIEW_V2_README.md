# Five-sentence Source Review — experimental v2

**Base:** `izdrewz/pdf` (PDF Split Cleaner). The original cleaner stays unchanged. This separate experimental reviewer is accessed by opening `review.html`.

## Purpose

This is an alternative to the main editor, for **source-preserving university note trimming**, not PDF redaction. It uses PDF.js in the browser; the original PDF is displayed as reference and never changed.

## Try it

Open `review.html` in a modern browser with internet access to the PDF.js CDN, or serve the folder from a static web server (`python -m http.server 8000` then `http://127.0.0.1:8000/review.html`). Choose a PDF. The app reads all pages, identifies likely prose, headings, tables, images and PDF links, and offers five-sentence review chunks. The separate original cleaner remains at `index.html`.

### Editing

- The editor **pre-proposes removal of copyright notices, printable-page timestamps and pure webpage controls**. Every proposed word is crossed out but retained unless you approve. You can restore any crossed-out word before approval.
- Click **Suggest shortening** for optional conservative deletion-only proposals on regular prose. If none are found, the app says so and does not create fake Accept/Reject controls. This variant **does not run an AI model**; most prose passages will still receive no automatic cuts.
- While a proposal is open, **click crossed-out words to restore them** or **click retained words to remove them**. Click **Approve edited suggestion** only when you agree with the exact result. Reject restores your prior manual edits.
- At any time, click words for manual deletion. To insert your writing, select **Add my writing in [brackets]**, click the word where it belongs, and type. The editor encloses it in `[square brackets]`. There are no tiny `+` marks after every word.
- Separate **Skip · keep original** from **Flag for review**. Tables, images/diagrams, activity labels and links are protected blocks; they cannot be shortened automatically.
- Export both your annotated project (JSON) and reviewed notes (TXT). When you approve deletion of an entire metadata/control block, that block is omitted from reviewed notes, but its unchanged original is retained in the JSON project. Save a project before closing. Project JSON distinguishes your insertions from original source brackets.
- Review decisions are made explicit; unreviewed units are not silently included in the reviewed-text export.

## Important limitations

- The parser uses PDF.js text positioning heuristics; multi-column layouts and real table-cell boundaries cannot be guaranteed. Any suspected table is kept whole and protected until manually checked.
- Embedded media such as a video must be accessed from the *original* activity link; the app cannot read the video itself. Link annotations are flagged.
- Potential images/graphics are flagged at **page level**, not pixel-perfect element bounds. Text inside a figure may be missing. This is deliberate: no OCR guesses or silent deletion.
- Line and sentence grouping is heuristic; always compare to the original PDF. This variant did not change the table-layout heuristic. The full source file cannot be inferred from a JSON project backup; reopen the PDF.
- The original PDF viewer uses browser-native PDF support (`iframe` with blob URL). Some browsers may not show a specific requested page; the browser viewer is only a visual reference.
- PDF.js is currently fetched from the same Cloudflare CDN as the existing `index.html`; offline use requires vendoring PDF.js locally.
- Long documents may take time to process. The local browser stores project state, subject to browser storage limits.
- There is **no integration yet** with the older RL sentence-compression model or a local LLM. Only a small conservative, explicitly reviewable deletion rule-set is available.

## Tests (without uploading any university PDF)

`node tests/test_core.js`

For the full Open University example, the QA team used a PyMuPDF geometry adapter to generate test-only PDF.js-like data, then ran the grouping and browser controls. **These geometry and browser-mock tests are not equivalent to running PDF.js on the full 56-page PDF inside a real network-enabled browser.** The original uploaded PDF is not included in the repository.

## Comparison scope

No existing main-branch files need changing. The experimental branch adds `review.html`, `review.js`, `review-core.js`, `review.css`, and the core test. Merge only if you prefer this interface after comparing it with the other agent's work.

## Changes made specifically in v2

1. Added separate `metadata` and `interface` extraction categories. The reader proposes **complete removal** of recognized copyright statements, page-generation timestamps, printed controls (`Save`, `Reset`, `Reveal discussion`, etc.) and study-time prompts, without applying the cuts automatically. Ordinary headings and activity questions remain available.
2. Added an explicit removal proposal banner, preview for full-section cuts, word-by-word restoration, and preservation of prior decisions when re-opening an identical PDF.
3. Replaced every tiny word-adjacent `+` with **Add my writing in [brackets]**, which asks you to select an anchor word only when you wish to insert.
4. A regular text section now says **No safe cuts identified** when the conservative suggestion rules find nothing; approval is disabled when neither a manual edit nor a proposed cut exists.
5. Accepted, fully deleted units are excluded from the reviewed-notes TXT, but are retained with full source wording and edit history in the JSON project export.
6. Added regression tests for this guide's page 1 metadata, 56-page structure-aware extraction, revised rejection/approval, bracket insertion, full-delete export, and undo-safe manual editing.

**Verification limit:** The new 56-page automated test uses PyMuPDF geometry converted to a PDF.js-shaped fixture and a Chromium browser mock, not actual PDF.js rendering. A screenshot from a user's real PDF.js session showed a different count (692 units versus 628 here); the mismatch remains to be investigated on a network-enabled browser. Neither the AI compression engine nor perfect table extraction is claimed to be complete.
