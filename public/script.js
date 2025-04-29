// Helpers for coordinate conversion
function hmsToDeg(hms) {
  const [h, m, s] = hms.split(':').map(parseFloat);
  return (h + m/60 + s/3600) * 15;
}
function dmsToDeg(dms) {
  const sign = dms.trim().startsWith('-') ? -1 : 1;
  const parts = dms.replace('-', '').split(':').map(parseFloat);
  return sign * (parts[0] + parts[1]/60 + parts[2]/3600);
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
  document.documentElement.classList.toggle('light');
  themeToggle.textContent = document.documentElement.classList.contains('light') ? 'Dark Mode' : 'Light Mode';
});

// Main search handler
document.getElementById('searchBtn').addEventListener('click', async () => {
  const zip = zipInput.value.trim();
  if (!zip) {
    alert('Enter a ZIP code.');
    return;
  }
  resultsEl.innerHTML = '';
  loadingEl.hidden = false;

  try {
    // Parse inputs
    const sensorW = parseFloat(sensorWInput.value);
    const sensorH = parseFloat(sensorHInput.value);
    const focal = parseFloat(focalInput.value);
    const variance = parseFloat(varianceInput.value) / 100;
    const maxMag = parseFloat(maxMagInput.value);
    const catalog = catalogInput.value;

    // Fetch from API
    const resp = await fetch(`/api/targets?zip=${encodeURIComponent(zip)}&catalog=${encodeURIComponent(catalog)}`);
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Unknown API error');

    const { lat, lng, records } = data;

    // Compute FOV
    const fovH = 2 * Math.atan(sensorW/(2*focal)) * (180/Math.PI);
    const fovV = 2 * Math.atan(sensorH/(2*focal)) * (180/Math.PI);
    const diag = Math.sqrt(fovH*fovH + fovV*fovV);
    const maxSize = diag * 60 * (1 + variance); // arcmin with variance

    // Compute target data
    const now = new Date();
    const lst = AstronomyEngine.SiderealTime(now, lng);
    const targets = records.map(r => {
      const f = r.fields;
      const raDeg = hmsToDeg(f.RA);
      const decDeg = dmsToDeg(f.Dec);
      const transitAlt = 90 - Math.abs(lat - decDeg);
      const deltaH = ((raDeg/15 - lst + 24) % 24);
      const transitT = new Date(now.getTime() + deltaH*3600e3)
        .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return {
        name: f.Name || f.M || f.NGC || f.IC,
        type: f.Type,
        maj: f.MajAx,
        min: f.MinAx,
        mag: f['V-Mag'],
        transitAlt,
        transitTime: transitT,
        wiki: `https://en.wikipedia.org/wiki/${encodeURIComponent(f.Name)}`
      };
    });

    // Apply filters
    const visible = targets
      .filter(o => o.transitAlt >= 30)
      .filter(o => o.mag <= maxMag)
      .filter(o => o.maj <= maxSize)
      .sort((a,b) => (a.mag - b.mag) || (b.maj - a.maj));

    // Render results
    resultsEl.innerHTML = visible.length
      ? visible.map(o => `
        <div class="bg-gray-800 p-4 rounded shadow-lg">
          <h3 class="text-xl font-semibold mb-1">${o.name}</h3>
          <p>Type: ${o.type}</p>
          <p>Size: ${o.maj}′ × ${o.min}′</p>
          <p>Mag: ${o.mag}</p>
          <p>Max Alt: ${o.transitAlt.toFixed(1)}° at ${o.transitTime}</p>
          <a href="${o.wiki}" target="_blank" class="text-blue-400 hover:underline">Wikipedia</a>
        </div>
      `).join('')
      : '<p class="text-center col-span-full">No targets match your criteria tonight.</p>';
  } catch (err) {
    resultsEl.innerHTML = `<p class="text-red-500 text-center">${err.message}</p>`;
  } finally {
    loadingEl.hidden = true;
  }
});
