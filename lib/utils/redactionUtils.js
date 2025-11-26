var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import JSZip from "jszip";
import * as Tesseract from "tesseract.js";
// Helper: safe regex escape
var escapeRegExp = function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); };
/**
 * Redact sensitive text in a PDF by overlaying black rectangles.
 * Simple approach: draw rectangles to cover sensitive areas.
 */
export function redactPdf(fileBlob, hits) {
    return __awaiter(this, void 0, void 0, function () {
        var arrayBuffer, pdfDoc, pages, font, fontSize, normalizedHits, pdfjs, loadingTask, pdf, p, page, pageInfo, textContent, items, words, _i, normalizedHits_1, hit, i, combined, minX, minY, maxX, maxY, j, w, pageHeight, rectX, rectY, rectW, rectH, label, textX, textY, labelWidth, labelPad, pgErr_1, pdfBytes, safeBytes, e_1, pages_1, pdfBytes, safeBytes;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fileBlob.arrayBuffer()];
                case 1:
                    arrayBuffer = _a.sent();
                    return [4 /*yield*/, PDFDocument.load(arrayBuffer)];
                case 2:
                    pdfDoc = _a.sent();
                    pages = pdfDoc.getPages();
                    console.log("Redacting PDF with", hits.length, "hits across", pages.length, "pages");
                    return [4 /*yield*/, pdfDoc.embedFont(StandardFonts.HelveticaBold)];
                case 3:
                    font = _a.sent();
                    fontSize = 10;
                    normalizedHits = hits.map(function (h) { return String(h.value || '').trim().toLowerCase(); }).filter(Boolean);
                    _a.label = 4;
                case 4:
                    _a.trys.push([4, 15, , 17]);
                    return [4 /*yield*/, import('pdfjs-dist/legacy/build/pdf')];
                case 5:
                    pdfjs = _a.sent();
                    loadingTask = pdfjs.getDocument({ data: arrayBuffer });
                    return [4 /*yield*/, loadingTask.promise];
                case 6:
                    pdf = _a.sent();
                    p = 1;
                    _a.label = 7;
                case 7:
                    if (!(p <= pdf.numPages)) return [3 /*break*/, 13];
                    _a.label = 8;
                case 8:
                    _a.trys.push([8, 11, , 12]);
                    page = pages[p - 1];
                    return [4 /*yield*/, pdf.getPage(p)];
                case 9:
                    pageInfo = _a.sent();
                    return [4 /*yield*/, pageInfo.getTextContent()];
                case 10:
                    textContent = _a.sent();
                    items = textContent.items || [];
                    words = items.map(function (it) {
                        var tx = (it.transform && it.transform[4]) || 0;
                        var ty = (it.transform && it.transform[5]) || 0;
                        var str = String(it.str || '');
                        // estimate width/height if not provided
                        var estimatedFontHeight = (it.height) || Math.abs((it.transform && it.transform[3]) || 10);
                        var estimatedWidth = (it.width) || (str.length * (estimatedFontHeight * 0.5));
                        return {
                            text: str,
                            x: tx,
                            y: ty,
                            width: estimatedWidth,
                            height: estimatedFontHeight,
                        };
                    });
                    // For each hit, scan words and nearby sequences to find matches and compute bounding boxes
                    for (_i = 0, normalizedHits_1 = normalizedHits; _i < normalizedHits_1.length; _i++) {
                        hit = normalizedHits_1[_i];
                        if (!hit)
                            continue;
                        for (i = 0; i < words.length; i++) {
                            combined = '';
                            minX = Number.POSITIVE_INFINITY;
                            minY = Number.POSITIVE_INFINITY;
                            maxX = Number.NEGATIVE_INFINITY;
                            maxY = Number.NEGATIVE_INFINITY;
                            for (j = i; j < Math.min(words.length, i + 6); j++) {
                                w = words[j];
                                if (!w.text)
                                    continue;
                                if (combined)
                                    combined += ' ';
                                combined += w.text;
                                // update bbox
                                minX = Math.min(minX, w.x);
                                minY = Math.min(minY, w.y);
                                maxX = Math.max(maxX, w.x + w.width);
                                maxY = Math.max(maxY, w.y + w.height);
                                if (combined.trim().toLowerCase().includes(hit)) {
                                    pageHeight = page.getSize().height;
                                    rectX = minX;
                                    rectY = pageHeight - maxY;
                                    rectW = Math.max(4, maxX - minX);
                                    rectH = Math.max(8, maxY - minY);
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
                                    label = '[REDACTED]';
                                    textX = rectX + 6;
                                    textY = rectY + (rectH - fontSize) / 2 - 1;
                                    labelWidth = font.widthOfTextAtSize(label, fontSize);
                                    labelPad = 6;
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
                                        font: font,
                                        color: rgb(0, 0, 0),
                                    });
                                    break; // move to next start i
                                }
                            }
                        }
                    }
                    return [3 /*break*/, 12];
                case 11:
                    pgErr_1 = _a.sent();
                    console.warn('Failed extracting page text positions for precise redaction', p, pgErr_1);
                    return [3 /*break*/, 12];
                case 12:
                    p++;
                    return [3 /*break*/, 7];
                case 13: return [4 /*yield*/, pdfDoc.save()];
                case 14:
                    pdfBytes = _a.sent();
                    safeBytes = new Uint8Array(pdfBytes);
                    return [2 /*return*/, new Blob([safeBytes], { type: 'application/pdf' })];
                case 15:
                    e_1 = _a.sent();
                    console.warn('pdfjs precise redaction failed, falling back to simple overlay', e_1);
                    pages_1 = pdfDoc.getPages();
                    pages_1.forEach(function (page) {
                        var _a = page.getSize(), width = _a.width, height = _a.height;
                        hits.forEach(function (hit, hitIndex) {
                            var boxWidth = width - 60;
                            var boxHeight = 18;
                            var x = 30;
                            var y = height - 80 - (hitIndex % 15) * 28;
                            if (y <= 20)
                                return;
                            page.drawRectangle({
                                x: x,
                                y: y,
                                width: boxWidth,
                                height: boxHeight,
                                color: rgb(1, 1, 0),
                                borderColor: rgb(0.2, 0.4, 0.8),
                                borderWidth: 1.5,
                            });
                            var label = '[REDACTED]';
                            var textX = x + 6;
                            var textY = y + (boxHeight - fontSize) / 2 - 1;
                            page.drawText(label, {
                                x: textX,
                                y: textY,
                                size: fontSize,
                                font: font,
                                color: rgb(0, 0, 0),
                            });
                        });
                    });
                    return [4 /*yield*/, pdfDoc.save()];
                case 16:
                    pdfBytes = _a.sent();
                    safeBytes = new Uint8Array(pdfBytes);
                    return [2 /*return*/, new Blob([safeBytes], { type: 'application/pdf' })];
                case 17: return [2 /*return*/];
            }
        });
    });
}
/**
 * Redact sensitive text in a DOCX by replacing matches with [REDACTED].
 * This reconstructs a simple DOCX with plain text preserved line-by-line.
 */
