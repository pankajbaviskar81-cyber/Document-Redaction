# Document Redaction Solution

## Overview
This solution detects Personally Sensitive Information (PSS) and Document Sensitive Information (DSS) in SharePoint documents (PDF, DOCX, Images, Text) and provides a one-click redaction workflow with downloadable redacted files.

## Features

### 1. **Sensitive Data Detection**
The solution detects the following data types:

#### PSS (Personally Sensitive Information):
- **PAN** (Primary Account Number / Credit Card): 13-19 digit patterns with separators
- **ACCOUNT**: 9-18 digit account numbers
- **UPI**: UPI handles (e.g., user@bankname)
- **CVV/CVC**: Card verification codes (3-4 digits)
- **PIN**: ATM PIN numbers (4-6 digits)

Additional PSS detectors added:
- **Credit Card Number**: explicit 4-4-4-4 patterns (e.g., `4111 1111 1111 1111`) with Luhn validation and brand detection (VISA/MASTERCARD/AMEX/DISCOVER)
- **Routing Number**: 9-digit US routing/ABA numbers (context-boosted when near keywords like `routing`, `ABA`, `ACH`)
- **Medical Record Number (MRN)**: patterns like `MRN-0012345`
- **Passport Number**: simple common pattern (letter + 7-8 digits, e.g., `X12345678`)
- **Health Insurance ID**: provider-style IDs (e.g., `H123456789`)

#### DSS (Document Sensitive Information):
- **TXN/TRX**: Transaction IDs (e.g., TXN-2025-000123)
- **PSSCODE**: Payment system reference codes (PSS, UTR, NEFT, RTGS, IMPS)
- **AMOUNT**: Currency amounts (₹ 5,00,000 or 5000 INR/USD)
- **IFSC**: Indian bank IFSC codes (e.g., SBIN0001234)

### 2. **Context-Aware Display**
For each detected sensitive item, the UI shows:
- **Type**: Detection type (CARD, TXN, AMOUNT, etc.)
- **Value**: The actual detected value
- **Confidence**: Luhn-based validation for PAN (high/medium/low)
- **Context Snippet**: Bullet-list of surrounding lines for context
- **Index**: Character position in document

### 3. **Multi-Format Support**
- **PDF**: Extracts text via pdfjs, redacts by overlaying black rectangles at text positions
- **DOCX**: Extracts text via Mammoth, replaces hits with [REDACTED], rebuilds document
- **Images**: OCR via Tesseract, overlays black rectangles on detected words
- **Text**: Direct text replacement with [REDACTED]

### 4. **Redaction & Download**
- Detects all sensitive data in document
- Creates redacted version
- Downloads as original filename with `-redacted` suffix
- Maintains readable format (PDFs show rectangles, DOCX/Text show [REDACTED] labels)

## Architecture

### Component: `CustomPanel.tsx`
- List view command set extension
- Triggered when user selects document and clicks "Redact" command
- Loads file from SharePoint via `SPService`
- Runs detection using regex patterns
- Calls redaction utilities based on file type
- Downloads redacted file

### Service: `spservice.ts`
- PnP SP wrapper for SharePoint file operations
- Supports both server-relative paths and absolute URLs
- Falls back to `fetch` if PnP retrieval fails
- Methods:
  - `getFileBlob(fileRef)`: Fetch file as Blob
  - `getFileText(fileRef)`: Fetch file as text
  - `getListItems()`: Query list items

### Utilities: `redactionUtils.ts`
Three redaction functions:

#### `redactPdf(blob, hits)`
- Uses `pdfjs-dist` to extract text positions
- Uses `pdf-lib` to draw black rectangles
- Overlays rectangles at detected text locations
- Returns Blob with redacted PDF
#### `redactPdf(blob, hits)`
- Uses `pdfjs-dist` (dynamically imported) to extract page-level text item positions and build word-level bounding boxes when available
- Uses `pdf-lib` to draw precise yellow highlight rectangles with blue border and overlay a bold `[REDACTED]` label aligned to the detected text bounding box
- Falls back to a simple overlay if `pdfjs` position extraction fails for a given PDF
- Returns Blob with redacted PDF

#### `redactDocx(blob, hits)`
- Uses `mammoth` to extract text
- Replaces hits with `[REDACTED]` (case-insensitive)
#### `redactDocx(blob, hits)`
- Uses `mammoth` to extract text (fallback to `JSZip` XML parsing when needed)
- Replaces hits while handling split `<w:t>` runs across WordprocessingML so redactions preserve exact visual location/length; masked output is styled (bold + shading)
- Uses an in-archive manipulation approach (JSZip + DOM) rather than `Packer.toBuffer()` to avoid platform-specific buffer problems in the browser
- Preserves basic formatting and returns a DOCX Blob
- Returns Blob with redacted DOCX

