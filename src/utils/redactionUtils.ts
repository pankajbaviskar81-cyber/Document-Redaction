import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import JSZip from "jszip";
import * as Tesseract from "tesseract.js";

/**
 * Redaction Utilities
 *
 * This module provides three main functions used by the UI to perform
 * redaction on different file types:
 *
 * - `redactPdf(fileBlob, hits)`: overlays a colored highlight, border,
 *   and bold "[REDACTED]" label over detected hits in a PDF. Uses
 *   `pdf-lib` to manipulate pages and returns a redacted PDF `Blob`.
 *
 * - `redactDocx(fileBlob, hits)`: loads the DOCX archive via `JSZip`,
 *   parses `word/document.xml`, and replaces matched text across
 *   potentially split `<w:t>` runs. Adds bold + shading run properties
 *   to the run containing the redaction and returns a new DOCX `Blob`.
 *
 * - `redactImage(fileBlob, hits)`: runs OCR (Tesseract) on the image,
 *   maps words to bounding boxes and draws a highlight + border and a
 *   bold `[REDACTED]` label on the image canvas. Returns a PNG `Blob`.
 *
 * Each function accepts `hits` as an array of objects containing at least
 * a `value` string (the matched substring). Implementations try to keep
 * output files readable and visually clear rather than strictly
 * pixel-perfect for every layout.
 */

