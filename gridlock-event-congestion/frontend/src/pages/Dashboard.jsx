import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  TrendingDown,
  Users,
  Construction,
} from 'lucide-react';
import toast from 'react-hot-toast';

import StatCard from '../components/StatCard';
import EventForm from '../components/EventForm';
import MapView from '../components/MapView';
import ResultsPanel from '../components/ResultsPanel';
import LoadingSpinner from '../components/LoadingSpinner';
import { safeForecast } from '../services/api';

export default function Dashboard() {
  const [forecastData, setForecastData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mapClickCoords, setMapClickCoords] = useState(null);
  const [sessionCount, setSessionCount] = useState(0);

  const handleMapClick = useCallback((coords) => {
    setMapClickCoords(coords);
  }, []);

  const handleSubmit = async (payload) => {
    setLoading(true);
    try {
      const data = await safeForecast(payload);
      setForecastData(data);
      setSessionCount(prev => prev + 1);
      toast.success('Forecast generated successfully!');
    } catch (err) {
      toast.error('Forecast failed: ' + (err.message || 'Unknown error'));
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
          value={sessionCount}
          label="Forecasts Run"
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
        <div>
          <MapView
            forecastData={forecastData}
            eventCoords={mapClickCoords || { lat: 12.9716, lng: 77.5946 }}
            onMapClick={handleMapClick}
          />
        </div>
      </div>

      {/* Loading state */}
      {loading && <LoadingSpinner text="Running impact forecast model..." />}

      {/* Results */}
      <ResultsPanel data={forecastData} />
    </div>
  );
}
