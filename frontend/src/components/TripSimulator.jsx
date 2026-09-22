import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Square, Activity, Gauge } from 'lucide-react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8080/api`;

export function TripSimulator({ onStatusChange }) {
  const [isDriving,    setIsDriving]    = useState(false);
  const [roughness,    setRoughness]    = useState(0.2);   // 0.0 – 1.0
  const [tripId,       setTripId]       = useState(null);
  const [currentAccel, setCurrentAccel] = useState(9.8);

  const timerRef = useRef(null);
  const posRef   = useRef({ lat: 40.7128, lng: -74.006 });

  const isAnomaly = Math.abs(currentAccel - 9.8) > 2;

  const startTrip = () => {
    const id = `trip_${Date.now()}`;
    setTripId(id);
    setIsDriving(true);
    onStatusChange(true);

    posRef.current = {
      lat: 40.7128 + (Math.random() - 0.5) * 0.05,
      lng: -74.006  + (Math.random() - 0.5) * 0.05,
    };

    timerRef.current = setInterval(() => {
      posRef.current = {
        lat: posRef.current.lat + 0.0002,
        lng: posRef.current.lng + 0.0003,
      };

      const noise = (Math.random() - 0.5) * 4 * roughness;
      const bump  = Math.random() > 0.95 ? (Math.random() > 0.5 ? 5 : -5) * roughness : 0;
      const zAccel = 9.8 + noise + bump;
      setCurrentAccel(zAccel);

      axios.post(`${API_BASE}/telemetry`, {
        tripId:    id,
        latitude:  posRef.current.lat,
        longitude: posRef.current.lng,
        zAccel,
      }).catch(err => console.warn('Telemetry sync failed:', err.message));
    }, 500);
  };

  const stopTrip = () => {
    clearInterval(timerRef.current);
    setIsDriving(false);
    onStatusChange(false);
  };

  // Clean up interval on unmount
  useEffect(() => () => clearInterval(timerRef.current), []);

  const roughnessLabel = roughness > 0.7 ? 'Severe' : roughness > 0.3 ? 'Bumpy' : 'Smooth';

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: '#111722',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px',
        padding: '20px',
        marginTop: '16px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
        <motion.div
          animate={isDriving ? { rotate: [0, 360] } : { rotate: 0 }}
          transition={isDriving ? { duration: 4, repeat: Infinity, ease: 'linear' } : { duration: 0.3 }}
        >
          <Activity size={16} color="#00E5FF" />
        </motion.div>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 700 }}>Passive Trip Simulator</h3>
      </div>

      {/* Road condition slider */}
      <div style={{ marginBottom: '18px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.75rem',
          marginBottom: '8px',
        }}>
          <span style={{ color: '#6B7280' }}>Road Condition</span>
          <span style={{ color: roughness > 0.7 ? '#FF3B3B' : roughness > 0.3 ? '#FF9500' : '#30D158', fontWeight: 600 }}>
            {roughnessLabel}
          </span>
        </div>
        <input
          type="range"
          min="0" max="1" step="0.1"
          value={roughness}
          onChange={e => setRoughness(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: '#00E5FF', cursor: 'pointer' }}
        />
      </div>

      {/* Live Z-accel readout */}
      <motion.div
        animate={isAnomaly && isDriving
          ? { boxShadow: ['0 0 0px rgba(255,59,48,0)', '0 0 16px rgba(255,59,48,0.35)', '0 0 0px rgba(255,59,48,0)'] }
          : { boxShadow: '0 0 0px rgba(0,0,0,0)' }
        }
        transition={{ duration: 1.1, repeat: isAnomaly && isDriving ? Infinity : 0 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          background: 'rgba(0,0,0,0.25)',
          border: `1px solid ${isAnomaly ? 'rgba(255,59,48,0.2)' : 'rgba(255,255,255,0.05)'}`,
          padding: '14px',
          borderRadius: '12px',
          marginBottom: '18px',
          transition: 'border-color 0.3s ease',
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.65rem', color: '#6B7280', letterSpacing: '1.2px', marginBottom: '4px', textTransform: 'uppercase' }}>
            Live Z-Accel
          </div>
          <div style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            fontFamily: "'JetBrains Mono', monospace",
            color: isAnomaly ? '#FF3B3B' : '#00E5FF',
            transition: 'color 0.2s ease',
          }}>
            {currentAccel.toFixed(2)} m/s²
          </div>
        </div>
        <motion.div
          animate={isDriving ? { scale: [1, 1.12, 1] } : { scale: 1 }}
          transition={isDriving ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' } : {}}
        >
          <Gauge
            size={28}
            color={isAnomaly ? '#FF3B3B' : '#4B5563'}
            style={{ opacity: isDriving ? 1 : 0.25, transition: 'color 0.3s ease' }}
          />
        </motion.div>
      </motion.div>

      {/* Start / stop button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '11px 16px',
          borderRadius: '11px',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'Inter, sans-serif',
          fontSize: '0.875rem',
          fontWeight: 600,
          background: isDriving
            ? 'linear-gradient(135deg, #FF3B3B, #FF5E30)'
            : 'linear-gradient(135deg, #00E5FF, #0098CC)',
          color: '#fff',
          boxShadow: isDriving
            ? '0 4px 18px rgba(255,59,48,0.35)'
            : '0 4px 18px rgba(0,229,255,0.3)',
          transition: 'box-shadow 0.2s ease',
        }}
        onClick={isDriving ? stopTrip : startTrip}
      >
        {isDriving
          ? <><Square size={15} fill="white" /> Stop Session</>
          : <><Play  size={15} fill="white" /> Start Passive Collection</>
        }
      </motion.button>
    </motion.div>
  );
}
