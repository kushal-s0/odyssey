import { config } from "../config.js";
import { CacheModel } from "../db.js";
import type { LocalInsights } from "../../../shared/types.js";
import { mapPointSchema } from "../../../shared/local-context.js";
import { geoapifyBusinesses } from "./geoapify.js";
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
  }).catch(() => {
    throw Object.assign(
      new Error(
        "The public location service is unavailable. Use a confirmed map point instead.",
      ),
      { status: 503 },
    );
  });
  if (!response.ok)
    throw Object.assign(
      new Error(
        "The public location service is unavailable. Use a confirmed map point instead.",
      ),
      { status: 503 },
    );
  const data: any = await response.json();
  if (!Array.isArray(data)) throw new Error("Invalid location response.");
  const results = data
    .map((p: any) => ({
      id: String(p.place_id),
      name: String(p.display_name),
      lat: Number(p.lat),
      lon: Number(p.lon),
    }))
    .filter((p) => mapPointSchema.safeParse(p).success);
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
  grocery: { key: "shop", value: "supermarket|convenience|general" },
  bakery: { key: "shop", value: "bakery" },
  clothing: { key: "shop", value: "clothes" },
  digital: { key: "office", value: "advertising_agency|it" },
  craft: { key: "shop", value: "craft|gift" },
};
export async function localBusinesses(
  lat: number,
  lon: number,
  category: string,
  radius = 3000,
): Promise<LocalInsights> {
  if (
    !mapPointSchema.safeParse({ lat, lon }).success ||
    !Number.isInteger(radius) ||
    radius < 500 ||
    radius > 5000
  )
    throw Object.assign(
      new Error(
        "Use valid coordinates and a search radius between 500 and 5000 meters.",
      ),
      { status: 400 },
    );
  const mapping = categories[category];
  if (!mapping) throw new Error("Choose a supported business category.");
  const key = `places-v3:${config.GEOAPIFY_API_KEY ? "managed" : "public"}:${lat}:${lon}:${category}:${radius}`;
  const cached = await CacheModel.findOne({
    key,
  }).lean();
  const snapshot = cached?.value as LocalInsights | undefined;
  const age = snapshot
    ? Date.now() - new Date(snapshot.retrievedAt).getTime()
    : Infinity;
  if (snapshot && age >= 0 && age < 86400000)
    return { ...snapshot, cached: true, stale: false };
  const managed = await geoapifyBusinesses(lat, lon, category, radius);
  if (managed) {
    await CacheModel.findOneAndUpdate(
      { key },
      {
        $set: {
          value: managed,
          expiresAt: new Date(Date.now() + 7 * 86400000),
        },
      },
      { upsert: true },
    );
    return managed;
  }
  const query = `[out:json][timeout:8];nwr(around:${radius},${lat},${lon})["${mapping.key}"~"^(${mapping.value})$"];out center tags 101;`;
  let data: any;
  let sourceEndpoint: string | undefined;
  for (const endpoint of [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
  ]) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": config.OSM_USER_AGENT,
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) continue;
      const result = await response.json();
      if (!Array.isArray(result.elements) || result.remark) continue;
      data = result;
      sourceEndpoint = endpoint;
      break;
    } catch {
      /* A bounded fallback may return a complete map response. */
    }
  }
  if (!data && snapshot && age >= 0 && age < 7 * 86400000)
    return {
      ...snapshot,
      cached: true,
      stale: true,
      message:
        "Live map services are unavailable. These older sourced listings may have changed; verify them before relying on them.",
    };
  if (!data)
    throw Object.assign(
      new Error(
        "Mapped business listings are unavailable or incomplete. Try again later.",
      ),
      { status: 503 },
    );
  const distance = (a: number, b: number) => {
    const rad = Math.PI / 180;
    const dlat = (a - lat) * rad;
    const dlon = (b - lon) * rad;
    const h =
      Math.sin(dlat / 2) ** 2 +
      Math.cos(lat * rad) * Math.cos(a * rad) * Math.sin(dlon / 2) ** 2;
    return Math.round(
      6371000 *
        2 *
        Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h))),
    );
  };
  const businesses = data.elements
    .flatMap((p: any) => {
      const a = p.lat ?? p.center?.lat,
        b = p.lon ?? p.center?.lon;
      if (
        !Number.isFinite(a) ||
        !Number.isFinite(b) ||
        Math.abs(a) > 90 ||
        Math.abs(b) > 180 ||
        !["node", "way", "relation"].includes(p.type) ||
        !Number.isSafeInteger(p.id) ||
        p.id < 1 ||
        !new RegExp(`^(${mapping.value})$`).test(
          String(p.tags?.[mapping.key] ?? ""),
        ) ||
        distance(a, b) > radius
      )
        return [];
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
    .filter(
      (p: any, index: number, all: any[]) =>
        all.findIndex((item) => item.id === p.id) === index,
    )
    .sort((a: any, b: any) => a.distanceMeters - b.distanceMeters)
    .slice(0, 100);
  const result: LocalInsights = {
    status: "available",
    businesses,
    retrievedAt: new Date().toISOString(),
    radiusMeters: radius,
    category,
    center: { lat, lon },
    sourceEndpoint,
    truncated: data.elements.length > 100,
    attribution: "© OpenStreetMap contributors",
    message: businesses.length
      ? "Category-matched mapped listings may be incomplete, duplicated or outdated. Confirm whether each is a competitor. They do not measure demand, profitability, or total competition."
      : "No mapped results found. This does not mean there are no competitors.",
  };
  await CacheModel.findOneAndUpdate(
    { key },
    { $set: { value: result, expiresAt: new Date(Date.now() + 7 * 86400000) } },
    { upsert: true },
  );
  return result;
}
