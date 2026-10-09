# Five-sentence source review — experimental v2

This branch was created from `main` for comparison with the original PDF Split Cleaner. The original main-branch cleaner remains unchanged.

## Files in this branch
- `review.html`: separate review interface, open this page (not `index.html`).
- `review.css`, `review-core.js`, `review.js`: tested browser implementation.
- `REVIEW_V2_README.md`: use instructions and limitations.
- `TEST_RESULTS.md`: verified test scope.

## Changes
The app proposes complete deletion of recognized copyright notices, printable-page timestamps and selected printed interface controls. These proposals are not applied until the user approves; individual words can be restored. The per-word '+' clutter was replaced with an intentional bracket-insertion flow. Empty shortening suggestions no longer offer an approval. Confirmed removals of whole sections are omitted from notes export but retained with original text in project JSON.

## Verification
The core and isolated browser-interaction tests pass against geometry adapted from the 56-page university source. **Actual browser PDF.js segmentation still needs verification:** the browser previously reported 692 units while the test adapter generated 628. The RL-based shortening model has not been connected.

The test fixture contains source text and was intentionally **not** uploaded to this public branch. No university PDF is included.

Do not merge this experiment until a real PDF.js run and layout review are satisfactory.
