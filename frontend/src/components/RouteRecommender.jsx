/**
 * RouteRecommender.jsx
 *
 * Smart Route Recommendation system backed by the OpenRouteService Directions API.
 * Exports two pieces:
 *   - RouteRecommenderPanel  — floating UI card (positioned absolutely over the map)
 *   - RoutePlannerLayers     — Leaflet layers (must live inside <MapContainer>)
 *
 * State is lifted to RoadMap so both pieces share the same planner object.
 */

import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Marker, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
  Navigation, X, RotateCcw, Shield, Zap, BarChart2,
  Clock, TrendingDown, Star, MapPin, ChevronRight,
  CheckCircle, Loader2, AlertTriangle,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/** Average weighted risk of issues within ~1.3 km of each route point */
function routeRisk(pts, issues) {
  if (!issues.length) return 0.06;
  const R = 0.012;
  let risk = 0;
  pts.forEach(pt => {
    issues.forEach(iss => {
      const d = Math.hypot(iss.latitude - pt[0], iss.longitude - pt[1]);
      if (d < R) risk += iss.severityScore * (1 - d / R);
    });
  });
  return clamp(risk / pts.length * 1.6, 0, 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// OPENROUTESERVICE API
// ═══════════════════════════════════════════════════════════════════════════

const ORS_ENDPOINT =
  'https://api.openrouteservice.org/v2/directions/driving-car/geojson';

async function fetchORSRoutes(start, end) {
  const key = import.meta.env.VITE_ORS_API_KEY;
  if (!key || key === 'paste_your_key_here') {
    throw new Error('ORS API key not configured — add VITE_ORS_API_KEY to frontend/.env');
  }

  // ORS uses [longitude, latitude] — opposite of Leaflet's [lat, lng]
  const body = {
    coordinates: [
      [start[1], start[0]],
      [end[1], end[0]],
    ],
    alternative_routes: {
      target_count: 3,
      weight_factor: 1.6,
      share_factor: 0.6,
    },
  };

  const res = await fetch(ORS_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: key,
      'Content-Type': 'application/json',
      Accept: 'application/json, application/geo+json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ORS ${res.status}: ${text}`);
  }

  return res.json();
}

/**
 * Fetch real road-following routes from ORS, score each one against live
 * issue data, then label them Safest / Balanced / Fastest by risk.
 */
export async function computeRoutes(start, end, issues) {
  const data = await fetchORSRoutes(start, end);
  const features = data.features;

  if (!features || features.length === 0) {
    throw new Error('No routes returned from ORS');
  }

  // Parse ORS GeoJSON: convert [lng, lat] → [lat, lng] for Leaflet
  const parsed = features.slice(0, 3).map(feature => {
    const pts = feature.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    const summary = feature.properties.summary;
    return {
      points:      pts,
      distanceKm:  (summary.distance / 1000).toFixed(1),
      estimatedMin: Math.round(summary.duration / 60),
      risk:         routeRisk(pts, issues),
    };
  });

  // Sort by risk: index 0 = safest, 1 = balanced, 2 = fastest/riskiest
  const byRisk = [...parsed].sort((a, b) => a.risk - b.risk);

  const META = [
    { id: 'safest',   label: 'Safest Route',  color: '#3DDB6B', weight: 5 },
    { id: 'balanced', label: 'Balanced Route', color: '#FFC857', weight: 4 },
    { id: 'fastest',  label: 'Fastest Route',  color: '#FF6B35', weight: 4, dashArray: '10 6' },
  ];

  return byRisk.slice(0, 3).map((r, i) => ({
    ...META[i],
    points:      r.points,
    distanceKm:  r.distanceKm,
    estimatedMin: r.estimatedMin,
    riskScore:   clamp(r.risk * 10,         0.3, 9.5),
    roadQuality: clamp(9.0 - r.risk * 6.0,  1.5, 9.6),
  }));
}

// Demo: Anna Nagar → T. Nagar (Chennai)
export const DEMO_START = [13.0827, 80.2107];
export const DEMO_END   = [13.0418, 80.2341];

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM START / END PIN ICONS
// ═══════════════════════════════════════════════════════════════════════════

function makePinIcon(label, bg) {
  const fg = bg === '#00E5FF' ? '#0B0F14' : '#fff';
  return L.divIcon({
    html: `
      <div style="
        position:relative; width:34px; height:42px;
        filter:drop-shadow(0 4px 10px rgba(0,0,0,0.65));
        animation: rw-marker-appear 0.45s cubic-bezier(0.34,1.56,0.64,1) both;
      ">
        <div style="
          width:34px; height:34px; border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          background:linear-gradient(135deg,${bg}cc,${bg});
          border:2px solid rgba(255,255,255,0.45);
          box-shadow:0 0 18px ${bg}88, 0 0 0 4px ${bg}22;
          display:flex; align-items:center; justify-content:center;
        ">
          <span style="
            transform:rotate(45deg);
            font-weight:900; font-size:14px; color:${fg}; line-height:1;
            font-family:Outfit,sans-serif;
          ">${label}</span>
        </div>
        <div style="
          position:absolute; bottom:0; left:50%; transform:translateX(-50%);
          width:6px; height:3px; border-radius:50%;
          background:rgba(0,0,0,0.35); filter:blur(2px);
        "></div>
      </div>`,
    className:   '',
    iconSize:    [34, 42],
    iconAnchor:  [17, 42],
    popupAnchor: [0, -44],
  });
}

const START_ICON = makePinIcon('A', '#00E5FF');
const END_ICON   = makePinIcon('B', '#FF3B3B');

// ═══════════════════════════════════════════════════════════════════════════
// ROUTE PLANNER LAYERS  (must be INSIDE <MapContainer>)
// ═══════════════════════════════════════════════════════════════════════════

export function RoutePlannerLayers({ planner, onMapClick }) {
  const { active, phase, start, end, routes, selectedRoute } = planner;
  const listening = active && (phase === 'set-start' || phase === 'set-end');

  const map = useMapEvents({
    click: (e) => { if (listening) onMapClick([e.latlng.lat, e.latlng.lng]); },
  });

  useEffect(() => {
    const el = map.getContainer();
    el.style.cursor = listening ? 'crosshair' : '';
    return () => { el.style.cursor = ''; };
  }, [listening, map]);

  if (!active) return null;

  return (
    <>
      {start && <Marker position={start} icon={START_ICON} />}
      {end   && <Marker position={end}   icon={END_ICON}   />}

      {phase === 'done' && routes.map((route, i) => {
        const sel = i === selectedRoute;
        return (
          <React.Fragment key={route.id}>
            {sel && (
              <Polyline
                positions={route.points}
                pathOptions={{
                  color: route.color, weight: route.weight + 10,
                  opacity: 0.10, dashArray: route.dashArray,
                  lineCap: 'round', lineJoin: 'round',
                }}
              />
            )}
            <Polyline
              positions={route.points}
              pathOptions={{
                color:     route.color,
                weight:    sel ? route.weight + 2 : route.weight - 1,
                opacity:   sel ? 0.96 : 0.28,
                dashArray: route.dashArray,
                lineCap:   'round',
                lineJoin:  'round',
              }}
            />
          </React.Fragment>
        );
      })}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED STYLE ATOMS
// ═══════════════════════════════════════════════════════════════════════════

const ICON_MAP = { safest: Shield, balanced: BarChart2, fastest: Zap };
const TAG_MAP  = {
  safest:   'Avoids all risk clusters',
  balanced: 'Optimised for both factors',
  fastest:  'Direct path · higher risk',
};

const fadeSlide = {
  initial:    { opacity: 0, y: 10 },
  animate:    { opacity: 1, y: 0  },
  exit:       { opacity: 0, y: -8 },
  transition: { duration: 0.22, ease: 'easeOut' },
};

const iconBtnCss = {
  width: 28, height: 28, borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  color: '#6B7280', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0, padding: 0,
  transition: 'background 0.15s ease, color 0.15s ease',
};

// ═══════════════════════════════════════════════════════════════════════════
// MINI BAR
// ═══════════════════════════════════════════════════════════════════════════

function MiniBar({ value, max = 10, color, delay = 0 }) {
  return (
    <div style={{
      flex: 1, height: 4,
      background: 'rgba(255,255,255,0.06)',
      borderRadius: 99, overflow: 'hidden',
    }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${clamp((value / max) * 100, 0, 100)}%` }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay }}
        style={{ height: '100%', background: color, borderRadius: 99 }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTE CARD
// ═══════════════════════════════════════════════════════════════════════════

function RouteCard({ route, index, isSelected, onSelect, isAiPick }) {
  const Icon  = ICON_MAP[route.id];
  const c     = route.color;
  const delay = index * 0.09;

  const riskColor = route.riskScore < 4 ? '#3DDB6B' : route.riskScore < 7 ? '#FFC857' : '#FF3B3B';
  const qualColor = route.roadQuality > 7 ? '#3DDB6B' : route.roadQuality > 4 ? '#FFC857' : '#FF3B3B';

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0  }}
      transition={{ duration: 0.32, delay, ease: [0.22, 1, 0.36, 1] }}
      onClick={onSelect}
      style={{
        position: 'relative', overflow: 'hidden',
        borderRadius: 13,
        border: isSelected ? `1.5px solid ${c}50` : '1px solid rgba(255,255,255,0.07)',
        background: isSelected ? `linear-gradient(135deg, ${c}10, ${c}04)` : 'rgba(255,255,255,0.025)',
        padding: '12px 14px 13px',
        cursor: 'pointer',
        boxShadow: isSelected ? `0 0 24px ${c}12` : 'none',
        transition: 'border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease',
      }}
    >
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
        background: isSelected ? c : 'rgba(255,255,255,0.06)',
        borderRadius: '13px 0 0 13px',
        transition: 'background 0.25s ease',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11, paddingLeft: 7 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9, flexShrink: 0,
          background: `${c}18`, border: `1px solid ${c}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={14} color={c} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.01em',
            color: isSelected ? '#E6EDF3' : '#8B949E',
            transition: 'color 0.2s ease',
          }}>
            {route.label}
          </div>
          <div style={{ fontSize: '0.6rem', color: '#3D4957', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {TAG_MAP[route.id]}
          </div>
        </div>

        {isAiPick && (
          <div style={{
            fontSize: '0.5rem', fontWeight: 800, letterSpacing: '0.8px',
            color: '#00E5FF', background: 'rgba(0,229,255,0.1)',
            border: '1px solid rgba(0,229,255,0.22)',
            padding: '2px 7px', borderRadius: 99, whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            AI PICK
          </div>
        )}
        {isSelected && <CheckCircle size={14} color={c} style={{ flexShrink: 0 }} />}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 7 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingDown size={10} color="#6B7280" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.61rem', color: '#6B7280', width: 40, flexShrink: 0 }}>Risk</span>
          <MiniBar value={route.riskScore} max={10} color={riskColor} delay={delay + 0.1} />
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: riskColor, width: 32, textAlign: 'right', flexShrink: 0, fontFamily: "'JetBrains Mono', monospace" }}>
            {route.riskScore.toFixed(1)}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={10} color="#6B7280" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.61rem', color: '#6B7280', width: 40, flexShrink: 0 }}>Time</span>
          <MiniBar value={Math.min(route.estimatedMin, 40)} max={40} color="#00E5FF" delay={delay + 0.15} />
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#00E5FF', width: 32, textAlign: 'right', flexShrink: 0, fontFamily: "'JetBrains Mono', monospace" }}>
            {route.estimatedMin}m
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Star size={10} color="#6B7280" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.61rem', color: '#6B7280', width: 40, flexShrink: 0 }}>Quality</span>
          <MiniBar value={route.roadQuality} max={10} color={qualColor} delay={delay + 0.2} />
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#8B949E', width: 32, textAlign: 'right', flexShrink: 0, fontFamily: "'JetBrains Mono', monospace" }}>
            {route.roadQuality.toFixed(1)}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 1 }}>
          <MapPin size={10} color="#6B7280" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.61rem', color: '#6B7280', width: 40, flexShrink: 0 }}>Dist.</span>
          <span style={{ fontSize: '0.64rem', color: '#4B5563', fontFamily: "'JetBrains Mono', monospace" }}>
            {route.distanceKm} km
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP INSTRUCTION CARD
// ═══════════════════════════════════════════════════════════════════════════

function StepCard({ step, total, title, desc, color, icon: Icon }) {
  return (
    <div style={{ textAlign: 'center', padding: '6px 4px 14px' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '3px 11px', borderRadius: 99, marginBottom: 18,
        background: `${color}12`, border: `1px solid ${color}28`,
        fontSize: '0.6rem', fontWeight: 700, color, letterSpacing: '0.8px',
      }}>
        STEP {step} / {total}
      </div>

      <motion.div
        animate={{ y: [0, -7, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width: 56, height: 56, borderRadius: '50%',
          background: `${color}0e`, border: `1px solid ${color}28`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}
      >
        <Icon size={24} color={color} />
      </motion.div>

      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#E6EDF3', marginBottom: 7, fontFamily: 'Outfit, sans-serif' }}>
        {title}
      </div>
      <div style={{ fontSize: '0.73rem', color: '#6B7280', lineHeight: 1.7 }}>
        {desc}
      </div>

      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        marginTop: 16, padding: '5px 13px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 8, fontSize: '0.64rem', color: '#4B5563',
      }}>
        <span style={{
          display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
          background: color, animation: 'rw-pulse 1.2s ease-out infinite', flexShrink: 0,
        }} />
        Cursor is now a crosshair
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DEMO BUTTON
// ═══════════════════════════════════════════════════════════════════════════

function DemoButton({ onClick }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      style={{
        width: '100%', padding: '9px 0', marginTop: 12,
        borderRadius: 10,
        background: 'rgba(0,229,255,0.05)',
        border: '1px solid rgba(0,229,255,0.16)',
        color: '#00E5FF', fontSize: '0.73rem', fontWeight: 700,
        cursor: 'pointer', letterSpacing: '0.3px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <Zap size={12} fill="#00E5FF" />
      Try Demo Route — Chennai
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPUTING STATE
// ═══════════════════════════════════════════════════════════════════════════

const COMPUTE_STEPS = [
  'Scanning risk zone database…',
  'Querying ORS road network…',
  'Computing optimal trajectories…',
  'Scoring route alternatives…',
  'Finalising AI recommendations…',
];

function ComputingState() {
  const [step, setStep] = React.useState(0);

  useEffect(() => {
    const ids = COMPUTE_STEPS.map((_, i) =>
      setTimeout(() => setStep(i), i * 330),
    );
    return () => ids.forEach(clearTimeout);
  }, []);

  const pct = Math.round(((step + 1) / COMPUTE_STEPS.length) * 100);

  return (
    <div style={{ textAlign: 'center', padding: '6px 4px 18px' }}>
      <div style={{ position: 'relative', width: 60, height: 60, margin: '0 auto 20px' }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(0,229,255,0.08)' }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid transparent', borderTopColor: '#00E5FF', borderRightColor: 'rgba(0,229,255,0.28)', animation: 'spin 0.85s linear infinite' }} />
        <div style={{ position: 'absolute', inset: 9, borderRadius: '50%', border: '1.5px solid rgba(0,229,255,0.07)', borderTopColor: 'rgba(0,229,255,0.32)', animation: 'spin 1.3s linear infinite reverse' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Navigation size={20} color="#00E5FF" />
        </div>
      </div>

      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#E6EDF3', marginBottom: 8, fontFamily: 'Outfit, sans-serif' }}>
        Analysing Routes…
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 5  }}
          animate={{ opacity: 1, y: 0  }}
          exit={{   opacity: 0, y: -5  }}
          transition={{ duration: 0.18 }}
          style={{ fontSize: '0.7rem', color: '#6B7280', marginBottom: 20, minHeight: 22 }}
        >
          {COMPUTE_STEPS[step]}
        </motion.div>
      </AnimatePresence>

      <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
        <motion.div
          initial={{ width: '4%' }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          style={{ height: '100%', background: 'linear-gradient(90deg, #00B8CC, #00E5FF)', borderRadius: 99, boxShadow: '0 0 8px rgba(0,229,255,0.5)' }}
        />
      </div>
      <div style={{ fontSize: '0.6rem', color: '#3D4957', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
        {pct}%
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ERROR STATE
// ═══════════════════════════════════════════════════════════════════════════

function ErrorState({ message, onRetry }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 4px 14px' }}>
      <div style={{
        width: 52, height: 52, borderRadius: '50%',
        background: 'rgba(255,59,59,0.08)', border: '1px solid rgba(255,59,59,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px',
      }}>
        <AlertTriangle size={22} color="#FF3B3B" />
      </div>
      <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#E6EDF3', marginBottom: 8, fontFamily: 'Outfit, sans-serif' }}>
        Route Fetch Failed
      </div>
      <div style={{ fontSize: '0.7rem', color: '#6B7280', lineHeight: 1.65, marginBottom: 18 }}>
        {message || 'Could not reach the routing service.'}
      </div>
      <motion.button
        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
        onClick={onRetry}
        style={{
          padding: '8px 20px', borderRadius: 9,
          background: 'rgba(255,59,59,0.09)',
          border: '1px solid rgba(255,59,59,0.25)',
          color: '#FF3B3B', fontSize: '0.75rem', fontWeight: 700,
          cursor: 'pointer', fontFamily: 'Inter, sans-serif',
        }}
      >
        Try Again
      </motion.button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTE RECOMMENDER PANEL  (positioned absolutely outside MapContainer)
// ═══════════════════════════════════════════════════════════════════════════

export function RouteRecommenderPanel({ planner, onAction, issues }) {
  const { active, phase, start, routes, selectedRoute, error } = planner;

  const hasCritical = issues.some(i => i.severityScore > 0.8);
  const aiPickIdx   = routes.length
    ? (hasCritical ? 0 : (routes[1]?.riskScore < 5.5 ? 1 : 0))
    : 0;

  if (!active) {
    return (
      <motion.button
        key="launch"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0  }}
        transition={{ duration: 0.4, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        whileHover={{ scale: 1.04, y: -2, boxShadow: '0 12px 40px rgba(0,0,0,0.55), 0 0 30px rgba(0,229,255,0.14)' }}
        whileTap={{ scale: 0.96 }}
        onClick={() => onAction({ type: 'OPEN' })}
        style={{
          position: 'absolute', bottom: 28, left: 16, zIndex: 800,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 16px', borderRadius: 12,
          background: 'rgba(11,15,20,0.95)',
          backdropFilter: 'blur(18px)',
          border: '1px solid rgba(0,229,255,0.2)',
          color: '#00E5FF', fontSize: '0.75rem', fontWeight: 700,
          letterSpacing: '0.4px', cursor: 'pointer',
          fontFamily: 'Inter, sans-serif',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(0,229,255,0.07)',
          whiteSpace: 'nowrap',
        }}
      >
        <Navigation size={14} />
        Route Planner
        <ChevronRight size={12} style={{ opacity: 0.55 }} />
      </motion.button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        key="panel"
        initial={{ opacity: 0, x: -28, scale: 0.96 }}
        animate={{ opacity: 1, x: 0,   scale: 1    }}
        exit={{   opacity: 0, x: -28, scale: 0.96  }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'absolute',
          bottom: 20, left: 16,
          zIndex: 800,
          width: 338,
          maxHeight: 'calc(100% - 90px)',
          display: 'flex', flexDirection: 'column',
          background: 'rgba(11,15,20,0.97)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: 18,
          boxShadow: '0 20px 64px rgba(0,0,0,0.72), 0 0 0 1px rgba(255,255,255,0.025)',
          overflow: 'hidden',
        }}
      >
        <div style={{ height: 3, flexShrink: 0, background: 'linear-gradient(90deg, transparent, #00E5FF88, #00E5FF, #00E5FF88, transparent)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, padding: '13px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ width: 33, height: 33, borderRadius: 10, flexShrink: 0, background: 'linear-gradient(135deg, rgba(0,229,255,0.14), rgba(0,229,255,0.05))', border: '1px solid rgba(0,229,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Navigation size={16} color="#00E5FF" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.87rem', fontWeight: 800, color: '#E6EDF3', letterSpacing: '-0.01em' }}>
              Smart Route Planner
            </div>
            <div style={{ fontSize: '0.58rem', color: '#3D4957', letterSpacing: '1.2px', textTransform: 'uppercase' }}>
              OPENROUTESERVICE · AI-SCORED
            </div>
          </div>
          {phase === 'done' && (
            <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.93 }} onClick={() => onAction({ type: 'CLEAR' })} style={{ ...iconBtnCss, marginRight: 4 }} title="Plan new route">
              <RotateCcw size={12} />
            </motion.button>
          )}
          <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.93 }} onClick={() => onAction({ type: 'CLOSE' })} style={iconBtnCss} title="Close">
            <X size={12} />
          </motion.button>
        </div>

        <div style={{ padding: '14px 16px 18px', overflowY: 'auto', flex: 1 }}>
          <AnimatePresence mode="wait">

            {phase === 'set-start' && (
              <motion.div key="set-start" {...fadeSlide}>
                <StepCard step={1} total={2} title="Set Start Point" desc="Click anywhere on the map to place your starting pin." color="#00E5FF" icon={MapPin} />
                <DemoButton onClick={() => onAction({ type: 'DEMO' })} />
              </motion.div>
            )}

            {phase === 'set-end' && (
              <motion.div key="set-end" {...fadeSlide}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 9, marginBottom: 14, background: 'rgba(61,219,107,0.06)', border: '1px solid rgba(61,219,107,0.18)' }}>
                  <CheckCircle size={13} color="#3DDB6B" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: '0.71rem', color: '#3DDB6B', fontWeight: 700 }}>Start set</span>
                  <span style={{ fontSize: '0.61rem', color: '#4B5563', marginLeft: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                    {start[0].toFixed(4)}, {start[1].toFixed(4)}
                  </span>
                </div>
                <StepCard step={2} total={2} title="Set Destination" desc="Click the map to place your end pin. Real road routes will generate instantly." color="#FF6B35" icon={MapPin} />
                <DemoButton onClick={() => onAction({ type: 'DEMO' })} />
              </motion.div>
            )}

            {phase === 'computing' && (
              <motion.div key="computing" {...fadeSlide}>
                <ComputingState />
              </motion.div>
            )}

            {phase === 'error' && (
              <motion.div key="error" {...fadeSlide}>
                <ErrorState message={error} onRetry={() => onAction({ type: 'RETRY' })} />
              </motion.div>
            )}

            {phase === 'done' && (
              <motion.div key="done" {...fadeSlide}>
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1,  y:  0 }}
                  transition={{ duration: 0.35 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 9, marginBottom: 12, background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.14)' }}
                >
                  <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#00E5FF', boxShadow: '0 0 6px #00E5FF', animation: 'rw-pulse 1.8s ease-out infinite', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.68rem', color: '#6B7280' }}>AI recommends:</span>
                  <span style={{ fontSize: '0.73rem', fontWeight: 800, color: '#00E5FF' }}>
                    {routes[aiPickIdx]?.label ?? 'Safest Route'}
                  </span>
                </motion.div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {routes.map((route, i) => (
                    <RouteCard
                      key={route.id}
                      route={route}
                      index={i}
                      isSelected={selectedRoute === i}
                      isAiPick={i === aiPickIdx && selectedRoute !== i}
                      onSelect={() => onAction({ type: 'SELECT', index: i })}
                    />
                  ))}
                </div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.45, duration: 0.3 }}
                  style={{ marginTop: 14, padding: '9px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <span style={{ fontSize: '0.62rem', color: '#4B5563' }}>
                    {routes.length} real road routes
                  </span>
                  <span style={{ fontSize: '0.62rem', color: '#3D4957', fontFamily: "'JetBrains Mono', monospace" }}>
                    via OpenRouteService
                  </span>
                </motion.div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
