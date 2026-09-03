const fs = require('fs');
const buf = fs.readFileSync('apps/web/public/logo.jpg');
// Crude JPEG byte sampling to estimate dominant hues
const counts = new Map();
const step = Math.floor(buf.length / 8000);
for (let i = 0; i < buf.length - 3; i += step) {
  const r = buf[i], g = buf[i + 1], b = buf[i + 2];
  // Quantize to 5-bit per channel
  const key = `${r >> 5},${g >> 5},${b >> 5}`;
  counts.set(key, (counts.get(key) || 0) + 1);
}
const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
const hexes = sorted.map(([k]) => {
  const [r, g, b] = k.split(',').map(n => parseInt(n, 10) * 32);
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
});
console.log('dominant:', hexes.join(' '));
