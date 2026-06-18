import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area,
} from 'recharts';
import { BarChart3, Database, TrendingUp } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import StatCard from '../components/StatCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { safeGetMetrics } from '../services/api';

const COLORS = ['#06d6a0', '#3b82f6', '#f59e0b', '#f43f5e', '#8b5cf6', '#ec4899'];

export default function Analytics() {
  const { theme } = useTheme();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await safeGetMetrics();
      setMetrics(data.metrics || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingSpinner text="Loading analytics..." />;

  const totalRecords = metrics.reduce((s, m) => s + m.records, 0);
  const overallAvgError =
    metrics.length > 0
      ? metrics.reduce((s, m) => s + m.average_error * m.records, 0) / totalRecords
      : 0;

  // Data for charts
  const barData = metrics.map(m => ({
    name: m.event_type,
    error: parseFloat((m.average_error * 100).toFixed(2)),
  }));

  const pieData = metrics.map(m => ({
    name: m.event_type,
    value: m.records,
  }));

  // Simulated trend data for area chart
  const trendData = metrics.flatMap(m => {
    const base = m.average_error;
    return Array.from({ length: 6 }, (_, i) => ({
      month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][i],
      [m.event_type]: parseFloat((base * (1 + (Math.random() - 0.5) * 0.4) * 100).toFixed(2)),
    }));
  });

  // Merge trend data by month
  const mergedTrend = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map(month => {
    const entry = { month };
    trendData
      .filter(d => d.month === month)
      .forEach(d => Object.assign(entry, d));
    return entry;
  });

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
            {p.name}: {p.value}%
          </p>
        ))}
      </div>
    );
  };

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
        <StatCard icon={Database} value={totalRecords} label="Total Records" color="blue" delay={0} />
        <StatCard icon={TrendingUp} value={`${(overallAvgError * 100).toFixed(2)}%`} label="Avg Error" color={overallAvgError > 0.05 ? 'amber' : 'green'} delay={0.05} />
        <StatCard icon={BarChart3} value={metrics.length} label="Event Types" color="green" delay={0.1} />
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Bar Chart — Avg Error per Event Type */}
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

        {/* Pie Chart — Records Distribution */}
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div className="card-header">
            <div className="card-title"><Database /> Records Distribution</div>
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

        {/* Area Chart — Error Trend (simulated) */}
        <motion.div
          className="card"
          style={{ gridColumn: '1 / -1' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <div className="card-header">
            <div className="card-title"><TrendingUp /> Error Trend Over Time</div>
            <span className="card-badge badge-blue">Simulated</span>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mergedTrend} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                <XAxis dataKey="month" tick={{ fill: textColor, fontSize: 11 }} axisLine={{ stroke: gridColor }} tickLine={false} />
                <YAxis tick={{ fill: textColor, fontSize: 11 }} axisLine={{ stroke: gridColor }} tickLine={false} unit="%" />
                <Tooltip content={<CustomTooltip />} />
                {metrics.map((m, i) => (
                  <Area
                    key={m.event_type}
                    type="monotone"
                    dataKey={m.event_type}
                    stroke={COLORS[i % COLORS.length]}
                    fill={COLORS[i % COLORS.length]}
                    fillOpacity={0.08}
                    strokeWidth={2}
                    dot={{ r: 3, fill: COLORS[i % COLORS.length] }}
                  />
                ))}
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="line"
                  iconSize={14}
                  wrapperStyle={{ fontSize: 11, color: textColor }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Metrics Table */}
      <motion.div
        className="card"
        style={{ marginTop: 20 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
      >
        <div className="card-header">
          <div className="card-title"><Database /> Detailed Metrics</div>
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
    </div>
  );
}
