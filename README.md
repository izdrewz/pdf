# PDF Split Cleaner

A local-first browser app for cleaning study PDFs by showing the original PDF beside an editable reproduction.

## What it does

- Opens a PDF in the browser
- Shows the original PDF on the left
- Creates an editable reproduction on the right
- Keeps the left and right sides separately scrollable
- Extracts PDF text into editable positioned text items
- Tries to preserve the visible position, size, rotation, and font style of text
- Detects image/design objects and adds removable placeholders
- Groups likely clutter patterns so you can jump to them:
  - hours / time estimates
  - `you` / conversational wording
  - activities / tasks / workbook instructions
  - numbers
  - questions
  - multiple-choice options
  - images / art
  - text boxes / screen clutter
- Adds one-click cleaning presets:
  - Remove study-time estimates
  - Remove conversational wording
  - Remove quiz / answer clutter
  - Remove design clutter
  - Plain study notes mode
- Lets you delete or hide a whole selected group
- Lets you delete a selected item
- Lets you insert collapsible transcript or notes blocks
- Lets you collapse selected text into a collapsible block
- Has an MCQ helper to delete nearby multiple-choice options
- Links back to the shared home dashboard
- Exports:
  - cleaned HTML
  - edit-state JSON
  - print/save-to-PDF output from the browser

## How to use

1. Open `index.html` in a browser.
2. Click **Open PDF**.
3. Use the left pane as the original reference.
4. Edit the right pane.
5. Use cleaning presets for fast cleanup, or use pattern groups manually.
6. Use Undo if a preset removes too much.
7. Insert transcripts or notes as collapsible blocks.
8. Export the edit state regularly.
9. Use **Print / Save PDF** to make a cleaned PDF from the editable reproduction.

## Important limitation

This is not a full Acrobat replacement. It does not directly rewrite the original PDF object-by-object.

Instead, it builds an editable reproduction from the PDF text layer and detected image placeholders. This is useful for study-cleaning workflows, but very complex PDFs may not reproduce perfectly.

## Best suited for

- Course PDFs
- Study guides
- PDFs with lots of screen clutter
- Removing time estimates such as “spend 2 hours”
- Removing conversational instructions
- Removing background art/design placeholders
- Cleaning quizzes or multiple-choice layouts
- Inserting transcript blocks or notes

## Not perfect for

- Scanned image-only PDFs
- PDFs with unusual embedded fonts
- Complex tables
- Precise academic publishing layout
- Secure/encrypted PDFs
- Perfect image extraction/repositioning

## Privacy

Your PDF stays in your browser. The app does not upload it anywhere.

If you export an edit-state JSON or cleaned HTML file, that file is saved locally by your browser.

## GitHub Pages

This is a static app. To publish it with GitHub Pages:

1. Go to the repository settings.
2. Open **Pages**.
3. Choose **Deploy from a branch**.
4. Select the `main` branch and `/root`.
5. Save.

After GitHub Pages finishes deploying, the app should be available at:

`https://izdrewz.github.io/pdf/`

The shared dashboard is:

`https://izdrewz.github.io/Tma-workbench-local/home.html`

## Future upgrades

- Better image extraction and removal
- True PDF redaction/export using a backend or advanced client-side PDF library
- OCR for scanned PDFs
- Table-aware reproduction
- Custom saved cleaning presets
- Drag-to-select multiple items
- Better MCQ detection by question block
- Export to DOCX
