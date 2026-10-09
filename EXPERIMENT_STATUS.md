# Five-sentence source review — experimental v2

This branch was created from `main` for comparison with the original PDF Split Cleaner. The original main-branch cleaner remains unchanged.

## Open the experimental browser preview

**[Open the five-sentence review editor](https://githubraw.com/izdrewz/pdf/experiment/five-sentence-review/review.html)**

This is a development preview directly served from this experimental branch using a third-party GitHub source preview service. It does **not** require a ZIP, terminal or GitHub Pages changes. When the branch changes, the preview usually reflects updates within minutes; refresh the page. The preview service is external, and there is no guaranteed uptime or instant cache refresh. For persistent university work, export your project JSON regularly.

The original PDF Split Cleaner remains at https://izdrewz.github.io/pdf/ .

## Source files

- `review.html`: separate review interface (not `index.html`)
- `review.css`, `review-core.js`, `review.js`: experimental implementation
- `REVIEW_V2_README.md`: detailed instructions and limitations
- `TEST_RESULTS.md`: verified test scope

## Current behavior

The reviewer proposes, but never automatically approves, removal of identified copyright notices, printable timestamps and some printed interface controls. You can restore proposed words, delete additional words and add your wording in square brackets. It keeps the original PDF for comparison and flags uncertain visual/table/linked content.

## Test limits

The available core and isolated browser-interaction tests passed with geometry adapted from the 56-page university source. **Actual browser PDF.js segmentation still needs verification:** the browser previously reported 692 units while the test adapter generated 628. The RL shortening model has not been connected, so the current suggestions are conservative and limited.

No university PDF was published to this branch. Do not merge this experiment until a real PDF.js run and layout review are satisfactory.
