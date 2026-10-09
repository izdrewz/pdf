# Source Review v3 — experimental

The changes target failures demonstrated by the 692-unit export from the 56-page Learning Guide.

Open `review.html` in the experimental branch browser preview.

- Groups continuous academic prose into at most five sentences. Original headings are stored for context, not separate editing chores.
- Entire copyright notices, printed interface controls, study-planning introductions and study-timetable tables are *proposed* for removal and require approval.
- Provides one-click whole-section cuts, Shift-click word ranges, individual word restoration and bracketed personal additions.
- Displays a continuous preview of accepted/kept notes and a local autosave indicator.
- Imports the previous project, transfers decisions when exact text matches, and archives every old decision in the new project backup. Changed table boundaries must be re-reviewed; they are not silently approved.
- Does not edit the original PDF. Unreadable images remain review flags.

## Tests

Full-PDF text coverage (56 pages): `node tests/verify_coverage.js` — no unmatched source words using an adapter generated from the PDF geometry.
Browser workflow (same full source, simulated PDF.js): `python tests/browser_test.py` — accepted decisions transferred, page planner grouped, bulk cuts, bracket insertions, preview and export passed.

**Outstanding limitation:** Chromium in this execution environment could not load the CDN PDF.js script, so full real PDF.js end-to-end extraction remains unverified. The local rule engine only proposes conservative cuts and selected whole sections; there is no pretrained RL model in this build. Special formats may still need visual checks against the source PDF.
