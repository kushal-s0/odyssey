import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { localBusinesses } from "../src/providers/location.js";
import { CacheModel } from "../src/db.js";
import { BUSINESS_CATEGORIES } from "../../shared/business-categories.js";
import { config } from "../src/config.js";
const original = {
  fetch: globalThis.fetch,
  find: CacheModel.findOne,
  update: CacheModel.findOneAndUpdate,
  geoapify: config.GEOAPIFY_API_KEY,
};
beforeEach(() => {
  config.GEOAPIFY_API_KEY = "";
  CacheModel.findOne = (() => ({ lean: async () => null })) as any;
  CacheModel.findOneAndUpdate = (async () => ({})) as any;
});
afterEach(() => {
  config.GEOAPIFY_API_KEY = original.geoapify;
  globalThis.fetch = original.fetch;
  CacheModel.findOne = original.find;
  CacheModel.findOneAndUpdate = original.update;
});
test("listings come only from valid nearby map features, sorted by distance with source URLs", async () => {
  globalThis.fetch = async (_url, options) => {
    const query = new URLSearchParams(String(options?.body)).get("data")!;
    assert.match(query, /around:1000,18.52,73.85/);
    return Response.json({
      elements: [
        {
          type: "node",
          id: 2,
          lat: 18.521,
          lon: 73.85,
          tags: { name: "Farther", shop: "tailor" },
        },
        {
          type: "node",
          id: 1,
          lat: 18.52,
          lon: 73.85,
          tags: { name: "Closer", shop: "tailor" },
        },
        { type: "node", id: 1, lat: 18.52, lon: 73.85, tags: {} },
        { type: "node", id: 3, lat: 20, lon: 73.85, tags: {} },
        { type: "invalid", id: 9, lat: 18.52, lon: 73.85, tags: {} },
      ],
    });
  };
  const result = await localBusinesses(18.52, 73.85, "tailoring", 1000);
  assert.deepEqual(
    result.businesses.map((b) => b.name),
    ["Closer", "Farther"],
  );
  assert.equal(
    result.businesses[0]!.url,
    "https://www.openstreetmap.org/node/1",
  );
  assert.equal(result.businesses[0]!.distanceMeters, 0);
  assert.equal(result.radiusMeters, 1000);
});
test("every selectable category has a server mapping", async () => {
  globalThis.fetch = async () => Response.json({ elements: [] });
  for (const [category] of BUSINESS_CATEGORIES)
    assert.equal(
      (await localBusinesses(18.52, 73.85, category)).status,
      "available",
    );
});
test("empty and capped results explicitly disclose incompleteness", async () => {
  globalThis.fetch = async () => Response.json({ elements: [] });
  assert.match(
    (await localBusinesses(18.52, 73.85, "food")).message,
    /does not mean/,
  );
  globalThis.fetch = async () =>
    Response.json({
      elements: Array.from({ length: 101 }, (_, i) => ({
        type: "node",
        id: i + 1,
        lat: 18.52,
        lon: 73.85,
        tags: { amenity: "restaurant" },
      })),
    });
  const capped = await localBusinesses(18.52, 73.85, "food");
  assert.equal(capped.truncated, true);
  assert.equal(capped.businesses.length, 100);
});
test("provider failures or partial responses cannot masquerade as zero competitors", async () => {
  globalThis.fetch = async () =>
    Response.json({ elements: [], remark: "query timed out" });
  await assert.rejects(
    () => localBusinesses(18.52, 73.85, "food"),
    /incomplete/,
  );
  globalThis.fetch = async () => new Response("", { status: 503 });
  await assert.rejects(
    () => localBusinesses(18.52, 73.85, "food"),
    /unavailable/,
  );
});

test("a second public endpoint can recover a failed lookup without inventing results", async () => {
  const hosts: string[] = [];
  globalThis.fetch = async (url) => {
    hosts.push(new URL(String(url)).hostname);
    if (hosts.length === 1) throw new Error("timeout");
    return Response.json({ elements: [] });
  };
  const result = await localBusinesses(18.52, 73.85, "food");
  assert.equal(result.status, "available");
  assert.deepEqual(hosts, ["overpass-api.de", "overpass.private.coffee"]);
  assert.equal(
    result.sourceEndpoint,
    "https://overpass.private.coffee/api/interpreter",
  );
});
test("old sourced cache is labelled stale when live providers fail", async () => {
  const snapshot = {
    status: "available",
    businesses: [],
    retrievedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    radiusMeters: 1000,
    center: { lat: 18.52, lon: 73.85 },
    category: "food",
    attribution: "OpenStreetMap",
    message: "Old complete response",
  };
  CacheModel.findOne = (() => ({
    lean: async () => ({ value: snapshot }),
  })) as any;
  globalThis.fetch = async () => new Response("", { status: 503 });
  const result = await localBusinesses(18.52, 73.85, "food", 1000);
  assert.equal(result.stale, true);
  assert.equal(result.cached, true);
  assert.equal(result.retrievedAt, snapshot.retrievedAt);
  assert.match(result.message, /older/);
});
test("invalid coordinates and radius are rejected before map provider requests", async () => {
  globalThis.fetch = async () => {
    throw new Error("Provider must not be called");
  };
  await assert.rejects(
    () => localBusinesses(NaN, 73.85, "food", 1000),
    /valid coordinates/,
  );
  await assert.rejects(
    () => localBusinesses(18.52, 73.85, "food", 10000),
    /radius/,
  );
});
test("managed places validate category, location, deduplication and never expose the API key", async () => {
  config.GEOAPIFY_API_KEY = "synthetic-secret-do-not-return";
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "api.geoapify.com");
    assert.equal(url.searchParams.get("filter"), "circle:73.85,18.52,1000");
    const feature = {
      type: "Feature",
      geometry: { type: "Point", coordinates: [73.85, 18.521] },
      properties: {
        place_id: "test-place",
        name: "Public example cafe",
        categories: ["catering.cafe"],
        formatted: "Public example address",
        datasource: { raw: { osm_type: "n", osm_id: 42 } },
      },
    };
    return Response.json({
      type: "FeatureCollection",
      features: [
        feature,
        feature,
        {
          ...feature,
          properties: {
            ...feature.properties,
            place_id: "wrong-category",
            categories: ["commercial.supermarket"],
          },
        },
        {
          ...feature,
          properties: { ...feature.properties, place_id: "too-far" },
          geometry: { type: "Point", coordinates: [70, 20] },
        },
      ],
    });
  };
  const result = await localBusinesses(18.52, 73.85, "food", 1000);
  assert.equal(result.businesses.length, 1);
  assert.equal(
    result.businesses[0]!.url,
    "https://www.openstreetmap.org/node/42",
  );
  assert.equal(result.businesses[0]!.provider, "geoapify");
  assert.equal(JSON.stringify(result).includes(config.GEOAPIFY_API_KEY), false);
  assert.match(result.attribution, /Geoapify/);
});
test("managed service failures fall back to public map data without returning provider errors", async () => {
  config.GEOAPIFY_API_KEY = "synthetic-key";
  let calls = 0;
  globalThis.fetch = async () =>
    ++calls === 1
      ? new Response("key-specific error", { status: 403 })
      : Response.json({ elements: [] });
  const result = await localBusinesses(18.52, 73.85, "food", 1000);
  assert.equal(result.status, "available");
  assert.equal(calls, 2);
  assert.equal(
    result.sourceEndpoint,
    "https://overpass-api.de/api/interpreter",
  );
});
