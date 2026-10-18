// localized-ui
import { t, useLanguage } from "./i18n";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapPlace } from "../../shared/types";
export interface MapListing {
  id: string;
  name: string;
  lat: number;
  lon: number;
  manual?: boolean;
}
export default function BusinessMap({
  place,
  radius,
  listings,
  selected,
  onSelect,
  onPick,
  picking,
}: {
  place: MapPlace | null;
  radius: number;
  listings: MapListing[];
  selected: string;
  onSelect: (id: string) => void;
  onPick: (point: { lat: number; lon: number }) => void;
  picking: boolean;
}) {
  useLanguage();
  const container = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    markers = useRef(new Map<string, L.Marker>());
  const handlers = useRef({ onSelect, onPick, picking });
  handlers.current = { onSelect, onPick, picking };
  const [tileError, setTileError] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    const m = L.map(container.current, {
      scrollWheelZoom: false,
      keyboard: true,
    }).setView([22, 79], 4);
    m.attributionControl.setPrefix(false);
    map.current = m;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      referrerPolicy: "strict-origin-when-cross-origin",
    })
      .on("tileerror", () => setTileError(true))
      .addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => {
      if (handlers.current.picking)
        handlers.current.onPick({ lat: e.latlng.lat, lon: e.latlng.lng });
    });
    const observer = new ResizeObserver(() => m.invalidateSize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const m = map.current;
    if (!m || !place) return;
    const circle = L.circle([place.lat, place.lon], {
      radius,
      color: "#222",
      weight: 1,
      dashArray: "5 5",
      fillColor: "#777",
      fillOpacity: 0.06,
    }).addTo(m);
    const pin = L.marker([place.lat, place.lon], {
      title: "Confirmed business location",
      icon: L.divIcon({
        className: "map-center-pin",
        html: "<span>●</span>",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
    }).addTo(m);
    const label = document.createElement("span");
    label.textContent = place.name;
    pin.bindPopup(label);
    m.fitBounds(circle.getBounds(), { padding: [25, 25], maxZoom: 16 });
    return () => {
      circle.remove();
      pin.remove();
    };
  }, [place?.lat, place?.lon, radius]);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const group = L.layerGroup().addTo(m);
    const providerCredit = listings.some((item) =>
      item.id.startsWith("geoapify:"),
    )
      ? 'Places: <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Geoapify</a>'
      : null;
    if (providerCredit) m.attributionControl.addAttribution(providerCredit);
    markers.current.clear();
    listings.forEach((item, index) => {
      const marker = L.marker([item.lat, item.lon], {
        title: `${index + 1}. ${item.name}${item.manual ? " (assessor observation)" : ""}`,
        keyboard: true,
        icon: L.divIcon({
          className: `map-business-pin ${item.manual ? "manual" : ""}`,
          html: `<span>${index + 1}</span>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      }).addTo(group);
      const text = document.createElement("strong");
      text.textContent = item.name;
      marker.bindPopup(text);
      marker.on("click", () => handlers.current.onSelect(item.id));
      markers.current.set(item.id, marker);
    });
    return () => {
      group.remove();
      if (providerCredit)
        m.attributionControl.removeAttribution(providerCredit);
      markers.current.clear();
    };
  }, [listings]);
  useEffect(() => {
    const marker = markers.current.get(selected);
    if (marker) {
      for (const item of markers.current.values()) item.setZIndexOffset(0);
      marker.setZIndexOffset(1000);
      marker.openPopup();
      map.current?.panTo(marker.getLatLng());
    }
  }, [selected, listings]);
  return (
    <div className="business-map-wrap">
      <div
        ref={container}
        className={`business-map ${picking ? "picking" : ""}`}
        role="region"
        aria-label={t("Nearby business map")}
      />
      <p className="hint">
        {picking
          ? t(
              "Click the map to place the selected pin. You can also enter coordinates below.",
            )
          : t(
              "Pan or use + / − to zoom. Focus the map and use arrow keys to pan. Numbered pins match the list; distances are straight-line.",
            )}
      </p>
      {tileError && (
        <p role="status" className="map-warning">
          {t(
            "Some map tiles could not load. Pins and the sourced list remain available. Use “Open area in OpenStreetMap” to inspect the location.",
          )}
        </p>
      )}
    </div>
  );
}
