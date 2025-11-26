import * as React from "react";
import { PrimaryButton, DefaultButton } from "@fluentui/react";
import { redactPdf, redactDocx, redactImage } from "../utils/redactionUtils";

const imageExtRe = /\.(png|jpg|jpeg|gif|bmp|tiff)$/i;

const detectors: Record<string, RegExp> = {
  pan: /\b(?:\d[ -]*?){13,19}\b/g,
  ifsc: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g,
  upi: /\b[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}\b/g,
  account: /\b\d{9,18}\b/g,
  txn: /\b(?:TXN|TRX|REF|UTR)[-_]?[A-Z0-9-]{6,}\b/g,
  cvvLike: /\b(?:CVV2?|CVC2?|CAV2|CID)\s*[:=]?\s*\d{3,4}\b/gi,
  pinLabeled: /\b(?:PIN|ATM\s*PIN)\s*[:=]?\s*\d{4,6}\b/gi,
};

function runDetectors(rawText: string) {
  const text = rawText
    .replace(/\\[-]/g, "-")
    .replace(/\\#/g, "#")
    .replace(/\\n/g, "\n")
    .replace(/\s+/g, " ");

  const hits: { type: string; value: string; index: number }[] = [];
  for (const [type, re] of Object.entries(detectors)) {
    const r = new RegExp(re.source, (re as RegExp).flags.includes("g") ? (re as RegExp).flags : (re as RegExp).flags + "g");
    let m: RegExpExecArray | null;
    while ((m = r.exec(text)) !== null) {
      hits.push({ type: type.toUpperCase(), value: m[0], index: m.index });
    }
  }
  const hasPSS = hits.some((h) => ["PAN", "ACCOUNT", "UPI", "CVVLIKE", "PINLABELED"].includes(h.type));
  const hasDSS = hits.some((h) => ["IFSC", "TXN"].includes(h.type));
  return { hits, hasPSS, hasDSS };
}

const RedactTester: React.FC = () => {
  const [file, setFile] = React.useState<File | null>(null);
  const [text, setText] = React.useState<string>("");
  const [detectResult, setDetectResult] = React.useState<any | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files && e.target.files[0];
    setFile(f || null);
    setDetectResult(null);
    setText("");
    if (f) {
      try {
        if (f.name.endsWith(".pdf")) {
          // Try to extract text via pdfjs in redactionUtils path if available — fallback to empty
          // For quick testing we won't re-run pdfjs here; we'll just set placeholder
          setText("PDF (text extraction occurs in CustomPanel in your SPFx environment)");
        } else if (f.name.endsWith(".docx")) {
          // mammoth extraction isn't available here synchronously; set placeholder
          setText("DOCX (text extraction occurs in CustomPanel in your SPFx environment)");
        } else if (f.name.match(imageExtRe)) {
          // run OCR using Tesseract if available via redactionUtils; for this simple tester we'll skip
          setText("Image (OCR will be performed when redaction runs)");
        } else {
          const txt = await f.text();
          setText(txt);
        }
      } catch (err) {
        console.error(err);
      }
    }
  }

  async function detect() {
    if (!file && !text) return alert("Select a file or provide text");
    setBusy(true);
    try {
      let content = text;
      if (file && !content) {
        try {
          content = await file.text();
        } catch {
          content = "";
        }
      }
      const res = runDetectors(content || "");
      setDetectResult(res);
    } finally {
      setBusy(false);
    }
  }

  async function redact() {
    if (!file) return alert("Select a file first");
    setBusy(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let redacted: Blob | null = null;
      // For PDF/DOCX/Image we'll call the same redaction utils used in your app
      if (ext === 'pdf') {
        const arrayBuffer = await file.arrayBuffer();
        redacted = await redactPdf(new Blob([arrayBuffer], { type: file.type }), detectResult?.hits || []);
      } else if (ext === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        redacted = await redactDocx(new Blob([arrayBuffer], { type: file.type }), detectResult?.hits || []);
      } else if (file.name.match(imageExtRe)) {
        const arrayBuffer = await file.arrayBuffer();
        redacted = await redactImage(new Blob([arrayBuffer], { type: file.type }), detectResult?.hits || []);
      } else {
        // text fallback
        let out = await file.text();
        for (const h of (detectResult?.hits || [])) {
          const esc = (h.value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          out = out.replace(new RegExp(esc, 'gi'), '[REDACTED]');
        }
        redacted = new Blob([out], { type: 'text/plain' });
      }

      if (redacted) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(redacted);
        a.download = file.name.replace(/(\.[^/.]+)$/, '') + '-redacted.' + (ext || 'txt');
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
      }
    } catch (err) {
      console.error(err);
      alert('Redaction failed: ' + (err && (err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 12 }}>
      <h3>Redaction Tester</h3>
      <input type="file" onChange={onFileChange} />
      <div style={{ marginTop: 8 }}>
        <PrimaryButton text="Detect" onClick={detect} disabled={busy || (!file && !text)} />
        <DefaultButton text="Redact" onClick={redact} disabled={busy || !file || !(detectResult?.hits?.length)} styles={{ root: { marginLeft: 8 } }} />
      </div>

      {detectResult && (
        <div style={{ marginTop: 12 }}>
          <div>Detections: {(detectResult.hits || []).length} | PSS: {detectResult.hasPSS ? 'Yes' : 'No'} | DSS: {detectResult.hasDSS ? 'Yes' : 'No'}</div>
          <div style={{ marginTop: 8 }}>
            {(detectResult.hits || []).map((h: any, i: number) => (
              <div key={i} style={{ padding: 6, borderBottom: '1px solid #eee' }}>
                <div style={{ fontWeight: 600 }}>{h.type}</div>
                <div style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{String(h.value)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RedactTester;
