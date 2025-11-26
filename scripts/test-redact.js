const fs = require('fs');
const path = require('path');

// Replicate the filename logic from CustomPanel
function makeRedactedFileName(orig) {
  if (!orig) return 'redacted_document.txt';
  const idx = orig.lastIndexOf('.');
  if (idx === -1) return `${orig}-redacted.txt`;
  const base = orig.substring(0, idx);
  const ext = orig.substring(idx);
  return `${base}-redacted${ext}`;
}

function redactContent(content, options = { redactPSS: true, redactDSS: true }) {
  let redacted = content || '';
  if (options.redactPSS) {
    redacted = redacted.replace(/Payment and Settlement Systems/gi, '[REDACTED]');
  }
  if (options.redactDSS) {
    redacted = redacted.replace(/Payment Card Industry Data Security Standard/gi, '[REDACTED]');
  }
  return redacted;
}

async function run() {
  const outDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const samples = [
    { orig: 'report.pdf', content: 'This mentions Payment and Settlement Systems in the body.' },
    { orig: 'notes', content: 'No sensitive text here.' },
    { orig: null, content: 'Payment Card Industry Data Security Standard is referenced.' }
  ];

  const BOM = '\uFEFF';

  for (const s of samples) {
    const redacted = redactContent(s.content);
    const fileName = makeRedactedFileName(s.orig);
    const filePath = path.join(outDir, fileName);
    // write with BOM and utf8
    fs.writeFileSync(filePath, BOM + redacted, { encoding: 'utf8' });
    const buf = fs.readFileSync(filePath);
    const hasBOM = buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;
    console.log(`Wrote: ${filePath} (size=${buf.length} bytes) BOM=${hasBOM}`);
  }

  console.log('\nFiles in output:');
  const files = fs.readdirSync(outDir);
  for (const f of files) console.log(' -', f);
  console.log('\nTest complete. Open any written .txt file in Notepad to verify readability.');
}

run().catch(err => {
  console.error('Test failed', err);
  process.exit(1);
});
