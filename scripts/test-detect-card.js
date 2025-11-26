// Test detector for card sample from user's attachment
const detectors = {
  pan: /\b(?:\d[ -]*?){13,19}\b/g,
  expiry: /\b(0[1-9]|1[0-2])\/[0-9]{2,4}\b/g,
  cvvLike: /\b(?:CVV2?|CVC2?|CAV2|CID)\s*[:=]?\s*\d{3,4}\b/gi,
  account: /\b\d{9,18}\b/g,
  txn: /\b(?:TXN|TRX|REF|UTR)[-_]?[A-Z0-9-]{6,}\b/g,
  amount: /[₹$€£₽¥]\s*[\d,]+(?:\.\d{2})?|\b\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:Rs|INR|USD|EUR|GBP)\b/gi,
  pssCode: /\b(?:PSS|UTR|NEFT|RTGS|IMPS)[-_]?[A-Z0-9-]{4,}\b/gi,
};

function getContextSnippet(full, index, linesAround = 2) {
  const lines = String(full).split(/\r?\n/);
  let pos = 0;
  let lineIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (index >= pos && index < pos + l.length + 1) {
      lineIndex = i;
      break;
    }
    pos += l.length + 1;
  }
  const start = Math.max(0, lineIndex - linesAround);
  const end = Math.min(lines.length - 1, lineIndex + linesAround);
  const contextLines = lines.slice(start, end + 1).map(l => l.trim()).filter(l => l.length > 0);
  return contextLines.map(l => `- ${l}`).join('\n');
}

function luhnCheck(value) {
  const digits = String(value || '').replace(/\D/g, '');
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

function runDetectors(rawText) {
  const text = String(rawText || '')
    .replace(/\\[-]/g, '-')
    .replace(/\\#/g, '#')
    .replace(/\\n/g, '\n')
    .replace(/\s+/g, ' ');

  const hits = [];
  for (const [type, re] of Object.entries(detectors)) {
    const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
    const r = new RegExp(re.source, flags);
    let m;
    while ((m = r.exec(text)) !== null) {
      let confidence = 'low';
      if (type === 'pan') confidence = luhnCheck(m[0]) ? 'high' : 'low';
      else if (type === 'cvvLike') confidence = 'medium';
      else if (type === 'txn' || type === 'pssCode') confidence = 'medium';
      const ctx = getContextSnippet(rawText, m.index, 1);
      hits.push({ type: type.toUpperCase(), value: m[0], index: m.index, confidence, context: ctx });
    }
  }

  const hasPAN = hits.some(h => h.type === 'PAN');
  const hasPSS = hasPAN || hits.some(h => ['CVVLIKE','ACCOUNT'].includes(h.type));
  const hasDSS = hits.some(h => ['TXN', 'PSSCODE', 'AMOUNT'].includes(h.type));
  return { hits, hasPSS, hasDSS };
}

const sample = `sharma

- primary account number (pan): 4111-1111-1111-1234

- expiration date: 11/27

- service co`;

const res = runDetectors(sample);
console.log('Input sample:\n', sample);
console.log('\nDetection result:');
console.log('Has PSS:', res.hasPSS);
console.log('Has DSS:', res.hasDSS);
console.log('Hits (count ' + res.hits.length + '):');
for (const h of res.hits) {
  const label = h.type === 'PAN' ? 'CARD' : h.type;
  console.log(`\nType: ${label}\nValue: ${h.value}\nConfidence: ${h.confidence}\nIndex: ${h.index}\nContext snippet:\n${h.context}\n`);
}

process.exit(0);
