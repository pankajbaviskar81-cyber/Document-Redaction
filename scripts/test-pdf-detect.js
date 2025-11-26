const fs = require('fs');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const pdfjs = require('pdfjs-dist/legacy/build/pdf');

async function makeSamplePdf(path, textLines) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 12;
  let y = 760;
  for (const line of textLines) {
    page.drawText(line, { x: 40, y, size: fontSize, font: helv, color: rgb(0,0,0) });
    y -= fontSize + 8;
  }
  const bytes = await pdfDoc.save();
  fs.writeFileSync(path, bytes);
}

function runDetectors(rawText) {
  const detectors = {
    // tightened PAN detection: prefer 4-4-4-4 grouping or continuous 13-19 digits
    pan: /(?:\b(?:\d{4}[- ]?){3}\d{4}\b|\b\d{13,19}\b)/g,
    ifsc: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g,
    upi: /\b[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}\b/g,
    account: /\b\d{9,18}\b/g,
    txn: /\b(?:TXN|TRX|REF|UTR)[-_]?[A-Z0-9-]{6,}\b/gi,
    cvvLike: /\b(?:CVV2?|CVC2?|CAV2|CID)\s*[:=]?\s*\d{3,4}\b/gi,
    pinLabeled: /\b(?:PIN|ATM\s*PIN)\s*[:=]?\s*\d{4,6}\b/gi,
    amount: /[₹$€£₽¥]\s*[\d,]+(?:\.\d{2})?|\b\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:Rs|INR|USD|EUR|GBP)\b/gi,
    pssCode: /\b(?:PSS|UTR|NEFT|RTGS|IMPS)[-_]?[A-Z0-9-]{4,}\b/gi,
    expiry: /\b\d{2}\/\d{2}\b/g,
  };

  function luhnCheck(value) {
    const digits = (value || '').replace(/\D/g, '');
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

  const hits = [];
  const text = String(rawText || '');
  for (const [k,re] of Object.entries(detectors)) {
    const r = new RegExp(re.source, (re.flags || '') + (re.flags && !re.flags.includes('g') ? 'g' : ''));
    let m;
    while ((m = r.exec(text)) !== null) {
      let confidence = 'low';

      if (k === 'pan') {
        const val = m[0];
        const digits = String(val).replace(/\D/g, '');
        const luhn = luhnCheck(digits);
        const windowStart = Math.max(0, m.index - 40);
        const windowEnd = Math.min(text.length, m.index + val.length + 40);
        const ctxWindow = text.slice(windowStart, windowEnd).toLowerCase();
        const contextKeywords = ['pan', 'primary account', 'card', 'cardholder', 'account number', 'primary account number'];
        const contextBoost = contextKeywords.some(k => ctxWindow.includes(k));

        if (digits.length >= 13 && digits.length <= 19) {
          if (luhn) {
            confidence = (digits.length === 16 || contextBoost) ? 'high' : 'medium';
          } else {
            confidence = contextBoost ? 'medium' : 'low';
          }
        } else {
          confidence = 'low';
        }
      } else if (k === 'cvvLike' || k === 'pinLabeled') {
        confidence = 'medium';
      } else if (k === 'txn' || k === 'pssCode') {
        confidence = 'medium';
      } else if (k === 'amount' || k === 'account') {
        confidence = 'low';
      }

      hits.push({ type: k.toUpperCase(), value: m[0], index: m.index, confidence });
      if (r.lastIndex === m.index) r.lastIndex++;
    }
  }
  return hits;
}

(async function(){
  const sample = [
    'Cardholder Name: Rahul Sharma',
    'Primary Account Number (PAN): 4111-1111-1111-1234',
    'Expiration Date: 11/27',
    'Service Code: 201',
    'CVV: 123',
    'PIN (encrypted): 9f8a7c6d5e4b'
  ];
  const outPath = './output/test_sample.pdf';
  if (!fs.existsSync('./output')) fs.mkdirSync('./output');
  await makeSamplePdf(outPath, sample);
  console.log('Wrote sample PDF to', outPath);

  // Extract text using pdfjs
  const data = new Uint8Array(fs.readFileSync(outPath));
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  let extracted = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const pageText = (content.items || []).map((it) => it.str || '').join(' ');
    extracted += pageText + '\n';
  }
  extracted = extracted.trim();
  console.log('Extracted text:\n', extracted);

  const hits = runDetectors(extracted);
  console.log('\nDetections from PDF extraction:');
  for (const h of hits) console.log('-', h.type, ':', h.value, '| confidence:', h.confidence);

  // Simulate image OCR by running detectors on the same text
  const imageHits = runDetectors(extracted);
  console.log('\nDetections from simulated image OCR:');
  for (const h of imageHits) console.log('-', h.type, ':', h.value, '| confidence:', h.confidence);

})();
