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
import { PrimaryButton, DefaultButton } from "@fluentui/react";
import { redactPdf, redactDocx, redactImage } from "../utils/redactionUtils";
var imageExtRe = /\.(png|jpg|jpeg|gif|bmp|tiff)$/i;
var detectors = {
    pan: /\b(?:\d[ -]*?){13,19}\b/g,
    ifsc: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g,
    upi: /\b[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}\b/g,
    account: /\b\d{9,18}\b/g,
    txn: /\b(?:TXN|TRX|REF|UTR)[-_]?[A-Z0-9-]{6,}\b/g,
    cvvLike: /\b(?:CVV2?|CVC2?|CAV2|CID)\s*[:=]?\s*\d{3,4}\b/gi,
    pinLabeled: /\b(?:PIN|ATM\s*PIN)\s*[:=]?\s*\d{4,6}\b/gi,
};
function runDetectors(rawText) {
    var text = rawText
        .replace(/\\[-]/g, "-")
        .replace(/\\#/g, "#")
        .replace(/\\n/g, "\n")
        .replace(/\s+/g, " ");
    var hits = [];
    for (var _i = 0, _a = Object.entries(detectors); _i < _a.length; _i++) {
        var _b = _a[_i], type = _b[0], re = _b[1];
        var r = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
        var m = void 0;
        while ((m = r.exec(text)) !== null) {
            hits.push({ type: type.toUpperCase(), value: m[0], index: m.index });
        }
    }
    var hasPSS = hits.some(function (h) { return ["PAN", "ACCOUNT", "UPI", "CVVLIKE", "PINLABELED"].includes(h.type); });
    var hasDSS = hits.some(function (h) { return ["IFSC", "TXN"].includes(h.type); });
    return { hits: hits, hasPSS: hasPSS, hasDSS: hasDSS };
}
var RedactTester = function () {
    var _a;
    var _b = React.useState(null), file = _b[0], setFile = _b[1];
    var _c = React.useState(""), text = _c[0], setText = _c[1];
    var _d = React.useState(null), detectResult = _d[0], setDetectResult = _d[1];
    var _e = React.useState(false), busy = _e[0], setBusy = _e[1];
    function onFileChange(e) {
        return __awaiter(this, void 0, void 0, function () {
            var f, txt, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        f = e.target.files && e.target.files[0];
                        setFile(f || null);
                        setDetectResult(null);
                        setText("");
                        if (!f) return [3 /*break*/, 8];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 7, , 8]);
                        if (!f.name.endsWith(".pdf")) return [3 /*break*/, 2];
                        // Try to extract text via pdfjs in redactionUtils path if available — fallback to empty
                        // For quick testing we won't re-run pdfjs here; we'll just set placeholder
                        setText("PDF (text extraction occurs in CustomPanel in your SPFx environment)");
                        return [3 /*break*/, 6];
                    case 2:
                        if (!f.name.endsWith(".docx")) return [3 /*break*/, 3];
                        // mammoth extraction isn't available here synchronously; set placeholder
                        setText("DOCX (text extraction occurs in CustomPanel in your SPFx environment)");
                        return [3 /*break*/, 6];
                    case 3:
                        if (!f.name.match(imageExtRe)) return [3 /*break*/, 4];
                        // run OCR using Tesseract if available via redactionUtils; for this simple tester we'll skip
                        setText("Image (OCR will be performed when redaction runs)");
                        return [3 /*break*/, 6];
                    case 4: return [4 /*yield*/, f.text()];
                    case 5:
                        txt = _a.sent();
                        setText(txt);
                        _a.label = 6;
                    case 6: return [3 /*break*/, 8];
                    case 7:
                        err_1 = _a.sent();
                        console.error(err_1);
                        return [3 /*break*/, 8];
                    case 8: return [2 /*return*/];
                }
            });
        });
    }
    function detect() {
        return __awaiter(this, void 0, void 0, function () {
            var content, _a, res;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!file && !text)
                            return [2 /*return*/, alert("Select a file or provide text")];
                        setBusy(true);
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, , 6, 7]);
                        content = text;
                        if (!(file && !content)) return [3 /*break*/, 5];
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, file.text()];
                    case 3:
                        content = _b.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        _a = _b.sent();
                        content = "";
                        return [3 /*break*/, 5];
                    case 5:
                        res = runDetectors(content || "");
                        setDetectResult(res);
                        return [3 /*break*/, 7];
                    case 6:
                        setBusy(false);
                        return [7 /*endfinally*/];
                    case 7: return [2 /*return*/];
                }
            });
        });
    }
    function redact() {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var ext, redacted, arrayBuffer, arrayBuffer, arrayBuffer, out, _i, _b, h, esc, a, err_2;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!file)
                            return [2 /*return*/, alert("Select a file first")];
                        setBusy(true);
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 13, 14, 15]);
                        ext = ((_a = file.name.split('.').pop()) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
                        redacted = null;
                        if (!(ext === 'pdf')) return [3 /*break*/, 4];
                        return [4 /*yield*/, file.arrayBuffer()];
                    case 2:
                        arrayBuffer = _c.sent();
                        return [4 /*yield*/, redactPdf(new Blob([arrayBuffer], { type: file.type }), (detectResult === null || detectResult === void 0 ? void 0 : detectResult.hits) || [])];
                    case 3:
                        redacted = _c.sent();
                        return [3 /*break*/, 12];
                    case 4:
                        if (!(ext === 'docx')) return [3 /*break*/, 7];
                        return [4 /*yield*/, file.arrayBuffer()];
                    case 5:
                        arrayBuffer = _c.sent();
                        return [4 /*yield*/, redactDocx(new Blob([arrayBuffer], { type: file.type }), (detectResult === null || detectResult === void 0 ? void 0 : detectResult.hits) || [])];
                    case 6:
                        redacted = _c.sent();
                        return [3 /*break*/, 12];
                    case 7:
                        if (!file.name.match(imageExtRe)) return [3 /*break*/, 10];
                        return [4 /*yield*/, file.arrayBuffer()];
                    case 8:
                        arrayBuffer = _c.sent();
                        return [4 /*yield*/, redactImage(new Blob([arrayBuffer], { type: file.type }), (detectResult === null || detectResult === void 0 ? void 0 : detectResult.hits) || [])];
                    case 9:
                        redacted = _c.sent();
                        return [3 /*break*/, 12];
                    case 10: return [4 /*yield*/, file.text()];
                    case 11:
                        out = _c.sent();
                        for (_i = 0, _b = ((detectResult === null || detectResult === void 0 ? void 0 : detectResult.hits) || []); _i < _b.length; _i++) {
                            h = _b[_i];
                            esc = (h.value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            out = out.replace(new RegExp(esc, 'gi'), '[REDACTED]');
                        }
                        redacted = new Blob([out], { type: 'text/plain' });
                        _c.label = 12;
                    case 12:
                        if (redacted) {
                            a = document.createElement('a');
                            a.href = URL.createObjectURL(redacted);
                            a.download = file.name.replace(/(\.[^/.]+)$/, '') + '-redacted.' + (ext || 'txt');
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            URL.revokeObjectURL(a.href);
                        }
                        return [3 /*break*/, 15];
                    case 13:
                        err_2 = _c.sent();
                        console.error(err_2);
                        alert('Redaction failed: ' + (err_2 && err_2.message));
                        return [3 /*break*/, 15];
                    case 14:
                        setBusy(false);
                        return [7 /*endfinally*/];
                    case 15: return [2 /*return*/];
                }
            });
        });
    }
    return (React.createElement("div", { style: { padding: 12 } },
        React.createElement("h3", null, "Redaction Tester"),
        React.createElement("input", { type: "file", onChange: onFileChange }),
        React.createElement("div", { style: { marginTop: 8 } },
            React.createElement(PrimaryButton, { text: "Detect", onClick: detect, disabled: busy || (!file && !text) }),
            React.createElement(DefaultButton, { text: "Redact", onClick: redact, disabled: busy || !file || !((_a = detectResult === null || detectResult === void 0 ? void 0 : detectResult.hits) === null || _a === void 0 ? void 0 : _a.length), styles: { root: { marginLeft: 8 } } })),
        detectResult && (React.createElement("div", { style: { marginTop: 12 } },
            React.createElement("div", null,
                "Detections: ",
                (detectResult.hits || []).length,
                " | PSS: ",
                detectResult.hasPSS ? 'Yes' : 'No',
                " | DSS: ",
                detectResult.hasDSS ? 'Yes' : 'No'),
            React.createElement("div", { style: { marginTop: 8 } }, (detectResult.hits || []).map(function (h, i) { return (React.createElement("div", { key: i, style: { padding: 6, borderBottom: '1px solid #eee' } },
                React.createElement("div", { style: { fontWeight: 600 } }, h.type),
                React.createElement("div", { style: { fontFamily: 'monospace', wordBreak: 'break-all' } }, String(h.value)))); }))))));
};
export default RedactTester;
//# sourceMappingURL=RedactTester.js.map