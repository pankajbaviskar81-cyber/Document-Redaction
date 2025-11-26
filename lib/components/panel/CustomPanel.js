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
import * as React from "react";
import { Panel, PanelType, DefaultButton, PrimaryButton } from "@fluentui/react";
import SPService from "../../services/spservice";
/**
 * CustomPanel
 *
 * Responsibilities:
 * - Load the selected file (DOCX, PDF, image, or text) from SharePoint
 * - Extract text (mammoth/pdfjs/tesseract or plain text) for detection
 * - Run regex-based detectors (PAN, CARD brand, CVV, PIN, IFSC, TXN, amounts, etc.)
 * - Present detection results with context and confidence scores
 * - Orchestrate redaction via `redactPdf`, `redactDocx`, and `redactImage`
 *
 * Notes:
 * - Detection aims for a pragmatic balance between recall and false positives
 *   (Luhn checks and nearby keyword boosts are used for PAN confidence).
 */
// Import native redaction utilities
import { redactPdf, redactDocx, redactImage } from "../../utils/redactionUtils";
import JSZip from "jszip";
var imageExtRe = /\.(png|jpg|jpeg|gif|bmp|tiff)$/i;
var CustomPanel = function (_a) {
    var onDismiss = _a.onDismiss, selectedRow = _a.selectedRow, context = _a.context;
    var _b = React.useState(""), fileContent = _b[0], setFileContent = _b[1];
    var _c = React.useState(null), fileName = _c[0], setFileName = _c[1];
    var _d = React.useState(null), detectResult = _d[0], setDetectResult = _d[1];
    var _e = React.useState(false), busy = _e[0], setBusy = _e[1];
    // Detector definitions
    var detectors = React.useMemo(function () { return ({
        // Explicit 4-4-4-4 credit card pattern (helps catch spaced/dashed cards)
        credit_card: /\b(?:\d{4}[- ]?){3}\d{4}\b/g,
        // Prefer grouped 4-4-4-4 or continuous 13-19 digit sequences, reduce false positives
        pan: /(?:\b(?:\d{4}[- ]?){3}\d{4}\b|\b\d{13,19}\b)/g,
        ifsc: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g,
        upi: /\b[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}\b/g,
        account: /\b\d{9,18}\b/g,
        // US routing numbers are 9 digits — will be validated with context
        routing: /\b\d{9}\b/g,
        txn: /\b(?:TXN|TRX|REF|UTR)[-_]?[A-Z0-9-]{6,}\b/g,
        cvv: /\b(?:CVV2?|CVC2?|CAV2|CID)\s*[:=]?\s*\d{3,4}\b/gi,
        pin: /\b(?:PIN|ATM\s*PIN)\s*[:=]?\s*\d{4,6}\b/gi,
        amount: /[₹$€£₽¥]\s*[\d,]+(?:\.\d{2})?|\b\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:Rs|INR|USD|EUR|GBP)\b/gi,
        pssCode: /\b(?:PSS|UTR|NEFT|RTGS|IMPS)[-_]?[A-Z0-9-]{4,}\b/gi,
        // Medical Record Number format e.g. MRN-0012345
        mrn: /\bMRN[-\s]?\d{5,}\b/gi,
        // Passport numbers: letter followed by 7-8 digits (common simple pattern)
        passport: /\b[A-Z]\d{7,8}\b/g,
        // Health insurance ID e.g. H123456789
        health_insurance: /\bH\d{6,10}\b/gi,
    }); }, []);
    function runDetectors(rawText) {
        var text = rawText
            .replace(/\\[-]/g, "-")
            .replace(/\\#/g, "#")
            .replace(/\\n/g, "\n")
            .replace(/\s+/g, " ");
        // Helper: get context snippet as bullet list (2-3 surrounding lines)
        function getContextSnippet(full, index, linesAround) {
            if (linesAround === void 0) { linesAround = 2; }
            var lines = String(full).split(/\r?\n/);
            // find which line contains the index
            var pos = 0;
            var lineIndex = 0;
            for (var i = 0; i < lines.length; i++) {
                var l = lines[i];
                if (index >= pos && index < pos + l.length + 1) {
                    lineIndex = i;
                    break;
                }
                pos += l.length + 1; // include newline
            }
            var start = Math.max(0, lineIndex - linesAround);
            var end = Math.min(lines.length - 1, lineIndex + linesAround);
            var contextLines = lines.slice(start, end + 1).map(function (l) { return l.trim(); }).filter(function (l) { return l.length > 0; });
            return contextLines.map(function (l) { return "- ".concat(l); }).join("\n");
        }
        // Luhn check for card numbers (PAN)
        function luhnCheck(value) {
            var digits = (value || "").replace(/\D/g, "");
            if (digits.length < 12)
                return false;
            var sum = 0;
            var alt = false;
            for (var i = digits.length - 1; i >= 0; i--) {
                var n = parseInt(digits.charAt(i), 10);
                if (alt) {
                    n *= 2;
                    if (n > 9)
                        n -= 9;
                }
                sum += n;
                alt = !alt;
            }
            return sum % 10 === 0;
        }
        // Detect card brand from digit-only PAN
        function detectCardBrand(digits) {
            if (/^3[47]\d{13}$/.test(digits))
                return 'AMEX'; // 15 digits
            if (/^4\d{12}(\d{3})?$/.test(digits))
                return 'VISA'; // 13 or 16
            if (/^(?:5[1-5]\d{14}|2(?:2[2-9]\d{12}|[3-6]\d{13}|7[01]\d{12}|720\d{12}))$/.test(digits))
                return 'MASTERCARD';
            if (/^(?:6011\d{12}|65\d{14}|64[4-9]\d{13}|622\d{10,13})$/.test(digits))
                return 'DISCOVER';
            return null;
        }
        var hits = [];
        for (var _i = 0, _a = Object.entries(detectors); _i < _a.length; _i++) {
            var _b = _a[_i], type = _b[0], re = _b[1];
            var flags = re.flags.includes("g") ? re.flags : re.flags + "g";
            var r = new RegExp(re.source, flags);
            var m = void 0;
            var _loop_1 = function () {
                var val = m[0];
                var confidence = "low";
                if (type === "pan") {
                    // normalize digits for Luhn and length checks
                    var digits = String(val).replace(/\D/g, "");
                    var luhn = luhnCheck(digits);
                    // examine nearby raw text for keywords that indicate card/PAN context
                    var windowStart = Math.max(0, m.index - 40);
                    var windowEnd = Math.min(rawText.length, m.index + val.length + 40);
                    var ctxWindow_1 = String(rawText).slice(windowStart, windowEnd).toLowerCase();
                    var contextKeywords = ["pan", "primary account", "card", "cardholder", "account number", "primary account number"];
                    var contextBoost = contextKeywords.some(function (k) { return ctxWindow_1.includes(k); });
                    if (digits.length >= 13 && digits.length <= 19) {
                        if (luhn) {
                            // Luhn + either 16-digit standard length or contextual keywords => high
                            confidence = (digits.length === 16 || contextBoost) ? "high" : "medium";
                        }
                        else {
                            // no Luhn but strong context => medium, else low
                            confidence = contextBoost ? "medium" : "low";
                        }
                    }
                    else {
                        confidence = "low";
                    }
                }
                else if (type === "cvv" || type === "pin") {
                    confidence = "medium";
                }
                else if (type === 'credit_card') {
                    // treat as card-like — prefer Luhn and 16-digit grouped forms
                    var digits = String(val).replace(/\D/g, '');
                    var luhn = luhnCheck(digits);
                    if (digits.length === 16 && luhn)
                        confidence = 'high';
                    else if (luhn)
                        confidence = 'medium';
                    else
                        confidence = 'low';
                    // also attempt to detect brand and add CARD hit
                    try {
                        var brand = detectCardBrand(digits);
                        if (brand) {
                            var brandConfidence = luhnCheck(digits) ? 'high' : 'medium';
                            hits.push({ type: 'CARD', value: brand, index: m.index, confidence: brandConfidence });
                        }
                    }
                    catch (e) {
                        // non-fatal
                    }
                }
                else if (type === 'routing') {
                    // routing numbers are 9 digits; use nearby keywords to raise confidence
                    var windowStart = Math.max(0, m.index - 40);
                    var windowEnd = Math.min(rawText.length, m.index + val.length + 40);
                    var ctxWindow_2 = String(rawText).slice(windowStart, windowEnd).toLowerCase();
                    var routingKeywords = ['routing', 'aba', 'routing number', 'ach'];
                    var ctxBoost = routingKeywords.some(function (k) { return ctxWindow_2.includes(k); });
                    confidence = ctxBoost ? 'medium' : 'low';
                }
                else if (type === 'mrn' || type === 'passport' || type === 'health_insurance') {
                    confidence = 'medium';
                }
                else if (type === "txn" || type === "pssCode") {
                    confidence = "medium";
                }
                else if (type === "amount" || type === "account") {
                    confidence = "low";
                }
                var ctx = getContextSnippet(rawText, m.index, 1);
                // push primary hit
                hits.push({ type: type.toUpperCase(), value: val, index: m.index, confidence: confidence, context: ctx });
                // if this was a PAN, also attempt to detect card brand and add a CARD hit
                if (type === 'pan') {
                    try {
                        var digits = String(val).replace(/\D/g, '');
                        var brand = detectCardBrand(digits);
                        if (brand) {
                            var brandConfidence = luhnCheck(digits) ? 'high' : 'medium';
                            hits.push({ type: 'CARD', value: brand, index: m.index, confidence: brandConfidence });
                        }
                    }
                    catch (e) {
                        // non-fatal
                    }
                }
            };
            while ((m = r.exec(text)) !== null) {
                _loop_1();
            }
        }
        var hasPSS = hits.some(function (h) { return ["PAN", "CREDIT_CARD", "ACCOUNT", "UPI", "CVV", "PIN", "ROUTING", "PASSPORT", "MRN", "HEALTH_INSURANCE", "CARD"].includes(h.type); });
        var hasDSS = hits.some(function (h) { return ["IFSC", "TXN", "PSSCODE", "AMOUNT"].includes(h.type); });
        return { hits: hits, hasPSS: hasPSS, hasDSS: hasDSS };
    }
    // Load file text with proper parser
    React.useEffect(function () {
        var load = function () { return __awaiter(void 0, void 0, void 0, function () {
            var sp, fileRef, name_1, text, blob, arrayBuffer, mammoth, result, zip, docXml, matches, arrayBuffer, pdfjs, loadingTask, pdf, extracted, p, page, content, pageText, pgErr_1, e_1, tesseract, createWorker, worker, bitmap, maxDim, scale, canvas, ctx, dataUrl, ocrResult, imgErr_1, Tesseract_1, quick, ferr_1, _a;
            var _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        if (!selectedRow)
                            return [2 /*return*/];
                        setBusy(true);
                        _e.label = 1;
                    case 1:
                        _e.trys.push([1, , 46, 47]);
                        sp = new SPService(context);
                        fileRef = null;
                        name_1 = null;
                        try {
                            fileRef = selectedRow.getValueByName("FileRef");
                            name_1 = selectedRow.getValueByName("FileLeafRef") || selectedRow.getValueByName("FileName");
                        }
                        catch (e) {
                            console.error("Error extracting fileRef:", e);
                        }
                        // fileRef loaded
                        setFileName(name_1 || null);
                        if (!fileRef) {
                            setFileContent("");
                            setDetectResult(null);
                            setBusy(false);
                            return [2 /*return*/];
                        }
                        text = "";
                        return [4 /*yield*/, sp.getFileBlob(fileRef)];
                    case 2:
                        blob = _e.sent();
                        if (!((name_1 === null || name_1 === void 0 ? void 0 : name_1.endsWith(".docx")) && blob)) return [3 /*break*/, 9];
                        return [4 /*yield*/, blob.arrayBuffer()];
                    case 3:
                        arrayBuffer = _e.sent();
                        return [4 /*yield*/, import("mammoth")];
                    case 4:
                        mammoth = _e.sent();
                        return [4 /*yield*/, mammoth.extractRawText({ arrayBuffer: arrayBuffer })];
                    case 5:
                        result = _e.sent();
                        text = (result === null || result === void 0 ? void 0 : result.value) || "";
                        if (!!text.trim()) return [3 /*break*/, 8];
                        return [4 /*yield*/, JSZip.loadAsync(arrayBuffer)];
                    case 6:
                        zip = _e.sent();
                        return [4 /*yield*/, ((_b = zip.file("word/document.xml")) === null || _b === void 0 ? void 0 : _b.async("string"))];
                    case 7:
                        docXml = _e.sent();
                        if (docXml) {
                            matches = docXml.match(/<w:t[^>]*>(.*?)<\/w:t>/g) || [];
                            text = matches.map(function (m) { return m.replace(/<[^>]+>/g, ""); }).join(" ");
                            // 🔎 Normalize whitespace and non-breaking spaces
                            text = text.replace(/\s+/g, " ").replace(/\u00A0/g, " ");
                        }
                        _e.label = 8;
                    case 8: return [3 /*break*/, 45];
                    case 9:
                        if (!((name_1 === null || name_1 === void 0 ? void 0 : name_1.endsWith(".pdf")) && blob)) return [3 /*break*/, 23];
                        _e.label = 10;
                    case 10:
                        _e.trys.push([10, 21, , 22]);
                        return [4 /*yield*/, blob.arrayBuffer()];
                    case 11:
                        arrayBuffer = _e.sent();
                        return [4 /*yield*/, import('pdfjs-dist/legacy/build/pdf')];
                    case 12:
                        pdfjs = _e.sent();
                        // try to set workerSrc to CDN if available
                        try {
                            if (pdfjs && pdfjs.GlobalWorkerOptions) {
                                // version may not exist; best-effort
                                pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/".concat(pdfjs.version || '2.16.105', "/pdf.worker.min.js");
                            }
                        }
                        catch (wErr) {
                            console.warn('Could not set pdfjs workerSrc', wErr);
                        }
                        loadingTask = pdfjs.getDocument({ data: arrayBuffer });
                        return [4 /*yield*/, loadingTask.promise];
                    case 13:
                        pdf = _e.sent();
                        extracted = '';
                        p = 1;
                        _e.label = 14;
                    case 14:
                        if (!(p <= pdf.numPages)) return [3 /*break*/, 20];
                        _e.label = 15;
                    case 15:
                        _e.trys.push([15, 18, , 19]);
                        return [4 /*yield*/, pdf.getPage(p)];
                    case 16:
                        page = _e.sent();
                        return [4 /*yield*/, page.getTextContent()];
                    case 17:
                        content = _e.sent();
                        pageText = (content.items || []).map(function (it) { return it.str || ''; }).join(' ');
                        extracted += pageText + '\n';
                        return [3 /*break*/, 19];
                    case 18:
                        pgErr_1 = _e.sent();
                        console.warn('Failed extracting page text', p, pgErr_1);
                        return [3 /*break*/, 19];
                    case 19:
                        p++;
                        return [3 /*break*/, 14];
                    case 20:
                        text = extracted.trim();
                        if (!text) {
                            text = fileContent || '';
                        }
                        return [3 /*break*/, 22];
                    case 21:
                        e_1 = _e.sent();
                        console.warn('PDF text extraction failed, falling back to fileContent', e_1);
                        text = fileContent || '';
                        return [3 /*break*/, 22];
                    case 22: return [3 /*break*/, 45];
                    case 23:
                        if (!((name_1 === null || name_1 === void 0 ? void 0 : name_1.match(imageExtRe)) && blob)) return [3 /*break*/, 40];
                        _e.label = 24;
                    case 24:
                        _e.trys.push([24, 33, , 39]);
                        return [4 /*yield*/, import('tesseract.js')];
                    case 25:
                        tesseract = _e.sent();
                        createWorker = tesseract.createWorker;
                        return [4 /*yield*/, createWorker({ logger: function (m) { return console.log('TESS:', m); } })];
                    case 26:
                        worker = _e.sent();
                        return [4 /*yield*/, worker.load()];
                    case 27:
                        _e.sent();
                        return [4 /*yield*/, worker.loadLanguage('eng')];
                    case 28:
                        _e.sent();
                        return [4 /*yield*/, worker.initialize('eng')];
                    case 29:
                        _e.sent();
                        return [4 /*yield*/, createImageBitmap(blob)];
                    case 30:
                        bitmap = _e.sent();
                        maxDim = Math.max(bitmap.width, bitmap.height);
                        scale = maxDim < 800 ? Math.min(2, 800 / Math.max(1, maxDim)) : 1;
                        canvas = document.createElement('canvas');
                        canvas.width = Math.round(bitmap.width * scale);
                        canvas.height = Math.round(bitmap.height * scale);
                        ctx = canvas.getContext('2d');
                        if (ctx) {
                            ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
                            // optional: simple contrast tweak could be added here
                        }
                        dataUrl = canvas.toDataURL();
                        return [4 /*yield*/, worker.recognize(dataUrl)];
                    case 31:
                        ocrResult = _e.sent();
                        text = ((_c = ocrResult === null || ocrResult === void 0 ? void 0 : ocrResult.data) === null || _c === void 0 ? void 0 : _c.text) || '';
                        // image OCR extracted
                        return [4 /*yield*/, worker.terminate()];
                    case 32:
                        // image OCR extracted
                        _e.sent();
                        return [3 /*break*/, 39];
                    case 33:
                        imgErr_1 = _e.sent();
                        console.warn('Image OCR failed, falling back to quick recognize()', imgErr_1);
                        _e.label = 34;
                    case 34:
                        _e.trys.push([34, 37, , 38]);
                        return [4 /*yield*/, import('tesseract.js')];
                    case 35:
                        Tesseract_1 = _e.sent();
                        return [4 /*yield*/, Tesseract_1.recognize(blob, 'eng')];
                    case 36:
                        quick = _e.sent();
                        text = ((_d = quick === null || quick === void 0 ? void 0 : quick.data) === null || _d === void 0 ? void 0 : _d.text) || '';
                        return [3 /*break*/, 38];
                    case 37:
                        ferr_1 = _e.sent();
                        console.warn('Fallback image OCR failed', ferr_1);
                        text = fileContent || '';
                        return [3 /*break*/, 38];
                    case 38: return [3 /*break*/, 39];
                    case 39: return [3 /*break*/, 45];
                    case 40:
                        _e.trys.push([40, 42, , 45]);
                        return [4 /*yield*/, sp.getFileText(fileRef)];
                    case 41:
                        text = _e.sent();
                        return [3 /*break*/, 45];
                    case 42:
                        _a = _e.sent();
                        if (!(blob && typeof blob.text === "function")) return [3 /*break*/, 44];
                        return [4 /*yield*/, blob.text()];
                    case 43:
                        text = _e.sent();
                        _e.label = 44;
                    case 44: return [3 /*break*/, 45];
                    case 45:
                        // Save content and run detectors
                        setFileContent(text || "");
                        if (text)
                            setDetectResult(runDetectors(text));
                        return [3 /*break*/, 47];
                    case 46:
                        setBusy(false);
                        return [7 /*endfinally*/];
                    case 47: return [2 /*return*/];
                }
            });
        }); };
        void load();
    }, [selectedRow, context]);
    // Redact and download
    function redactDocument() {
        return __awaiter(this, void 0, void 0, function () {
            var result, sp, fileRef, blob, _a, redactedBlob, out, _i, _b, h, esc, a, ext, err_1;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!fileContent)
                            return [2 /*return*/, alert("No file content")];
                        result = detectResult || runDetectors(fileContent);
                        if (!result.hits || result.hits.length === 0) {
                            return [2 /*return*/, alert("No sensitive data detected to redact")];
                        }
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 12, 13, 14]);
                        setBusy(true);
                        sp = new SPService(context);
                        fileRef = null;
                        try {
                            fileRef = selectedRow.getValueByName("FileRef");
                        }
                        catch (e) {
                            console.error("Error extracting fileRef:", e);
                        }
                        if (!fileRef) return [3 /*break*/, 3];
                        return [4 /*yield*/, sp.getFileBlob(fileRef)];
                    case 2:
                        _a = _c.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        _a = null;
                        _c.label = 4;
                    case 4:
                        blob = _a;
                        redactedBlob = null;
                        if (!((fileName === null || fileName === void 0 ? void 0 : fileName.endsWith(".pdf")) && blob)) return [3 /*break*/, 6];
                        return [4 /*yield*/, redactPdf(blob, result.hits)];
                    case 5:
                        redactedBlob = _c.sent();
                        return [3 /*break*/, 11];
                    case 6:
                        if (!((fileName === null || fileName === void 0 ? void 0 : fileName.endsWith(".docx")) && blob)) return [3 /*break*/, 8];
                        return [4 /*yield*/, redactDocx(blob, result.hits)];
                    case 7:
                        redactedBlob = _c.sent();
                        return [3 /*break*/, 11];
                    case 8:
                        if (!((fileName === null || fileName === void 0 ? void 0 : fileName.match(imageExtRe)) && blob)) return [3 /*break*/, 10];
                        return [4 /*yield*/, redactImage(blob, result.hits)];
                    case 9:
                        redactedBlob = _c.sent();
                        return [3 /*break*/, 11];
                    case 10:
                        out = fileContent;
                        for (_i = 0, _b = result.hits; _i < _b.length; _i++) {
                            h = _b[_i];
                            if (!h.value)
                                continue;
                            esc = String(h.value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                            out = out.replace(new RegExp(esc, "gi"), "[REDACTED]");
                        }
                        redactedBlob = new Blob([out], { type: "text/plain" });
                        _c.label = 11;
                    case 11:
                        if (redactedBlob) {
                            a = document.createElement("a");
                            a.href = URL.createObjectURL(redactedBlob);
                            ext = (fileName === null || fileName === void 0 ? void 0 : fileName.split(".").pop()) || "txt";
                            a.download = "".concat(fileName === null || fileName === void 0 ? void 0 : fileName.replace(/\.[^/.]+$/, ""), "-redacted.").concat(ext);
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            URL.revokeObjectURL(a.href);
                            alert("Document redacted and downloaded successfully!\nRedacted ".concat(result.hits.length, " sensitive data points."));
                        }
                        return [3 /*break*/, 14];
                    case 12:
                        err_1 = _c.sent();
                        console.error("Redaction error:", err_1);
                        alert("Redaction failed: ".concat(err_1.message));
                        return [3 /*break*/, 14];
                    case 13:
                        setBusy(false);
                        return [7 /*endfinally*/];
                    case 14: return [2 /*return*/];
                }
            });
        });
    }
    // Color-coded detection UI
    function getColor(type) {
        if (["PAN", "CREDIT_CARD", "CVV", "PIN", "CARD", "ROUTING", "PASSPORT", "MRN", "HEALTH_INSURANCE"].includes(type))
            return "#ffe5e5"; // red background
        if (["ACCOUNT", "UPI", "IFSC"].includes(type))
            return "#fff5e5"; // orange background
        return "#e5ffe5"; // green background
    }
    function getTextColor(type) {
        if (["PAN", "CREDIT_CARD", "CVV", "PIN", "CARD", "ROUTING", "PASSPORT", "MRN", "HEALTH_INSURANCE"].includes(type))
            return "red";
        if (["ACCOUNT", "UPI", "IFSC"].includes(type))
            return "orange";
        return "green";
    }
    return (React.createElement(Panel, { isOpen: true, onDismiss: onDismiss, type: PanelType.medium, headerText: "Document Redaction Assistant" },
        React.createElement("div", { style: { marginTop: 12 } },
            React.createElement(PrimaryButton, { text: "Detect PSS/DSS", onClick: function () { return setDetectResult(runDetectors(fileContent)); }, disabled: !fileContent || busy }),
            React.createElement(DefaultButton, { text: "Redact & Download", onClick: redactDocument, disabled: !fileContent || busy || !((detectResult === null || detectResult === void 0 ? void 0 : detectResult.hasPSS) || (detectResult === null || detectResult === void 0 ? void 0 : detectResult.hasDSS)), styles: { root: { marginLeft: 8 } } })),
        detectResult && (React.createElement("div", { style: { marginTop: 12 } },
            React.createElement("div", null,
                "Detections: ",
                (detectResult.hits || []).length,
                " | PSS: ",
                detectResult.hasPSS ? "Yes" : "No",
                " | DSS:",
                " ",
                detectResult.hasDSS ? "Yes" : "No"),
            React.createElement("div", { style: { marginTop: 8 } }, (detectResult.hits || []).map(function (h, i) { return (React.createElement("div", { key: i, style: {
                    padding: 8,
                    borderBottom: "1px solid #eee",
                    backgroundColor: getColor(h.type),
                } },
                React.createElement("div", { style: { fontWeight: 600, color: getTextColor(h.type) } }, h.type),
                React.createElement("div", { style: { fontFamily: "monospace", wordBreak: "break-all" } }, String(h.value)),
                React.createElement("div", { style: { color: "#666", fontSize: 12 } },
                    "Confidence: ",
                    h.confidence || 'n/a',
                    " | Index: ",
                    h.index),
                h.context && (React.createElement("div", { style: { marginTop: 8, padding: 8, border: '1px solid #eee', background: '#fafafa', fontFamily: 'monospace', whiteSpace: 'pre-wrap' } },
                    React.createElement("div", { style: { fontWeight: 600, marginBottom: 6 } }, "Context snippet:"),
                    React.createElement("div", null, h.context))))); }))))));
};
export default CustomPanel;
//# sourceMappingURL=CustomPanel.js.map