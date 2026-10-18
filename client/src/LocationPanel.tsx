import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, MapPin, Save, Trash2 } from "lucide-react";
import type {
  LocalInsights,
  MapPlace,
  SavedLocalContext,
} from "../../shared/types";
import { BUSINESS_CATEGORIES } from "../../shared/business-categories";
import {
  distanceMeters,
  localObservationSchema,
  mapPointSchema,
} from "../../shared/local-context";
import { api, download } from "./api";
import { Notice } from "./components";
const BusinessMap = lazy(() => import("./BusinessMap"));
const empty: SavedLocalContext = {
  place: null,
  category: "",
  radius: 3000,
  observations: [],
  revision: 0,
};
export default function LocationPanel({
  example,
  location,
  submissionId,
}: {
  example: boolean;
  location: string;
  submissionId: string;
}) {
  const [query, setQuery] = useState(location),
    [locations, setLocations] = useState<(MapPlace & { id: string })[]>([]),
    [selected, setSelected] = useState(""),
    [place, setPlace] = useState<MapPlace | null>(null),
    [category, setCategory] = useState(""),
    [radius, setRadius] = useState(3000),
    [result, setResult] = useState<LocalInsights | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [pending, setPending] = useState(false),
    [loading, setLoading] = useState(!example),
    [saved, setSaved] = useState<SavedLocalContext>(empty),
    [selectedBusiness, setSelectedBusiness] = useState(""),
    [pick, setPick] = useState<"center" | "observation" | null>(null),
    [lat, setLat] = useState(""),
    [lon, setLon] = useState(""),
    [showManual, setShowManual] = useState(false);
  const [observation, setObservation] = useState({
    name: "",
    sourceUrl: "",
    note: "",
    checked: false,
    lat: "",
    lon: "",
  });
  useEffect(() => {
    let active = true;
    if (example) return;
    api<{ context: SavedLocalContext }>(
      `/submissions/${submissionId}/local-context`,
    )
      .then((r) => {
        if (!active) return;
        const c = r.context ?? empty;
        setSaved(c);
        if (c.place) {
          setPlace(c.place);
          setQuery(c.place.name);
          setCategory(c.category);
          setRadius(c.radius);
          setLat(String(c.place.lat));
          setLon(String(c.place.lon));
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [submissionId, example]);
  const observations = useMemo(
    () =>
      saved.observations.filter(
        (o) =>
          place &&
          o.category === category &&
          distanceMeters(place, o) <= radius,
      ),
    [saved.observations, place, category, radius],
  );
  const listings = useMemo(
    () => [
      ...(result?.businesses ?? []),
      ...observations.map((o) => ({
        ...o,
        id: `manual:${o.id}`,
        manual: true,
      })),
    ],
    [result, observations],
  );
  const changed =
    !saved.place ||
    !place ||
    saved.place.lat !== place.lat ||
    saved.place.lon !== place.lon ||
    saved.place.name !== place.name ||
    saved.radius !== radius ||
    saved.category !== category;
  function clearResult() {
    setResult(null);
    setSelectedBusiness("");
    setError("");
    setNotice("");
  }
  function confirm(p: MapPlace) {
    setPlace(p);
    setLat(String(p.lat));
    setLon(String(p.lon));
    setPick(null);
    clearResult();
  }
  async function saveContext() {
    if (!place || !category)
      throw new Error("Confirm a location and category first.");
    const r = await api<{ context: SavedLocalContext }>(
      `/submissions/${submissionId}/local-context`,
      {
        method: "POST",
        body: JSON.stringify({
          place,
          category,
          radius,
          revision: saved.revision,
        }),
      },
    );
    setSaved(r.context);
    return r.context;
  }
  async function run(fn: () => Promise<void>) {
    setPending(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="panel location-panel">
      <div className="panel-heading">
        <div>
          <h2>
            <MapPin size={17} /> Local business context
          </h2>
          <p>
            Confirm the operating location, inspect mapped businesses and record
            sourced observations.
          </p>
        </div>
      </div>
      <div className="location-body">
        <Notice>
          Mapped listings can be incomplete or outdated. A category match is not
          necessarily a competitor; no results do not mean no competition.
        </Notice>
        {loading && <p role="status">Loading saved local context…</p>}
        <label>
          Business location
          <div className="input-button">
            <input
              value={query}
              aria-label="Business location"
              disabled={pending || loading}
              onChange={(e) => {
                setQuery(e.target.value);
                setLocations([]);
                setSelected("");
                setPlace(null);
                clearResult();
              }}
              placeholder="Village, district and state"
            />
            <button
              className="button secondary"
              disabled={
                example || pending || loading || query.trim().length < 3
              }
              onClick={() =>
                void run(async () => {
                  clearResult();
                  setPlace(null);
                  setLocations([]);
                  setSelected("");
                  const r = await api<{ locations: typeof locations }>(
                    `/locations/search?q=${encodeURIComponent(query)}`,
                  );
                  setLocations(r.locations);
                  if (!r.locations.length)
                    throw new Error(
                      "No matching location. Include the district/state or enter a confirmed point below.",
                    );
                })
              }
            >
              Find location
            </button>
          </div>
        </label>
        {locations.length > 0 && (
          <label>
            Confirm the correct location
            <select
              value={selected}
              disabled={pending}
              onChange={(e) => {
                setSelected(e.target.value);
                const p = locations.find((l) => l.id === e.target.value);
                if (p) confirm(p);
                else {
                  setPlace(null);
                  clearResult();
                }
              }}
            >
              <option value="">Choose the correct place</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <details className="coordinate-controls">
          <summary>Use a confirmed map point instead</summary>
          <p className="hint">
            Use this when the place name is ambiguous or the geocoder is
            unavailable. Confirm coordinates with the beneficiary or source.
          </p>
          <div className="form-grid">
            <label>
              Location latitude
              <input
                type="number"
                min={-85}
                max={85}
                step="any"
                value={lat}
                disabled={pending}
                onChange={(e) => setLat(e.target.value)}
              />
            </label>
            <label>
              Location longitude
              <input
                type="number"
                min={-180}
                max={180}
                step="any"
                value={lon}
                disabled={pending}
                onChange={(e) => setLon(e.target.value)}
              />
            </label>
          </div>
          <div className="toolbar-actions">
            <button
              className="button secondary small"
              disabled={pending || example}
              onClick={() => {
                setPick(pick === "center" ? null : "center");
              }}
            >
              {" "}
              {pick === "center"
                ? "Cancel location pin"
                : "Place location pin on map"}
            </button>
            <button
              className="button secondary small"
              disabled={pending || example}
              onClick={() => {
                const p = mapPointSchema.safeParse({
                  lat: lat.trim() ? Number(lat) : NaN,
                  lon: lon.trim() ? Number(lon) : NaN,
                });
                if (!p.success || query.trim().length < 3) {
                  setError("Enter a place label and valid latitude/longitude.");
                  return;
                }
                confirm({ ...p.data, name: query.trim() });
              }}
            >
              Confirm coordinates
            </button>
          </div>
        </details>
        <div className="form-grid">
          <label>
            Business category
            <select
              value={category}
              disabled={pending || loading}
              onChange={(e) => {
                setCategory(e.target.value);
                clearResult();
              }}
            >
              <option value="">Choose the closest category</option>
              {BUSINESS_CATEGORIES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            Search radius
            <select
              value={radius}
              disabled={pending || loading}
              onChange={(e) => {
                setRadius(Number(e.target.value));
                clearResult();
              }}
            >
              <option value={1000}>1 km</option>
              <option value={3000}>3 km</option>
              <option value={5000}>5 km</option>
            </select>
          </label>
        </div>
        {place && (
          <p className="confirmed-place">
            <strong>Confirmed location:</strong> {place.name} ·{" "}
            {place.lat.toFixed(5)}, {place.lon.toFixed(5)}
          </p>
        )}
        <div className="toolbar-actions">
          <button
            className="button primary"
            disabled={example || pending || loading || !place || !category}
            onClick={() =>
              void run(async () => {
                setResult(null);
                setSelectedBusiness("");
                if (changed) await saveContext();
                const r = await api<LocalInsights>("/locations/businesses", {
                  method: "POST",
                  body: JSON.stringify({
                    lat: place!.lat,
                    lon: place!.lon,
                    category,
                    radius,
                  }),
                });
                setResult(r);
              })
            }
          >
            {pending ? (
              <Loader2 size={15} className="spin" />
            ) : (
              <MapPin size={15} />
            )}
            Look up mapped businesses
          </button>
          <button
            className="button secondary"
            disabled={
              example || pending || loading || !place || !category || !changed
            }
            onClick={() =>
              void run(async () => {
                await saveContext();
                setNotice("Confirmed location and search settings saved.");
              })
            }
          >
            <Save size={14} /> Save location
          </button>
        </div>
        {error && <Notice type="error">{error}</Notice>}
        {notice && <p role="status">{notice}</p>}
        {example ? (
          <p className="hint">
            Live maps and lookup are available in your connected workspace. No
            listings are invented for examples.
          </p>
        ) : (
          <Suspense fallback={<p role="status">Loading interactive map…</p>}>
            <BusinessMap
              place={place}
              radius={radius}
              listings={listings}
              selected={selectedBusiness}
              onSelect={setSelectedBusiness}
              picking={pick !== null}
              onPick={(p) => {
                if (pick === "center") {
                  if (query.trim().length < 3) {
                    setError("Enter a location label first.");
                    return;
                  }
                  confirm({ ...p, name: query.trim() });
                } else {
                  setObservation((o) => ({
                    ...o,
                    lat: p.lat.toFixed(6),
                    lon: p.lon.toFixed(6),
                  }));
                  setPick(null);
                }
              }}
            />
          </Suspense>
        )}
        {place && (
          <a
            className="text-link"
            href={`https://www.openstreetmap.org/#map=15/${place.lat}/${place.lon}`}
            target="_blank"
            rel="noreferrer"
          >
            Open area in OpenStreetMap <ExternalLink size={13} />
          </a>
        )}
        {result && (
          <div className="local-results">
            <h3>
              {result.businesses.length}
              {result.truncated ? "+" : ""} mapped listings within{" "}
              {(result.radiusMeters / 1000).toFixed(0)} km
            </h3>
            <p>{result.message}</p>
            {result.stale && (
              <Notice>
                Live lookup failed. These are older cached listings from the
                date below; verify them before relying on them.
              </Notice>
            )}
            {result.truncated && (
              <p>
                Results are capped at 100 and may omit nearer businesses. Narrow
                the radius.
              </p>
            )}
            {result.businesses.map((b, index) => (
              <article
                className={`business-listing ${selectedBusiness === b.id ? "selected" : ""}`}
                key={b.id}
              >
                <button
                  className="map-list-select"
                  onClick={() => setSelectedBusiness(b.id)}
                  aria-label={`Show ${b.name} on map`}
                >
                  <span className="listing-number">{index + 1}</span>
                  <span>
                    <strong>{b.name}</strong>
                    <small>
                      {b.category} · {(b.distanceMeters / 1000).toFixed(2)} km
                      straight-line
                    </small>
                  </span>
                </button>
                <a
                  href={b.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Source: ${b.name}`}
                >
                  {b.sourceLabel ?? "Source"} <ExternalLink size={12} />
                </a>
              </article>
            ))}
            <small>
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
              >
                {result.attribution}
              </a>{" "}
              {result.sourceEndpoint?.includes("geoapify") && (
                <>
                  <a
                    href="https://www.geoapify.com/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Powered by Geoapify
                  </a>
                  {" · "}
                </>
              )}
              · Retrieved {new Date(result.retrievedAt).toLocaleString("en-IN")}{" "}
              {result.cached ? "· cached" : ""}
            </small>
          </div>
        )}
        <section className="local-observations">
          <div className="panel-heading">
            <div>
              <h3>Assessor observations</h3>
              <p>
                Separately sourced local context. These entries are manual and
                do not change the financial risk score.
              </p>
            </div>
          </div>
          {observations.length > 0 && (
            <ul className="observation-list">
              {observations.map((o, index) => (
                <li key={o.id}>
                  <button
                    className="map-list-select"
                    onClick={() => setSelectedBusiness(`manual:${o.id}`)}
                  >
                    <span className="listing-number">
                      {(result?.businesses.length ?? 0) + index + 1}
                    </span>
                    <strong>{o.name}</strong>
                  </button>
                  <p>{o.note}</p>
                  <small>
                    {o.checked
                      ? "Source checked by assessor"
                      : "Reported; needs checking"}{" "}
                    · {(distanceMeters(place!, o) / 1000).toFixed(2)} km ·{" "}
                    {new Date(o.recordedAt).toLocaleDateString("en-IN")}
                  </small>
                  <div className="toolbar-actions">
                    <a
                      className="text-link"
                      href={o.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Observation source <ExternalLink size={12} />
                    </a>
                    <button
                      className="button text small"
                      disabled={pending}
                      aria-label={`Remove observation ${o.name}`}
                      onClick={() =>
                        void run(async () => {
                          const r = await api<{ context: SavedLocalContext }>(
                            `/submissions/${submissionId}/local-context/observations/${o.id}`,
                            { method: "DELETE" },
                          );
                          setSaved(r.context);
                        })
                      }
                    >
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {!observations.length && (
            <p className="hint">
              No saved observations match the selected category and radius. This
              says nothing about how many competitors exist.
            </p>
          )}
          <button
            className="button secondary small"
            disabled={example || pending || !place || !category}
            onClick={() => setShowManual(!showManual)}
          >
            {showManual
              ? "Close observation form"
              : "Add sourced local observation"}
          </button>
          {showManual && (
            <form
              className="observation-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const parsed = localObservationSchema.safeParse({
                    ...observation,
                    category,
                    lat: observation.lat.trim() ? Number(observation.lat) : NaN,
                    lon: observation.lon.trim() ? Number(observation.lon) : NaN,
                  });
                  if (!parsed.success)
                    throw new Error(
                      parsed.error.issues.map((i) => i.message).join(" "),
                    );
                  if (!place || distanceMeters(place, parsed.data) > radius)
                    throw new Error(
                      "Place the observed business inside the selected search radius.",
                    );
                  if (changed) await saveContext();
                  const r = await api<{ context: SavedLocalContext }>(
                    `/submissions/${submissionId}/local-context/observations`,
                    { method: "POST", body: JSON.stringify(parsed.data) },
                  );
                  setSaved(r.context);
                  setShowManual(false);
                  setObservation({
                    name: "",
                    sourceUrl: "",
                    note: "",
                    checked: false,
                    lat: "",
                    lon: "",
                  });
                  setNotice("Manual observation saved with its source.");
                });
              }}
            >
              <label>
                Observed business name
                <input
                  required
                  minLength={2}
                  maxLength={160}
                  disabled={pending}
                  value={observation.name}
                  onChange={(e) =>
                    setObservation((o) => ({ ...o, name: e.target.value }))
                  }
                />
              </label>
              <label>
                Public source URL
                <input
                  required
                  type="url"
                  maxLength={1000}
                  disabled={pending}
                  value={observation.sourceUrl}
                  onChange={(e) =>
                    setObservation((o) => ({ ...o, sourceUrl: e.target.value }))
                  }
                />
              </label>
              <label>
                What was observed?
                <textarea
                  required
                  minLength={10}
                  maxLength={1000}
                  disabled={pending}
                  value={observation.note}
                  onChange={(e) =>
                    setObservation((o) => ({ ...o, note: e.target.value }))
                  }
                />
              </label>
              <div className="form-grid">
                <label>
                  Observed business latitude
                  <input
                    required
                    type="number"
                    step="any"
                    min={-85}
                    max={85}
                    disabled={pending}
                    value={observation.lat}
                    onChange={(e) =>
                      setObservation((o) => ({ ...o, lat: e.target.value }))
                    }
                  />
                </label>
                <label>
                  Observed business longitude
                  <input
                    required
                    type="number"
                    step="any"
                    min={-180}
                    max={180}
                    disabled={pending}
                    value={observation.lon}
                    onChange={(e) =>
                      setObservation((o) => ({ ...o, lon: e.target.value }))
                    }
                  />
                </label>
              </div>
              <button
                type="button"
                className="button secondary small"
                disabled={pending}
                onClick={() =>
                  setPick(pick === "observation" ? null : "observation")
                }
              >
                {pick === "observation"
                  ? "Cancel observation pin"
                  : "Place observation pin on map"}
              </button>
              <label className="check-line">
                <input
                  type="checkbox"
                  disabled={pending}
                  checked={observation.checked}
                  onChange={(e) =>
                    setObservation((o) => ({ ...o, checked: e.target.checked }))
                  }
                />
                I checked this source; its business claims may still need
                validation.
              </label>
              <button className="button primary" disabled={pending}>
                Save manual observation
              </button>
            </form>
          )}
        </section>
        {(result || observations.length > 0) && (
          <button
            className="button secondary small"
            onClick={() =>
              download(
                "local-business-context.json",
                JSON.stringify(
                  {
                    place,
                    category,
                    radius,
                    mapped: result,
                    manualObservations: observations,
                  },
                  null,
                  2,
                ),
                "application/json",
              )
            }
          >
            Download sourced local context
          </button>
        )}
      </div>
    </section>
  );
}
