import * as React from "react";
import { Panel, PanelType, DefaultButton, PrimaryButton } from "@fluentui/react";
import { RowAccessor } from "@microsoft/sp-listview-extensibility";
import { ListViewCommandSetContext } from "@microsoft/sp-listview-extensibility";
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

const imageExtRe = /\.(png|jpg|jpeg|gif|bmp|tiff)$/i;

export interface ICustomPanelProps {
  onDismiss: () => void;
  selectedRow: RowAccessor;
  context: ListViewCommandSetContext;
}

const CustomPanel: React.FC<ICustomPanelProps> = ({ onDismiss, selectedRow, context }) => {
  const [fileContent, setFileContent] = React.useState<string>("");
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [detectResult, setDetectResult] = React.useState<any | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Detector definitions
  const detectors: Record<string, RegExp> = React.useMemo(
    () => ({
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
    }),
    []
  );

  function runDetectors(rawText: string) {
    const text = rawText
      .replace(/\\[-]/g, "-")
      .replace(/\\#/g, "#")
      .replace(/\\n/g, "\n")
      .replace(/\s+/g, " ");

    // Helper: get context snippet as bullet list (2-3 surrounding lines)
    function getContextSnippet(full: string, index: number, linesAround = 2) {
      const lines = String(full).split(/\r?\n/);
      // find which line contains the index
      let pos = 0;
      let lineIndex = 0;
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (index >= pos && index < pos + l.length + 1) {
          lineIndex = i;
          break;
        }
        pos += l.length + 1; // include newline
      }
      const start = Math.max(0, lineIndex - linesAround);
      const end = Math.min(lines.length - 1, lineIndex + linesAround);
      const contextLines = lines.slice(start, end + 1).map(l => l.trim()).filter(l => l.length > 0);
      return contextLines.map(l => `- ${l}`).join("\n");
    }

    // Luhn check for card numbers (PAN)
    function luhnCheck(value: string) {
      const digits = (value || "").replace(/\D/g, "");
      if (digits.length < 12) return false;
      let sum = 0;
      let alt = false;
      for (let i = digits.length - 1; i >= 0; i--) {
        let n = parseInt(digits.charAt(i), 10);
        if (alt) {
          n *= 2;
          if (n > 9) n -= 9;
        }
        sum += n;
        alt = !alt;
      }
      return sum % 10 === 0;
    }

    // Detect card brand from digit-only PAN
    function detectCardBrand(digits: string) {
      if (/^3[47]\d{13}$/.test(digits)) return 'AMEX'; // 15 digits
      if (/^4\d{12}(\d{3})?$/.test(digits)) return 'VISA'; // 13 or 16
      if (/^(?:5[1-5]\d{14}|2(?:2[2-9]\d{12}|[3-6]\d{13}|7[01]\d{12}|720\d{12}))$/.test(digits)) return 'MASTERCARD';
      if (/^(?:6011\d{12}|65\d{14}|64[4-9]\d{13}|622\d{10,13})$/.test(digits)) return 'DISCOVER';
      return null;
    }

    const hits: { type: string; value: string; index: number; confidence?: string; context?: string }[] = [];
    for (const [type, re] of Object.entries(detectors)) {
      const flags = (re as RegExp).flags.includes("g") ? (re as RegExp).flags : (re as RegExp).flags + "g";
      const r = new RegExp((re as RegExp).source, flags);
      let m: RegExpExecArray | null;
        while ((m = r.exec(text)) !== null) {
          const val = m[0];
          let confidence = "low";

          if (type === "pan") {
            // normalize digits for Luhn and length checks
            const digits = String(val).replace(/\D/g, "");
            const luhn = luhnCheck(digits);

            // examine nearby raw text for keywords that indicate card/PAN context
            const windowStart = Math.max(0, m.index - 40);
            const windowEnd = Math.min(rawText.length, m.index + val.length + 40);
            const ctxWindow = String(rawText).slice(windowStart, windowEnd).toLowerCase();
            const contextKeywords = ["pan", "primary account", "card", "cardholder", "account number", "primary account number"];
            const contextBoost = contextKeywords.some(k => ctxWindow.includes(k));

            if (digits.length >= 13 && digits.length <= 19) {
              if (luhn) {
                // Luhn + either 16-digit standard length or contextual keywords => high
                confidence = (digits.length === 16 || contextBoost) ? "high" : "medium";
              } else {
                // no Luhn but strong context => medium, else low
                confidence = contextBoost ? "medium" : "low";
              }
            } else {
              confidence = "low";
            }
          } else if (type === "cvv" || type === "pin") {
            confidence = "medium";
          } else if (type === 'credit_card') {
            // treat as card-like — prefer Luhn and 16-digit grouped forms
            const digits = String(val).replace(/\D/g, '');
            const luhn = luhnCheck(digits);
            if (digits.length === 16 && luhn) confidence = 'high';
            else if (luhn) confidence = 'medium';
            else confidence = 'low';

            // also attempt to detect brand and add CARD hit
            try {
              const brand = detectCardBrand(digits);
              if (brand) {
                const brandConfidence = luhnCheck(digits) ? 'high' : 'medium';
                hits.push({ type: 'CARD', value: brand, index: m.index, confidence: brandConfidence });
              }
            } catch (e) {
              // non-fatal
            }
          } else if (type === 'routing') {
            // routing numbers are 9 digits; use nearby keywords to raise confidence
            const windowStart = Math.max(0, m.index - 40);
            const windowEnd = Math.min(rawText.length, m.index + val.length + 40);
            const ctxWindow = String(rawText).slice(windowStart, windowEnd).toLowerCase();
            const routingKeywords = ['routing', 'aba', 'routing number', 'ach'];
            const ctxBoost = routingKeywords.some(k => ctxWindow.includes(k));
            confidence = ctxBoost ? 'medium' : 'low';
          } else if (type === 'mrn' || type === 'passport' || type === 'health_insurance') {
            confidence = 'medium';
          } else if (type === "txn" || type === "pssCode") {
            confidence = "medium";
          } else if (type === "amount" || type === "account") {
            confidence = "low";
          }

          const ctx = getContextSnippet(rawText, m.index, 1);

          // push primary hit
          hits.push({ type: type.toUpperCase(), value: val, index: m.index, confidence, context: ctx });

          // if this was a PAN, also attempt to detect card brand and add a CARD hit
          if (type === 'pan') {
            try {
              const digits = String(val).replace(/\D/g, '');
              const brand = detectCardBrand(digits);
              if (brand) {
                const brandConfidence = luhnCheck(digits) ? 'high' : 'medium';
                hits.push({ type: 'CARD', value: brand, index: m.index, confidence: brandConfidence });
              }
            } catch (e) {
              // non-fatal
            }
          }
        }
    }

    const hasPSS = hits.some(h => ["PAN", "CREDIT_CARD", "ACCOUNT", "UPI", "CVV", "PIN", "ROUTING", "PASSPORT", "MRN", "HEALTH_INSURANCE", "CARD"].includes(h.type));
    const hasDSS = hits.some(h => ["IFSC", "TXN", "PSSCODE", "AMOUNT"].includes(h.type));
    return { hits, hasPSS, hasDSS };
  }

  // Load file text with proper parser
  React.useEffect(() => {
  const load = async () => {
    if (!selectedRow) return;
    setBusy(true);

    try {
      const sp = new SPService(context);

      let fileRef: string | null = null;
      let name: string | null = null;

      try {
        fileRef = selectedRow.getValueByName("FileRef");
        name = selectedRow.getValueByName("FileLeafRef") || selectedRow.getValueByName("FileName");
      } catch (e) {
        console.error("Error extracting fileRef:", e);
      }
// fileRef loaded

      setFileName(name || null);

      if (!fileRef) {
        setFileContent("");
        setDetectResult(null);
        setBusy(false);
        return;
      }

      let text = "";
      const blob = await sp.getFileBlob(fileRef);

      // DOCX handling
      if (name?.endsWith(".docx") && blob) {
  const arrayBuffer = await blob.arrayBuffer();

  // Try Mammoth first
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer });
  text = result?.value || "";
  // mammoth extract (if available)

  // ✅ Fallback with JSZip if Mammoth misses sensitive values
  if (!text.trim()) {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXml = await zip.file("word/document.xml")?.async("string");
    if (docXml) {
      // Extract only text nodes (<w:t>...</w:t>) and join them
      const matches = docXml.match(/<w:t[^>]*>(.*?)<\/w:t>/g) || [];
      text = matches.map(m => m.replace(/<[^>]+>/g, "")).join(" ");

      // 🔎 Normalize whitespace and non-breaking spaces
      text = text.replace(/\s+/g, " ").replace(/\u00A0/g, " ");
    }
    // JSZip fallback extract
  }
}

      // PDF handling
      else if (name?.endsWith(".pdf") && blob) {
        // Try to extract text from PDF using pdfjs (dynamic import). If it fails, fall back to existing fileContent.
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf');
          // try to set workerSrc to CDN if available
          try {
            if (pdfjs && pdfjs.GlobalWorkerOptions) {
              // version may not exist; best-effort
              (pdfjs as any).GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${(pdfjs as any).version || '2.16.105'}/pdf.worker.min.js`;
            }
          } catch (wErr) {
            console.warn('Could not set pdfjs workerSrc', wErr);
          }

          const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          let extracted = '';
          for (let p = 1; p <= pdf.numPages; p++) {
            try {
              const page = await pdf.getPage(p);
              const content = await page.getTextContent();
              const pageText = (content.items || []).map((it: any) => it.str || '').join(' ');
              extracted += pageText + '\n';
            } catch (pgErr) {
              console.warn('Failed extracting page text', p, pgErr);
            }
          }
          text = extracted.trim();
          if (!text) {
            text = fileContent || '';
          }
        } catch (e) {
          console.warn('PDF text extraction failed, falling back to fileContent', e);
          text = fileContent || '';
        }
      }

      // Image handling
      else if (name?.match(imageExtRe) && blob) {
        try {
          const tesseract: any = await import('tesseract.js');
          const { createWorker } = tesseract;
          const worker = await createWorker({ logger: (m: any) => console.log('TESS:', m) });
          await worker.load();
          await worker.loadLanguage('eng');
          await worker.initialize('eng');

          // Preprocess image: upscale moderately for better OCR accuracy
          const bitmap = await createImageBitmap(blob);
          const maxDim = Math.max(bitmap.width, bitmap.height);
          const scale = maxDim < 800 ? Math.min(2, 800 / Math.max(1, maxDim)) : 1; // upscale small images
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(bitmap.width * scale);
          canvas.height = Math.round(bitmap.height * scale);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            // optional: simple contrast tweak could be added here
          }

          const dataUrl = canvas.toDataURL();
          const ocrResult = await worker.recognize(dataUrl);
          text = ocrResult?.data?.text || '';
          // image OCR extracted
          await worker.terminate();
        } catch (imgErr) {
          console.warn('Image OCR failed, falling back to quick recognize()', imgErr);
          try {
            const Tesseract = await import('tesseract.js');
            const quick = await Tesseract.recognize(blob, 'eng');
            text = quick?.data?.text || '';
            // fallback OCR extracted
          } catch (ferr) {
            console.warn('Fallback image OCR failed', ferr);
            text = fileContent || '';
          }
        }
      }

      // Fallback for plain text
      else {
        try {
          text = await sp.getFileText(fileRef);
        } catch {
          if (blob && typeof (blob as any).text === "function") {
            text = await (blob as any).text();
          }
        }
        // plain text extracted
      }

      // Save content and run detectors
      setFileContent(text || "");
      if (text) setDetectResult(runDetectors(text));
    } finally {
      setBusy(false);
    }
  };

  void load();
}, [selectedRow, context]);

  // Redact and download
  async function redactDocument() {
    if (!fileContent) return alert("No file content");
    const result = detectResult || runDetectors(fileContent);

    if (!result.hits || result.hits.length === 0) {
      return alert("No sensitive data detected to redact");
    }

      try {
        setBusy(true);
        const sp = new SPService(context);
        let fileRef: string | null = null;
        try {
          fileRef = selectedRow.getValueByName("FileRef");
        } catch (e) {
          console.error("Error extracting fileRef:", e);
        }

        const blob = fileRef ? await sp.getFileBlob(fileRef) : null;

      let redactedBlob: Blob | null = null;
      if (fileName?.endsWith(".pdf") && blob) {
        redactedBlob = await redactPdf(blob, result.hits);
      } else if (fileName?.endsWith(".docx") && blob) {
        redactedBlob = await redactDocx(blob, result.hits);
      } else if (fileName?.match(imageExtRe) && blob) {
        redactedBlob = await redactImage(blob, result.hits);
      } else {
        // fallback: text replacement for plain text
        let out = fileContent;
        for (const h of result.hits) {
          if (!h.value) continue;
          const esc = String(h.value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          out = out.replace(new RegExp(esc, "gi"), "[REDACTED]");
        }
        redactedBlob = new Blob([out], { type: "text/plain" });
      }

      if (redactedBlob) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(redactedBlob);
        const ext = fileName?.split(".").pop() || "txt";
        a.download = `${fileName?.replace(/\.[^/.]+$/, "")}-redacted.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
        alert(`Document redacted and downloaded successfully!\nRedacted ${result.hits.length} sensitive data points.`);
      }
    } catch (err) {
      console.error("Redaction error:", err);
      alert(`Redaction failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  // Color-coded detection UI
  function getColor(type: string) {
    if (["PAN", "CREDIT_CARD", "CVV", "PIN", "CARD", "ROUTING", "PASSPORT", "MRN", "HEALTH_INSURANCE"].includes(type)) return "#ffe5e5"; // red background
    if (["ACCOUNT", "UPI", "IFSC"].includes(type)) return "#fff5e5"; // orange background
    return "#e5ffe5"; // green background
  }

  function getTextColor(type: string) {
    if (["PAN", "CREDIT_CARD", "CVV", "PIN", "CARD", "ROUTING", "PASSPORT", "MRN", "HEALTH_INSURANCE"].includes(type)) return "red";
    if (["ACCOUNT", "UPI", "IFSC"].includes(type)) return "orange";
    return "green";
  }

    return (
    <Panel isOpen onDismiss={onDismiss} type={PanelType.medium} headerText="Document Redaction Assistant">
      <div style={{ marginTop: 12 }}>
        <PrimaryButton
          text="Detect PSS/DSS"
          onClick={() => setDetectResult(runDetectors(fileContent))}
          disabled={!fileContent || busy}
        />
        <DefaultButton
          text="Redact & Download"
          onClick={redactDocument}
          disabled={!fileContent || busy || !(detectResult?.hasPSS || detectResult?.hasDSS)}
          styles={{ root: { marginLeft: 8 } }}
        />
      </div>

      {detectResult && (
        <div style={{ marginTop: 12 }}>
          <div>
            Detections: {(detectResult.hits || []).length} | PSS: {detectResult.hasPSS ? "Yes" : "No"} | DSS:{" "}
            {detectResult.hasDSS ? "Yes" : "No"}
          </div>
          <div style={{ marginTop: 8 }}>
            {(detectResult.hits || []).map((h: any, i: number) => (
              <div
                key={i}
                style={{
                  padding: 8,
                  borderBottom: "1px solid #eee",
                  backgroundColor: getColor(h.type),
                }}
              >
                <div style={{ fontWeight: 600, color: getTextColor(h.type) }}>{h.type}</div>
                <div style={{ fontFamily: "monospace", wordBreak: "break-all" }}>{String(h.value)}</div>
                <div style={{ color: "#666", fontSize: 12 }}>Confidence: {h.confidence || 'n/a'} | Index: {h.index}</div>
                {h.context && (
                  <div style={{ marginTop: 8, padding: 8, border: '1px solid #eee', background: '#fafafa', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Context snippet:</div>
                    <div>{h.context}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
};

export default CustomPanel;