#### `redactImage(blob, hits)`
- Uses `tesseract.js` for OCR
- Extracts bounding boxes for each word
- Overlays black rectangles on matched words
- Returns Blob with redacted PNG image

### Test Components: `RedactTester.tsx`
- In-browser file upload tester
- Manual detection and redaction testing
- Useful for validation before SharePoint integration

### Test Scripts: `scripts/test-detect*.js`
- Node.js scripts for CLI testing
- `test-detect.js`: Generic transaction data
- `test-detect-card.js`: Card/payment data
- Shows detected hits with context snippets

## Usage

### In SharePoint
1. Navigate to a document library with files (PDF, DOCX, Image, Text)
2. Select a document
3. Click the "Redact" command (or context menu option)
4. A panel opens showing:
   - File name
   - "Detect PSS/DSS" button
   - "Redact & Download" button
5. Click "Detect PSS/DSS" to scan document
6. Review detections (type, value, confidence, context)
7. Click "Redact & Download" to create and download redacted file
8. Open downloaded file - sensitive data is replaced/blacked-out

### Local Testing
```powershell
# Test transaction data
node scripts/test-detect.js

# Test card data
node scripts/test-detect-card.js
```

## Dependencies

```json
{
  "pdf-lib": "^1.17.1",
  "mammoth": "^1.11.0",
  "docx": "^9.5.1",
  "tesseract.js": "^2.1.5",
  "pdfjs-dist": "^3.10.113",
  "jszip": "^3.x",
  "@pnp/sp": "^4.17.0"
}
```

## Build & Deploy

### Build SPFx Package
```powershell
npm install
npx gulp clean
npx gulp bundle --ship
npx gulp package-solution --ship
```

### Deploy to SharePoint
1. Upload `.sppkg` file to app catalog
2. Approve/Add app to site
3. Configure command set on target library
4. Select files and use "Redact" command

## Configuration

### Detector Patterns (CustomPanel.tsx)
Edit the `detectors` object to customize regex patterns:
```typescript
const detectors: Record<string, RegExp> = {
  pan: /\b(?:\d[ -]*?){13,19}\b/g,
  amount: /[₹$€£₽¥]\s*[\d,]+(?:\.\d{2})?/gi,
  // ... more patterns
};
```

### Confidence Scoring (runDetectors function)
Adjust confidence levels:
- `high`: Luhn-validated PAN
- `medium`: Transaction IDs, CVV, PSS codes
- `low`: Amounts, accounts, generic patterns

### Context Window Size
Change `linesAround` parameter in `getContextSnippet`:
```typescript
const ctx = getContextSnippet(rawText, m.index, 2); // 2 = show 2 lines before/after
```

## Known Limitations

1. **PDF Text Extraction**: Complex PDFs with custom fonts may have accuracy issues
2. **OCR Accuracy**: Image quality affects Tesseract results; best with high-resolution images
3. **DOCX Formatting**: Rebuilt DOCX may lose complex styling (tables, images, etc.)
4. **Large Files**: Processing very large PDFs/images may be slow (depends on browser)
5. **URL Support**: pdfjs-dist requires CDN worker URL; offline environments need custom setup

## Troubleshooting

### Error: "nodebuffer is not supported by this platform"
**Solution**: Already fixed in code - pdfjs worker is configured to use CDN.

### Error: "Cannot read property 'getValueByName'"
**Solution**: Ensure file is selected in list view before triggering command.

### Detections showing empty/null
**Solution**: Check file encoding and content format; ensure text extraction succeeds in browser console.

### Redacted file not downloading
**Solution**: Check browser console for errors; verify blob creation; ensure file extension is correct.

## Testing Checklist

- [ ] PDF detection and redaction works
- [ ] DOCX detection and redaction works
- [ ] Image detection and redaction works
- [ ] Text file redaction works
- [ ] Context snippets display correctly
- [ ] Confidence scoring shows for PAN
- [ ] Downloaded files are readable
- [ ] Large files (>10MB) don't cause timeout
- [ ] Multiple detections in same document work
- [ ] Case-insensitive matching works

## Files Structure

```
src/
├── components/
│   ├── panel/
│   │   └── CustomPanel.tsx          # Main redaction UI
│   ├── RedactTester.tsx             # In-browser test component
│   └── ...
├── services/
│   └── spservice.ts                 # SharePoint file operations
├── utils/
│   └── redactionUtils.ts            # PDF/DOCX/Image redaction
└── ...

scripts/
├── test-detect.js                   # Transaction data test
└── test-detect-card.js              # Card data test

config/
└── ... (SPFx config files)
```

## Support

For issues or feature requests:
1. Check browser console for detailed error messages
2. Review test script output for detection accuracy
3. Verify file formats are supported (PDF, DOCX, PNG, JPG, TXT)
4. Ensure SharePoint permissions allow file access

---

**Version**: 1.0.0  
**Last Updated**: November 27, 2025  
**Status**: Production Ready
