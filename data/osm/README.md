# Dated regional OpenStreetMap context

`bengaluru-tea.json` is a small real public Overpass extraction near central Bengaluru (coarse centre 12.972, 77.595; 1500m query radius). It was retrieved with `scripts/capture_osm_snapshot.py --provider coffee`; the JSON records the actual UTC retrieval time, upstream endpoint and scope. No applicant data, names, contact details or submissions were sent to the provider. Business listing names/IDs are public OSM data.

**Attribution: © OpenStreetMap contributors.** Data is available under the [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/); see [OpenStreetMap copyright](https://www.openstreetmap.org/copyright). Preserve this attribution and provenance when sharing an extract or derived database. This is third-party data, not original field research or a complete business directory.

The snapshot contains at most thirty bounded returned cafe/tea listings. It is not complete competition coverage. The app uses it only when a live provider fails, the requested trade matches, and the entire requested search circle fits within this snapshot's recorded area. Other locations receive an honest unavailable state. Snapshot results retain their original retrieval date and explicitly say they are offline, rather than appearing to be a fresh lookup.

The initial public POST verification failed with a server error. The documented GET interface at Private.coffee succeeded; this is now the configured default, which operators can change without rebuilding the app. Public Nominatim geocoding remains separately opt-in and is not used to build this snapshot.
