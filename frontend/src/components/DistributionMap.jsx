// DistributionMap — GBIF occurrence map with a decade time-slider (Requirement 10).
// Calls the public GBIF API directly from the browser (no backend/proxy).
//
// GBIF's occurrence search does NOT match common names via `scientificName`, so we
// first resolve the common name (e.g. "Clouded Leopard") to a GBIF taxonKey via the
// species search endpoint, then query occurrences by that key.

import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const CURRENT_DECADE = Math.floor(new Date().getFullYear() / 10) * 10;
const START_DECADE = 1900;
const DECADES = [];
for (let d = START_DECADE; d <= CURRENT_DECADE; d += 10) DECADES.push(d);

// Slider index DECADES.length == "All decades" (default). 0..len-1 select a decade.
const ALL_INDEX = DECADES.length;

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`GBIF HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve a species name (common OR scientific) to a GBIF taxonKey.
 * Restricts to kingdom Animalia (highertaxonKey=1) so common-name searches
 * don't match unrelated taxa (viruses, etc.).
 * @returns {Promise<number|null>}
 */
async function resolveTaxonKey(name, timeoutMs) {
  // 1) Try the strict match endpoint first (fast path for scientific names).
  try {
    const m = await fetchWithTimeout(
      `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(name)}`,
      timeoutMs
    );
    if (m && m.matchType && m.matchType !== 'NONE' && m.usageKey) {
      return m.usageKey;
    }
  } catch {
    /* fall through to search */
  }

  // 2) Fall back to vernacular-aware species search within Animalia.
  const s = await fetchWithTimeout(
    `https://api.gbif.org/v1/species/search?q=${encodeURIComponent(name)}` +
      `&highertaxonKey=1&rank=SPECIES&qField=VERNACULAR&limit=5`,
    timeoutMs
  );
  const results = (s.results || []).filter((r) => r.nubKey || r.speciesKey || r.key);
  if (results.length === 0) return null;

  // Prefer an ACCEPTED taxon; a synonym points to the accepted taxon that
  // actually carries the occurrence records (GBIF rolls records up to it).
  const accepted = results.find((r) => r.taxonomicStatus === 'ACCEPTED');
  const chosen = accepted || results[0];
  if (chosen.taxonomicStatus === 'SYNONYM' && chosen.acceptedKey) {
    return chosen.acceptedKey;
  }
  return chosen.nubKey || chosen.speciesKey || chosen.key;
}

// Adjusts the map view to fit all occurrence points (centres on the animal's region).
function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 5);
      return;
    }
    const bounds = points.map((p) => [p.lat, p.lng]);
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 6 });
  }, [points, map]);
  return null;
}

export default function DistributionMap({ species }) {
  const [decadeIndex, setDecadeIndex] = useState(ALL_INDEX); // default: all decades
  const [status, setStatus] = useState('loading'); // loading | ok | empty | error
  const [records, setRecords] = useState([]);
  const [taxonKey, setTaxonKey] = useState(null);

  const isAll = decadeIndex === ALL_INDEX;
  const decade = isAll ? null : DECADES[decadeIndex];

  // Resolve the taxonKey whenever the species changes.
  useEffect(() => {
    let cancelled = false;
    setTaxonKey(null);
    setStatus('loading');
    setRecords([]);

    resolveTaxonKey(species, 5000)
      .then((key) => {
        if (cancelled) return;
        if (!key) {
          setStatus('empty');
          return;
        }
        setTaxonKey(key);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('GBIF taxon resolve failed:', err);
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [species]);

  // Fetch occurrences whenever the taxonKey or selected decade changes.
  useEffect(() => {
    if (!taxonKey) return;
    let cancelled = false;
    setStatus('loading');
    setRecords([]);

    const yearParam = isAll ? '' : `&year=${decade},${decade + 9}`;
    const url =
      `https://api.gbif.org/v1/occurrence/search?taxonKey=${taxonKey}` +
      `${yearParam}&hasCoordinate=true&limit=300`;

    fetchWithTimeout(url, 5000)
      .then((data) => {
        if (cancelled) return;
        const pts = (data.results || [])
          .filter(
            (r) =>
              typeof r.decimalLatitude === 'number' &&
              typeof r.decimalLongitude === 'number'
          )
          .map((r, i) => ({
            id: r.key ?? i,
            lat: r.decimalLatitude,
            lng: r.decimalLongitude,
            place: r.country || r.locality || 'Unknown location',
            year: r.year,
          }));
        setRecords(pts);
        setStatus(pts.length === 0 ? 'empty' : 'ok');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('GBIF occurrence fetch failed:', err);
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [taxonKey, decade, isAll]);

  const center = useMemo(() => {
    if (records.length === 0) return [1.35, 103.82]; // Singapore fallback
    const avgLat = records.reduce((s, r) => s + r.lat, 0) / records.length;
    const avgLng = records.reduce((s, r) => s + r.lng, 0) / records.length;
    return [avgLat, avgLng];
  }, [records]);

  return (
    <section className="section">
      <h3>Where in the world?</h3>

      <div className="slider-row">
        <span className="slider-label">{isAll ? 'All decades' : `${decade}s`}</span>
        <input
          type="range"
          min={0}
          max={ALL_INDEX}
          value={decadeIndex}
          onChange={(e) => setDecadeIndex(Number(e.target.value))}
          aria-label="Decade filter"
        />
      </div>

      {status === 'error' && <div className="map-message">Distribution data unavailable</div>}
      {status === 'empty' && (
        <div className="map-message">No recorded sightings found for this species</div>
      )}
      {status === 'loading' && <div className="map-message">Loading sightings…</div>}

      {status === 'ok' && (
        <div className="map-wrap">
          <MapContainer center={center} zoom={2} scrollWheelZoom={false}>
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds points={records} />
            {records.map((r) => (
              <CircleMarker
                key={r.id}
                center={[r.lat, r.lng]}
                radius={5}
                pathOptions={{ color: '#4a7c59', fillColor: '#6b9080', fillOpacity: 0.7 }}
              >
                <Popup>
                  {r.place}
                  {r.year ? ` (${r.year})` : ''}
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      )}
    </section>
  );
}