export function redactDocx(fileBlob, hits) {
    return __awaiter(this, void 0, void 0, function () {
        var arrayBuffer, zip, docXmlFile, xmlText, parser, xmlDoc, ns, tNodeList, tNodes, nodeTexts, starts, combined, i, sortedHits, _i, sortedHits_1, h, hitValue, esc, regex, matches, m, mi, _a, start, end, firstIdx, lastIdx, i, nodeStart, nodeEnd, originalMatched, masked, maskPos, i, nodeText, nodeStart, nodeEnd, overlapStart, overlapEnd, localStart, localEnd, prefix, suffix, replaceLen, maskedSegment, run, rPr, b, shd, i, i, serializer, newXml, redactedBlob;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, fileBlob.arrayBuffer()];
                case 1:
                    arrayBuffer = _b.sent();
                    zip = new JSZip();
                    return [4 /*yield*/, zip.loadAsync(arrayBuffer)];
                case 2:
                    _b.sent();
                    docXmlFile = zip.file("word/document.xml");
                    if (!docXmlFile) {
                        console.warn("document.xml not found in DOCX");
                        return [2 /*return*/, fileBlob]; // Return unchanged if can't find document
                    }
                    return [4 /*yield*/, docXmlFile.async("string")];
                case 3:
                    xmlText = _b.sent();
                    console.log("Original DOCX XML length:", xmlText.length);
                    console.log("Redacting", hits.length, "hits");
                    parser = new DOMParser();
                    xmlDoc = parser.parseFromString(xmlText, "application/xml");
                    ns = xmlDoc.documentElement.getAttribute('xmlns:w') || 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
                    tNodeList = xmlDoc.getElementsByTagNameNS('*', 't');
                    tNodes = Array.from(tNodeList);
                    nodeTexts = tNodes.map(function (n) { return n.textContent || ''; });
                    starts = [];
                    combined = '';
                    for (i = 0; i < nodeTexts.length; i++) {
                        starts[i] = combined.length;
                        combined += nodeTexts[i];
                    }
                    sortedHits = __spreadArray([], hits, true).sort(function (a, b) { return (String(b.value || '').length) - (String(a.value || '').length); });
                    for (_i = 0, sortedHits_1 = sortedHits; _i < sortedHits_1.length; _i++) {
                        h = sortedHits_1[_i];
                        hitValue = String(h.value || '').trim();
                        if (!hitValue)
                            continue;
                        esc = escapeRegExp(hitValue);
                        regex = new RegExp(esc, 'gi');
                        matches = [];
                        m = void 0;
                        while ((m = regex.exec(combined)) !== null) {
                            matches.push({ start: m.index, end: m.index + m[0].length });
                            // avoid infinite loops for zero-length
                            if (m.index === regex.lastIndex)
                                regex.lastIndex++;
                        }
                        console.log("Replacing \"".concat(hitValue, "\": found ").concat(matches.length, " matches in DOCX text"));
                        // Process matches from end -> start to avoid offset shifting
                        for (mi = matches.length - 1; mi >= 0; mi--) {
                            _a = matches[mi], start = _a.start, end = _a.end;
                            firstIdx = -1;
                            lastIdx = -1;
                            for (i = 0; i < tNodes.length; i++) {
                                nodeStart = starts[i];
                                nodeEnd = nodeStart + (nodeTexts[i] || '').length;
                                if (firstIdx === -1 && start < nodeEnd && end > nodeStart)
                                    firstIdx = i;
                                if (firstIdx !== -1 && start < nodeEnd && end > nodeStart)
                                    lastIdx = i;
                                if (nodeStart > end)
                                    break;
                            }
                            if (firstIdx === -1 || lastIdx === -1)
                                continue;
                            originalMatched = combined.slice(start, end);
                            if (!originalMatched)
                                continue;
                            masked = originalMatched.replace(/\S/g, '█');
                            maskPos = 0;
                            for (i = firstIdx; i <= lastIdx; i++) {
                                nodeText = nodeTexts[i] || '';
                                nodeStart = starts[i];
                                nodeEnd = nodeStart + nodeText.length;
                                overlapStart = Math.max(start, nodeStart);
                                overlapEnd = Math.min(end, nodeEnd);
                                localStart = overlapStart - nodeStart;
                                localEnd = overlapEnd - nodeStart;
                                if (overlapEnd <= overlapStart)
                                    continue; // no overlap
                                prefix = nodeText.slice(0, localStart);
                                suffix = nodeText.slice(localEnd);
                                replaceLen = localEnd - localStart;
                                maskedSegment = masked.substr(maskPos, replaceLen);
                                maskPos += replaceLen;
                                // set the new text content for this node to prefix + maskedSegment + suffix
                                tNodes[i].textContent = prefix + maskedSegment + suffix;
                                // Add run properties to the run containing this node so the masked segment is visible
                                try {
                                    run = (tNodes[i].parentNode);
                                    if (run) {
                                        rPr = Array.from(run.childNodes).find(function (c) { return c.nodeName && String(c.nodeName).toLowerCase().endsWith('rpr'); });
                                        if (!rPr) {
                                            rPr = xmlDoc.createElementNS(ns, 'w:rPr');
                                            run.insertBefore(rPr, tNodes[i]);
                                        }
                                        if (!Array.from(rPr.childNodes).some(function (c) { return String(c.nodeName).toLowerCase().endsWith('b'); })) {
                                            b = xmlDoc.createElementNS(ns, 'w:b');
                                            rPr.appendChild(b);
                                        }
                                        if (!Array.from(rPr.childNodes).some(function (c) { return String(c.nodeName).toLowerCase().endsWith('shd'); })) {
                                            shd = xmlDoc.createElementNS(ns, 'w:shd');
                                            shd.setAttribute('w:val', 'clear');
                                            shd.setAttribute('w:fill', 'FFFF00');
                                            rPr.appendChild(shd);
                                        }
                                    }
                                }
                                catch (e) {
                                    console.warn('Failed to add run properties for redaction run', e);
                                }
                            }
                            // Update nodeTexts and combined for subsequent matches
                            for (i = firstIdx; i <= lastIdx; i++) {
                                nodeTexts[i] = tNodes[i].textContent || '';
                            }
                            // rebuild combined and starts (simple but safe)
                            combined = '';
                            for (i = 0; i < nodeTexts.length; i++) {
                                starts[i] = combined.length;
                                combined += nodeTexts[i];
                            }
                        }
                    }
                    serializer = new XMLSerializer();
                    newXml = serializer.serializeToString(xmlDoc);
                    console.log('Redacted DOCX XML length:', newXml.length);
                    // Update document.xml in ZIP
                    zip.file('word/document.xml', newXml);
                    return [4 /*yield*/, zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })];
                case 4:
                    redactedBlob = _b.sent();
                    return [2 /*return*/, redactedBlob];
            }
        });
    });
}
/**
 * Redact sensitive text in an image using OCR bounding boxes (Tesseract.js).
 * Overlays black rectangles on words matching hits.
 */