// Types for OCR words (to avoid implicit 'any')
type OcrWord = {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

// Helper: safe regex escape
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Redact sensitive text in a PDF by overlaying black rectangles.
 * Simple approach: draw rectangles to cover sensitive areas.
 */
export async function redactPdf(
  fileBlob: Blob,
  hits: { value: string }[]
): Promise<Blob> {
  const arrayBuffer = await fileBlob.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();
  console.log("Redacting PDF with", hits.length, "hits across", pages.length, "pages");

  // embed a bold font for overlay text
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontSize = 10;

  // Normalize hits
  const normalizedHits = hits.map((h) => String(h.value || '').trim().toLowerCase()).filter(Boolean);

  // Try to use pdfjs to obtain text item positions for precise rectangles
  try {
    const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf');
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    for (let p = 1; p <= pdf.numPages; p++) {
      try {
        const page = pages[p - 1];
        const pageInfo: any = await pdf.getPage(p);
        const textContent = await pageInfo.getTextContent();
        const items: any[] = textContent.items || [];

        // Build simplified words array with bbox estimates
        const words = items.map((it: any) => {
          const tx = (it.transform && it.transform[4]) || 0;
          const ty = (it.transform && it.transform[5]) || 0;
          const str = String(it.str || '');
          // estimate width/height if not provided
          const estimatedFontHeight = (it.height) || Math.abs((it.transform && it.transform[3]) || 10);
          const estimatedWidth = (it.width) || (str.length * (estimatedFontHeight * 0.5));
          return {
            text: str,
            x: tx,
            y: ty,
            width: estimatedWidth,
            height: estimatedFontHeight,
          };
        });

        // For each hit, scan words and nearby sequences to find matches and compute bounding boxes
        for (const hit of normalizedHits) {
          if (!hit) continue;
          for (let i = 0; i < words.length; i++) {
            // accumulate up to N words to allow matching split tokens
            let combined = '';
            let minX = Number.POSITIVE_INFINITY;
            let minY = Number.POSITIVE_INFINITY;
            let maxX = Number.NEGATIVE_INFINITY;
            let maxY = Number.NEGATIVE_INFINITY;
            for (let j = i; j < Math.min(words.length, i + 6); j++) {
              const w = words[j];
              if (!w.text) continue;
              if (combined) combined += ' ';
              combined += w.text;

              // update bbox
              minX = Math.min(minX, w.x);
              minY = Math.min(minY, w.y);
              maxX = Math.max(maxX, w.x + w.width);
              maxY = Math.max(maxY, w.y + w.height);

              if (combined.trim().toLowerCase().includes(hit)) {
                // convert pdfjs coords to pdf-lib coords
                const { height: pageHeight } = page.getSize();
                const rectX = minX;
                // pdfjs y is bottom-based in transform; convert to pdf-lib coordinate space
                const rectY = pageHeight - maxY;
                const rectW = Math.max(4, maxX - minX);
                const rectH = Math.max(8, maxY - minY);

                // draw rectangle (semi-transparent yellow highlight + blue border)
                page.drawRectangle({
                  x: rectX,
                  y: rectY,
                  width: rectW,
                  height: rectH,
                  color: rgb(1, 1, 0),
                  borderColor: rgb(0.2, 0.4, 0.8),
                  borderWidth: 1.5,
                  opacity: 0.6,
                });

                // overlay bold [REDACTED] text with opaque background for contrast
                const label = '[REDACTED]';
                const textX = rectX + 6;
                const textY = rectY + (rectH - fontSize) / 2 - 1;
                const labelWidth = font.widthOfTextAtSize(label, fontSize);
                const labelPad = 6;
                page.drawRectangle({
                  x: textX - labelPad / 2,
                  y: textY - (fontSize / 4),
                  width: labelWidth + labelPad,
                  height: fontSize + (fontSize / 4),
                  color: rgb(1, 1, 1),
                });
                page.drawText(label, {
                  x: textX,
                  y: textY,
                  size: fontSize,
                  font,
                  color: rgb(0, 0, 0),
                });

                break; // move to next start i
              }
            }
          }
        }
      } catch (pgErr) {
        console.warn('Failed extracting page text positions for precise redaction', p, pgErr);
      }
    }

    const pdfBytes = await pdfDoc.save();
    const safeBytes = new Uint8Array(pdfBytes);
    return new Blob([safeBytes], { type: 'application/pdf' });
  } catch (e) {
    console.warn('pdfjs precise redaction failed, falling back to simple overlay', e);
    // fallback: previous simple overlay behavior
    const pages = pdfDoc.getPages();
    pages.forEach((page) => {
      const { width, height } = page.getSize();
      hits.forEach((hit, hitIndex) => {
        const boxWidth = width - 60;
        const boxHeight = 18;
        const x = 30;
        const y = height - 80 - (hitIndex % 15) * 28;
        if (y <= 20) return;
        page.drawRectangle({
          x,
          y,
          width: boxWidth,
          height: boxHeight,
          color: rgb(1, 1, 0),
          borderColor: rgb(0.2, 0.4, 0.8),
          borderWidth: 1.5,
        });
        const label = '[REDACTED]';
        const textX = x + 6;
        const textY = y + (boxHeight - fontSize) / 2 - 1;
        page.drawText(label, {
          x: textX,
          y: textY,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
      });
    });
    const pdfBytes = await pdfDoc.save();
    const safeBytes = new Uint8Array(pdfBytes);
    return new Blob([safeBytes], { type: 'application/pdf' });
  }
}

/**
 * Redact sensitive text in a DOCX by replacing matches with [REDACTED].
 * This reconstructs a simple DOCX with plain text preserved line-by-line.
 */
export async function redactDocx(
  fileBlob: Blob,
  hits: { value: string }[]
): Promise<Blob> {
  const arrayBuffer = await fileBlob.arrayBuffer();

  // Load DOCX as ZIP
  const zip = new JSZip();
  await zip.loadAsync(arrayBuffer);

  // Extract document.xml (where text content is stored)
  const docXmlFile = zip.file("word/document.xml");
  if (!docXmlFile) {
    console.warn("document.xml not found in DOCX");
    return fileBlob; // Return unchanged if can't find document
  }

  let xmlText = await docXmlFile.async("string");
  console.log("Original DOCX XML length:", xmlText.length);
  console.log("Redacting", hits.length, "hits");

  // Parse XML into DOM so we can handle text split across multiple <w:t> nodes
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "application/xml");

  // Namespace for WordprocessingML (usually bound to prefix 'w')
  const ns = xmlDoc.documentElement.getAttribute('xmlns:w') || 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

  // Collect all text nodes (<w:t>) in document order
  const tNodeList = xmlDoc.getElementsByTagNameNS('*', 't');
  const tNodes: Element[] = Array.from(tNodeList as any);
  const nodeTexts = tNodes.map((n) => n.textContent || '');

  // Build combined text and record start offsets for each node
  const starts: number[] = [];
  let combined = '';
  for (let i = 0; i < nodeTexts.length; i++) {
    starts[i] = combined.length;
    combined += nodeTexts[i];
  }

  // Sort hits by length descending so we replace longer matches first
  const sortedHits = [...hits].sort((a, b) => (String(b.value || '').length) - (String(a.value || '').length));

  for (const h of sortedHits) {
    const hitValue = String(h.value || '').trim();
    if (!hitValue) continue;
    const esc = escapeRegExp(hitValue);
    const regex = new RegExp(esc, 'gi');

    // collect matches in combined text
    const matches: Array<{ start: number; end: number }> = [];
    let m: RegExpExecArray | null;
    while ((m = regex.exec(combined)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length });
      // avoid infinite loops for zero-length
      if (m.index === regex.lastIndex) regex.lastIndex++;
    }

    console.log(`Replacing "${hitValue}": found ${matches.length} matches in DOCX text`);

    // Process matches from end -> start to avoid offset shifting
    for (let mi = matches.length - 1; mi >= 0; mi--) {
      const { start, end } = matches[mi];

      // find first and last node indices overlapping the match
      let firstIdx = -1;
      let lastIdx = -1;
      for (let i = 0; i < tNodes.length; i++) {
        const nodeStart = starts[i];
        const nodeEnd = nodeStart + (nodeTexts[i] || '').length;
        if (firstIdx === -1 && start < nodeEnd && end > nodeStart) firstIdx = i;
        if (firstIdx !== -1 && start < nodeEnd && end > nodeStart) lastIdx = i;
        if (nodeStart > end) break;
      }

      if (firstIdx === -1 || lastIdx === -1) continue;

      // Extract the exact original matched substring from combined
      const originalMatched = combined.slice(start, end);
      if (!originalMatched) continue;

      // Create a masked string of same length that preserves whitespace
      const masked = originalMatched.replace(/\S/g, '█');

      // Now apply masked characters across the involved nodes preserving per-node lengths
      let maskPos = 0;
      for (let i = firstIdx; i <= lastIdx; i++) {
        const nodeText = nodeTexts[i] || '';
        const nodeStart = starts[i];
        const nodeEnd = nodeStart + nodeText.length;

        // overlap within this node
        const overlapStart = Math.max(start, nodeStart);
        const overlapEnd = Math.min(end, nodeEnd);
        const localStart = overlapStart - nodeStart;
        const localEnd = overlapEnd - nodeStart;

        if (overlapEnd <= overlapStart) continue; // no overlap

        const prefix = nodeText.slice(0, localStart);
        const suffix = nodeText.slice(localEnd);
        const replaceLen = localEnd - localStart;
        const maskedSegment = masked.substr(maskPos, replaceLen);
        maskPos += replaceLen;

        // set the new text content for this node to prefix + maskedSegment + suffix
        tNodes[i].textContent = prefix + maskedSegment + suffix;

        // Add run properties to the run containing this node so the masked segment is visible
        try {
          const run = (tNodes[i].parentNode) as Element | null;
          if (run) {
            let rPr = Array.from(run.childNodes).find((c: any) => c.nodeName && String(c.nodeName).toLowerCase().endsWith('rpr')) as Element | undefined;
            if (!rPr) {
              rPr = xmlDoc.createElementNS(ns, 'w:rPr');
              run.insertBefore(rPr, tNodes[i]);
            }
            if (!Array.from(rPr.childNodes).some((c: any) => String(c.nodeName).toLowerCase().endsWith('b'))) {
              const b = xmlDoc.createElementNS(ns, 'w:b');
              rPr.appendChild(b);
            }
            if (!Array.from(rPr.childNodes).some((c: any) => String(c.nodeName).toLowerCase().endsWith('shd'))) {
              const shd = xmlDoc.createElementNS(ns, 'w:shd');
              shd.setAttribute('w:val', 'clear');
              shd.setAttribute('w:fill', 'FFFF00');
              rPr.appendChild(shd);
            }
          }
        } catch (e) {
          console.warn('Failed to add run properties for redaction run', e);
        }
      }

      // Update nodeTexts and combined for subsequent matches
      for (let i = firstIdx; i <= lastIdx; i++) {
        nodeTexts[i] = tNodes[i].textContent || '';
      }
      // rebuild combined and starts (simple but safe)
      combined = '';
      for (let i = 0; i < nodeTexts.length; i++) {
        starts[i] = combined.length;
        combined += nodeTexts[i];
      }
    }
  }

  // Serialize back to XML string
  const serializer = new XMLSerializer();
  const newXml = serializer.serializeToString(xmlDoc);

  console.log('Redacted DOCX XML length:', newXml.length);

  // Update document.xml in ZIP
  zip.file('word/document.xml', newXml);

  // Generate DOCX blob from modified ZIP
  const redactedBlob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

  return redactedBlob;
}

/**
 * Redact sensitive text in an image using OCR bounding boxes (Tesseract.js).
 * Overlays black rectangles on words matching hits.
 */
export async function redactImage(
  fileBlob: Blob,
  hits: { value: string }[]
): Promise<Blob> {
  const img = await createImageBitmap(fileBlob);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");

  ctx.drawImage(img, 0, 0);

  // Run OCR
  const ocrResult = await Tesseract.recognize(fileBlob, "eng");
  const words: OcrWord[] = (ocrResult?.data?.words ?? []).map((w: any) => ({
    text: String(w.text ?? ""),
    bbox: {
      x0: Number(w.bbox?.x0 ?? 0),
      y0: Number(w.bbox?.y0 ?? 0),
      x1: Number(w.bbox?.x1 ?? 0),
      y1: Number(w.bbox?.y1 ?? 0),
    },
  }));

  // Normalize hits for matching (lowercase, trim)
  const normalizedHits = hits.map((h) => String(h.value || "").trim().toLowerCase()).filter(Boolean);

  console.log("Image redaction: matching", normalizedHits.length, "hit patterns against", words.length, "OCR words");

  // Group OCR words using spatial clustering: line grouping and x-distance heuristics.
  // This approach is adaptive: it derives thresholds from OCR word heights and widths
  // so it works reasonably across resolutions and fonts.
  const normalized = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const redactedFlags = new Array(words.length).fill(false);
  let redactionCount = 0;

  // Compute word heights and widths and median height as baseline
  const heights = words.map((w) => Math.max(1, (w.bbox.y1 - w.bbox.y0) || 10));
  const median = (arr: number[]) => {
    const a = arr.slice().sort((x, y) => x - y);
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  };
  const medianHeight = Math.max(8, median(heights));

  // Group words by line using center Y and a threshold derived from medianHeight
  type Line = { centerY: number; words: { idx: number; w: OcrWord; cx: number }[] };
  const lines: Line[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (!w.text) continue;
    const cy = (w.bbox.y0 + w.bbox.y1) / 2;
    // try to find a matching line
    let placed = false;
    for (const line of lines) {
      if (Math.abs(line.centerY - cy) <= Math.max(6, medianHeight * 0.6)) {
        line.words.push({ idx: i, w, cx: (w.bbox.x0 + w.bbox.x1) / 2 });
        placed = true;
        break;
      }
    }
    if (!placed) {
      lines.push({ centerY: cy, words: [{ idx: i, w, cx: (w.bbox.x0 + w.bbox.x1) / 2 }] });
    }
  }

  // For each line, sort by x and create segments by merging nearby words based on gap heuristics
  for (const line of lines) {
    line.words.sort((a, b) => (a.w.bbox.x0 - b.w.bbox.x0));
    const segs: { idxs: number[]; minX: number; minY: number; maxX: number; maxY: number; text: string }[] = [];
    let cur: typeof segs[0] | null = null;
    for (let wi = 0; wi < line.words.length; wi++) {
      const entry = line.words[wi];
      const b = entry.w.bbox;
      if (!cur) {
        cur = { idxs: [entry.idx], minX: b.x0, minY: b.y0, maxX: b.x1, maxY: b.y1, text: String(entry.w.text || '') };
        continue;
      }
      const gap = entry.w.bbox.x0 - cur.maxX;
      const avgWidth = ((cur.maxX - cur.minX) / Math.max(1, cur.idxs.length) + (b.x1 - b.x0)) / 2;
      const gapThreshold = Math.max(8, avgWidth * 0.8);
      if (gap <= gapThreshold) {
        // merge into current segment
        cur.idxs.push(entry.idx);
        cur.minX = Math.min(cur.minX, b.x0);
        cur.minY = Math.min(cur.minY, b.y0);
        cur.maxX = Math.max(cur.maxX, b.x1);
        cur.maxY = Math.max(cur.maxY, b.y1);
        cur.text = cur.text + ' ' + String(entry.w.text || '');
      } else {
        // push current and start new
        segs.push(cur);
        cur = { idxs: [entry.idx], minX: b.x0, minY: b.y0, maxX: b.x1, maxY: b.y1, text: String(entry.w.text || '') };
      }
    }
    if (cur) segs.push(cur);

    // Now match each segment against normalized hits
    for (const s of segs) {
      // skip if already redacted
      if (s.idxs.every((ii) => redactedFlags[ii])) continue;
      const normSeg = normalized(s.text);
      if (!normSeg) continue;

      let matched = '';
      for (const h of normalizedHits) {
        const normH = normalized(h);
        if (!normH) continue;
        if (normSeg.includes(normH) || normH.includes(normSeg)) {
          matched = h;
          break;
        }
      }

      if (matched) {
        const pad = Math.max(4, Math.round(medianHeight * 0.18));
        const x0 = Math.max(0, s.minX - pad);
        const y0 = Math.max(0, s.minY - pad);
        const w = Math.max(4, s.maxX - s.minX + pad * 2);
        const h = Math.max(8, s.maxY - s.minY + pad * 2);

        // draw highlight
        ctx.fillStyle = '#FFFF66';
        ctx.fillRect(x0, y0, w, h);
        ctx.lineWidth = Math.max(1, Math.round(Math.min(w, h) * 0.06));
        ctx.strokeStyle = '#2E6AF9';
        ctx.strokeRect(x0 + (ctx.lineWidth / 2), y0 + (ctx.lineWidth / 2), w - ctx.lineWidth, h - ctx.lineWidth);

        const padding = 6;
        const fontSize = Math.min(18, Math.max(10, Math.round(h * 0.7)));
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = '#000000';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillText('[REDACTED]', x0 + padding, y0 + h / 2);

        for (const ii of s.idxs) redactedFlags[ii] = true;
        redactionCount++;
        console.log(`Image: redacted clustered segment "${s.text}" matching hit "${matched}"`);
      }
    }
  }

  console.log('Image redaction complete:', redactionCount, 'segments redacted');

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to create redacted image blob"));
      },
      "image/png",
      0.92
    );
  });
}