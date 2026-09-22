import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Satellite, MapPin, Activity, Play, Square,
  AlertTriangle, CheckCircle, WifiOff, Loader2,
  Navigation, Zap, Clock, ChevronRight, Volume2, VolumeX,
} from 'lucide-react';

// ── Backend URL: uses the same host as the frontend so it works
//    both on localhost and when accessed from a phone via LAN IP.
const API_BASE = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8080/api`;

// ── Detection thresholds (m/s²  spike above running baseline)
const THRESHOLD_MINOR    = 2.5;
const THRESHOLD_WARNING  = 5.0;
const THRESHOLD_CRITICAL = 9.0;
const DEBOUNCE_MS        = 2200;   // min gap between two detections
const BASELINE_ALPHA     = 0.05;   // EMA smoothing — low = slow baseline drift

function severityFromSpike(spike) {
  return Math.min(1.0, spike / 15.0);
}

function labelFromSpike(spike) {
  if (spike >= THRESHOLD_CRITICAL) return 'CRITICAL';
  if (spike >= THRESHOLD_WARNING)  return 'WARNING';
  return 'MINOR';
}

function colorFromSpike(spike) {
  if (spike >= THRESHOLD_CRITICAL) return '#FF3B3B';
  if (spike >= THRESHOLD_WARNING)  return '#FFC857';
  return '#3DDB6B';
}

function typeFromSpike(spike) {
  return spike >= THRESHOLD_WARNING ? 'pothole' : 'crack';
}

// ════════════════════════════════════════════════════════════════
// G-FORCE METER  — animated arc gauge
// ════════════════════════════════════════════════════════════════
function GForceMeter({ spike, isActive }) {
  const MAX = 15;
  const pct = Math.min(1, spike / MAX);
  const color = colorFromSpike(spike);

  // Arc math: quarter circle 0° → 180° across the top
  const R   = 70;
  const cx  = 90;
  const cy  = 90;
  const startAngle = Math.PI;
  const endAngle   = startAngle + pct * Math.PI;
  const x1 = cx + R * Math.cos(startAngle);
  const y1 = cy + R * Math.sin(startAngle);
  const x2 = cx + R * Math.cos(endAngle);
  const y2 = cy + R * Math.sin(endAngle);
  const largeArc = pct > 0.5 ? 1 : 0;

  return (
    <div style={{ position: 'relative', width: 180, height: 100, margin: '0 auto' }}>
      <svg width="180" height="100" viewBox="0 0 180 100">
        {/* Track */}
        <path
          d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Fill */}
        {pct > 0 && (
          <path
            d={`M ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2}`}
            fill="none" stroke={color} strokeWidth="10"
            strokeLinecap="round"
            style={{ transition: 'stroke 0.15s ease' }}
          />
        )}
        {/* Glow */}
        {pct > 0 && isActive && (
          <path
            d={`M ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2}`}
            fill="none" stroke={color} strokeWidth="18"
            strokeLinecap="round" opacity="0.12"
            style={{ transition: 'stroke 0.15s ease' }}
          />
        )}
        {/* Center ticks */}
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const angle = Math.PI + t * Math.PI;
          const ix = cx + (R - 14) * Math.cos(angle);
          const iy = cy + (R - 14) * Math.sin(angle);
          const ox = cx + (R + 4)  * Math.cos(angle);
          const oy = cy + (R + 4)  * Math.sin(angle);
          return <line key={i} x1={ix} y1={iy} x2={ox} y2={oy} stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />;
        })}
      </svg>

      {/* Center readout */}
      <div style={{
        position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: '1.7rem', fontWeight: 800, lineHeight: 1,
          fontFamily: "'JetBrains Mono', monospace",
          color: isActive ? color : '#3D4957',
          transition: 'color 0.15s ease',
        }}>
          {spike.toFixed(1)}
        </div>
        <div style={{ fontSize: '0.58rem', color: '#3D4957', letterSpacing: '1.2px', marginTop: 2 }}>
          m/s² SPIKE
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// DETECTION CARD
// ════════════════════════════════════════════════════════════════
function DetectionCard({ item, index }) {
  const color = colorFromSpike(item.spike);
  const ago   = Math.floor((Date.now() - item.ts) / 1000);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 14px',
        borderRadius: 12,
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${color}22`,
        marginBottom: 8,
      }}
    >
      {/* Color dot */}
      <div style={{
        width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
        background: color, boxShadow: `0 0 8px ${color}88`,
      }} />

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#E6EDF3', textTransform: 'capitalize' }}>
            {item.type}
          </span>
          <span style={{
            fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.7px',
            color, background: `${color}18`,
            border: `1px solid ${color}30`,
            padding: '1px 6px', borderRadius: 99,
          }}>
            {item.label}
          </span>
          {item.sent
            ? <CheckCircle size={11} color="#3DDB6B" style={{ marginLeft: 'auto', flexShrink: 0 }} />
            : <Loader2    size={11} color="#4B5563" style={{ marginLeft: 'auto', flexShrink: 0, animation: 'spin 0.8s linear infinite' }} />
          }
        </div>
        <div style={{ fontSize: '0.65rem', color: '#4B5563', display: 'flex', gap: 8 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {item.lat.toFixed(5)}, {item.lng.toFixed(5)}
          </span>
          <span>· {ago}s ago</span>
        </div>
      </div>

      {/* Score */}
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '1rem', fontWeight: 800, color, flexShrink: 0,
      }}>
        {(item.severity * 10).toFixed(1)}
      </div>
    </motion.div>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════
