# PDF Split Cleaner

A local-first browser app for cleaning study PDFs by showing the original PDF beside an editable reproduction.

## What it does

- Opens a PDF in the browser
- Shows the original PDF on the left
- Creates an editable reproduction on the right
- Keeps the left and right sides separately scrollable
- Carries the rendered PDF page/image background into the editable side
- Extracts PDF text into editable positioned text items on top of the rendered background
- Tries to preserve the visible position, size, rotation, and font style of text
- Lets you toggle the rendered background on/off or make it stronger
- Groups likely clutter patterns so you can jump to them:
  - hours / time estimates
  - `you` / conversational wording
  - activities / tasks / workbook instructions
  - numbers
  - questions
  - multiple-choice options
  - images / art
  - text boxes / screen clutter
- Lets you dismiss incorrect group matches so they stop showing as matches
- Adds one-click cleaning presets:
  - Remove study-time estimates
  - Remove conversational wording
  - Remove quiz / answer clutter
  - Remove design clutter
  - Plain study notes mode
- Adds a lasso tool for selecting areas on the editable page
- Lets you delete a lasso area by covering it with a white redaction block and removing selected editable text
- Lets you move selected text up or down only, not side-to-side or diagonally
- Lets you delete or hide a whole selected group
- Lets you delete a selected item
- Lets you insert collapsible transcript or notes blocks
- Lets you collapse selected text into a collapsible block
- Has an MCQ helper to delete nearby multiple-choice options
- Links back to the shared dashboard
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
6. Click **Dismiss match** when a grouped match is wrong.
7. Turn **Lasso on**, draw around an area, then delete it or move selected text up/down.
8. Insert transcripts or notes as collapsible blocks.
9. Export the edit state regularly.
10. Use **Print / Save PDF** to make a cleaned PDF from the editable reproduction.

## Important limitation

This is not a full Acrobat replacement. It does not directly rewrite the original PDF object-by-object.

The app now uses the rendered PDF page as a background image on the editable side so images/designs visually carry over better. Editable text sits on top of that background. Deleting an area uses a white cover/redaction block rather than truly removing the original PDF image pixels.

This is useful for study-cleaning workflows, but very complex PDFs may not reproduce perfectly.

## Best suited for

- Course PDFs
- Study guides
- PDFs with lots of screen clutter
- Removing time estimates such as “spend 2 hours”
- Removing conversational instructions
- Covering background art/design clutter
- Cleaning quizzes or multiple-choice layouts
- Inserting transcript blocks or notes
- Moving extracted text up/down after deleting clutter

## Not perfect for

- Scanned image-only PDFs where you want fully editable text
- PDFs with unusual embedded fonts
- Complex tables
- Precise academic publishing layout
- Secure/encrypted PDFs
- True object-level PDF redaction

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

`https://izdrewz.github.io/dash/`

## Future upgrades

- True PDF redaction/export using a backend or advanced client-side PDF library
- OCR for scanned PDFs
- Table-aware reproduction
- Custom saved cleaning presets
- Better MCQ detection by question block
- Export to DOCX
