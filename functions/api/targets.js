// functions/targets.js

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const zip = url.searchParams.get("zip");
    const catalog = url.searchParams.get("catalog") || "Messier";

    if (!zip) {
      return new Response(
        JSON.stringify({ error: "Missing zip" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 1) Geocode
    const geoResp = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!geoResp.ok) {
      return new Response(
        JSON.stringify({ error: "Invalid ZIP" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const geoJson = await geoResp.json();
    const place = geoJson.places[0];
    const lat = parseFloat(place.latitude);
    const lng = parseFloat(place.longitude);

    // 2) Fetch full catalog from the public host
    const rows = 15000;
    const dataset = "ngc-ic-messier-catalog@datastro";
    const apiUrl =
      `https://public.opendatasoft.com/api/records/1.0/search?` +
      `dataset=${dataset}` +
      `&rows=${rows}` +
      `&format=json`;
    const dataResp = await fetch(apiUrl);
    if (!dataResp.ok) {
      return new Response(
        JSON.stringify({
          error: `Catalog fetch error: ${dataResp.status} ${dataResp.statusText}`
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }
    const dataJson = await dataResp.json();
    const allRecords = dataJson.records.map(r => r.record.fields);

    // 3) Filter by catalog field
    const filtered = allRecords.filter(f =>
      String(f.catalog).toLowerCase() === catalog.toLowerCase()
    );

    // 4) Return JSON
    return new Response(
      JSON.stringify({ lat, lng, records: filtered }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
