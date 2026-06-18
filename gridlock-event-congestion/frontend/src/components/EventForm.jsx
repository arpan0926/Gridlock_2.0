import { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, MapPin } from 'lucide-react';

const EVENT_TYPES = ['Concert', 'Cricket', 'Expo', 'Political Rally', 'Unplanned'];
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const PRIORITIES = ['High', 'Medium', 'Low'];
const CORRIDORS = ['MG Road', 'Outer Ring Road', 'Whitefield', 'Koramangala', 'Indiranagar', 'Jayanagar', 'Non-corridor'];

const DEFAULT_FORM = {
  event_type: 'Concert',
  expected_footfall: 25000,
  venue_capacity: 40000,
  day_of_week: 'Saturday',
  time_of_day: '18:30',
  latitude: 12.9716,
  longitude: 77.5946,
  end_latitude: '',
  end_longitude: '',
  corridor: 'MG Road',
  priority: 'High',
  event_cause: 'Concert',
};

export default function EventForm({ onSubmit, loading, mapClickCoords }) {
  const [form, setForm] = useState(DEFAULT_FORM);

  // Update lat/lng when user clicks map
  if (mapClickCoords) {
    if (
      mapClickCoords.lat !== form.latitude ||
      mapClickCoords.lng !== form.longitude
    ) {
      setForm(prev => ({
        ...prev,
        latitude: parseFloat(mapClickCoords.lat.toFixed(6)),
        longitude: parseFloat(mapClickCoords.lng.toFixed(6)),
      }));
    }
  }

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      expected_footfall: parseInt(form.expected_footfall, 10),
      venue_capacity: parseInt(form.venue_capacity, 10),
      time_of_day: form.time_of_day + ':00',
      end_latitude: form.end_latitude ? parseFloat(form.end_latitude) : null,
      end_longitude: form.end_longitude ? parseFloat(form.end_longitude) : null,
    };
    onSubmit(payload);
  };

  return (
    <motion.div
      className="card"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="card-header">
        <div className="card-title">
          <Zap /> Event Parameters
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          {/* Event Type */}
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

          {/* Day of Week */}
          <div className="form-group">
            <label className="form-label">Day of Week</label>
            <select
              className="form-select"
              value={form.day_of_week}
              onChange={e => handleChange('day_of_week', e.target.value)}
            >
              {DAYS_OF_WEEK.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Expected Footfall */}
          <div className="form-group">
            <label className="form-label">Expected Footfall</label>
            <input
              className="form-input"
              type="number"
              min={100}
              max={200000}
              value={form.expected_footfall}
              onChange={e => handleChange('expected_footfall', e.target.value)}
            />
          </div>

          {/* Venue Capacity */}
          <div className="form-group">
            <label className="form-label">Venue Capacity</label>
            <input
              className="form-input"
              type="number"
              min={100}
              max={200000}
              value={form.venue_capacity}
              onChange={e => handleChange('venue_capacity', e.target.value)}
            />
          </div>

          {/* Time */}
          <div className="form-group">
            <label className="form-label">Time of Day</label>
            <input
              className="form-input"
              type="time"
              value={form.time_of_day}
              onChange={e => handleChange('time_of_day', e.target.value)}
            />
          </div>

          {/* Priority */}
          <div className="form-group">
            <label className="form-label">Priority</label>
            <select
              className="form-select"
              value={form.priority}
              onChange={e => handleChange('priority', e.target.value)}
            >
              {PRIORITIES.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Corridor */}
          <div className="form-group">
            <label className="form-label">Corridor</label>
            <select
              className="form-select"
              value={form.corridor}
              onChange={e => handleChange('corridor', e.target.value)}
            >
              {CORRIDORS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Event Cause */}
          <div className="form-group">
            <label className="form-label">Event Cause</label>
            <select
              className="form-select"
              value={form.event_cause}
              onChange={e => handleChange('event_cause', e.target.value)}
            >
              {EVENT_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Latitude */}
          <div className="form-group">
            <label className="form-label">
              <MapPin size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              Latitude
            </label>
            <input
              className="form-input"
              type="number"
              step="0.000001"
              value={form.latitude}
              onChange={e => handleChange('latitude', parseFloat(e.target.value))}
            />
          </div>

          {/* Longitude */}
          <div className="form-group">
            <label className="form-label">
              <MapPin size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              Longitude
            </label>
            <input
              className="form-input"
              type="number"
              step="0.000001"
              value={form.longitude}
              onChange={e => handleChange('longitude', parseFloat(e.target.value))}
            />
          </div>

          {/* End Latitude (optional) */}
          <div className="form-group">
            <label className="form-label">End Latitude <span style={{ opacity: 0.5 }}>(opt)</span></label>
            <input
              className="form-input"
              type="number"
              step="0.000001"
              placeholder="12.9750"
              value={form.end_latitude}
              onChange={e => handleChange('end_latitude', e.target.value)}
            />
          </div>

          {/* End Longitude (optional) */}
          <div className="form-group">
            <label className="form-label">End Longitude <span style={{ opacity: 0.5 }}>(opt)</span></label>
            <input
              className="form-input"
              type="number"
              step="0.000001"
              placeholder="77.5950"
              value={form.end_longitude}
              onChange={e => handleChange('end_longitude', e.target.value)}
            />
          </div>

          {/* Submit */}
          <div className="form-group full-width" style={{ marginTop: 8 }}>
            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  Running Forecast…
                </>
              ) : (
                <>
                  <Zap size={16} />
                  Run Impact Forecast
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </motion.div>
  );
}
