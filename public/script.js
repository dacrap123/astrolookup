// Helpers (unchanged)
function hmsToDeg(hms) {
  const [h, m, s] = hms.split(':').map(parseFloat);
  return (h + m / 60 + s / 3600) * 15;
}
function dmsToDeg(dms) {
  const sign = dms.trim().startsWith('-') ? -1 : 1;
  const parts = dms.replace('-', '').split(':').map(parseFloat);
  return sign * (parts[0] + parts[1] / 60 + parts[2] / 3600);
}

const zipInput = document.getElementById('zip');
const sensorWInput = document.getElementById('sensorWidth');
const sensorHInput = document.getElementById('sensorHeight');
const focalInput = document.getElementById('focalLength');
const varianceInput = document.getElementById('fovVariance');
const maxMagInput = document.getElementById('maxMag');
const catalogInput = document.getElementById('catalog');
const resultsEl = document.getElementById('results');
const loadingEl = document.getElementById('loading');
const themeToggle = document.getElementById('themeToggle');

// Theme toggle
themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light');
  themeToggle.textContent = document.body.classList.contains('light') ? 'Dark Mode' : 'Light Mode';
});

document.getElementById('searchBtn').addEventListener('click', async () => {
  const zip = zipInput.value.trim();
  if (!zip) return alert('Enter a ZIP code.');

  // Show spinner
  resultsEl.innerHTML = '';
  loadingEl.hidden = false;

  try {
    const [sensorW, sensorH, focal] = [sensorWInput, sensorHInput, focalInput].map(i => parseFloat(i.value));
    const variance = parseFloat(varianceInput.value) / 100;
    const maxMag = parseFloat(maxMagInput.value);
    const catalog = catalogInput.value;

    const resp = await fetch(`/api/targets?zip=${zip}&catalog=${catalog}`);
    if (!resp.ok) throw new Error(await resp.text());
    const { lat, lng, records } = await resp.json();

    // FOV in degrees
    const fovH = 2 * Math.atan(sensorW / (2 * focal)) * (180 / Math.PI);
    const fovV = 2 * Math.atan(sensorH / (2 * focal)) * (180 / Math.PI);
    const diagFov = Math.sqrt(fovH*fovH + fovV*fovV);
    const diagFovArc = diagFov * 60 * (1 + variance);

    const now = new Date();
    const lst = AstronomyEngine.SiderealTime(now, lng);

    const processed = records.map(r => {
      const f = r.fields;
      const raDeg = hmsToDeg(f.RA);
      const decDeg = dmsToDeg(f.Dec);
      const transitAlt = 90 - Math.abs(lat - decDeg);
      const deltaH = ((raDeg/15 - lst + 24) % 24);
      const transitT = new Date(now.getTime() + deltaH * 3600e3)
        .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return {
        name: f.Name || f.M || f.NGC || f.IC,
        type: f.Type,
        maj: f.MajAx,
        min: f.MinAx,
        mag: f['V-Mag'],
        transitAlt,
        transitTime: transitT,
        wiki: `https://en.wikipedia.org/wiki/${encodeURIComponent(f.Name)}`,
      };
    });

    const visible = processed
      .filter(o => o.transitAlt >= 30)
      .filter(o => o.mag <= maxMag)
      .filter(o => o.maj <= diagFovArc)
      .sort((a,b) => (a.mag - b.mag) || (b.maj - a.maj));

    resultsEl.innerHTML = visible.length
      ? visible.map(o => `
        <div class="target">
          <h3>${o.name}</h3>
          <p>Type: ${o.type}</p>
          <p>Size: ${o.maj}′ × ${o.min}′</p>
          <p>Mag: ${o.mag}</p>
          <p>Max Altitude: ${o.transitAlt.toFixed(1)}° at ${o.transitTime}</p>
          <a href="${o.wiki}" target="_blank">📖 Wikipedia</a>
        </div>
      `).join('')
      : '<p>No targets match your criteria tonight.</p>';
  } catch (e) {
    resultsEl.innerHTML = `<p class="error">Error: ${e.message}</p>`;
  } finally {
    loadingEl.hidden = true;
  }
});
