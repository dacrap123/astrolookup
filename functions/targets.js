export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const zip = url.searchParams.get("zip");
    const catalog = url.searchParams.get("catalog") || "Messier";

    if (!zip) {
      return new Response(JSON.stringify({ error: "Missing zip" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 1) Geocode via Zippopotam.us
    const geoResp = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!geoResp.ok) {
      return new Response(JSON.stringify({ error: "Invalid ZIP" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const { places } = await geoResp.json();
    const lat = parseFloat(places[0].latitude);
    const lng = parseFloat(places[0].longitude);

    // 2) Fetch ALL catalog data
    const rows = 15000;  // covers the full dataset
    const dataset = "ngc-ic-messier-catalog@datastro";
    const apiUrl = `https://data.opendatasoft.com/api/records/1.0/search?` +
                   `dataset=${dataset}&rows=${rows}`;
    const dataResp = await fetch(apiUrl);
    if (!dataResp.ok) {
      return new Response(JSON.stringify({ error: "Catalog fetch error" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }
    const dataJson = await dataResp.json();
    const allRecords = dataJson.records.map(r => r.fields);

    // 3) FILTER in code by the catalog parameter
    //    dataset.entries have a `catalog` property ("Messier"/"NGC"/"IC")
    const filtered = allRecords.filter(f =>
      String(f.catalog).toLowerCase() === catalog.toLowerCase()
    );

    return new Response(
      JSON.stringify({ lat, lng, records: filtered }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
  catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
