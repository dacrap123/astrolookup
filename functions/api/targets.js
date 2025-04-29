// functions/api/targets.js

// --- Helper functions for coordinate parsing ---
function hmsToDeg(hms) {
  const [h, m, s] = hms.split(':').map(parseFloat);
  return (h + m/60 + s/3600) * 15;
}
function dmsToDeg(dms) {
  const sign = dms.trim().startsWith('-') ? -1 : 1;
  const parts = dms.replace('-', '').split(':').map(parseFloat);
  return sign * (parts[0] + parts[1]/60 + parts[2]/3600);
}

// --- Main Function Export ---
export async function onRequestGet(context) {
  try {
    // Parse query parameters
    const url = new URL(context.request.url);
    const zip = url.searchParams.get('zip');
    const catalog = url.searchParams.get('catalog') || 'Messier';

    if (!zip) {
      return new Response(
        JSON.stringify({ error: 'Missing required query param: zip' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1) Geocode via Zippopotam.us
    const geoResp = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!geoResp.ok) {
      return new Response(
        JSON.stringify({ error: 'Invalid ZIP code' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const geoJson = await geoResp.json();
    const place = geoJson.places[0];
    const lat = parseFloat(place.latitude);
    const lng = parseFloat(place.longitude);

    // 2) Fetch full catalog from OpenDataSoft
    const rows = 10000;  // max rows per request
    const dataset = 'ngc-ic-messier-catalog@datastro';
    const apiUrl = `https://public.opendatasoft.com/api/records/1.0/search?dataset=${encodeURIComponent(dataset)}&rows=${rows}&format=json`;
    const dataResp = await fetch(apiUrl);
    if (!dataResp.ok) {
      return new Response(
        JSON.stringify({ error: `Catalog fetch error: ${dataResp.status} ${dataResp.statusText}` }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const dataJson = await dataResp.json();
    const allRecords = dataJson.records.map(r => r.fields);

    // 3) Filter by catalog (Messier, NGC or IC)
    const filteredByCatalog = allRecords.filter(f =>
      String(f.catalog).toLowerCase() === catalog.toLowerCase()
    );

    // 4) Viability filter: only targets with max altitude ≥ 30°
    const viableTargets = filteredByCatalog.filter(f => {
      if (!f.dec || !f.ra) return false;
      const decDeg = dmsToDeg(f.dec);
      const maxAlt = 90 - Math.abs(lat - decDeg);
      return maxAlt >= 30;
    });

    // 5) Return the results
    return new Response(
      JSON.stringify({ lat, lng, records: viableTargets }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
