import { config } from "../config.js";
import { CacheModel } from "../db.js";
import type { LocalInsights } from "../../../shared/types.js";
let lastGeocode = 0;
export async function geocode(query: string) {
  const key = `geo:${query.toLowerCase().trim()}`;
  const cached = await CacheModel.findOne({
    key,
    expiresAt: { $gt: new Date() },
  }).lean();
  if (cached) return cached.value;
  // Requests in this single API process are serialized before the public geocoder.
  const now = Date.now();
  if (now - lastGeocode < 1100)
    throw Object.assign(
      new Error("Please wait a moment before another location lookup."),
      { status: 429 },
    );
  lastGeocode = now;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "in");
  const response = await fetch(url, {
    headers: { "User-Agent": config.OSM_USER_AGENT },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error("The public location service is unavailable.");
  const data: any = await response.json();
  if (!Array.isArray(data)) throw new Error("Invalid location response.");
  const results = data
    .map((p: any) => ({
      id: String(p.place_id),
      name: String(p.display_name),
      lat: Number(p.lat),
      lon: Number(p.lon),
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  await CacheModel.findOneAndUpdate(
    { key },
    {
      $set: { value: results, expiresAt: new Date(Date.now() + 7 * 86400000) },
    },
    { upsert: true },
  );
  return results;
}
const categories: Record<string, { key: string; value: string }> = {
  tailoring: { key: "shop", value: "tailor" },
  food: { key: "amenity", value: "restaurant|cafe|fast_food" },
  dairy: { key: "shop", value: "dairy" },
  beauty: { key: "shop", value: "beauty|hairdresser" },
  repair: { key: "shop", value: "mobile_phone" },
  agriculture: { key: "shop", value: "agrarian" },
  poultry: { key: "shop", value: "farm|butcher" },
};
export async function localBusinesses(
  lat: number,
  lon: number,
  category: string,
  radius = 3000,
): Promise<LocalInsights> {
  const mapping = categories[category];
  if (!mapping) throw new Error("Choose a supported business category.");
  const key = `osm:${lat.toFixed(4)}:${lon.toFixed(4)}:${category}:${radius}`;
  const cached = await CacheModel.findOne({
    key,
    expiresAt: { $gt: new Date() },
  }).lean();
  if (cached) return cached.value as LocalInsights;
  const query = `[out:json][timeout:20];nwr(around:${radius},${lat},${lon})["${mapping.key}"~"^(${mapping.value})$"];out center tags 50;`;
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": config.OSM_USER_AGENT,
    },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(28000),
  });
  if (!response.ok)
    throw new Error("Mapped business listings are currently unavailable.");
  const data: any = await response.json();
  if (!Array.isArray(data.elements))
    throw new Error("Invalid business listing response.");
  const distance = (a: number, b: number) => {
    const rad = Math.PI / 180;
    const dlat = (a - lat) * rad;
    const dlon = (b - lon) * rad;
    const h =
      Math.sin(dlat / 2) ** 2 +
      Math.cos(lat * rad) * Math.cos(a * rad) * Math.sin(dlon / 2) ** 2;
    return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
  };
  const businesses = data.elements
    .flatMap((p: any) => {
      const a = p.lat ?? p.center?.lat,
        b = p.lon ?? p.center?.lon;
      if (!Number.isFinite(a) || !Number.isFinite(b)) return [];
      return [
        {
          id: `${p.type}/${p.id}`,
          name: String(p.tags?.name ?? "Unnamed mapped business"),
          category: String(p.tags?.[mapping.key] ?? category),
          distanceMeters: distance(a, b),
          url: `https://www.openstreetmap.org/${p.type}/${p.id}`,
          lat: a,
          lon: b,
        },
      ];
    })
    .sort((a: any, b: any) => a.distanceMeters - b.distanceMeters);
  const result: LocalInsights = {
    status: "available",
    businesses,
    retrievedAt: new Date().toISOString(),
    radiusMeters: radius,
    attribution: "© OpenStreetMap contributors",
    message: businesses.length
      ? "Mapped listings are incomplete and do not measure demand, profitability, or total competition."
      : "No mapped results found. This does not mean there are no competitors.",
  };
  await CacheModel.findOneAndUpdate(
    { key },
    { $set: { value: result, expiresAt: new Date(Date.now() + 86400000) } },
    { upsert: true },
  );
  return result;
}
