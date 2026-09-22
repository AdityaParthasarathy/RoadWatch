import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, LayoutDashboard, Map as MapIcon,
  Loader2, Radio, ShieldAlert, ChevronLeft, ChevronRight,
  Menu, Satellite, AlertOctagon, Zap, X, MapPin, Clock, RefreshCw, Bell,
  LogOut, User, Volume2, VolumeX,
} from 'lucide-react';

import { LandingPage }      from './pages/LandingPage';
import { AdminDashboard }   from './components/AdminDashboard';
import { TripSimulator }    from './components/TripSimulator';
import { AuthScreen }       from './components/AuthScreen';
import { auth, onAuthStateChanged, signOut } from './firebase';
import { Sidebar }          from './components/Sidebar';
import { RoadMap }          from './components/RoadMap';
import { UploadModal }      from './components/UploadModal';
import { ErrorBoundary }    from './components/ErrorBoundary';
import {
  AlertToastStack,
  AlertHistoryPanel,
} from './components/AlertSystem';
import { ReportGenerator } from './components/ReportGenerator';

const API_BASE = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8080/api`;

const BOOT_LOGS = [
  'Initializing AI Surveillance Kernels...',
  'Linking National Road Registry Database...',
  'Configuring Satellite Telemetry Handshake...',
  'Establishing Predictive ML Pipeline...',
  'Access Granted — Commencing Dashboard Boot.',
];

/* ════════════════════════════════════════════════════════════
   SIMULATE INCIDENT — mock data pool
════════════════════════════════════════════════════════════ */
const MOCK_ISSUE_TYPES = ['pothole', 'crack', 'waterlogging', 'pothole', 'crack'];
const MOCK_LOCATIONS   = [
  // Chennai hotspots
  { lat: 13.0674, lng: 80.2376, area: 'Anna Nagar'     },
  { lat: 13.0418, lng: 80.2341, area: 'T. Nagar'       },
  { lat: 13.0827, lng: 80.2707, area: 'Royapettah'     },
  { lat: 13.0569, lng: 80.2425, area: 'Vadapalani'     },
  { lat: 13.1067, lng: 80.2206, area: 'Ambattur'       },
  { lat: 13.0143, lng: 80.2068, area: 'Pallavaram'     },
  { lat: 13.0932, lng: 80.2809, area: 'Perambur'       },
  { lat: 13.0499, lng: 80.2134, area: 'Ashok Nagar'    },
  // NYC (matches TripSimulator origin)
  { lat: 40.7128, lng: -74.006,  area: 'Downtown NYC'   },
  { lat: 40.7282, lng: -73.9942, area: 'Greenwich Vlg'  },
  { lat: 40.7614, lng: -73.9776, area: 'Midtown Manhattan' },
];

function generateFakeIssue() {
  const loc         = MOCK_LOCATIONS[Math.floor(Math.random() * MOCK_LOCATIONS.length)];
  const type        = MOCK_ISSUE_TYPES[Math.floor(Math.random() * MOCK_ISSUE_TYPES.length)];
  // Bias toward critical for demo impact: 40% critical, 35% warning, 25% minor
  const roll        = Math.random();
  const severity    = roll < 0.40
    ? 0.82 + Math.random() * 0.17          // 0.82–0.99 critical
    : roll < 0.75
      ? 0.42 + Math.random() * 0.37        // 0.42–0.79 warning
      : 0.05 + Math.random() * 0.35;       // 0.05–0.40 minor

  // Jitter lat/lng slightly so repeated simulations don't stack exactly
  const jitter = () => (Math.random() - 0.5) * 0.008;

  return {
    id:            `sim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    severityScore: parseFloat(severity.toFixed(3)),
    latitude:      parseFloat((loc.lat + jitter()).toFixed(6)),
    longitude:     parseFloat((loc.lng + jitter()).toFixed(6)),
    timestamp:     Date.now(),
    area:          loc.area,
    simulated:     true,
  };
}

/* ════════════════════════════════════════════════════════════
   INCIDENT ALERT BANNER
════════════════════════════════════════════════════════════ */
const SEVERITY_LABEL = s => s > 0.8 ? 'CRITICAL' : s > 0.4 ? 'WARNING' : 'MINOR';
const SEVERITY_COLOR = s => s > 0.8 ? '#FF3B3B' : s > 0.4 ? '#FFC857' : '#3DDB6B';
const TYPE_ICON_COLOR= t => ({ pothole: '#FF3B3B', crack: '#FFC857', waterlogging: '#00E5FF' }[t] ?? '#8B949E');

