import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageSquarePlus, Send, CheckCircle2, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { safeSubmitFeedback, safeGetFeedbackHistory } from '../services/api';

const EVENT_TYPES = ['Concert', 'Cricket', 'Expo', 'Political Rally', 'Unplanned'];

export default function Feedback() {
  const [form, setForm] = useState({
    event_id: '',
    event_type: 'Concert',
    predicted_speed_degradation: '',
    actual_speed_degradation: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Load persisted feedback history on mount
  useEffect(() => {
    (async () => {
      setHistoryLoading(true);
      const data = await safeGetFeedbackHistory(100);
      setHistory(data.history || []);
      setHistoryLoading(false);
    })();
  }, []);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.predicted_speed_degradation || !form.actual_speed_degradation) {
      toast.error('Please fill in both degradation values.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        event_id: form.event_id || null,
        event_type: form.event_type,
        predicted_speed_degradation: parseFloat(form.predicted_speed_degradation),
        actual_speed_degradation: parseFloat(form.actual_speed_degradation),
        notes: form.notes || null,
      };

      await safeSubmitFeedback(payload);
      toast.success('Feedback submitted successfully!');

      // Reset form
      setForm({
        event_id: '',
        event_type: 'Concert',
        predicted_speed_degradation: '',
        actual_speed_degradation: '',
        notes: '',
      });

      // Refresh history from DB
      const data = await safeGetFeedbackHistory(100);
      setHistory(data.history || []);
    } catch (err) {
      toast.error('Submission failed: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <motion.h2
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
        >
          Post-Event Feedback
        </motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          Log actual vs predicted congestion to improve the model over time
        </motion.p>
      </div>

      <div className="dashboard-grid">
        {/* Feedback Form */}
        <motion.div
          className="card"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="card-header">
            <div className="card-title"><MessageSquarePlus /> Submit Feedback</div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Event ID <span style={{ opacity: 0.5 }}>(optional)</span></label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="EVT-1001"
                  value={form.event_id}
                  onChange={e => handleChange('event_id', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Event Type</label>
                <select
                  className="form-select"
                  value={form.event_type}
                  onChange={e => handleChange('event_type', e.target.value)}
                >
                  {EVENT_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Predicted Degradation</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  placeholder="0.35"
                  value={form.predicted_speed_degradation}
                  onChange={e => handleChange('predicted_speed_degradation', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Actual Degradation</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  placeholder="0.32"
                  value={form.actual_speed_degradation}
                  onChange={e => handleChange('actual_speed_degradation', e.target.value)}
                />
              </div>

              <div className="form-group full-width">
                <label className="form-label">Notes <span style={{ opacity: 0.5 }}>(optional)</span></label>
                <textarea
                  className="form-textarea"
                  placeholder="Actual impact was lower due to early police deployment..."
                  value={form.notes}
                  onChange={e => handleChange('notes', e.target.value)}
                />
              </div>

              <div className="form-group full-width" style={{ marginTop: 8 }}>
                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                      Submitting…
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      Submit Feedback
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </motion.div>

        {/* Submission History — from DB */}
        <motion.div
          className="card"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="card-header">
            <div className="card-title"><CheckCircle2 /> Feedback History</div>
            <div className="card-badge badge-green">{history.length} entries</div>
          </div>

          {historyLoading ? (
            <div className="empty-state" style={{ padding: '32px' }}>
              <span className="spinner" style={{ width: 28, height: 28, borderWidth: 2 }} />
              <p>Loading feedback history…</p>
            </div>
          ) : history.length === 0 ? (
            <div className="empty-state">
              <MessageSquarePlus size={48} />
              <h3>No feedback yet</h3>
              <p>Submit your first post-event feedback to see it here. All feedback is saved to the database and persists across sessions.</p>
            </div>
          ) : (
            <div className="feedback-history-scroll">
              {history.map((entry) => (
                <div className="feedback-card" key={entry.id}>
                  <div className="feedback-card-header">
                    <span className="feedback-type">
                      {entry.event_type}
                      {entry.event_id && (
                        <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 8, fontSize: 12 }}>
                          {entry.event_id}
                        </span>
                      )}
                    </span>
                    <span className="feedback-time">
                      <Clock size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                      {new Date(entry.created_at).toLocaleString('en-IN', {
                        month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="feedback-metrics">
                    <div className="feedback-metric">
                      <span className="feedback-metric-value" style={{ color: 'var(--info)' }}>
                        {(entry.predicted_speed_degradation * 100).toFixed(0)}%
                      </span>
                      <span className="feedback-metric-label">Predicted</span>
                    </div>
                    <div className="feedback-metric">
                      <span className="feedback-metric-value" style={{ color: 'var(--accent-primary)' }}>
                        {(entry.actual_speed_degradation * 100).toFixed(0)}%
                      </span>
                      <span className="feedback-metric-label">Actual</span>
                    </div>
                    <div className="feedback-metric">
                      <span className="feedback-metric-value" style={{ color: entry.error > 0.05 ? 'var(--danger)' : 'var(--success)' }}>
                        {(entry.error * 100).toFixed(1)}%
                      </span>
                      <span className="feedback-metric-label">Error</span>
                    </div>
                  </div>
                  {entry.notes && (
                    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8, fontStyle: 'italic' }}>
                      "{entry.notes}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
