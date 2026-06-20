import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

const client = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

/**
 * POST /api/forecast — Run segment-level impact forecast
 */
export async function runForecast(eventData) {
  const response = await client.post('/forecast', eventData);
  return response.data;
}

/**
 * POST /api/feedback — Submit post-event feedback
 */
export async function submitFeedback(feedbackData) {
  const response = await client.post('/feedback', feedbackData);
  return response.data;
}

/**
 * GET /api/metrics — Retrieve aggregated model accuracy
 */
export async function getMetrics() {
  const response = await client.get('/metrics');
  return response.data;
}

// ============================================
// MOCK DATA — Used when backend is unavailable
// ============================================

export const MOCK_FORECAST = {
  segments: [
    { segment_id: '4521-7832-0', road_name: 'MG Road', highway_type: 'primary', predicted_speed_degradation: 0.62, affected_radius_m: 1500, duration_min: 55, distance_m: 180 },
    { segment_id: '4521-7833-0', road_name: 'Brigade Road', highway_type: 'secondary', predicted_speed_degradation: 0.48, affected_radius_m: 1200, duration_min: 45, distance_m: 340 },
    { segment_id: '4522-7834-0', road_name: 'Church Street', highway_type: 'tertiary', predicted_speed_degradation: 0.35, affected_radius_m: 1000, duration_min: 35, distance_m: 520 },
    { segment_id: '4523-7835-0', road_name: 'Residency Road', highway_type: 'secondary', predicted_speed_degradation: 0.28, affected_radius_m: 800, duration_min: 25, distance_m: 710 },
    { segment_id: '4524-7836-0', road_name: 'Lavelle Road', highway_type: 'tertiary', predicted_speed_degradation: 0.18, affected_radius_m: 600, duration_min: 20, distance_m: 950 },
    { segment_id: '4525-7837-0', road_name: 'Kasturba Road', highway_type: 'primary', predicted_speed_degradation: 0.42, affected_radius_m: 1100, duration_min: 40, distance_m: 420 },
  ],
  manpower: {
    officer_count: 5,
    signal_override: true,
    rationale: 'Footfall 25000 mapped to 5 officers; criticality score 4 triggers signal override.',
  },
  barricade_candidates: [
    { segment_id: '4521-7840-0', road_name: 'Brigade Road Junction', highway_type: 'secondary', priority_score: 4, distance_m: 150 },
    { segment_id: '4521-7841-0', road_name: 'MG Road Metro Exit', highway_type: 'primary', priority_score: 5, distance_m: 80 },
    { segment_id: '4521-7842-0', road_name: 'Church St Entry', highway_type: 'tertiary', priority_score: 3, distance_m: 260 },
    { segment_id: '4521-7843-0', road_name: 'Residency Rd Underpass', highway_type: 'secondary', priority_score: 3, distance_m: 380 },
  ],
  diversion_routes: [
    { route_id: 'route-1', total_distance_m: 4800, detour_ratio: 1.12, capacity_score: 8, path_nodes: [100, 101, 102, 103, 104] },
    { route_id: 'route-2', total_distance_m: 5600, detour_ratio: 1.28, capacity_score: 6, path_nodes: [100, 110, 111, 112, 104] },
    { route_id: 'route-3', total_distance_m: 6200, detour_ratio: 1.41, capacity_score: 7, path_nodes: [100, 120, 121, 122, 123, 104] },
  ],
};

export const MOCK_METRICS = {
  metrics: [
    { event_type: 'Concert', records: 14, average_error: 0.0342, last_updated: '2025-06-18T10:30:00Z' },
    { event_type: 'Cricket', records: 9, average_error: 0.0285, last_updated: '2025-06-18T09:15:00Z' },
    { event_type: 'Expo', records: 6, average_error: 0.0518, last_updated: '2025-06-17T14:00:00Z' },
    { event_type: 'Political Rally', records: 4, average_error: 0.0621, last_updated: '2025-06-16T11:30:00Z' },
    { event_type: 'Unplanned', records: 3, average_error: 0.0890, last_updated: '2025-06-15T08:45:00Z' },
  ],
};

/**
 * Safe wrapper — falls back to mock data if backend unavailable
 */
export async function safeForecast(eventData) {
  try {
    return await runForecast(eventData);
  } catch {
    console.warn('Backend unavailable — using mock forecast data.');
    return MOCK_FORECAST;
  }
}

export async function safeGetMetrics() {
  try {
    return await getMetrics();
  } catch {
    console.warn('Backend unavailable — using mock metrics data.');
    return MOCK_METRICS;
  }
}

export async function safeSubmitFeedback(feedbackData) {
  try {
    return await submitFeedback(feedbackData);
  } catch {
    console.warn('Backend unavailable — feedback submission simulated.');
    return { status: 'ok', message: 'Feedback recorded (mock).' };
  }
}
