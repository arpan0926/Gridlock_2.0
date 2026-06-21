import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area,
} from 'recharts';
import { BarChart3, Database, TrendingUp, Activity } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import StatCard from '../components/StatCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { safeGetMetrics, safeGetForecastAnalytics } from '../services/api';

const COLORS = ['#06d6a0', '#3b82f6', '#f59e0b', '#f43f5e', '#8b5cf6', '#ec4899'];

export default function Analytics() {
  const { theme } = useTheme();
  const [metrics, setMetrics] = useState(null);
  const [forecastStats, setForecastStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [metricsData, analyticsData] = await Promise.all([
        safeGetMetrics(),
        safeGetForecastAnalytics(),
      ]);
      setMetrics(metricsData.metrics || []);
      setForecastStats(analyticsData);
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingSpinner text="Loading analytics..." />;

  const totalRecords = metrics.reduce((s, m) => s + m.records, 0);
  const overallAvgError =
    metrics.length > 0
      ? metrics.reduce((s, m) => s + m.average_error * m.records, 0) / Math.max(totalRecords, 1)
      : 0;

  const totalForecasts = forecastStats?.total_forecasts || 0;
  const forecastByType = forecastStats?.by_event_type || [];

  // Data for charts
  const barData = metrics.map(m => ({
    name: m.event_type,
    error: parseFloat((m.average_error * 100).toFixed(2)),
  }));

  const pieData = metrics.length > 0
    ? metrics.map(m => ({ name: m.event_type, value: m.records }))
    : forecastByType.map(f => ({ name: f.event_type, value: f.count }));

  // Forecast degradation by type for bar chart
  const forecastBarData = forecastByType.map(f => ({
    name: f.event_type,
    degradation: parseFloat(((f.avg_deg || 0) * 100).toFixed(1)),
    forecasts: f.count,
  }));

  // Trend data from recent forecasts
  const recentForecasts = forecastStats?.recent_forecasts || [];
  const trendData = recentForecasts
    .slice()
    .reverse()
    .map((f, i) => ({
      index: i + 1,
      label: new Date(f.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      degradation: parseFloat(((f.avg_degradation || 0) * 100).toFixed(1)),
      event_type: f.event_type,
    }));

  const textColor = theme === 'dark' ? '#94a3b8' : '#475569';
  const gridColor = theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: theme === 'dark' ? '#1e293b' : '#fff',
        border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
        borderRadius: 8,
        padding: '10px 14px',
        fontSize: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      }}>
        <p style={{ fontWeight: 600, marginBottom: 4, color: theme === 'dark' ? '#f1f5f9' : '#0f172a' }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color, margin: 0 }}>
            {p.name}: {p.value}{typeof p.value === 'number' ? '%' : ''}
          </p>
        ))}
      </div>
    );
  };

  const hasNoData = totalRecords === 0 && totalForecasts === 0;

  return (
    <div>
      <div className="page-header">
        <motion.h2
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
        >
          Model Analytics
        </motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          Track prediction accuracy and model performance across event types
        </motion.p>
      </div>

      {/* Summary Stats */}
      <div className="stats-grid">
        <StatCard icon={Activity} value={totalForecasts} label="Total Forecasts" color="green" delay={0} />
        <StatCard icon={Database} value={totalRecords} label="Feedback Records" color="blue" delay={0.05} />
        <StatCard icon={TrendingUp} value={totalRecords > 0 ? `${(overallAvgError * 100).toFixed(2)}%` : '—'} label="Avg Error" color={overallAvgError > 0.05 ? 'amber' : 'green'} delay={0.1} />
        <StatCard icon={BarChart3} value={forecastByType.length || metrics.length} label="Event Types" color="amber" delay={0.15} />
      </div>

      {hasNoData ? (
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="empty-state">
            <BarChart3 size={48} />
            <h3>No analytics data yet</h3>
            <p>Run forecasts from the Dashboard and submit feedback to see analytics here. All data is persisted in the database.</p>
          </div>
        </motion.div>
      ) : (
        <>
          {/* Charts Grid */}
          <div className="charts-grid">
            {/* Bar Chart — Avg Error per Event Type (if feedback exists) */}
            {barData.length > 0 && (
              <motion.div
                className="card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <div className="card-header">
                  <div className="card-title"><BarChart3 /> Prediction Error by Event Type</div>
                </div>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                      <XAxis dataKey="name" tick={{ fill: textColor, fontSize: 11 }} axisLine={{ stroke: gridColor }} tickLine={false} />
                      <YAxis tick={{ fill: textColor, fontSize: 11 }} axisLine={{ stroke: gridColor }} tickLine={false} unit="%" />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="error" name="Avg Error" radius={[6, 6, 0, 0]} maxBarSize={50}>
                        {barData.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            )}

            {/* Pie Chart — Records Distribution */}
            {pieData.length > 0 && (
              <motion.div
                className="card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <div className="card-header">
                  <div className="card-title"><Database /> {totalRecords > 0 ? 'Feedback' : 'Forecast'} Distribution</div>
                </div>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={100}
                        paddingAngle={4}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {pieData.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend
                        verticalAlign="bottom"
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 12, color: textColor }}
                      />
                      <Tooltip
                        formatter={(value, name) => [`${value} records`, name]}
                        contentStyle={{
                          background: theme === 'dark' ? '#1e293b' : '#fff',
                          border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            )}

            {/* Forecast degradation by type */}
            {forecastBarData.length > 0 && (
              <motion.div
                className="card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="card-header">
                  <div className="card-title"><TrendingUp /> Avg Degradation by Event Type</div>
                  <span className="card-badge badge-blue">{totalForecasts} forecasts</span>
                </div>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={forecastBarData} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                      <XAxis dataKey="name" tick={{ fill: textColor, fontSize: 11 }} axisLine={{ stroke: gridColor }} tickLine={false} />
                      <YAxis tick={{ fill: textColor, fontSize: 11 }} axisLine={{ stroke: gridColor }} tickLine={false} unit="%" />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="degradation" name="Avg Degradation" radius={[6, 6, 0, 0]} maxBarSize={50}>
                        {forecastBarData.map((_, index) => (
                          <Cell key={index} fill={COLORS[(index + 2) % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            )}

            {/* Area Chart — Real trend from recent forecasts */}
            {trendData.length > 1 && (
              <motion.div
                className="card"
                style={{ gridColumn: '1 / -1' }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                <div className="card-header">
                  <div className="card-title"><TrendingUp /> Forecast Degradation Trend</div>
                  <span className="card-badge badge-green">Live Data</span>
                </div>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                      <XAxis dataKey="label" tick={{ fill: textColor, fontSize: 11 }} axisLine={{ stroke: gridColor }} tickLine={false} />
                      <YAxis tick={{ fill: textColor, fontSize: 11 }} axisLine={{ stroke: gridColor }} tickLine={false} unit="%" />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="degradation"
                        name="Avg Degradation"
                        stroke="#06d6a0"
                        fill="#06d6a0"
                        fillOpacity={0.1}
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#06d6a0' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            )}
          </div>

          {/* Metrics Table */}
          {metrics.length > 0 && (
            <motion.div
              className="card"
              style={{ marginTop: 20 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
            >
              <div className="card-header">
                <div className="card-title"><Database /> Feedback Metrics Detail</div>
              </div>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Event Type</th>
                      <th>Records</th>
                      <th>Avg Error</th>
                      <th>Accuracy</th>
                      <th>Last Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.map(m => (
                      <tr key={m.event_type}>
                        <td style={{ fontWeight: 600 }}>{m.event_type}</td>
                        <td>{m.records}</td>
                        <td>
                          <span className={`degradation-chip ${m.average_error > 0.06 ? 'high' : m.average_error > 0.04 ? 'medium' : 'low'}`}>
                            {(m.average_error * 100).toFixed(2)}%
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="score-bar" style={{ width: 80 }}>
                              <div
                                className={`score-bar-fill ${(1 - m.average_error) >= 0.95 ? 'green' : 'amber'}`}
                                style={{ width: `${(1 - m.average_error) * 100}%` }}
                              />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 600 }}>
                              {((1 - m.average_error) * 100).toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                          {new Date(m.last_updated).toLocaleDateString('en-IN', {
                            year: 'numeric', month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
