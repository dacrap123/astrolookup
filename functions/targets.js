export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const zip = url.searchParams.get("zip");
    const catalog = url.searchParams.get("catalog") || "Messier";

    if (!zip) {
      return new Response(JSON.stringify({ error: "Missing zip" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // 1) Geocode via Zippopotam.us
    const geoResp = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!geoResp.ok) {
      return new Response(JSON.stringify({ error: "Invalid ZIP" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    const geoData = await geoResp.json();
    const place = geoData.places[0];
    const lat = parseFloat(place.latitude);
    const lng = parseFloat(place.longitude);

    // 2) Fetch catalog data dynamically
    const rows = 10000;
    const dataset = "ngc-ic-messier-catalog";
    const apiUrl =
      `https://data.opendatasoft.com/api/records/1.0/search?dataset=${dataset}` +
      `&refine.catalog=${encodeURIComponent(catalog)}` +
      `&rows=${rows}`;
    const dataResp = await fetch(apiUrl);
    if (!dataResp.ok) {
      return new Response(JSON.stringify({ error: "Catalog fetch error" }), { status: 502, headers: { "Content-Type": "application/json" } });
    }
    const dataJson = await dataResp.json();
    const records = dataJson.records.map(r => ({ fields: r.record.fields }));

    return new Response(JSON.stringify({ lat, lng, records }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}