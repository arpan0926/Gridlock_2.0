import { motion } from 'framer-motion';
import {
  Users,
  Construction,
  Route,
  AlertTriangle,
  Shield,
  Zap,
} from 'lucide-react';

function degradationChip(value) {
  if (value >= 0.5) return 'high';
  if (value >= 0.3) return 'medium';
  return 'low';
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export default function ResultsPanel({ data }) {
  if (!data) return null;

  const { segments, manpower, barricade_candidates, diversion_routes } = data;
  const avgDeg =
    segments.length > 0
      ? segments.reduce((s, seg) => s + seg.predicted_speed_degradation, 0) / segments.length
      : 0;

  return (
    <motion.div
      className="results-grid"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* ── Manpower Recommendation ── */}
      <motion.div className="card" variants={item}>
        <div className="card-header">
          <div className="card-title"><Users /> Manpower Deployment</div>
          <div className={`signal-badge ${manpower.signal_override ? 'active' : 'inactive'}`}>
            <Zap size={12} />
            {manpower.signal_override ? 'Signal Override' : 'Standard'}
          </div>
        </div>
        <div className="manpower-grid">
          <div className="officer-count">{manpower.officer_count}</div>
          <div className="manpower-details">
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Officers Required
            </span>
            <p className="manpower-rationale">{manpower.rationale}</p>
          </div>
        </div>
      </motion.div>

      {/* ── Segment Predictions Table ── */}
      <motion.div className="card" variants={item}>
        <div className="card-header">
          <div className="card-title"><AlertTriangle /> Segment Impact</div>
          <div className={`card-badge badge-${avgDeg >= 0.4 ? 'rose' : avgDeg >= 0.25 ? 'amber' : 'green'}`}>
            Avg {(avgDeg * 100).toFixed(0)}%
          </div>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Road</th>
                <th>Type</th>
                <th>Degradation</th>
                <th>Duration</th>
                <th>Distance</th>
              </tr>
            </thead>
            <tbody>
              {segments.map(seg => (
                <tr key={seg.segment_id}>
                  <td style={{ fontWeight: 600 }}>{seg.road_name}</td>
                  <td>
                    <span className="card-badge badge-blue" style={{ fontSize: 10 }}>
                      {seg.highway_type}
                    </span>
                  </td>
                  <td>
                    <span className={`degradation-chip ${degradationChip(seg.predicted_speed_degradation)}`}>
                      {(seg.predicted_speed_degradation * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td>{seg.duration_min} min</td>
                  <td>{seg.distance_m?.toFixed(0)} m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* ── Barricade Candidates ── */}
      <motion.div className="card" variants={item}>
        <div className="card-header">
          <div className="card-title"><Construction /> Barricade Candidates</div>
          <div className="card-badge badge-amber">{barricade_candidates.length} segments</div>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Location</th>
                <th>Type</th>
                <th>Priority</th>
                <th>Distance</th>
              </tr>
            </thead>
            <tbody>
              {barricade_candidates.map(b => (
                <tr key={b.segment_id}>
                  <td style={{ fontWeight: 600 }}>{b.road_name}</td>
                  <td>{b.highway_type}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="score-bar" style={{ width: 60 }}>
                        <div
                          className={`score-bar-fill ${b.priority_score >= 4 ? 'rose' : b.priority_score >= 3 ? 'amber' : 'green'}`}
                          style={{ width: `${(b.priority_score / 5) * 100}%` }}
                        />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{b.priority_score}/5</span>
                    </div>
                  </td>
                  <td>{b.distance_m?.toFixed(0)} m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* ── Diversion Routes ── */}
      <motion.div className="card" variants={item}>
        <div className="card-header">
          <div className="card-title"><Route /> Diversion Routes</div>
          <div className="card-badge badge-blue">{diversion_routes.length} paths</div>
        </div>

        {diversion_routes.length === 0 ? (
          <div className="empty-state" style={{ padding: 30 }}>
            <Shield size={36} />
            <h3>No diversions needed</h3>
            <p>Set end coordinates to compute alternate routes.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {diversion_routes.map(route => (
              <div className="route-card" key={route.route_id}>
                <div className="route-card-header">
                  <span className="route-id">{route.route_id.toUpperCase()}</span>
                  <div className="card-badge badge-blue">{route.path_nodes?.length || 0} nodes</div>
                </div>
                <div className="route-stats">
                  <div className="route-stat">
                    <span className="route-stat-value">{(route.total_distance_m / 1000).toFixed(1)} km</span>
                    <span className="route-stat-label">Distance</span>
                  </div>
                  <div className="route-stat">
                    <span className="route-stat-value">{route.detour_ratio}x</span>
                    <span className="route-stat-label">Detour</span>
                  </div>
                  <div className="route-stat">
                    <span className="route-stat-value">{route.capacity_score}/10</span>
                    <span className="route-stat-label">Capacity</span>
                  </div>
                </div>
                <div className="score-bar" style={{ marginTop: 12 }}>
                  <div
                    className={`score-bar-fill ${route.capacity_score >= 7 ? 'green' : route.capacity_score >= 4 ? 'amber' : 'rose'}`}
                    style={{ width: `${route.capacity_score * 10}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