function IncidentAlert({ issue, onDismiss }) {
  const color    = SEVERITY_COLOR(issue.severityScore);
  const label    = SEVERITY_LABEL(issue.severityScore);
  const DURATION = 4800; // ms before auto-dismiss

  // auto-dismiss
  useEffect(() => {
    const id = setTimeout(onDismiss, DURATION);
    return () => clearTimeout(id);
  }, []);

  return (
    <motion.div
      initial={{ y: -90, opacity: 0 }}
      animate={{ y: 0,   opacity: 1 }}
      exit={{   y: -90, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      style={{
        position:  'fixed',
        top:       '68px',         // just below topbar
        left:      '50%',
        transform: 'translateX(-50%)',
        zIndex:    2000,
        minWidth:  '380px',
        maxWidth:  '520px',
        borderRadius: '16px',
        overflow:  'hidden',
        background: 'rgba(11,15,20,0.97)',
        border:    `1px solid ${color}38`,
        boxShadow: `0 20px 60px rgba(0,0,0,0.65), 0 0 0 1px ${color}18, 0 0 40px ${color}10`,
        backdropFilter: 'blur(24px)',
      }}
    >
      {/* Coloured top strip */}
      <div style={{
        height: '3px',
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
      }} />

      {/* Body */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px 12px' }}>

        {/* Pulsing icon */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            position: 'absolute', inset: '-5px', borderRadius: '50%',
            border: `1.5px solid ${color}`,
            animation: 'rw-pulse 2s ease-out infinite',
            opacity: 0.6,
          }} />
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: `linear-gradient(135deg, ${color}22, ${color}0a)`,
            border: `1px solid ${color}35`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={16} color={color} />
          </div>
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{
              fontSize: '0.82rem', fontWeight: 800, color: '#E6EDF3', letterSpacing: '0.01em',
            }}>
              New Road Issue Detected
            </span>
            <span style={{
              fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.8px',
              color, background: `${color}18`,
              padding: '1px 6px', borderRadius: '99px',
              border: `1px solid ${color}30`,
            }}>
              {label}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#6B7280' }}>
              <MapPin size={10} color={TYPE_ICON_COLOR(issue.type)} />
              <span style={{ textTransform: 'capitalize', color: '#8B949E' }}>{issue.type}</span>
              {issue.area && <span style={{ color: '#4B5563' }}>· {issue.area}</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#4B5563' }}>
              <Clock size={10} />
              just now
            </div>
          </div>
        </div>

        {/* Severity score */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{
            fontSize: '1.3rem', fontWeight: 800, lineHeight: 1,
            fontFamily: "'JetBrains Mono', monospace",
            color,
          }}>
            {(issue.severityScore * 10).toFixed(1)}
          </div>
          <div style={{ fontSize: '0.58rem', color: '#4B5563', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
            severity
          </div>
        </div>

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          style={{
            flexShrink: 0, marginLeft: '4px',
            width: 26, height: 26, borderRadius: '7px',
            border: '1px solid rgba(255,255,255,0.07)',
            background: 'rgba(255,255,255,0.04)',
            color: '#4B5563', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = '#E6EDF3'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#4B5563'; }}
        >
          <X size={12} />
        </button>
      </div>

      {/* Auto-dismiss progress bar */}
      <div style={{ height: '2px', background: 'rgba(255,255,255,0.05)' }}>
        <div style={{
          height: '100%',
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          animation: `alertProgressBar ${DURATION}ms linear forwards`,
        }} />
      </div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════
   TOP BAR — live clock, real-time system health, quick stats
════════════════════════════════════════════════════════════ */

// ── Status helpers ──────────────────────────────────────────
const SERVICE_COLOR = {
  UP:      '#3DDB6B',   // green  — fully operational
  DOWN:    '#FF3B3B',   // red    — unreachable
  DEGRADED:'#FFC857',   // amber  — running on fallback
  null:    '#3D4957',   // gray   — not yet polled
};

// AI and Firestore being "DOWN" means fallback mode → amber, not full-red
function resolveColor(service, value) {
  if (value === null)   return SERVICE_COLOR[null];
  if (value === 'UP')   return SERVICE_COLOR.UP;
  // backend DOWN = hard red; ai/firestore DOWN = degraded amber (fallback active)
  return service === 'backend' ? SERVICE_COLOR.DOWN : SERVICE_COLOR.DEGRADED;
}

function ServiceDot({ label, value, service }) {
  const color = resolveColor(service, value);
  const isUp  = value === 'UP';

  return (
    <div
      title={`${label}: ${value ?? 'checking…'}`}
      style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'default' }}
    >
      {/* dot + optional pulse ring when UP */}
      <div style={{ position: 'relative', width: 8, height: 8, flexShrink: 0 }}>
        {isUp && (
          <div style={{
            position: 'absolute',
            inset: '-3px',
            borderRadius: '50%',
            border: `1px solid ${color}`,
            animation: 'rw-pulse 2.4s ease-out infinite',
            opacity: 0.5,
          }} />
        )}
        <div style={{
          width: 8, height: 8,
          borderRadius: '50%',
          background: color,
          boxShadow: value !== null ? `0 0 7px ${color}cc` : 'none',
          transition: 'background 0.4s ease, box-shadow 0.4s ease',
        }} />
      </div>
      <span style={{
        fontSize: '0.6rem',
        fontWeight: 700,
        letterSpacing: '0.6px',
        color: isUp ? '#5A6472' : color,
        transition: 'color 0.4s ease',
        userSelect: 'none',
      }}>
        {label}
      </span>
    </div>
  );
}

function TopBar({ issues, trips, isSimulating, onToggleSidebar, sidebarCollapsed, onSimulateIncident, onOpenHistory, unreadCount = 0, user, onSignOut, voiceMuted, onToggleVoice }) {
  const [now,         setNow]         = useState(new Date());
  const [health,      setHealth]      = useState({ backend: null, ai: null, firestore: null });
  const [lastChecked, setLastChecked] = useState(null);
  const [isChecking,  setIsChecking]  = useState(false);

  // ── 1-second clock ─────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Health poll every 5 s ──────────────────────────────────
  useEffect(() => {
    const poll = async () => {
      setIsChecking(true);
      try {
        const res = await axios.get(`${API_BASE}/health`, { timeout: 3000 });
        setHealth(res.data);
      } catch {
        // If we can't reach /api/health at all, backend itself is down
        setHealth({ backend: 'DOWN', ai: 'DOWN', firestore: 'DOWN' });
      } finally {
        setLastChecked(new Date());
        setIsChecking(false);
      }
    };
    poll();                                   // immediate first check
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  const criticalCount = issues.filter(i => i.severityScore > 0.8).length;
  const activeTrips   = Object.keys(trips).length;

  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  const secsSince   = lastChecked ? Math.floor((now - lastChecked) / 1000) : null;
  const backendOk   = health.backend === 'UP';
  const clusterBorderColor = backendOk
    ? 'rgba(61,219,107,0.18)'
    : health.backend === 'DOWN'
      ? 'rgba(255,59,59,0.22)'
      : 'rgba(255,255,255,0.07)';
  const clusterGlow = backendOk
    ? '0 0 20px rgba(61,219,107,0.07)'
    : 'none';

  return (
    <header className="topbar">
      {/* Sidebar toggle */}
      <button
        className="topbar-btn"
        onClick={onToggleSidebar}
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <Menu size={18} />
      </button>

      <div className="topbar-divider" />

      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: 30, height: 30,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,229,255,0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(0,229,255,0.2)',
          boxShadow: '0 0 16px rgba(0,229,255,0.15)',
          flexShrink: 0,
        }}>
          <Satellite size={16} color="#00E5FF" />
        </div>
        <div>
          <div style={{
            fontSize: '0.88rem',
            fontWeight: 800,
            fontFamily: 'Outfit, sans-serif',
            color: '#E6EDF3',
            lineHeight: 1.1,
            letterSpacing: '-0.01em',
          }}>
            RoadWatch AI
          </div>
          <div style={{
            fontSize: '0.6rem',
            color: '#3D4957',
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}>
            Control Center
          </div>
        </div>
      </div>

      <div className="topbar-divider" />

      {/* ── System Status Cluster ──────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '6px 13px',
        borderRadius: '10px',
        background: 'rgba(255,255,255,0.025)',
        border: `1px solid ${clusterBorderColor}`,
        backdropFilter: 'blur(10px)',
        boxShadow: clusterGlow,
        transition: 'border-color 0.5s ease, box-shadow 0.5s ease',
      }}>

        {/* LIVE pulse dot + label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ position: 'relative', width: 8, height: 8 }}>
            {/* outer pulse ring */}
            <div style={{
              position: 'absolute',
              inset: '-4px',
              borderRadius: '50%',
              border: `1.5px solid ${backendOk ? '#3DDB6B' : '#FF3B3B'}`,
              animation: 'rw-pulse 1.8s ease-out infinite',
              opacity: 0.55,
            }} />
            {/* solid core */}
            <div style={{
              width: 8, height: 8,
              borderRadius: '50%',
              background: backendOk ? '#3DDB6B' : '#FF3B3B',
              boxShadow: `0 0 8px ${backendOk ? '#3DDB6B' : '#FF3B3B'}bb`,
              transition: 'background 0.4s ease',
            }} />
          </div>
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 800,
            letterSpacing: '1.2px',
            color: backendOk ? '#3DDB6B' : '#FF3B3B',
            transition: 'color 0.4s ease',
          }}>
            LIVE
          </span>
        </div>

        {/* thin rule */}
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

        {/* Service indicators */}
        <ServiceDot service="backend"   label="BACKEND"   value={health.backend}   />
        <ServiceDot service="ai"        label="AI SVC"    value={health.ai}        />
        <ServiceDot service="firestore" label="FIRESTORE" value={health.firestore} />

        {/* thin rule + last-checked counter */}
        {secsSince !== null && (
          <>
            <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {/* spinning refresh icon while polling */}
              <svg
                width="9" height="9" viewBox="0 0 24 24" fill="none"
                stroke={isChecking ? '#00E5FF' : '#3D4957'}
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{
                  transition: 'stroke 0.3s ease',
                  animation: isChecking ? 'spin 0.7s linear infinite' : 'none',
                  flexShrink: 0,
                }}
              >
                <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.58rem',
                color: '#3D4957',
                letterSpacing: '0.3px',
                minWidth: '26px',
              }}>
                {secsSince}s
              </span>
            </div>
          </>
        )}
      </div>

      {/* Right-hand side */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Critical alert badge */}
        {criticalCount > 0 && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="topbar-stat-chip critical"
          >
            <AlertOctagon size={12} />
            {criticalCount} CRITICAL
          </motion.div>
        )}

        {/* Issues total */}
        <div className="topbar-stat-chip">
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00E5FF' }} />
          {issues.length} issues
        </div>

        {/* Active trips */}
        {isSimulating && activeTrips > 0 && (
          <div className="topbar-stat-chip">
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#FFC857' }} />
            {activeTrips} trip{activeTrips !== 1 ? 's' : ''} live
          </div>
        )}

        {/* ── Simulate Incident button ───────────────────── */}
        <motion.button
          whileHover={{ scale: 1.04, y: -1 }}
          whileTap={{ scale: 0.96 }}
          onClick={onSimulateIncident}
          title="Inject a simulated road incident onto the map"
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '5px 12px',
            borderRadius: '8px',
            border: '1px solid rgba(255,200,87,0.28)',
            background: 'linear-gradient(135deg, rgba(255,200,87,0.12), rgba(255,200,87,0.04))',
            color: '#FFC857',
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.5px',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            boxShadow: '0 0 18px rgba(255,200,87,0.08)',
            transition: 'box-shadow 0.2s ease',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 28px rgba(255,200,87,0.22)'; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 0 18px rgba(255,200,87,0.08)'; }}
        >
          <Zap size={13} fill="#FFC857" />
          SIMULATE
        </motion.button>

        {/* ── Alert History bell ───────────────────────── */}
        <motion.button
          whileHover={{ scale: 1.08, y: -1 }}
          whileTap={{ scale: 0.93 }}
          onClick={onOpenHistory}
          title="Alert history"
          style={{
            position: 'relative',
            width: 34, height: 34,
            borderRadius: '9px',
            border: unreadCount > 0
              ? '1px solid rgba(255,59,59,0.35)'
              : '1px solid rgba(255,255,255,0.08)',
            background: unreadCount > 0
              ? 'linear-gradient(135deg, rgba(255,59,59,0.14), rgba(255,59,59,0.05))'
              : 'rgba(255,255,255,0.04)',
            color: unreadCount > 0 ? '#FF3B3B' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: unreadCount > 0 ? '0 0 16px rgba(255,59,59,0.18)' : 'none',
            transition: 'all 0.2s ease',
            flexShrink: 0,
          }}
        >
          <Bell size={15} />
          {unreadCount > 0 && (
            <motion.div
              key={unreadCount}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1,   opacity: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 18 }}
              style={{
                position: 'absolute',
                top: 3, right: 3,
                minWidth: 14, height: 14,
                borderRadius: '99px',
                background: '#FF3B3B',
                border: '1.5px solid #0B0F14',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.48rem',
                fontWeight: 800,
                color: '#fff',
                lineHeight: 1,
                padding: '0 2px',
              }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.div>
          )}
        </motion.button>

        {/* ── Voice mute toggle ────────────────────────────── */}
        <motion.button
          whileHover={{ scale: 1.08, y: -1 }}
          whileTap={{ scale: 0.93 }}
          onClick={onToggleVoice}
          title={voiceMuted ? 'Unmute voice alerts' : 'Mute voice alerts'}
          style={{
            width: 34, height: 34,
            borderRadius: '9px',
            border: voiceMuted
              ? '1px solid rgba(255,255,255,0.07)'
              : '1px solid rgba(0,229,255,0.25)',
            background: voiceMuted
              ? 'rgba(255,255,255,0.03)'
              : 'rgba(0,229,255,0.08)',
            color: voiceMuted ? '#4B5563' : '#00E5FF',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s ease',
            flexShrink: 0,
          }}
        >
          {voiceMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </motion.button>

        <div className="topbar-divider" />

        {/* ── User badge + sign-out ─────────────────────────── */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Email pill */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '5px 10px',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <User size={11} color="#3D4957" />
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 600,
                color: '#6B7280',
                maxWidth: '140px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                letterSpacing: '0.2px',
              }}>
                {user.email}
              </span>
            </div>

            {/* Sign out */}
            <motion.button
              whileHover={{ scale: 1.06, y: -1 }}
              whileTap={{ scale: 0.94 }}
              onClick={onSignOut}
              title="Sign out"
              style={{
                width: 32, height: 32,
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.07)',
                background: 'rgba(255,255,255,0.03)',
                color: '#4B5563',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,59,59,0.1)'; e.currentTarget.style.color = '#FF3B3B'; e.currentTarget.style.borderColor = 'rgba(255,59,59,0.25)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#4B5563'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
            >
              <LogOut size={13} />
            </motion.button>
          </div>
        )}

        <div className="topbar-divider" />

        {/* Clock */}
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.88rem',
            fontWeight: 700,
            color: '#00E5FF',
            letterSpacing: '1px',
            lineHeight: 1.1,
          }}>
            {timeStr}
          </div>
          <div style={{
            fontSize: '0.6rem',
            color: '#3D4957',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
          }}>
            {dateStr}
          </div>
        </div>
      </div>
    </header>
  );
}