export function redactImage(fileBlob, hits) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function () {
        var img, canvas, ctx, ocrResult, words, normalizedHits, normalized, redactedFlags, redactionCount, heights, median, medianHeight, lines, i, w, cy, placed, _i, lines_1, line, _c, lines_2, line, segs, cur, wi, entry, b, gap, avgWidth, gapThreshold, _d, segs_1, s, normSeg, matched, _e, normalizedHits_2, h, normH, pad, x0, y0, w, h, padding, fontSize, _f, _g, ii;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0: return [4 /*yield*/, createImageBitmap(fileBlob)];
                case 1:
                    img = _h.sent();
                    canvas = document.createElement("canvas");
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx = canvas.getContext("2d");
                    if (!ctx)
                        throw new Error("Canvas 2D context not available");
                    ctx.drawImage(img, 0, 0);
                    return [4 /*yield*/, Tesseract.recognize(fileBlob, "eng")];
                case 2:
                    ocrResult = _h.sent();
                    words = ((_b = (_a = ocrResult === null || ocrResult === void 0 ? void 0 : ocrResult.data) === null || _a === void 0 ? void 0 : _a.words) !== null && _b !== void 0 ? _b : []).map(function (w) {
                        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
                        return ({
                            text: String((_a = w.text) !== null && _a !== void 0 ? _a : ""),
                            bbox: {
                                x0: Number((_c = (_b = w.bbox) === null || _b === void 0 ? void 0 : _b.x0) !== null && _c !== void 0 ? _c : 0),
                                y0: Number((_e = (_d = w.bbox) === null || _d === void 0 ? void 0 : _d.y0) !== null && _e !== void 0 ? _e : 0),
                                x1: Number((_g = (_f = w.bbox) === null || _f === void 0 ? void 0 : _f.x1) !== null && _g !== void 0 ? _g : 0),
                                y1: Number((_j = (_h = w.bbox) === null || _h === void 0 ? void 0 : _h.y1) !== null && _j !== void 0 ? _j : 0),
                            },
                        });
                    });
                    normalizedHits = hits.map(function (h) { return String(h.value || "").trim().toLowerCase(); }).filter(Boolean);
                    console.log("Image redaction: matching", normalizedHits.length, "hit patterns against", words.length, "OCR words");
                    normalized = function (s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); };
                    redactedFlags = new Array(words.length).fill(false);
                    redactionCount = 0;
                    heights = words.map(function (w) { return Math.max(1, (w.bbox.y1 - w.bbox.y0) || 10); });
                    median = function (arr) {
                        var a = arr.slice().sort(function (x, y) { return x - y; });
                        var m = Math.floor(a.length / 2);
                        return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
                    };
                    medianHeight = Math.max(8, median(heights));
                    lines = [];
                    for (i = 0; i < words.length; i++) {
                        w = words[i];
                        if (!w.text)
                            continue;
                        cy = (w.bbox.y0 + w.bbox.y1) / 2;
                        placed = false;
                        for (_i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
                            line = lines_1[_i];
                            if (Math.abs(line.centerY - cy) <= Math.max(6, medianHeight * 0.6)) {
                                line.words.push({ idx: i, w: w, cx: (w.bbox.x0 + w.bbox.x1) / 2 });
                                placed = true;
                                break;
                            }
                        }
                        if (!placed) {
                            lines.push({ centerY: cy, words: [{ idx: i, w: w, cx: (w.bbox.x0 + w.bbox.x1) / 2 }] });
                        }
                    }
                    // For each line, sort by x and create segments by merging nearby words based on gap heuristics
                    for (_c = 0, lines_2 = lines; _c < lines_2.length; _c++) {
                        line = lines_2[_c];
                        line.words.sort(function (a, b) { return (a.w.bbox.x0 - b.w.bbox.x0); });
                        segs = [];
                        cur = null;
                        for (wi = 0; wi < line.words.length; wi++) {
                            entry = line.words[wi];
                            b = entry.w.bbox;
                            if (!cur) {
                                cur = { idxs: [entry.idx], minX: b.x0, minY: b.y0, maxX: b.x1, maxY: b.y1, text: String(entry.w.text || '') };
                                continue;
                            }
                            gap = entry.w.bbox.x0 - cur.maxX;
                            avgWidth = ((cur.maxX - cur.minX) / Math.max(1, cur.idxs.length) + (b.x1 - b.x0)) / 2;
                            gapThreshold = Math.max(8, avgWidth * 0.8);
                            if (gap <= gapThreshold) {
                                // merge into current segment
                                cur.idxs.push(entry.idx);
                                cur.minX = Math.min(cur.minX, b.x0);
                                cur.minY = Math.min(cur.minY, b.y0);
                                cur.maxX = Math.max(cur.maxX, b.x1);
                                cur.maxY = Math.max(cur.maxY, b.y1);
                                cur.text = cur.text + ' ' + String(entry.w.text || '');
                            }
                            else {
                                // push current and start new
                                segs.push(cur);
                                cur = { idxs: [entry.idx], minX: b.x0, minY: b.y0, maxX: b.x1, maxY: b.y1, text: String(entry.w.text || '') };
                            }
                        }
                        if (cur)
                            segs.push(cur);
                        // Now match each segment against normalized hits
                        for (_d = 0, segs_1 = segs; _d < segs_1.length; _d++) {
                            s = segs_1[_d];
                            // skip if already redacted
                            if (s.idxs.every(function (ii) { return redactedFlags[ii]; }))
                                continue;
                            normSeg = normalized(s.text);
                            if (!normSeg)
                                continue;
                            matched = '';
                            for (_e = 0, normalizedHits_2 = normalizedHits; _e < normalizedHits_2.length; _e++) {
                                h = normalizedHits_2[_e];
                                normH = normalized(h);
                                if (!normH)
                                    continue;
                                if (normSeg.includes(normH) || normH.includes(normSeg)) {
                                    matched = h;
                                    break;
                                }
                            }
                            if (matched) {
                                pad = Math.max(4, Math.round(medianHeight * 0.18));
                                x0 = Math.max(0, s.minX - pad);
                                y0 = Math.max(0, s.minY - pad);
                                w = Math.max(4, s.maxX - s.minX + pad * 2);
                                h = Math.max(8, s.maxY - s.minY + pad * 2);
                                // draw highlight
                                ctx.fillStyle = '#FFFF66';
                                ctx.fillRect(x0, y0, w, h);
                                ctx.lineWidth = Math.max(1, Math.round(Math.min(w, h) * 0.06));
                                ctx.strokeStyle = '#2E6AF9';
                                ctx.strokeRect(x0 + (ctx.lineWidth / 2), y0 + (ctx.lineWidth / 2), w - ctx.lineWidth, h - ctx.lineWidth);
                                padding = 6;
                                fontSize = Math.min(18, Math.max(10, Math.round(h * 0.7)));
                                ctx.font = "bold ".concat(fontSize, "px sans-serif");
                                ctx.fillStyle = '#000000';
                                ctx.textBaseline = 'middle';
                                ctx.textAlign = 'left';
                                ctx.fillText('[REDACTED]', x0 + padding, y0 + h / 2);
                                for (_f = 0, _g = s.idxs; _f < _g.length; _f++) {
                                    ii = _g[_f];
                                    redactedFlags[ii] = true;
                                }
                                redactionCount++;
                                console.log("Image: redacted clustered segment \"".concat(s.text, "\" matching hit \"").concat(matched, "\""));
                            }
                        }
                    }
                    console.log('Image redaction complete:', redactionCount, 'segments redacted');
                    return [2 /*return*/, new Promise(function (resolve, reject) {
                            canvas.toBlob(function (blob) {
                                if (blob)
                                    resolve(blob);
                                else
                                    reject(new Error("Failed to create redacted image blob"));
                            }, "image/png", 0.92);
                        })];
            }
        });
    });
}
//# sourceMappingURL=redactionUtils.js.map