export function MobileReporter() {
  const [phase, setPhase]       = useState('idle');      // idle | permission | active | error
  const [gps,   setGps]         = useState(null);        // { lat, lng, accuracy }
  const [gpsErr, setGpsErr]     = useState(null);
  const [spike,  setSpike]      = useState(0);
  const [detections, setDetections] = useState([]);
  const [flashColor, setFlashColor] = useState(null);
  const [permErr, setPermErr]   = useState(null);
  const [backendOk, setBackendOk] = useState(null);     // null=unknown, true, false
  const [voiceOn,   setVoiceOn]  = useState(true);       // voice alert toggle

  const baselineRef   = useRef(null);
  const debounceRef   = useRef(false);
  const gpsRef        = useRef(null);
  const watchIdRef    = useRef(null);
  const motionHandler = useRef(null);
  const isActive      = phase === 'active';

  // ── Keep gpsRef in sync so the motion handler always reads latest position
  useEffect(() => { gpsRef.current = gps; }, [gps]);

  // ── Ping backend health on mount
  useEffect(() => {
    fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) })
      .then(r => setBackendOk(r.ok))
      .catch(() => setBackendOk(false));
  }, []);

  // ── Voice alert via Web Speech API
  const speakAlert = useCallback((type, label, spike) => {
    if (!voiceOn || !window.speechSynthesis) return;
    const score = (spike / 15 * 10).toFixed(1);
    const text  = label === 'CRITICAL'
      ? `Critical road hazard! ${type} detected. Severity ${score} out of 10.`
      : label === 'WARNING'
        ? `Warning. ${type} detected ahead. Severity ${score}.`
        : `Minor ${type} detected.`;
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate   = 1.08;
    utter.volume = 1.0;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  }, [voiceOn]);

  // ── Send detection to backend
  const sendReport = useCallback(async (payload) => {
    try {
      const res = await fetch(`${API_BASE}/issues/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  // ── Core detection logic — runs on every accelerometer event
  const handleMotion = useCallback((e) => {
    const accel = e.accelerationIncludingGravity ?? e.acceleration;
    if (!accel || accel.z === null) return;

    const z = Math.abs(accel.z ?? 0);

    // Calibrate baseline slowly via EMA
    if (baselineRef.current === null) {
      baselineRef.current = z;
      return;
    }
    baselineRef.current = baselineRef.current * (1 - BASELINE_ALPHA) + z * BASELINE_ALPHA;

    const s = Math.abs(z - baselineRef.current);
    setSpike(s);

    if (s < THRESHOLD_MINOR || debounceRef.current) return;

    // ── Pothole detected ────────────────────────────────────────
    const pos = gpsRef.current;
    if (!pos) return;   // no GPS lock yet — skip

    debounceRef.current = true;
    setTimeout(() => { debounceRef.current = false; }, DEBOUNCE_MS);

    const color    = colorFromSpike(s);
    const severity = severityFromSpike(s);
    const type     = typeFromSpike(s);
    const label    = labelFromSpike(s);

    const detection = {
      id:       `det_${Date.now()}`,
      ts:       Date.now(),
      spike:    s, severity, type, label, color,
      lat:      pos.lat,
      lng:      pos.lng,
      sent:     false,
    };

    setDetections(prev => [detection, ...prev].slice(0, 20));
    setFlashColor(color);
    setTimeout(() => setFlashColor(null), 600);
    speakAlert(type, label, s);

    // Send in background; update card's sent status when done
    sendReport({ type, latitude: pos.lat, longitude: pos.lng, severityScore: severity })
      .then(ok => {
        setDetections(prev =>
          prev.map(d => d.id === detection.id ? { ...d, sent: ok } : d)
        );
      });
  }, [sendReport]);

  // ── Start session
  const startSession = useCallback(async () => {
    setPermErr(null);
    setPhase('permission');
    baselineRef.current = null;

    // iOS 13+ requires explicit permission for DeviceMotionEvent
    if (typeof DeviceMotionEvent !== 'undefined' &&
        typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const res = await DeviceMotionEvent.requestPermission();
        if (res !== 'granted') {
          setPermErr('Motion sensor permission denied. Please allow it in your browser settings.');
          setPhase('error');
          return;
        }
      } catch {
        setPermErr('Could not request motion permission. Try tapping "Start" again.');
        setPhase('error');
        return;
      }
    } else if (typeof DeviceMotionEvent === 'undefined') {
      setPermErr('This device does not expose motion sensors to the browser.');
      setPhase('error');
      return;
    }

    // Start GPS watch
    if (!navigator.geolocation) {
      setPermErr('Geolocation is not supported by this browser.');
      setPhase('error');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      err => setGpsErr(err.message),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 },
    );

    // Register motion listener
    motionHandler.current = handleMotion;
    window.addEventListener('devicemotion', motionHandler.current);

    setPhase('active');
  }, [handleMotion]);

  // ── Stop session
  const stopSession = useCallback(() => {
    if (motionHandler.current) {
      window.removeEventListener('devicemotion', motionHandler.current);
      motionHandler.current = null;
    }
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setSpike(0);
    setPhase('idle');
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopSession(), []);

  const criticalCount = detections.filter(d => d.spike >= THRESHOLD_CRITICAL).length;
  const warningCount  = detections.filter(d => d.spike >= THRESHOLD_WARNING && d.spike < THRESHOLD_CRITICAL).length;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0B0F14',
      color: '#E6EDF3',
      fontFamily: 'Inter, sans-serif',
      padding: '0 0 40px',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* ── Flash overlay on detection ──────────────────────── */}
      <AnimatePresence>
        {flashColor && (
          <motion.div
            key="flash"
            initial={{ opacity: 0.55 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 999,
              background: flashColor,
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Cyan top strip ──────────────────────────────────── */}
      <div style={{ height: 3, background: 'linear-gradient(90deg, transparent, #00E5FF88, #00E5FF, #00E5FF88, transparent)' }} />

      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{
        padding: '20px 20px 0',
        display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        paddingBottom: 16,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: 'linear-gradient(135deg, rgba(0,229,255,0.15), rgba(0,229,255,0.05))',
          border: '1px solid rgba(0,229,255,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 20px rgba(0,229,255,0.12)',
        }}>
          <Satellite size={20} color="#00E5FF" />
        </div>
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', lineHeight: 1.1 }}>
            RoadWatch Sensor
          </div>
          <div style={{ fontSize: '0.6rem', color: '#3D4957', letterSpacing: '1.8px', textTransform: 'uppercase', fontWeight: 600 }}>
            Mobile Reporter
          </div>
        </div>

        {/* Backend status pill */}
        <div style={{ marginLeft: 'auto' }}>
          {backendOk === null ? (
            <div style={{ fontSize: '0.6rem', color: '#3D4957' }}>checking…</div>
          ) : backendOk ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3DDB6B', boxShadow: '0 0 6px #3DDB6B' }} />
              <span style={{ fontSize: '0.62rem', color: '#3DDB6B', fontWeight: 700 }}>CONNECTED</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <WifiOff size={12} color="#FF3B3B" />
              <span style={{ fontSize: '0.62rem', color: '#FF3B3B', fontWeight: 700 }}>OFFLINE</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '20px 20px 0' }}>

        {/* ── GPS Status ────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px',
          borderRadius: 13,
          background: gps
            ? 'rgba(61,219,107,0.05)'
            : 'rgba(255,255,255,0.02)',
          border: `1px solid ${gps ? 'rgba(61,219,107,0.2)' : 'rgba(255,255,255,0.06)'}`,
          marginBottom: 16,
        }}>
          <Navigation
            size={15}
            color={gps ? '#3DDB6B' : '#4B5563'}
            style={!gps && isActive ? { animation: 'spin 2s linear infinite' } : {}}
          />
          {gps ? (
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.72rem', color: '#3DDB6B', fontWeight: 700 }}>GPS Locked</div>
              <div style={{
                fontSize: '0.63rem', color: '#4B5563',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}
                {gps.accuracy && <span style={{ marginLeft: 6 }}>±{Math.round(gps.accuracy)}m</span>}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.72rem', color: isActive ? '#FFC857' : '#4B5563', fontWeight: 600 }}>
                {isActive ? 'Acquiring GPS…' : 'GPS Inactive'}
              </div>
              {gpsErr && <div style={{ fontSize: '0.62rem', color: '#FF3B3B', marginTop: 2 }}>{gpsErr}</div>}
            </div>
          )}
          {gps && <MapPin size={12} color="#3DDB6B" />}
        </div>

        {/* ── G-Force Meter ─────────────────────────────────── */}
        <div style={{
          padding: '22px 16px 16px',
          borderRadius: 16,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          marginBottom: 16,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '0.6rem', color: '#4B5563', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 12 }}>
            Live Accelerometer
          </div>

          <GForceMeter spike={spike} isActive={isActive} />

          {/* Threshold labels */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            marginTop: 10, padding: '0 8px',
            fontSize: '0.57rem', color: '#3D4957', letterSpacing: '0.5px',
          }}>
            <span style={{ color: '#3DDB6B' }}>MINOR 2.5</span>
            <span style={{ color: '#FFC857' }}>WARNING 5.0</span>
            <span style={{ color: '#FF3B3B' }}>CRITICAL 9.0</span>
          </div>
        </div>

        {/* ── Start / Stop Button ───────────────────────────── */}
        {phase === 'error' ? (
          <div style={{ marginBottom: 16 }}>
            <div style={{
              padding: '12px 14px',
              borderRadius: 13,
              background: 'rgba(255,59,59,0.07)',
              border: '1px solid rgba(255,59,59,0.2)',
              marginBottom: 12,
              display: 'flex', gap: 9, alignItems: 'flex-start',
            }}>
              <AlertTriangle size={14} color="#FF3B3B" style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: '0.78rem', color: '#FF3B3B', lineHeight: 1.55 }}>{permErr}</span>
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => { setPhase('idle'); setPermErr(null); }}
              style={btnStyle('#FFC857')}
            >
              Try Again
            </motion.button>
          </div>
        ) : (
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={isActive ? stopSession : startSession}
            disabled={phase === 'permission'}
            style={btnStyle(isActive ? '#FF3B3B' : '#00E5FF', phase === 'permission')}
          >
            {phase === 'permission' ? (
              <><Loader2 size={20} style={{ animation: 'spin 0.8s linear infinite' }} /> Requesting Permission…</>
            ) : isActive ? (
              <><Square size={20} fill="#fff" /> Stop Session</>
            ) : (
              <><Play size={20} fill="#0B0F14" /> Start Detecting</>
            )}
          </motion.button>
        )}

        {/* ── Voice toggle ─────────────────────────────────── */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setVoiceOn(v => !v)}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '10px 0',
            borderRadius: 12,
            border: voiceOn
              ? '1px solid rgba(0,229,255,0.2)'
              : '1px solid rgba(255,255,255,0.06)',
            background: voiceOn
              ? 'rgba(0,229,255,0.06)'
              : 'rgba(255,255,255,0.02)',
            color: voiceOn ? '#00E5FF' : '#4B5563',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            marginBottom: 16,
            WebkitTapHighlightColor: 'transparent',
            transition: 'all 0.2s ease',
          }}
        >
          {voiceOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
          Voice Alerts {voiceOn ? 'On' : 'Off'}
        </motion.button>

        {/* ── Session Stats ─────────────────────────────────── */}
        {detections.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: 'flex', gap: 8, marginBottom: 16,
            }}
          >
            {[
              { label: 'Total',    value: detections.length, color: '#00E5FF' },
              { label: 'Critical', value: criticalCount,     color: '#FF3B3B' },
              { label: 'Warning',  value: warningCount,      color: '#FFC857' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                flex: 1, padding: '10px 8px', textAlign: 'center',
                borderRadius: 11,
                background: 'rgba(255,255,255,0.02)',
                border: `1px solid ${color}22`,
              }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: '0.58rem', color: '#4B5563', marginTop: 3, letterSpacing: '0.5px' }}>{label}</div>
              </div>
            ))}
          </motion.div>
        )}

        {/* ── Detection Log ─────────────────────────────────── */}
        {detections.length > 0 && (
          <div>
            <div style={{
              fontSize: '0.6rem', fontWeight: 700, color: '#4B5563',
              letterSpacing: '1.4px', textTransform: 'uppercase',
              marginBottom: 10,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Activity size={10} />
              Detection Log
              <span style={{ marginLeft: 'auto', fontWeight: 400, letterSpacing: 0 }}>
                {detections.filter(d => d.sent).length}/{detections.length} sent
              </span>
            </div>
            <AnimatePresence>
              {detections.map((d, i) => (
                <DetectionCard key={d.id} item={d} index={i} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────── */}
        {detections.length === 0 && phase !== 'active' && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#3D4957' }}>
            <Activity size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>No detections yet</div>
            <div style={{ fontSize: '0.72rem', marginTop: 4, lineHeight: 1.6 }}>
              Tap Start and drive over a pothole.<br />
              Bumps will appear here and on the dashboard.
            </div>
          </div>
        )}

        {isActive && detections.length === 0 && (
          <motion.div
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.8, repeat: Infinity }}
            style={{ textAlign: 'center', padding: '24px 0', color: '#00E5FF' }}
          >
            <Zap size={28} style={{ margin: '0 auto 10px', display: 'block' }} />
            <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>Monitoring…</div>
            <div style={{ fontSize: '0.68rem', color: '#3D4957', marginTop: 4 }}>
              {gps ? 'GPS locked. Drive over a bump to detect it.' : 'Waiting for GPS lock…'}
            </div>
          </motion.div>
        )}

        {/* ── Dashboard link ────────────────────────────────── */}
        <motion.a
          href="/"
          whileTap={{ scale: 0.97 }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            marginTop: 24,
            padding: '11px 0',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            color: '#4B5563',
            fontSize: '0.78rem',
            fontWeight: 600,
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          View Dashboard
          <ChevronRight size={14} />
        </motion.a>
      </div>
    </div>
  );
}

// ── Shared button style helper
function btnStyle(accent, disabled = false) {
  return {
    width: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    padding: '16px 0',
    borderRadius: 14,
    border: 'none',
    background: disabled
      ? 'rgba(255,255,255,0.04)'
      : accent === '#00E5FF'
        ? 'linear-gradient(135deg, #00B8CC, #00E5FF)'
        : accent === '#FF3B3B'
          ? 'linear-gradient(135deg, #CC2020, #FF3B3B)'
          : `linear-gradient(135deg, ${accent}cc, ${accent})`,
    color: disabled ? '#3D4957' : accent === '#00E5FF' ? '#0B0F14' : '#fff',
    fontSize: '1rem',
    fontWeight: 800,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'Inter, sans-serif',
    letterSpacing: '0.02em',
    boxShadow: disabled ? 'none' : `0 6px 28px ${accent}44`,
    marginBottom: 16,
    WebkitTapHighlightColor: 'transparent',
  };
}