/* ════════════════════════════════════════════════════════════
   BOOT SCREEN
════════════════════════════════════════════════════════════ */
function BootScreen({ logs }) {
  return (
    <div style={{
      height: '100vh', width: '100vw',
      background: '#0B0F14',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div style={{
          width: '540px',
          background: '#0D1420',
          border: '1px solid rgba(0,229,255,0.12)',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 60px rgba(0,229,255,0.04)',
        }}>
          {/* Title bar */}
          <div style={{
            padding: '11px 16px',
            background: '#0B1018',
            borderBottom: '1px solid rgba(0,229,255,0.08)',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            {['#FF3B3B', '#FFC857', '#3DDB6B'].map(c => (
              <div key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c, opacity: 0.85 }} />
            ))}
            <span style={{
              marginLeft: '10px',
              fontSize: '0.7rem',
              color: '#3D4957',
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: '0.5px',
            }}>
              roadwatch-ai — system-init.sh
            </span>
          </div>

          {/* Terminal body */}
          <div style={{ padding: '24px 28px', minHeight: '230px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px' }}>
              <Loader2 size={16} className="animate-spin" color="#00E5FF" />
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.75rem',
                color: '#00E5FF',
                letterSpacing: '2.5px',
                fontWeight: 700,
              }}>
                SYSTEM DIAGNOSTIC
              </span>
            </div>

            {logs.map((log, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.74rem',
                  marginBottom: '10px',
                  display: 'flex',
                  gap: '14px',
                  color: i === logs.length - 1 ? '#3DDB6B' : 'rgba(139, 148, 158, 0.55)',
                }}
              >
                <span style={{ color: '#2A3544', minWidth: '30px' }}>[{String(i + 1).padStart(2, '0')}]</span>
                <span>{log}</span>
              </motion.div>
            ))}

            {logs.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '0.74rem', color: '#2A3544' }}>&gt;&nbsp;</span>
                <span
                  className="cursor-blink"
                  style={{ display: 'inline-block', width: '8px', height: '14px', background: '#3DDB6B', borderRadius: '1px' }}
                />
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN APP
════════════════════════════════════════════════════════════ */
function App() {
  // ── Firebase auth ──────────────────────────────────────────────────────────
  const [user,            setUser]            = useState(undefined); // undefined = loading
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u ?? null));
    return unsub;
  }, []);

  const handleSignOut = useCallback(() => signOut(auth), []);

  const [issues,          setIssues]          = useState([]);
  const [predictions,     setPredictions]     = useState([]);
  const [trips,           setTrips]           = useState({});
  const [showLanding,     setShowLanding]     = useState(true);
  const [isBooting,       setIsBooting]       = useState(false);
  const [bootLog,         setBootLog]         = useState([]);
  const [showRiskLayer,   setShowRiskLayer]   = useState(false);
  const [isSimulating,    setIsSimulating]    = useState(false);
  const [isUploadOpen,    setIsUploadOpen]    = useState(false);
  const [selectedIssue,   setSelectedIssue]   = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [issuesError,     setIssuesError]     = useState(false);
  const [backendDown,     setBackendDown]     = useState(false);
  const [view,            setView]            = useState('map');
  const [sidebarCollapsed,setSidebarCollapsed]= useState(false);
  const [incidentAlert,   setIncidentAlert]   = useState(null);   // center banner (simulate only)
  const [simulatedId,     setSimulatedId]     = useState(null);   // id of latest simulated issue

  // ── Real-time alert system ─────────────────────────────────────────────
  const [alertQueue,      setAlertQueue]      = useState([]);     // active toasts (max 4)
  const [alertHistory,    setAlertHistory]    = useState([]);     // rolling log (max 50)
  const [showAlertHistory,setShowAlertHistory]= useState(false);
  const [unreadCount,     setUnreadCount]     = useState(0);

  // ── Voice alert mute toggle ────────────────────────────────────────────
  const [voiceMuted, setVoiceMuted] = useState(false);

  // Tracks which issue IDs have already been alerted on — prevents duplicates
  const seenIssueIds   = useRef(new Set());
  // True until the very first fetchIssues() call completes — seed without alerting
  const isInitialFetch = useRef(true);
  // Timestamp of the last alert fired — drives the simulation fallback cadence
  const lastAlertTime  = useRef(0);

  // ── Alert callbacks ────────────────────────────────────────────────────
  const addAlert = useCallback((issue) => {
    const alert = {
      ...issue,
      alertId: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    };
    setAlertQueue(prev => [alert, ...prev].slice(0, 4));
    setAlertHistory(prev => [alert, ...prev].slice(0, 50));
    setUnreadCount(n => n + 1);
    lastAlertTime.current = Date.now();

    // Voice alert for critical issues (dashboard)
    if (!voiceMuted && issue.severityScore > 0.7 && window.speechSynthesis) {
      const type = issue.type || 'road issue';
      const score = (issue.severityScore * 10).toFixed(0);
      const area  = issue.area ? ` in ${issue.area}` : '';
      const utter = new SpeechSynthesisUtterance(
        `Critical alert. ${type}${area}. Severity ${score} out of 10. Immediate attention required.`
      );
      utter.rate = 1.05;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    }
  }, [voiceMuted]);

  const dismissAlert = useCallback((alertId) => {
    setAlertQueue(prev => prev.filter(a => a.alertId !== alertId));
  }, []);

  /* ── Boot ─────────────────────────────────────────────────── */
  const bootSystem = () => {
    setIsBooting(true);
    BOOT_LOGS.forEach((log, i) => {
      setTimeout(() => setBootLog(prev => [...prev, log]), i * 680);
    });
    setTimeout(() => {
      setShowLanding(false);
      setIsBooting(false);
    }, BOOT_LOGS.length * 680 + 400);
  };

  /* ── Data — only after user enters the dashboard ─────────── */
  useEffect(() => {
    if (showLanding) return;
    fetchIssues();
    fetchTrips();
  }, [showLanding]);

  useEffect(() => {
    if (!isSimulating) return;
    const id = setInterval(fetchTrips, 2000);
    return () => clearInterval(id);
  }, [isSimulating]);

  // ── Backend health poll — only after user enters the dashboard ──────────
  useEffect(() => {
    if (showLanding) return;
    const poll = async () => {
      try {
        await axios.get(`${API_BASE}/health`, { timeout: 3000 });
        setBackendDown(false);
      } catch {
        setBackendDown(true);
      }
    };
    poll();
    const id = setInterval(poll, 6000);
    return () => clearInterval(id);
  }, [showLanding]);

  // ── Issues polling — detects new issues and fires toast alerts ──────────
  useEffect(() => {
    if (showLanding) return;
    const poll = async () => {
      try {
        const res = await axios.get(`${API_BASE}/issues`, { timeout: 8000 });
        const freshIssues = res.data;
        setIssues(freshIssues);
        setIssuesError(false);
        freshIssues.forEach(issue => {
          if (!seenIssueIds.current.has(issue.id)) {
            seenIssueIds.current.add(issue.id);
            addAlert(issue);
          }
        });
      } catch (e) {
        console.error('Poll issues:', e.message);
      }
    };
    const id = setInterval(poll, 15000);
    return () => clearInterval(id);
  }, [showLanding, addAlert]);

  // ── Simulation fallback — fires alerts when no real backend activity ────
  useEffect(() => {
    if (showLanding) return;
    const id = setInterval(() => {
      if (Date.now() - lastAlertTime.current > 28000) {
        const fake = generateFakeIssue();
        seenIssueIds.current.add(fake.id);
        addAlert(fake);
      }
    }, 30000);
    return () => clearInterval(id);
  }, [showLanding, addAlert]);

  const fetchIssues = async () => {
    setIssuesError(false);
    try {
      const res = await axios.get(`${API_BASE}/issues`, { timeout: 8000 });
      setIssues(res.data);
      // Seed on initial fetch — don't fire alerts for pre-existing issues
      if (isInitialFetch.current) {
        res.data.forEach(i => seenIssueIds.current.add(i.id));
        isInitialFetch.current = false;
      }
    } catch (e) {
      console.error('Fetch issues:', e.message);
      setIssuesError(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchPredictions = async () => {
    try {
      const res = await axios.get(`${API_BASE}/predictions`);
      setPredictions(res.data);
    } catch (e) {
      console.error('Fetch predictions:', e.message);
    }
  };

  const fetchTrips = async () => {
    try {
      const res = await axios.get(`${API_BASE}/telemetry/trips`);
      setTrips(res.data);
    } catch (e) {
      console.error('Fetch trips:', e.message);
    }
  };

  const toggleRiskLayer = useCallback(() => {
    if (!showRiskLayer && predictions.length === 0) fetchPredictions();
    setShowRiskLayer(v => !v);
  }, [showRiskLayer, predictions.length]);

  const handleUploadComplete = (newIssue) => {
    setIssues(prev => [newIssue, ...prev]);
    seenIssueIds.current.add(newIssue.id);
    setIsUploadOpen(false);
    addAlert(newIssue);
  };

  /* ── Simulate incident ─────────────────────────────────── */
  const simulateIncident = useCallback(() => {
    const fake = generateFakeIssue();
    // Prepend to issues list (shows in sidebar + map immediately)
    setIssues(prev => [fake, ...prev]);
    // Track so the polling loop doesn't double-alert this id
    seenIssueIds.current.add(fake.id);
    // Select it — triggers map.flyTo() in MapController
    setSelectedIssue(fake);
    // Store its id so RoadMap can auto-open the popup
    setSimulatedId(fake.id);
    // Show center banner (existing) + fire a toast notification
    setIncidentAlert(fake);
    addAlert(fake);
    // Switch to map view if on admin panel
    setView('map');
  }, [addAlert]);

  const criticalCount = issues.filter(i => i.severityScore > 0.8).length;

  /* ── Render ───────────────────────────────────────────────── */

  // Still resolving Firebase auth state — show a minimal spinner
  if (user === undefined) {
    return (
      <div style={{
        height: '100vh', width: '100vw',
        background: '#0B0F14',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Loader2 size={28} color="#00E5FF" style={{ animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  // Not signed in — show auth screen
  if (!user) return <AuthScreen />;

  return (
    <AnimatePresence mode="wait">
      {showLanding ? (
        <motion.div
          key="landing"
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.65, ease: 'easeInOut' }}
        >
          {!isBooting
            ? <LandingPage onStart={bootSystem} />
            : <BootScreen logs={bootLog} />
          }
        </motion.div>
      ) : (
        <motion.div
          key="app"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="dashboard-wrapper"
        >
          {/* ── TOP BAR ─────────────────────────────────────── */}
          <TopBar
            issues={issues}
            trips={trips}
            isSimulating={isSimulating}
            onToggleSidebar={() => setSidebarCollapsed(v => !v)}
            sidebarCollapsed={sidebarCollapsed}
            onSimulateIncident={simulateIncident}
            onOpenHistory={() => { setShowAlertHistory(true); setUnreadCount(0); }}
            unreadCount={unreadCount}
            user={user}
            onSignOut={handleSignOut}
            voiceMuted={voiceMuted}
            onToggleVoice={() => setVoiceMuted(v => !v)}
          />

          {/* ── INCIDENT ALERT BANNER ────────────────────────── */}
          <AnimatePresence>
            {incidentAlert && (
              <IncidentAlert
                key={incidentAlert.id}
                issue={incidentAlert}
                onDismiss={() => setIncidentAlert(null)}
              />
            )}
          </AnimatePresence>

          {/* ── ALERT TOAST STACK (top-right floating cards) ─── */}
          <AlertToastStack alerts={alertQueue} onDismiss={dismissAlert} />

          {/* ── ALERT HISTORY PANEL (sliding side panel) ─────── */}
          <AlertHistoryPanel
            history={alertHistory}
            isOpen={showAlertHistory}
            onClose={() => setShowAlertHistory(false)}
            onClear={() => setAlertHistory([])}
          />

          {/* ── BODY ────────────────────────────────────────── */}
          <div className="dashboard-body">

            {/* ── SIDEBAR ──────────────────────────────────── */}
            <div className={`sidebar glass ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>

              {/* Logo */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: sidebarCollapsed ? 0 : '10px',
                marginBottom: '24px',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                overflow: 'hidden',
                flexShrink: 0,
              }}>
                <div style={{
                  width: 34, height: 34,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'linear-gradient(135deg, rgba(255,59,59,0.2), rgba(255,59,59,0.08))',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,59,59,0.2)',
                  boxShadow: '0 0 18px rgba(255,59,59,0.12)',
                  flexShrink: 0,
                }}>
                  <AlertTriangle color="#FF3B3B" size={18} />
                </div>
                {!sidebarCollapsed && (
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                      RoadWatch
                    </div>
                    <div style={{ fontSize: '0.6rem', color: '#00E5FF', fontWeight: 700, letterSpacing: '2px', whiteSpace: 'nowrap' }}>
                      AI COMMAND CENTER
                    </div>
                  </div>
                )}
              </div>

              {/* Divider with gradient fade */}
              <div style={{
                height: '1px',
                background: 'linear-gradient(90deg, transparent, var(--border-bright), transparent)',
                marginBottom: '16px',
                flexShrink: 0,
              }} />

              {/* ── NAVIGATION section ─────────────────────── */}
              {!sidebarCollapsed && (
                <div className="sidebar-section-label">Navigation</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px', flexShrink: 0 }}>
                <button
                  className={`nav-btn ${view === 'map' ? 'active' : ''}`}
                  onClick={() => setView('map')}
                  title={sidebarCollapsed ? 'Map View' : undefined}
                  style={{ justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}
                >
                  <MapIcon size={17} className="nav-btn-icon" style={{ flexShrink: 0 }} />
                  {!sidebarCollapsed && <span style={{ flex: 1, whiteSpace: 'nowrap' }}>Map View</span>}
                  {!sidebarCollapsed && criticalCount > 0 && view !== 'map' && (
                    <span style={{
                      background: 'linear-gradient(135deg, #FF3B3B, #CC2020)',
                      color: '#fff',
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      padding: '1px 7px',
                      borderRadius: '99px',
                      boxShadow: '0 0 8px rgba(255,59,59,0.5)',
                      letterSpacing: '0.3px',
                    }}>
                      {criticalCount}
                    </span>
                  )}
                </button>

                <button
                  className={`nav-btn ${view === 'admin' ? 'active' : ''}`}
                  onClick={() => setView('admin')}
                  title={sidebarCollapsed ? 'Intelligence Panel' : undefined}
                  style={{ justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}
                >
                  <LayoutDashboard size={17} className="nav-btn-icon" style={{ flexShrink: 0 }} />
                  {!sidebarCollapsed && <span style={{ whiteSpace: 'nowrap' }}>Intelligence Panel</span>}
                </button>
              </div>

              {/* ── TOOLS section ──────────────────────────── */}
              {!sidebarCollapsed && (
                <>
                  <div className="sidebar-section-label">Tools</div>

                  {/* PDF Report Generator */}
                  <div style={{ marginBottom: 10 }}>
                    <ReportGenerator issues={issues} />
                  </div>

                  {/* Risk layer toggle */}
                  <motion.div
                    onClick={toggleRiskLayer}
                    whileHover={{ scale: 1.01, x: 1 }}
                    whileTap={{ scale: 0.99 }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '11px 12px',
                      borderRadius: '9px',
                      border: `1px solid ${showRiskLayer ? 'rgba(0,229,255,0.25)' : 'rgba(255,255,255,0.06)'}`,
                      background: showRiskLayer
                        ? 'linear-gradient(135deg, rgba(0,229,255,0.08), rgba(0,229,255,0.02))'
                        : 'rgba(255,255,255,0.015)',
                      cursor: 'pointer',
                      marginBottom: '16px',
                      transition: 'all 0.22s ease',
                      flexShrink: 0,
                      boxShadow: showRiskLayer ? '0 0 18px rgba(0,229,255,0.07)' : 'none',
                    }}
                  >
                    <Radio
                      size={15}
                      color={showRiskLayer ? '#00E5FF' : 'var(--text-muted)'}
                      style={{
                        flexShrink: 0,
                        filter: showRiskLayer ? 'drop-shadow(0 0 5px rgba(0,229,255,0.6))' : 'none',
                        transition: 'filter 0.22s ease',
                      }}
                    />
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{
                        fontSize: '0.8rem', fontWeight: 600,
                        color: showRiskLayer ? '#00E5FF' : 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                        transition: 'color 0.22s ease',
                      }}>
                        Predictive Risk Layer
                      </div>
                      <div style={{
                        fontSize: '0.67rem', color: 'var(--text-muted)',
                        marginTop: '1px', whiteSpace: 'nowrap',
                        overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        AI-identified deterioration zones
                      </div>
                    </div>
                    {/* Toggle pill */}
                    <div style={{
                      width: '36px', height: '20px',
                      borderRadius: '99px',
                      background: showRiskLayer
                        ? 'linear-gradient(90deg, #00B8CC, #00E5FF)'
                        : 'rgba(255,255,255,0.07)',
                      position: 'relative', flexShrink: 0,
                      transition: 'all 0.25s ease',
                      border: '1px solid rgba(255,255,255,0.07)',
                      boxShadow: showRiskLayer ? '0 0 10px rgba(0,229,255,0.4)' : 'none',
                    }}>
                      <div style={{
                        position: 'absolute', top: '2px',
                        left: showRiskLayer ? '18px' : '2px',
                        width: '14px', height: '14px', borderRadius: '50%',
                        background: showRiskLayer ? '#001A1F' : '#fff',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                        transition: 'left 0.25s ease',
                      }} />
                    </div>
                  </motion.div>
                </>
              )}

              {/* ── Collapsed: tool icon buttons ────────────── */}
              {sidebarCollapsed && view === 'map' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.95 }}
                    className="topbar-btn"
                    style={{
                      width: 40, height: 40,
                      background: 'linear-gradient(135deg, rgba(255,59,59,0.14), rgba(255,59,59,0.06))',
                      border: '1px solid rgba(255,59,59,0.22)',
                      boxShadow: '0 0 14px rgba(255,59,59,0.12)',
                    }}
                    onClick={() => setIsUploadOpen(true)}
                    title="Report Road Issue"
                  >
                    <ShieldAlert size={17} color="#FF3B3B" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.95 }}
                    className="topbar-btn"
                    style={{
                      width: 40, height: 40,
                      background: showRiskLayer
                        ? 'linear-gradient(135deg, rgba(0,229,255,0.14), rgba(0,229,255,0.05))'
                        : 'rgba(255,255,255,0.03)',
                      border: showRiskLayer
                        ? '1px solid rgba(0,229,255,0.25)'
                        : '1px solid rgba(255,255,255,0.06)',
                      boxShadow: showRiskLayer ? '0 0 14px rgba(0,229,255,0.2)' : 'none',
                    }}
                    onClick={toggleRiskLayer}
                    title="Toggle Risk Layer"
                  >
                    <Radio size={16} color={showRiskLayer ? '#00E5FF' : 'var(--text-muted)'} />
                  </motion.button>
                </div>
              )}

              {/* ── Map view controls — expanded only ────────── */}
              {!sidebarCollapsed && view === 'map' && (
                <>
                  {/* Gradient divider before report button */}
                  <div style={{
                    height: '1px',
                    background: 'linear-gradient(90deg, transparent, var(--border-bright), transparent)',
                    marginBottom: '14px',
                    flexShrink: 0,
                  }} />

                  {/* Report button — full-width gradient with glow */}
                  <motion.button
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      marginBottom: '18px',
                      borderRadius: '11px',
                      flexShrink: 0,
                      fontSize: '0.875rem',
                      padding: '12px 16px',
                      letterSpacing: '0.02em',
                    }}
                    onClick={() => setIsUploadOpen(true)}
                  >
                    <ShieldAlert size={16} />
                    Report Road Issue
                  </motion.button>

                  {/* Gradient divider before incident list */}
                  <div style={{
                    height: '1px',
                    background: 'linear-gradient(90deg, var(--border-bright), transparent)',
                    marginBottom: '14px',
                    flexShrink: 0,
                  }} />
                  {!sidebarCollapsed && (
                    <div className="sidebar-section-label" style={{ marginBottom: '10px' }}>
                      Incidents
                    </div>
                  )}

                  <ErrorBoundary label="Incident Registry">
                    <Sidebar
                      issues={issues}
                      onSelectIssue={setSelectedIssue}
                      selectedIssue={selectedIssue}
                      loading={loading}
                      error={issuesError}
                    />
                  </ErrorBoundary>

                  <TripSimulator onStatusChange={setIsSimulating} />
                </>
              )}

              {/* Spacer + collapse toggle at bottom */}
              <div style={{ marginTop: 'auto', paddingTop: '16px', flexShrink: 0 }}>
                <div style={{
                  height: '1px',
                  background: 'linear-gradient(90deg, transparent, var(--border-bright), transparent)',
                  marginBottom: '12px',
                }} />
                <motion.button
                  whileHover={{ x: sidebarCollapsed ? 0 : -2 }}
                  className="nav-btn"
                  onClick={() => setSidebarCollapsed(v => !v)}
                  style={{ justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}
                  title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  {sidebarCollapsed
                    ? <ChevronRight size={16} style={{ flexShrink: 0 }} />
                    : <><ChevronLeft size={16} style={{ flexShrink: 0 }} /><span style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>Collapse</span></>
                  }
                </motion.button>
              </div>
            </div>

            {/* ── MAIN CONTENT ─────────────────────────────── */}
            <div className="main-content">

              {/* ── Issues fetch error banner ──────────────── */}
              <AnimatePresence>
                {issuesError && !loading && !backendDown && (
                  <motion.div
                    key="issues-error-banner"
                    initial={{ opacity: 0, y: -14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -14 }}
                    transition={{ duration: 0.28, ease: 'easeOut' }}
                    style={{
                      position: 'absolute',
                      top: 12, left: '50%',
                      transform: 'translateX(-50%)',
                      zIndex: 900,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '9px 14px',
                      borderRadius: 11,
                      background: 'rgba(11,15,20,0.97)',
                      border: '1px solid rgba(255,59,59,0.28)',
                      backdropFilter: 'blur(18px)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.55), 0 0 28px rgba(255,59,59,0.07)',
                      whiteSpace: 'nowrap',
                      pointerEvents: 'auto',
                    }}
                  >
                    <AlertTriangle size={13} color="#FF3B3B" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '0.77rem', color: '#8B949E' }}>
                      Failed to load incidents
                    </span>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={fetchIssues}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '4px 11px', borderRadius: 7,
                        background: 'rgba(255,59,59,0.1)',
                        border: '1px solid rgba(255,59,59,0.25)',
                        color: '#FF3B3B', fontSize: '0.7rem',
                        fontWeight: 700, cursor: 'pointer',
                        fontFamily: 'Inter, sans-serif',
                        letterSpacing: '0.2px',
                      }}
                    >
                      <RefreshCw size={11} />
                      Retry
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Service unavailable overlay ────────────── */}
              <AnimatePresence>
                {backendDown && !showLanding && (
                  <motion.div
                    key="service-unavailable"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    className="service-down-backdrop"
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.94, y: 18 }}
                      animate={{ opacity: 1, scale: 1,    y: 0  }}
                      exit={{   opacity: 0, scale: 0.94, y: 18  }}
                      transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                      style={{
                        maxWidth: 440, width: '90%',
                        background: 'rgba(11,15,20,0.97)',
                        border: '1px solid rgba(255,59,59,0.22)',
                        borderRadius: 22,
                        padding: '44px 36px 36px',
                        textAlign: 'center',
                        boxShadow: '0 28px 72px rgba(0,0,0,0.75), 0 0 60px rgba(255,59,59,0.06)',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      {/* 3px danger top strip */}
                      <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                        background: 'linear-gradient(90deg, transparent, #FF3B3B 40%, #FF3B3B 60%, transparent)',
                      }} />

                      {/* Faint radial bleed */}
                      <div style={{
                        position: 'absolute', top: '-25%', left: '50%',
                        transform: 'translateX(-50%)',
                        width: 280, height: 280, borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(255,59,59,0.07) 0%, transparent 70%)',
                        pointerEvents: 'none',
                      }} />

                      {/* Pulsing icon ring */}
                      <div style={{
                        width: 68, height: 68, borderRadius: '50%',
                        background: 'rgba(255,59,59,0.08)',
                        border: '1px solid rgba(255,59,59,0.22)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 24px',
                        animation: 'rw-pulse 2.2s ease-out infinite',
                        position: 'relative',
                      }}>
                        <ShieldAlert size={30} color="#FF3B3B" />
                      </div>

                      <h2 style={{
                        fontFamily: 'Outfit, sans-serif',
                        fontSize: '1.3rem', fontWeight: 800,
                        color: '#E6EDF3', marginBottom: 10,
                        letterSpacing: '-0.01em',
                      }}>
                        Service Unavailable
                      </h2>

                      <p style={{
                        fontSize: '0.82rem', color: '#6B7280',
                        lineHeight: 1.75, marginBottom: 26,
                      }}>
                        The RoadWatch backend is unreachable.<br />
                        Live data, map updates, and AI analysis are paused.
                      </p>

                      {/* Status pill */}
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '6px 16px', borderRadius: 99,
                        background: 'rgba(255,59,59,0.07)',
                        border: '1px solid rgba(255,59,59,0.16)',
                        marginBottom: 28,
                      }}>
                        <div style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: '#FF3B3B',
                          boxShadow: '0 0 8px rgba(255,59,59,0.9)',
                        }} />
                        <span style={{
                          fontSize: '0.68rem', fontWeight: 700,
                          color: '#FF3B3B', letterSpacing: '1px',
                          textTransform: 'uppercase',
                        }}>
                          Backend Offline
                        </span>
                      </div>

                      <br />

                      {/* Retry button */}
                      <motion.button
                        whileHover={{ scale: 1.04, y: -1 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={async () => {
                          try {
                            await axios.get(`${API_BASE}/health`, { timeout: 3000 });
                            setBackendDown(false);
                            fetchIssues();
                          } catch { /* stays down */ }
                        }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 8,
                          padding: '10px 24px', borderRadius: 11,
                          background: 'rgba(255,59,59,0.12)',
                          border: '1px solid rgba(255,59,59,0.28)',
                          color: '#FF3B3B', fontSize: '0.82rem',
                          fontWeight: 700, cursor: 'pointer',
                          letterSpacing: '0.4px',
                          fontFamily: 'Inter, sans-serif',
                          transition: 'background 0.18s ease',
                        }}
                      >
                        <RefreshCw size={14} />
                        Try Reconnecting
                      </motion.button>

                      {/* Hint: previously loaded data still visible */}
                      {issues.length > 0 && (
                        <p style={{
                          fontSize: '0.68rem', color: '#3D4957',
                          marginTop: 18, lineHeight: 1.6,
                        }}>
                          Showing {issues.length} cached incident{issues.length !== 1 ? 's' : ''} from last session.
                        </p>
                      )}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── View panels ────────────────────────────── */}
              <AnimatePresence mode="wait">
                {view === 'map' ? (
                  <motion.div
                    key="map"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ height: '100%' }}
                  >
                    <ErrorBoundary label="Road Map">
                      <RoadMap
                        issues={issues}
                        predictions={predictions}
                        showRiskLayer={showRiskLayer}
                        trips={trips}
                        selectedIssue={selectedIssue}
                        onIssueClick={setSelectedIssue}
                        onToggleRiskLayer={toggleRiskLayer}
                        simulatedId={simulatedId}
                        loading={loading}
                      />
                    </ErrorBoundary>
                  </motion.div>
                ) : (
                  <motion.div
                    key="admin"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.28 }}
                    style={{ height: '100%' }}
                  >
                    <ErrorBoundary label="Intelligence Oversight">
                      <AdminDashboard
                        issues={issues}
                        loading={loading}
                        error={issuesError}
                      />
                    </ErrorBoundary>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ── UPLOAD MODAL ─────────────────────────────── */}
          <AnimatePresence>
            {isUploadOpen && (
              <UploadModal
                onClose={() => setIsUploadOpen(false)}
                onSuccess={handleUploadComplete}
              />
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default App;
