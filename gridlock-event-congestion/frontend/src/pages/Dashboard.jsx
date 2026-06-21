import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  TrendingDown,
  Users,
  Construction,
  History,
  Clock,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

import StatCard from '../components/StatCard';
import EventForm from '../components/EventForm';
import MapView from '../components/MapView';
import ResultsPanel from '../components/ResultsPanel';
import LoadingSpinner from '../components/LoadingSpinner';
import { safeForecast, safeGetForecasts, safeGetForecastById } from '../services/api';

export default function Dashboard() {
  const [forecastData, setForecastData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mapClickCoords, setMapClickCoords] = useState(null);
  const [recentForecasts, setRecentForecasts] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Load forecast history on mount
  useEffect(() => {
    (async () => {
      setHistoryLoading(true);
      const data = await safeGetForecasts(20);
      const list = data.forecasts || [];
      setRecentForecasts(list);

      // Auto-restore latest forecast
      if (list.length > 0 && !forecastData) {
        const latest = await safeGetForecastById(list[0].id);
        if (latest?.full_response) {
          setForecastData(latest.full_response);
        }
      }
      setHistoryLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMapClick = useCallback((coords) => {
    setMapClickCoords(coords);
  }, []);

  const handleSubmit = async (payload) => {
    setLoading(true);
    try {
      const data = await safeForecast(payload);
      setForecastData(data);
      toast.success('Forecast generated successfully!');

      // Refresh history
      const hist = await safeGetForecasts(20);
      setRecentForecasts(hist.forecasts || []);
    } catch (err) {
      toast.error('Forecast failed: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleLoadForecast = async (id) => {
    setLoading(true);
    try {
      const result = await safeGetForecastById(id);
      if (result?.full_response) {
        setForecastData(result.full_response);
        toast.success('Forecast restored!');
      }
    } catch {
      toast.error('Failed to load forecast.');
    } finally {
      setLoading(false);
    }
  };

  // Compute stats from forecast
  const avgDeg =
    forecastData?.segments?.length > 0
      ? forecastData.segments.reduce((s, seg) => s + seg.predicted_speed_degradation, 0) / forecastData.segments.length
      : 0;

  return (
    <div>
      <div className="page-header">
        <motion.h2
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          Impact Dashboard
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          Forecast segment-level congestion and generate operational recommendations
        </motion.p>
      </div>

      {/* Stats Bar */}
      <div className="stats-grid">
        <StatCard
          icon={Activity}
          value={recentForecasts.length}
          label="Total Forecasts"
          color="green"
          delay={0}
        />
        <StatCard
          icon={TrendingDown}
          value={forecastData ? `${(avgDeg * 100).toFixed(0)}%` : '—'}
          label="Avg Degradation"
          color={avgDeg >= 0.4 ? 'rose' : avgDeg >= 0.25 ? 'amber' : 'green'}
          delay={0.05}
        />
        <StatCard
          icon={Users}
          value={forecastData?.manpower?.officer_count ?? '—'}
          label="Officers Required"
          color="blue"
          delay={0.1}
        />
        <StatCard
          icon={Construction}
          value={forecastData?.barricade_candidates?.length ?? '—'}
          label="Barricade Points"
          color="amber"
          delay={0.15}
        />
      </div>

      {/* Main Grid: Form + Map */}
      <div className="dashboard-grid">
        <EventForm
          onSubmit={handleSubmit}
          loading={loading}
          mapClickCoords={mapClickCoords}
        />
        <div className="dashboard-right">
          <MapView
            forecastData={forecastData}
            eventCoords={mapClickCoords || { lat: 12.9716, lng: 77.5946 }}
            onMapClick={handleMapClick}
          />

          {/* Recent Forecasts History */}
          <motion.div
            className="card forecast-history-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="card-header">
              <div className="card-title"><History /> Recent Forecasts</div>
              <div className="card-badge badge-green">{recentForecasts.length} runs</div>
            </div>

            {historyLoading ? (
              <div className="empty-state" style={{ padding: '24px' }}>
                <span className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
                <p>Loading history…</p>
              </div>
            ) : recentForecasts.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px' }}>
                <Activity size={32} />
                <p>No forecasts yet. Run your first forecast above!</p>
              </div>
            ) : (
              <div className="history-list">
                {recentForecasts.slice(0, 8).map((fc) => (
                  <button
                    key={fc.id}
                    className="history-item"
                    onClick={() => handleLoadForecast(fc.id)}
                  >
                    <div className="history-item-info">
                      <span className="history-item-type">{fc.event_type}</span>
                      <span className="history-item-meta">
                        <Clock size={11} />
                        {new Date(fc.created_at).toLocaleString('en-IN', {
                          month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="history-item-stats">
                      <span className={`degradation-chip ${fc.avg_degradation >= 0.4 ? 'high' : fc.avg_degradation >= 0.25 ? 'medium' : 'low'}`}>
                        {(fc.avg_degradation * 100).toFixed(0)}%
                      </span>
                      <span className="history-item-details">
                        {fc.segment_count} seg · {fc.officer_count} officers
                      </span>
                      <ChevronRight size={14} className="history-chevron" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Loading state */}
      {loading && <LoadingSpinner text="Running impact forecast model..." />}

      {/* Unplanned Event Notice */}
      <AnimatePresence>
        {forecastData && forecastData.manpower?.rationale?.includes('unplanned') && (
          <motion.div
            className="card"
            style={{
              borderLeft: '4px solid #f59e0b',
              backgroundColor: 'rgba(245, 158, 11, 0.05)',
              marginTop: 16,
            }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '14px' }}>
              ⚠️ <strong>Unplanned Event:</strong> This forecast is for an unexpected/spontaneous event. Predictions may be less accurate; prioritize real-time monitoring and rapid response coordination.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <ResultsPanel data={forecastData} />
    </div>
  );
}
