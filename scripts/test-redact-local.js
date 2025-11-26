const fs = require('fs');
const path = require('path');

// Simple detectors copied/adapted from the component for local testing
const detectors = {
  pan: /\b(?:\d[ -]*?){13,19}\b/g,
  ifsc: /\b[A-Z]{4}0[A-Z0-9]{6}\b/gi,
  upi: /\b[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}\b/g,
  account: /\b\d{9,18}\b/g,
  txn: /\b(?:TXN|TRX|REF|UTR)[-_]?[A-Z0-9-]{6,}\b/ig
};

function runDetectors(text) {
  const hits = [];
  for (const [type, re] of Object.entries(detectors)) {
    try {
      const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
      const r = new RegExp(re.source, flags);
      let m;
      while ((m = r.exec(text)) !== null) {
        hits.push({ type: type.toUpperCase(), value: m[0], index: m.index });
      }
    } catch (e) {
      // ignore
    }
  }
  return { hits, hasPSS: false, hasDSS: false };
}

function redactText(text, detectResult) {
  const values = Array.from(new Set((detectResult.hits || []).map(h => String(h.value)).filter(Boolean)));
  values.sort((a,b) => b.length - a.length);
  let out = text;
  for (const v of values) {
    try {
      const esc = v.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
      out = out.replace(new RegExp(esc, 'gi'), '[REDACTED]');
    } catch (e) {
      // ignore
    }
  }
  return out;
}

function writeRedactedFile(origName, outText, dir='scripts/output'){
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const ext = origName ? path.extname(origName).toLowerCase().replace('.', '') : '';
  const base = origName ? path.basename(origName, path.extname(origName)) : 'redacted_document';
  const textExts = ['txt','md','csv','log','json','xml'];
  const outName = (ext && textExts.includes(ext)) ? `${base}-redacted.${ext}` : `${base}-redacted.txt`;
  const encoder = new TextEncoder();
  const bom = new Uint8Array([0xEF,0xBB,0xBF]);
  const bytes = encoder.encode(outText);
  const buf = Buffer.concat([Buffer.from(bom), Buffer.from(bytes)]);
  const outPath = path.join(dir, outName);
  fs.writeFileSync(outPath, buf);
  return outPath;
}

// Samples to test detection and filename behaviour
const samples = [
  {
    name: 'notes.txt',
    text: 'This document contains a PAN 4111 1111 1111 1111 and an IFSC HDFC0001234 and UPI abc123@bank.'
  },
  {
    name: 'report.pdf',
    text: 'Transaction ID TXN-2025-000123 and account 000123456789 detected. PCI DSS mention.'
  },
  {
    name: 'redacted_document',
    text: 'No extension example with PAN 5555-4444-3333-2222.'
  }
];

console.log('Running local redact tests...');
for (const s of samples) {
  const res = runDetectors(s.text);
  const out = redactText(s.text, res);
  const outPath = writeRedactedFile(s.name, out);
  const stats = fs.statSync(outPath);
  console.log(`${outPath} (${stats.size} bytes) - hits=${(res.hits||[]).length}`);
}

console.log('Done. Open files in scripts/output to verify BOM and filenames.');
