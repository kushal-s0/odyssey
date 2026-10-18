import { config } from "../config.js";
import {
  distanceMeters,
  mapPointSchema,
} from "../../../shared/local-context.js";
import type { LocalBusiness, LocalInsights } from "../../../shared/types.js";
const categories: Record<string, string[]> = {
  tailoring: ["service.tailor"],
  food: ["catering.restaurant", "catering.cafe", "catering.fast_food"],
  dairy: ["commercial.food_and_drink.cheese_and_dairy"],
  beauty: ["service.beauty"],
  repair: ["commercial.elektronics"],
  agriculture: ["commercial.agrarian"],
  poultry: [
    "commercial.food_and_drink.butcher",
    "commercial.food_and_drink.farm",
  ],
  grocery: ["commercial.supermarket", "commercial.convenience"],
  bakery: ["commercial.food_and_drink.bakery"],
  clothing: ["commercial.clothing"],
  digital: ["office.advertising_agency", "office.it"],
  craft: ["commercial.gift_and_souvenir", "commercial.hobby.art"],
};
const endpoint = "https://api.geoapify.com/v2/places";
export async function geoapifyBusinesses(
  lat: number,
  lon: number,
  category: string,
  radius: number,
): Promise<LocalInsights | null> {
  const wanted = categories[category];
  if (!config.GEOAPIFY_API_KEY || !wanted) return null;
  const url = new URL(endpoint);
  url.search = new URLSearchParams({
    apiKey: config.GEOAPIFY_API_KEY,
    categories: wanted.join(","),
    filter: `circle:${lon},${lat},${radius}`,
    bias: `proximity:${lon},${lat}`,
    limit: "101",
    lang: "en",
  }).toString();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return null;
    const data = await response.json();
    if (
      data.type !== "FeatureCollection" ||
      !Array.isArray(data.features) ||
      data.error
    )
      return null;
    const businesses: LocalBusiness[] = data.features
      .flatMap((feature: any) => {
        const p = feature.properties,
          coordinates = feature.geometry?.coordinates;
        if (
          !p ||
          feature.geometry?.type !== "Point" ||
          !Array.isArray(coordinates) ||
          coordinates.length < 2
        )
          return [];
        const point = { lat: coordinates[1], lon: coordinates[0] };
        const match = Array.isArray(p.categories)
          ? p.categories.find(
              (c: unknown) =>
                typeof c === "string" &&
                wanted.some((w) => c === w || c.startsWith(w + ".")),
            )
          : null;
        if (
          !mapPointSchema.safeParse(point).success ||
          distanceMeters({ lat, lon }, point) > radius ||
          !match ||
          typeof p.place_id !== "string" ||
          !p.place_id ||
          p.place_id.length > 400
        )
          return [];
        const raw = p.datasource?.raw ?? {},
          osmType = (
            {
              n: "node",
              w: "way",
              r: "relation",
              node: "node",
              way: "way",
              relation: "relation",
            } as Record<string, string>
          )[String(raw.osm_type ?? p.osm_type)];
        const osmId = Number(raw.osm_id ?? p.osm_id),
          source = !!osmType && Number.isSafeInteger(osmId) && osmId > 0;
        return [
          {
            id: `geoapify:${p.place_id}`,
            name: String(
              p.name ?? p.address_line1 ?? "Unnamed mapped business",
            ).slice(0, 300),
            category: match,
            distanceMeters: distanceMeters({ lat, lon }, point),
            url: source
              ? `https://www.openstreetmap.org/${osmType}/${osmId}`
              : `https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lon}#map=18/${point.lat}/${point.lon}`,
            ...point,
            provider: "geoapify" as const,
            providerPlaceId: p.place_id,
            address:
              typeof p.formatted === "string"
                ? p.formatted.slice(0, 500)
                : undefined,
            sourceLabel: source
              ? "OpenStreetMap source record"
              : "Geoapify result · view location",
          },
        ];
      })
      .filter(
        (item: LocalBusiness, index: number, all: LocalBusiness[]) =>
          all.findIndex((p) => p.id === item.id) === index,
      )
      .sort(
        (a: LocalBusiness, b: LocalBusiness) =>
          a.distanceMeters - b.distanceMeters,
      )
      .slice(0, 100);
    if (data.features.length > 0 && businesses.length === 0) return null;
    return {
      status: "available",
      businesses,
      retrievedAt: new Date().toISOString(),
      radiusMeters: radius,
      category,
      center: { lat, lon },
      sourceEndpoint: endpoint,
      truncated: data.features.length > 100,
      attribution: "© OpenStreetMap contributors · Geoapify",
      message: businesses.length
        ? "Category-matched results supplied by Geoapify. Verify each business and whether it competes with the proposal; map coverage is not exhaustive."
        : "No mapped results found for this category and radius. This does not mean there are no competitors.",
    };
  } catch {
    return null;
  }
}
