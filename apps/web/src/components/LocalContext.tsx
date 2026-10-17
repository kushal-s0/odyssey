import { useEffect, useState, type FormEvent } from 'react'
import { MapPin, ExternalLink } from 'lucide-react'
import { apiRequest, type Assessment } from '../api/client'
import type { components } from '../api/generated/schema'

type Insights = components['schemas']['LocationInsights']
type Settings = components['schemas']['LocationSettings']
type Candidates = components['schemas']['GeocodeResults']
export function LocalContext({ value, token }: { value: Assessment; token: string }) {
  const [result, setResult] = useState<Insights | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [candidates, setCandidates] = useState<Candidates | null>(null)
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [area, setArea] = useState('')
  const [radius, setRadius] = useState(1500)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      apiRequest<Insights>(`/v1/submissions/${value.submission_id}/location-insights`, { token, signal: controller.signal }),
      apiRequest<Settings>(`/v1/submissions/${value.submission_id}/location-settings`, { token, signal: controller.signal }),
    ]).then(([data, config]) => {
      if (controller.signal.aborted) return
      setResult(data); setSettings(config); setError('')
      setArea(data.area_label || config.declared_location?.locality || '')
      setLatitude(String(data.latitude ?? config.declared_location?.latitude ?? ''))
      setLongitude(String(data.longitude ?? config.declared_location?.longitude ?? ''))
    }).catch((e: unknown) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Location context is unavailable.') })
    return () => controller.abort()
  }, [token, value.id, value.submission_id, reload])
  async function locate() {
    if (busy) return
    setBusy(true); setError('')
    try { setCandidates(await apiRequest<Candidates>(`/v1/submissions/${value.submission_id}/geocode`, { token, method: 'POST', body: { expected_revision_id: value.input_revision_id } })) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not locate the area.') }
    finally { setBusy(false) }
  }
  async function lookup(event: FormEvent) {
    event.preventDefault(); if (busy || !confirmed || !latitude || !longitude) return
    setBusy(true); setError('')
    try { setResult(await apiRequest<Insights>(`/v1/submissions/${value.submission_id}/location-insights`, { token, method: 'POST',
      body: { expected_revision_id: value.input_revision_id, latitude: Number(latitude), longitude: Number(longitude), area_label: area, radius_m: radius, confirmed: true } })) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not retrieve nearby listings.') }
    finally { setBusy(false) }
  }
  return <section className="tool-panel"><div className="tool-heading"><MapPin size={21} /><h3>Understand the business area</h3><span className="badge">OpenStreetMap</span></div><p className="field-note">Explore mapped businesses around a confirmed coarse area. This context is kept separate from the assessment score.</p>
    {error && <p role="alert" className="form-error">{error}{!settings && <button className="text-button" onClick={() => setReload(n => n + 1)}>Retry location settings</button>}</p>}
    {settings?.supported_trade === false && <p className="empty-state">The trade needs a supported category before nearby-business lookup is available. Clarify the business type first.</p>}
    {settings?.supported_trade && <details className="location-form" open={result?.status === 'not_requested'}><summary>Confirm an area & search nearby</summary>
      {settings.geocoding_enabled && settings.declared_location?.applicant_confirmed && <><button type="button" disabled={busy} className="secondary-button" onClick={() => { void locate() }}>Locate the submitted locality</button><p className="field-note">This sends only the confirmed business locality to the configured geocoder.</p></>}
      {candidates && <div className="candidate-list">{candidates.candidates.length === 0 && <p>No matching locality found. Use approximate coordinates.</p>}{candidates.candidates.map((candidate, i) => <button className="secondary-button" key={i} onClick={() => { setLatitude(String(candidate.latitude)); setLongitude(String(candidate.longitude)); setArea(candidate.label.slice(0, 200)); setConfirmed(false) }}>{candidate.label}</button>)}</div>}
      <form onSubmit={event => { void lookup(event) }}><fieldset disabled={busy}><label>Business area<input required minLength={2} maxLength={200} value={area} onChange={e => setArea(e.target.value)} placeholder="Locality or district" /></label><div className="form-grid"><label>Approximate latitude<input required type="number" step="any" min={-90} max={90} value={latitude} onChange={e => { setLatitude(e.target.value); setConfirmed(false) }} placeholder="e.g. 12.972" /></label><label>Approximate longitude<input required type="number" step="any" min={-180} max={180} value={longitude} onChange={e => { setLongitude(e.target.value); setConfirmed(false) }} placeholder="e.g. 77.595" /></label></div>
        <label>Search radius<select value={radius} onChange={e => setRadius(Number(e.target.value))}>{[500, 1000, 1500, 3000, 5000].map(m => <option key={m} value={m}>{m / 1000} km</option>)}</select></label><label className="consent"><input required type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /><span>I confirm this is the approximate business area. Search these coordinates in OpenStreetMap.</span></label><button className="primary-link" disabled={busy || !confirmed} type="submit"><MapPin size={16} />{busy ? 'Checking mapped businesses…' : 'Search nearby businesses'}</button></fieldset></form>
    </details>}
    {result?.status === 'unavailable' && <p className="form-message">The map provider is temporarily unavailable. Your assessment is saved; try this lookup later.</p>}
    {result?.status === 'empty' && <p className="empty-state">No matching businesses were returned for this area. Sparse map coverage does not establish an absence of competition.</p>}
    {result && ['ready', 'empty'].includes(result.status) && <><p className="field-note">{result.source} · {result.area_label} · {result.radius_m ? result.radius_m / 1000 : '—'} km radius · {result.retrieved_at ? new Date(result.retrieved_at).toLocaleString() : 'Date unavailable'}{result.cached ? ' · cached results' : ''}</p>
      <div className="local-list">{(result.items || []).map(item => <a key={`${item.osm_type}:${item.osm_id}`} href={item.url} target="_blank" rel="noreferrer" className="local-business"><MapPin size={18} /><span><strong>{item.name}</strong><small>{item.category.replaceAll('_', ' ')} · approximately {item.distance_m} m away</small></span><ExternalLink size={15} /></a>)}</div></>}
    <p className="field-note"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors · ODbL</a>. {result?.note || 'Coverage may be incomplete. Listings are context and need human verification.'}</p>
  </section>
}
