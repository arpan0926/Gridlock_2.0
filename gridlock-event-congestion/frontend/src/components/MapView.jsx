import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, useMapEvents, useMap } from 'react-leaflet';
import { useTheme } from '../context/ThemeContext';
import 'leaflet/dist/leaflet.css';

const DEFAULT_LAT = parseFloat(import.meta.env.VITE_MAP_DEFAULT_LAT) || 12.9716;
const DEFAULT_LNG = parseFloat(import.meta.env.VITE_MAP_DEFAULT_LNG) || 77.5946;
const DEFAULT_ZOOM = parseInt(import.meta.env.VITE_MAP_DEFAULT_ZOOM, 10) || 13;

/** Convert speed degradation 0..1 → color */
function degradationColor(value) {
  if (value >= 0.5) return '#f43f5e';
  if (value >= 0.3) return '#f59e0b';
  return '#10b981';
}

function degradationLabel(value) {
  if (value >= 0.5) return 'High';
  if (value >= 0.3) return 'Medium';
  return 'Low';
}

/** Click handler to update coordinates */
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

/** Fly-to when venue changes */
function FlyToCenter({ lat, lng }) {
  const map = useMap();
  const prevRef = useRef({ lat, lng });

  useEffect(() => {
    if (lat !== prevRef.current.lat || lng !== prevRef.current.lng) {
      map.flyTo([lat, lng], 14, { duration: 1.2 });
      prevRef.current = { lat, lng };
    }
  }, [lat, lng, map]);

  return null;
}

export default function MapView({ forecastData, eventCoords, onMapClick }) {
  const { theme } = useTheme();

  const tileUrl =
    theme === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

  const segments = forecastData?.segments || [];
  const barricades = forecastData?.barricade_candidates || [];

  // Simulate segment positions in a radial layout around the event venue
  const venueLat = eventCoords?.lat || DEFAULT_LAT;
  const venueLng = eventCoords?.lng || DEFAULT_LNG;

  const segmentPositions = segments.map((seg, i) => {
    const angle = (i / Math.max(segments.length, 1)) * 2 * Math.PI;
    const dist = (seg.distance_m || 300) / 111000; // rough degree offset
    return {
      ...seg,
      lat: venueLat + dist * Math.cos(angle),
      lng: venueLng + dist * Math.sin(angle),
    };
  });

  const barricadePositions = barricades.map((b, i) => {
    const angle = ((i + 0.5) / Math.max(barricades.length, 1)) * 2 * Math.PI;
    const dist = (b.distance_m || 200) / 111000;
    return {
      ...b,
      lat: venueLat + dist * Math.cos(angle),
      lng: venueLng + dist * Math.sin(angle),
    };
  });

  // Diversion routes — simulate curved paths
  const diversionRoutes = (forecastData?.diversion_routes || []).map((route, ri) => {
    const points = [];
    const numPts = route.path_nodes?.length || 5;
    const baseAngle = ((ri + 0.25) / 3) * Math.PI;
    for (let j = 0; j < numPts; j++) {
      const frac = j / (numPts - 1);
      const lat = venueLat + frac * 0.012 * Math.cos(baseAngle + frac * 0.5);
      const lng = venueLng + frac * 0.012 * Math.sin(baseAngle + frac * 0.5);
      points.push([lat, lng]);
    }
    return { ...route, points };
  });

  return (
    <div className="map-container">
      <MapContainer
        center={[DEFAULT_LAT, DEFAULT_LNG]}
        zoom={DEFAULT_ZOOM}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url={tileUrl}
        />
        <MapClickHandler onMapClick={onMapClick} />
        <FlyToCenter lat={venueLat} lng={venueLng} />

        {/* Event Venue Marker */}
        <CircleMarker
          center={[venueLat, venueLng]}
          radius={12}
          pathOptions={{
            color: '#06d6a0',
            fillColor: '#06d6a0',
            fillOpacity: 0.3,
            weight: 3,
          }}
          className="pulse-glow"
        >
          <Popup>
            <strong>Event Venue</strong>
            <br />
            {venueLat.toFixed(4)}, {venueLng.toFixed(4)}
          </Popup>
        </CircleMarker>

        {/* Segments as colored lines radiating from venue */}
        {segmentPositions.map((seg) => (
          <Polyline
            key={seg.segment_id}
            positions={[
              [venueLat, venueLng],
              [seg.lat, seg.lng],
            ]}
            pathOptions={{
              color: degradationColor(seg.predicted_speed_degradation),
              weight: 5,
              opacity: 0.8,
            }}
          >
            <Popup>
              <strong>{seg.road_name}</strong>
              <br />
              Type: {seg.highway_type}
              <br />
              Degradation: {(seg.predicted_speed_degradation * 100).toFixed(0)}% ({degradationLabel(seg.predicted_speed_degradation)})
              <br />
              Distance: {seg.distance_m?.toFixed(0)}m
            </Popup>
          </Polyline>
        ))}

        {/* Barricade Markers */}
        {barricadePositions.map((b) => (
          <CircleMarker
            key={b.segment_id}
            center={[b.lat, b.lng]}
            radius={7}
            pathOptions={{
              color: '#f59e0b',
              fillColor: '#f59e0b',
              fillOpacity: 0.6,
              weight: 2,
            }}
          >
            <Popup>
              <strong>🚧 {b.road_name}</strong>
              <br />
              Priority: {b.priority_score}/5
              <br />
              Distance: {b.distance_m?.toFixed(0)}m
            </Popup>
          </CircleMarker>
        ))}

        {/* Diversion Routes */}
        {diversionRoutes.map((route) => (
          <Polyline
            key={route.route_id}
            positions={route.points}
            pathOptions={{
              color: '#3b82f6',
              weight: 3,
              opacity: 0.7,
              dashArray: '10, 8',
            }}
          >
            <Popup>
              <strong>{route.route_id.toUpperCase()}</strong>
              <br />
              Distance: {(route.total_distance_m / 1000).toFixed(1)} km
              <br />
              Detour Ratio: {route.detour_ratio}x
              <br />
              Capacity Score: {route.capacity_score}/10
            </Popup>
          </Polyline>
        ))}
      </MapContainer>

      {/* Legend */}
      {segments.length > 0 && (
        <div className="map-legend">
          <h4>Degradation Level</h4>
          <div className="legend-items">
            <div className="legend-item">
              <div className="legend-color" style={{ background: '#10b981' }} />
              Low (&lt;30%)
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ background: '#f59e0b' }} />
              Medium (30–50%)
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ background: '#f43f5e' }} />
              High (&gt;50%)
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ background: '#3b82f6', borderStyle: 'dashed', borderWidth: 1, borderColor: '#3b82f6', height: 0 }} />
              Diversion Route
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ background: '#f59e0b', width: 10, height: 10, borderRadius: '50%' }} />
              Barricade
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
