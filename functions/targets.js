// functions/targets.js

// — Caldwell list (C-number → NGC/IC number)
const CALDWELL_LIST = {
  1: "NGC 188", 2: "NGC 40", 3: "NGC 4236", 4: "NGC 7023", 5: "IC 342",
  6: "NGC 6543", 7: "NGC 2403", 8: "NGC 559", 9: "NGC 633", 10: "NGC 663",
  // ... include all 109 entries ...
  105: "NGC 4565", 106: "NGC 247", 107: "NGC 6752", 108: "NGC 5139", 109: "NGC 278"
};

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const zip = url.searchParams.get("zip");
  const catalog = url.searchParams.get("catalog") || "Messier";

  if (!zip) return new Response("Missing zip", { status: 400 });

  // 1) Geocode
  const geo = await fetch(`https://api.zippopotam.us/us/${zip}`);
  if (!geo.ok) return new Response("Invalid ZIP", { status: 400 });
  const { places: [place] } = await geo.json();
  const lat = +place.latitude, lng = +place.longitude;

  // 2) Fetch all records
  const resp = await fetch(
    "https://data.opendatasoft.com/api/records/1.0/search/?" +
    "dataset=ngc-ic-messier-catalog&rows=500"
  );
  if (!resp.ok) return new Response("Catalog error", { status: 502 });
  const json = await resp.json();
  let records = json.records.map(r => ({ fields: r.record.fields }));

  // 3) Filter by catalog
  if (catalog === "Caldwell") {
    const names = Object.values(CALDWELL_LIST);
    records = records.filter(r => names.includes(r.fields.NGC || r.fields.IC));
  } else {
    records = records.filter(r => r.fields.catalog === catalog);
  }

  return new Response(
    JSON.stringify({ lat, lng, records }),
    { headers: { "Content-Type": "application/json" } }
  );
}
