# Testing summary (experimental v2)

Date: 2026-10-09. Test source: *Learning Guide 1 Introducing health and wellbeing.pdf* (56 pages).

- `node tests/test_core.js`: PASS.
- `node tests/test_v2.js`: PASS. Verified metadata first, 21 words proposed for cutting, zero automatic deletions, text/page preservation, five-sentence maximum, table and visual safeguards, and detected interface controls.
- `python tests/browser_test.py`: PASS in isolated Chromium with actual source geometry supplied as a PDF.js-shaped fixture. Tested rejection, restoration of a proposed word, complete metadata removal after approval, manual word cuts, bracketed additions, no false suggestion approval, TXT export, and JSON project backup.
- Extracted 628 review items from the fixture; 71 are separately detected web-interface controls and 1 is document metadata. These counts do **not** establish what PDF.js in a real browser will extract.
- The uploaded original PDF and main-branch editor were not modified.

**Remaining work:** Direct PDF.js browser test on the 56-page source, more robust table reconstruction, real AI shortening integration. Live PDF.js previously produced 692 items, so the fixture/browser count difference is not fixed by this release.
