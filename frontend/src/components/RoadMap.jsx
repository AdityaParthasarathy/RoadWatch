import React, { useEffect, useRef, useCallback, useReducer } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Tooltip,
  Circle,
  Polyline,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, Clock, MapPin, Layers, TrendingUp, Eye, EyeOff, Activity, Heart } from 'lucide-react';

import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import {
  RouteRecommenderPanel,
  RoutePlannerLayers,
  computeRoutes,
  DEMO_START,
  DEMO_END,
} from './RouteRecommender';
import {
  RoadHealthOverlay,
  RoadHealthPanel,
  computeHealthGrid,
} from './RoadHealthPanel';

// ─── Fix Leaflet default icon paths in Vite ───────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ shadowUrl: markerShadow });

const DEFAULT_CENTER = [13.0827, 80.2707]; // Chennai
const DEFAULT_ZOOM   = 13;

// ═══════════════════════════════════════════════════════════════════════════
// SEVERITY HELPERS
// ═══════════════════════════════════════════════════════════════════════════
const getSeverityColor = (score) => {
  if (score > 0.8) return '#FF3B3B';
  if (score > 0.4) return '#FFC857';
  return '#3DDB6B';
};

const getSeverityLabel = (score) => {
  if (score > 0.8) return 'CRITICAL';
  if (score > 0.4) return 'WARNING';
  return 'MINOR';
};

// ─── Deterministic AI confidence per issue ────────────────────────────────
//     (consistent across re-renders; slightly correlated with severity)
const getAiConfidence = (issue) => {
  const seed = (issue.id || '')
    .split('')
    .reduce((acc, ch) => ((acc * 31) + ch.charCodeAt(0)) & 0xffff, 7);
  const noise = ((seed % 24) - 12) / 100;           // ±0.12 jitter
  return Math.max(0.61, Math.min(0.98, issue.severityScore * 0.22 + 0.71 + noise));
};

// ═══════════════════════════════════════════════════════════════════════════
// AI RISK HEATMAP — static seed clusters + dynamic issue overlay
// ═══════════════════════════════════════════════════════════════════════════
//
// `r` = radius in screen-pixels at zoom 13 (doubles per zoom level).
// Risk thresholds mirror the severity scheme: >0.7 red, >0.4 amber, else green.
//
const HEATMAP_CLUSTERS = [
  // ── Chennai ──────────────────────────────────────────────────────────────
  { lat: 13.0674, lng: 80.2376, risk: 0.88, r: 110 },  // Anna Nagar
  { lat: 13.0418, lng: 80.2341, risk: 0.72, r:  95 },  // T. Nagar
  { lat: 13.0827, lng: 80.2707, risk: 0.85, r: 120 },  // Royapettah
  { lat: 13.0569, lng: 80.2425, risk: 0.55, r:  85 },  // Vadapalani
  { lat: 13.1067, lng: 80.2206, risk: 0.42, r:  80 },  // Ambattur
  { lat: 13.0143, lng: 80.2068, risk: 0.65, r:  90 },  // Pallavaram
  { lat: 13.0932, lng: 80.2809, risk: 0.78, r: 100 },  // Perambur
  { lat: 13.0499, lng: 80.2134, risk: 0.35, r:  75 },  // Ashok Nagar
  { lat: 13.0600, lng: 80.2580, risk: 0.93, r: 130 },  // Central Chennai
  { lat: 13.0740, lng: 80.2480, risk: 0.68, r:  90 },  // Mid Chennai
  { lat: 13.0890, lng: 80.2650, risk: 0.74, r: 105 },  // North Chennai
  { lat: 13.0350, lng: 80.2700, risk: 0.81, r: 115 },  // South Chennai
  // ── NYC ──────────────────────────────────────────────────────────────────
  { lat: 40.7128, lng: -74.0060, risk: 0.79, r: 115 },  // Downtown
  { lat: 40.7282, lng: -73.9942, risk: 0.58, r:  90 },  // Greenwich Vlg
  { lat: 40.7614, lng: -73.9776, risk: 0.45, r:  95 },  // Midtown
  { lat: 40.7831, lng: -73.9712, risk: 0.82, r: 120 },  // Upper West Side
  { lat: 40.6892, lng: -74.0445, risk: 0.63, r:  85 },  // Staten Island
  { lat: 40.7489, lng: -73.9680, risk: 0.70, r: 100 },  // Murray Hill
];

// Merge static clusters with live issue positions for a fully dynamic map
function buildRiskPoints(issues) {
  const fromIssues = issues.map(i => ({
    lat: i.latitude,
    lng: i.longitude,
    risk: i.severityScore,
    r: Math.round(55 + i.severityScore * 65),   // 55–120 px
  }));
  return [...HEATMAP_CLUSTERS, ...fromIssues];
}

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM DIVICON MARKER FACTORY
// ═══════════════════════════════════════════════════════════════════════════
//
// Three tiers (critical / warning / minor), each with normal + active states.
// All animations use keyframes defined in index.css:
//   rw-marker-appear — bounce-in entry
//   rw-pulse         — expanding ring (steady, infinite)
//   rw-ripple        — fast burst ring for active/selected state
//
const createMarkerIcon = (severityScore, isActive = false, appearDelay = 0) => {
  const color  = getSeverityColor(severityScore);
  const isCrit = severityScore > 0.8;
  const isWarn = severityScore > 0.4;

  // Container size + core size per tier + state
  const outer = isCrit
    ? (isActive ? 56 : 44)
    : isWarn
      ? (isActive ? 44 : 32)
      : (isActive ? 32 : 24);

  const core  = isCrit
    ? (isActive ? 16 : 14)
    : isWarn
      ? (isActive ? 14 : 12)
      : (isActive ? 12 : 10);

  // Ring 2 (inner secondary ring) only for critical + active warning
  const ring2Inset = isCrit
    ? Math.round(outer * 0.18)    // ~18% inset from each edge
    : (isWarn && isActive)
      ? Math.round(outer * 0.18)
      : null;

  // Pulse duration: fast for critical, slow for minor
  const pulseDur  = isCrit ? '2s' : isWarn ? '2.6s' : '3.2s';
  const ring1Opa  = isCrit ? '0.65' : isWarn ? '0.45' : '0.28';

  // Ripple timing for active state
  const rippleDur = isCrit ? '1.15s' : isWarn ? '1.5s' : '1.9s';

  // Core gradient (lighter → base color, top-left → bottom-right)
  const lightColor = isCrit ? '#FF7070' : isWarn ? '#FFE08A' : '#6FEEA0';
  const glowPx     = isCrit ? 14 : isWarn ? 10 : 7;
  const hlSize     = Math.max(3, Math.round(core * 0.30)); // small specular dot

  // Only stagger delay on initial appear, not on active-state icon swap
  const delay = isActive ? 0 : appearDelay;

  const html = `
    <div style="
      position:relative;
      width:${outer}px; height:${outer}px;
      display:flex; align-items:center; justify-content:center;
      animation: rw-marker-appear 0.45s cubic-bezier(0.34,1.56,0.64,1) ${delay}s both;
    ">

      ${/* ── Active ripple burst — expands outward from marker center ── */ ''}
      ${isActive ? `
        <div style="
          position:absolute; inset:0; border-radius:50%;
          border:2px solid ${color};
          animation: rw-ripple ${rippleDur} ease-out infinite;
        "></div>
      ` : ''}

      ${/* ── White selection ring (active only) ── */ ''}
      ${isActive ? `
        <div style="
          position:absolute; inset:-3px; border-radius:50%;
          border:1.5px solid rgba(255,255,255,0.45);
          box-shadow:0 0 14px rgba(255,255,255,0.12);
        "></div>
      ` : ''}

      ${/* ── Outer pulse ring (all tiers) ── */ ''}
      <div style="
        position:absolute; inset:0; border-radius:50%;
        border:${isCrit ? '1.5px' : '1px'} solid ${color};
        animation: rw-pulse ${pulseDur} ease-out infinite;
        opacity:${ring1Opa};
      "></div>

      ${/* ── Inner secondary pulse ring (critical + active warning) ── */ ''}
      ${ring2Inset !== null ? `
        <div style="
          position:absolute; inset:${ring2Inset}px; border-radius:50%;
          border:1px solid ${color};
          animation: rw-pulse ${pulseDur} ease-out 0.55s infinite;
          opacity:0.42;
        "></div>
      ` : ''}

      ${/* ── Soft glow halo behind core ── */ ''}
      <div style="
        position:absolute;
        width:${core + 6}px; height:${core + 6}px; border-radius:50%;
        background:${color};
        opacity:0.18;
        filter:blur(4px);
      "></div>

      ${/* ── Core dot ── */ ''}
      <div style="
        position:relative; z-index:1;
        width:${core}px; height:${core}px; border-radius:50%;
        background:linear-gradient(145deg, ${lightColor}, ${color});
        border:2px solid rgba(255,255,255,0.38);
        box-shadow:
          0 0 ${glowPx}px ${color},
          0 0 ${glowPx * 2}px ${color}44,
          0 2px 8px rgba(0,0,0,0.65);
      ">
        ${/* specular highlight */ ''}
        <div style="
          position:absolute; top:2px; left:3px;
          width:${hlSize}px; height:${hlSize}px; border-radius:50%;
          background:rgba(255,255,255,0.6);
        "></div>
      </div>

    </div>
  `;

  return L.divIcon({
    html,
    className:   '',
    iconSize:    [outer, outer],
    iconAnchor:  [outer / 2, outer / 2],
    popupAnchor: [0, -(outer / 2 + 10)],
  });
};

// ═══════════════════════════════════════════════════════════════════════════
// MAP CONTROLLER — flies to selected issue; opens popup for simulated ones
// ═══════════════════════════════════════════════════════════════════════════
function MapController({ selectedIssue, simulatedId, markerRefs }) {
  const map = useMap();

  useEffect(() => {
    if (!selectedIssue) return;

    map.flyTo(
      [selectedIssue.latitude, selectedIssue.longitude],
      16,
      { animate: true, duration: 1.1 },
    );

    // After fly-to completes (≈1.1s + small buffer), open the popup
    // but only for programmatically simulated issues
    if (selectedIssue.id === simulatedId) {
      const timeout = setTimeout(() => {
        const ref = markerRefs.current[selectedIssue.id];
        if (ref) ref.openPopup();
      }, 1300);
      return () => clearTimeout(timeout);
    }
  }, [selectedIssue, simulatedId, map]);

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// HEATMAP CANVAS OVERLAY
// ═══════════════════════════════════════════════════════════════════════════
//
// Renders a full-size <canvas> appended directly to the Leaflet map container
// (screen-space, not world-space) — redrawn on every map move/zoom via events.
// Smooth fade is achieved with CSS `transition: opacity`.
//
function HeatmapCanvas({ points, visible }) {
  const map      = useMap();
  // Pre-create the canvas element once so we can ref it stably
  const canvasRef = useRef(document.createElement('canvas'));
  // Always-current redraw function pointer — avoids stale closure in the
  // stable map event handler while still supporting dependency changes.
  const redrawRef = useRef(null);

  // Build the draw routine; recreated whenever points or visibility changes
  const redraw = useCallback(() => {
    const canvas    = canvasRef.current;
    const container = map.getContainer();

    // Match canvas size to the map container exactly
    canvas.width  = container.clientWidth;
    canvas.height = container.clientHeight;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!visible || !points.length) return;

    const zoom  = map.getZoom();
    const scale = Math.pow(2, zoom - 13);   // doubles each zoom step

    points.forEach(({ lat, lng, risk, r }) => {
      const px     = map.latLngToContainerPoint(L.latLng(lat, lng));
      const radius = Math.max(4, r * scale);

      // Skip completely out-of-view blobs
      if (
        px.x < -radius || px.x > canvas.width  + radius ||
        px.y < -radius || px.y > canvas.height + radius
      ) return;

      // Colour by risk level — mirrors the severity scheme
      let cr, cg, cb;
      if      (risk > 0.7) { cr = 255; cg = 59;  cb = 59;  }  // red
      else if (risk > 0.4) { cr = 255; cg = 200; cb = 87;  }  // amber
      else                 { cr = 61;  cg = 219; cb = 107; }  // green

      // Soft radial gradient — dense centre, feathers to transparent edge
      const grd = ctx.createRadialGradient(px.x, px.y, 0, px.x, px.y, radius);
      grd.addColorStop(0,    `rgba(${cr},${cg},${cb},0.52)`);
      grd.addColorStop(0.30, `rgba(${cr},${cg},${cb},0.28)`);
      grd.addColorStop(0.65, `rgba(${cr},${cg},${cb},0.07)`);
      grd.addColorStop(1,    `rgba(${cr},${cg},${cb},0)`);

      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(px.x, px.y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [map, points, visible]);

  // Keep the ref in sync on every render so the stable event handler below
  // always calls the latest version of redraw
  redrawRef.current = redraw;

  // ── Mount / unmount the canvas + register Leaflet events (once) ─────────
  useEffect(() => {
    const canvas    = canvasRef.current;
    const container = map.getContainer();

    Object.assign(canvas.style, {
      position:      'absolute',
      top:           '0',
      left:          '0',
      pointerEvents: 'none',
      zIndex:        '450',              // above tiles (200), below markers (600)
      transition:    'opacity 0.55s ease',
      opacity:       '0',
    });

    container.appendChild(canvas);

    // Stable handler — always delegates to current redraw via ref
    const handler = () => redrawRef.current?.();
    map.on('move moveend zoom zoomend resize viewreset', handler);
    handler();   // initial paint

    return () => {
      map.off('move moveend zoom zoomend resize viewreset', handler);
      if (container.contains(canvas)) container.removeChild(canvas);
    };
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fade the canvas in / out when `visible` flips ───────────────────────
  useEffect(() => {
    canvasRef.current.style.opacity = visible ? '1' : '0';
  }, [visible]);

  // ── Repaint whenever points or visibility changes ────────────────────────
  useEffect(() => { redraw(); }, [redraw]);

  return null;   // nothing rendered in the React tree — canvas is in the DOM directly
}

// ═══════════════════════════════════════════════════════════════════════════
// FLOATING LEGEND
// ═══════════════════════════════════════════════════════════════════════════
const legendRowVariants = {
  hidden:  { opacity: 0, x: 8 },
  visible: (i) => ({
    opacity: 1, x: 0,
    transition: { delay: 0.35 + i * 0.07, duration: 0.28, ease: 'easeOut' },
  }),
};

function MapLegend() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: 'absolute',
        bottom: '28px',
        right: '16px',
        zIndex: 800,
        background: 'rgba(11,15,20,0.94)',
        backdropFilter: 'blur(18px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '14px',
        padding: '14px 18px',
        minWidth: '174px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontSize: '0.59rem', fontWeight: 700, color: '#8B949E', letterSpacing: '1.4px', textTransform: 'uppercase', marginBottom: '12px' }}>
        Map Legend
      </div>

      {[
        { color: '#FF3B3B', label: 'Critical' },
        { color: '#FFC857', label: 'Warning'  },
        { color: '#3DDB6B', label: 'Minor'    },
      ].map(({ color, label }, i) => (
        <motion.div
          key={label}
          custom={i}
          initial="hidden"
          animate="visible"
          variants={legendRowVariants}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '9px' }}
        >
          <div style={{ position: 'relative', width: 14, height: 14, flexShrink: 0 }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              border: `1px solid ${color}`,
              opacity: 0.4,
            }} />
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              width: 8, height: 8, borderRadius: '50%',
              background: color,
              boxShadow: `0 0 6px ${color}88`,
            }} />
          </div>
          <span style={{ fontSize: '0.75rem', color: '#E6EDF3' }}>{label}</span>
        </motion.div>
      ))}

      <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '10px 0' }} />

      <div style={{ fontSize: '0.59rem', fontWeight: 700, color: '#8B949E', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: '10px' }}>
        Trip Paths
      </div>
      {[
        { color: '#3DDB6B', label: 'Smooth road' },
        { color: '#FFC857', label: 'Bumpy road'  },
        { color: '#FF3B3B', label: 'Rough road'  },
      ].map(({ color, label }, i) => (
        <motion.div
          key={label}
          custom={i + 3}
          initial="hidden"
          animate="visible"
          variants={legendRowVariants}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '7px' }}
        >
          <div style={{ width: 18, height: 3, background: color, borderRadius: '99px', flexShrink: 0 }} />
          <span style={{ fontSize: '0.75rem', color: '#8B949E' }}>{label}</span>
        </motion.div>
      ))}

      <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '10px 0' }} />
      <motion.div
        custom={6}
        initial="hidden"
        animate="visible"
        variants={legendRowVariants}
        style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
      >
        <div style={{
          width: 18, height: 18, borderRadius: '50%',
          border: '1.5px dashed #FF3B3B',
          background: 'rgba(255,59,59,0.12)',
          flexShrink: 0,
        }} />
        <span style={{ fontSize: '0.75rem', color: '#8B949E' }}>AI Risk Zone</span>
      </motion.div>

      {/* ── Heatmap gradient band ──────────────────────────── */}
      <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '10px 0' }} />

      <motion.div
        custom={7}
        initial="hidden"
        animate="visible"
        variants={legendRowVariants}
      >
        <div style={{
          fontSize: '0.59rem', fontWeight: 700, color: '#8B949E',
          letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: '9px',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Activity size={9} color="#8B949E" />
          Risk Heatmap
        </div>

        {/* Gradient bar */}
        <div style={{
          height: 7,
          borderRadius: 99,
          background: 'linear-gradient(90deg, #3DDB6B 0%, #FFC857 50%, #FF3B3B 100%)',
          marginBottom: 5,
          boxShadow: '0 0 10px rgba(255,59,59,0.18)',
        }} />

        {/* Labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.57rem', color: '#3DDB6B', fontWeight: 600 }}>Low</span>
          <span style={{ fontSize: '0.57rem', color: '#FFC857', fontWeight: 600 }}>Med</span>
          <span style={{ fontSize: '0.57rem', color: '#FF3B3B', fontWeight: 600 }}>High</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FLOATING CONTROL PANEL
// ═══════════════════════════════════════════════════════════════════════════
function TogglePill({ active, onClick, activeColor = '#00E5FF', activeGrad }) {
  const bg = active
    ? (activeGrad ?? `linear-gradient(90deg, ${activeColor}99, ${activeColor})`)
    : 'rgba(255,255,255,0.07)';
  return (
    <motion.div
      onClick={onClick}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.93 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      style={{
        width: 36, height: 20, borderRadius: '99px',
        background: bg,
        border: `1px solid ${active ? `${activeColor}44` : 'rgba(255,255,255,0.1)'}`,
        position: 'relative',
        cursor: 'pointer',
        transition: 'all 0.25s ease',
        flexShrink: 0,
        boxShadow: active ? `0 0 10px ${activeColor}44` : 'none',
      }}
    >
      <div style={{
        position: 'absolute',
        top: 3,
        left: active ? 18 : 3,
        width: 12, height: 12, borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.25s ease',
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      }} />
    </motion.div>
  );
}

function ControlPanel({ showRiskLayer, onToggleRiskLayer, showHeatmap, onToggleHeatmap, showHealthLayer, onToggleHealthLayer }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        zIndex: 800,
        background: 'rgba(11,15,20,0.94)',
        backdropFilter: 'blur(18px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '14px',
        padding: '14px 18px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        minWidth: 178,
      }}
    >
      <div style={{ fontSize: '0.59rem', fontWeight: 700, color: '#8B949E', letterSpacing: '1.4px', textTransform: 'uppercase', marginBottom: '12px' }}>
        Layers
      </div>

      {/* ── Row 1: predictions risk circles ──────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '11px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
          {showRiskLayer
            ? <Eye size={13} color="#00E5FF" />
            : <EyeOff size={13} color="#4B5563" />
          }
          <span style={{ fontSize: '0.78rem', color: showRiskLayer ? '#E6EDF3' : '#6B7280', whiteSpace: 'nowrap' }}>
            Risk Layer
          </span>
        </div>
        <TogglePill
          active={showRiskLayer}
          onClick={onToggleRiskLayer}
          activeColor="#00E5FF"
          activeGrad="linear-gradient(90deg, #00B8CC, #00E5FF)"
        />
      </div>

      {/* thin divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: '11px' }} />

      {/* ── Row 2: AI heatmap ────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '11px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
          <Activity
            size={13}
            color={showHeatmap ? '#FF6B6B' : '#4B5563'}
            style={{ transition: 'color 0.25s ease' }}
          />
          <span style={{ fontSize: '0.78rem', color: showHeatmap ? '#E6EDF3' : '#6B7280', whiteSpace: 'nowrap', transition: 'color 0.25s ease' }}>
            Risk Heatmap
          </span>
        </div>
        <TogglePill
          active={showHeatmap}
          onClick={onToggleHeatmap}
          activeColor="#FF3B3B"
          activeGrad="linear-gradient(90deg, #CC2020, #FF3B3B)"
        />
      </div>

      {/* thin divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: '11px' }} />

      {/* ── Row 3: Road Health Index ─────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
          <Heart
            size={13}
            color={showHealthLayer ? '#3DDB6B' : '#4B5563'}
            style={{ transition: 'color 0.25s ease' }}
          />
          <span style={{ fontSize: '0.78rem', color: showHealthLayer ? '#E6EDF3' : '#6B7280', whiteSpace: 'nowrap', transition: 'color 0.25s ease' }}>
            Health Index
          </span>
        </div>
        <TogglePill
          active={showHealthLayer}
          onClick={onToggleHealthLayer}
          activeColor="#3DDB6B"
          activeGrad="linear-gradient(90deg, #2BA84A, #3DDB6B)"
        />
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTE PLANNER STATE MACHINE
// ═══════════════════════════════════════════════════════════════════════════

const plannerInit = {
  active: false,
  phase: 'set-start',   // 'set-start' | 'set-end' | 'computing' | 'done' | 'error'
  start: null,
  end: null,
  routes: [],
  selectedRoute: 0,
  error: null,
};

function plannerReducer(state, action) {
  switch (action.type) {
    case 'OPEN':      return { ...plannerInit, active: true };
    case 'CLOSE':     return { ...plannerInit };
    case 'CLEAR':     return { ...plannerInit, active: true };
    case 'SET_START': return { ...state, phase: 'set-end',    start: action.pos, error: null };
    case 'SET_END':   return { ...state, phase: 'computing',  end:   action.pos, error: null };
    case 'SET_ROUTES':return { ...state, phase: 'done',       routes: action.routes };
    case 'SET_ERROR': return { ...state, phase: 'error',      error: action.message };
    case 'RETRY':     return { ...state, phase: 'computing',  error: null };
    case 'SELECT':    return { ...state, selectedRoute: action.index };
    case 'DEMO':      return { ...state, phase: 'computing',  start: DEMO_START, end: DEMO_END, error: null };
    default:          return state;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export function RoadMap({
  issues, predictions, showRiskLayer, onToggleRiskLayer,
  trips, selectedIssue, onIssueClick, simulatedId, loading = false,
}) {
  // markerRefs holds { [issueId]: leafletMarkerInstance }
  // Used by MapController to imperatively open the popup on simulated issues
  const markerRefs = useRef({});

  // ── AI Risk Heatmap (local state — purely a visual overlay) ─────────────
  const [showHeatmap, setShowHeatmap] = React.useState(true);
  const heatmapPoints = React.useMemo(() => buildRiskPoints(issues), [issues]);

  // ── Road Health Index overlay ────────────────────────────────────────────
  const [showHealthLayer, setShowHealthLayer] = React.useState(false);
  const healthCells = React.useMemo(() => computeHealthGrid(issues), [issues]);

  // ── Route planner state ──────────────────────────────────────────────────
  const [planner, plannerDispatch] = useReducer(plannerReducer, plannerInit);

  const handlePlannerAction = useCallback((action) => {
    plannerDispatch(action);
  }, []);

  const handleMapClick = useCallback((pos) => {
    if (planner.phase === 'set-start') plannerDispatch({ type: 'SET_START', pos });
    else if (planner.phase === 'set-end') plannerDispatch({ type: 'SET_END', pos });
  }, [planner.phase]);

  // Trigger ORS route fetch whenever phase enters 'computing'
  useEffect(() => {
    if (planner.phase !== 'computing' || !planner.start || !planner.end) return;
    let cancelled = false;
    computeRoutes(planner.start, planner.end, issues)
      .then(routes => {
        if (!cancelled) plannerDispatch({ type: 'SET_ROUTES', routes });
      })
      .catch(err => {
        if (!cancelled) plannerDispatch({ type: 'SET_ERROR', message: err.message });
      });
    return () => { cancelled = true; };
  }, [planner.phase, planner.start, planner.end]);

  const criticalCount = issues.filter(i => i.severityScore > 0.8).length;

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>

      {/* ── Stats overlay (top-left, above tiles) ────────────────────────── */}
      <div style={{
        position: 'absolute', top: 16, left: 16,
        zIndex: 800, display: 'flex', gap: 8, pointerEvents: 'none',
      }}>
        {/* Total */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          style={{
            background: 'rgba(11,15,20,0.94)', backdropFilter: 'blur(18px)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 13,
            padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
          }}
        >
          <Layers size={14} color="#8B949E" />
          <div>
            <div style={{ fontSize: '0.57rem', color: '#6B7280', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 2 }}>
              Total Issues
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#E6EDF3', lineHeight: 1 }}>
              {issues.length}
            </div>
          </div>
        </motion.div>

        {/* High risk */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
          style={{
            background: 'rgba(11,15,20,0.94)', backdropFilter: 'blur(18px)',
            border: `1px solid ${criticalCount > 0 ? 'rgba(255,59,59,0.3)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 13, padding: '10px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: criticalCount > 0
              ? '0 4px 20px rgba(255,59,59,0.2)'
              : '0 4px 20px rgba(0,0,0,0.45)',
          }}
        >
          <TrendingUp size={14} color={criticalCount > 0 ? '#FF3B3B' : '#8B949E'} />
          <div>
            <div style={{ fontSize: '0.57rem', color: '#6B7280', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 2 }}>
              High Risk
            </div>
            <div style={{
              fontSize: '1.3rem', fontWeight: 800, lineHeight: 1,
              color: criticalCount > 0 ? '#FF3B3B' : '#E6EDF3',
            }}>
              {criticalCount}
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Control panel (top-right) ─────────────────────────────────────── */}
      <ControlPanel
        showRiskLayer={showRiskLayer}
        onToggleRiskLayer={onToggleRiskLayer}
        showHeatmap={showHeatmap}
        onToggleHeatmap={() => setShowHeatmap(v => !v)}
        showHealthLayer={showHealthLayer}
        onToggleHealthLayer={() => setShowHealthLayer(v => !v)}
      />

      {/* ── Legend (bottom-right) ─────────────────────────────────────────── */}
      <MapLegend />

      {/* ── Map loading skeleton overlay ─────────────────────────────────── */}
      <AnimatePresence>
        {loading && (
          <motion.div
            key="map-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 801,
              pointerEvents: 'none',
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              style={{
                background: 'rgba(11,15,20,0.94)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 18,
                padding: '22px 32px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
              }}
            >
              {/* Spinner ring */}
              <div style={{ position: 'relative', width: 28, height: 28, flexShrink: 0 }}>
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  border: '2px solid rgba(0,229,255,0.1)',
                }} />
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  border: '2px solid transparent',
                  borderTopColor: '#00E5FF',
                  animation: 'spin 0.8s linear infinite',
                }} />
              </div>
              <div>
                <div style={{
                  fontSize: '0.82rem', fontWeight: 700,
                  color: '#E6EDF3', marginBottom: 3,
                }}>
                  Loading Map Data
                </div>
                <div style={{ fontSize: '0.68rem', color: '#4B5563' }}>
                  Fetching incidents…
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── No issues empty state ─────────────────────────────────────────── */}
      <AnimatePresence>
        {!loading && issues.length === 0 && (
          <motion.div
            key="map-empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            style={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 800,
              pointerEvents: 'none',
              textAlign: 'center',
            }}
          >
            <motion.div
              initial={{ scale: 0.92, y: 12, opacity: 0 }}
              animate={{ scale: 1,    y: 0,  opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
              style={{
                background: 'rgba(11,15,20,0.94)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 20,
                padding: '32px 44px',
                boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
                minWidth: 260,
              }}
            >
              {/* Top accent strip */}
              <div style={{
                position: 'absolute', top: 0, left: '20%', right: '20%', height: 2,
                background: 'linear-gradient(90deg, transparent, rgba(0,229,255,0.4), transparent)',
                borderRadius: 99,
              }} />
              <motion.div
                animate={{ y: [0, -7, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  width: 52, height: 52,
                  borderRadius: '50%',
                  background: 'rgba(0,229,255,0.06)',
                  border: '1px solid rgba(0,229,255,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 18px',
                }}
              >
                <MapPin size={22} color="#00E5FF" style={{ opacity: 0.55 }} />
              </motion.div>
              <p style={{
                fontSize: '0.9rem', fontWeight: 700,
                fontFamily: 'Outfit, sans-serif',
                color: '#E6EDF3', marginBottom: 7,
              }}>
                No Issues Detected
              </p>
              <p style={{ fontSize: '0.72rem', color: '#4B5563', lineHeight: 1.7 }}>
                Upload a road image to begin<br />AI-powered monitoring.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Leaflet map ───────────────────────────────────────────────────── */}
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        {/* CartoDB Dark Matter tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
        />

        {/* Fly to selected issue; auto-open popup for simulated ones */}
        <MapController
          selectedIssue={selectedIssue}
          simulatedId={simulatedId}
          markerRefs={markerRefs}
        />

        {/* ── AI Risk Heatmap canvas overlay ────────────────────────────── */}
        <HeatmapCanvas points={heatmapPoints} visible={showHeatmap} />

        {/* ── Road Health Index cell overlay ────────────────────────────── */}
        <RoadHealthOverlay cells={healthCells} visible={showHealthLayer} />

        {/* ══════════════════════════════════════════════════════════════════
            ISSUE MARKERS — pulsing DivIcon + hover Tooltip + click Popup
        ══════════════════════════════════════════════════════════════════ */}
        {issues.map((issue, index) => {
          const isActive   = selectedIssue?.id === issue.id;
          const isSimulated= issue.id === simulatedId;
          const color      = getSeverityColor(issue.severityScore);
          const confidence = getAiConfidence(issue);

          return (
            <Marker
              key={issue.id}
              position={[issue.latitude, issue.longitude]}
              icon={createMarkerIcon(
                issue.severityScore,
                isActive || isSimulated,
                // simulated issues appear instantly (no stagger delay)
                isSimulated ? 0 : Math.min(index * 0.05, 0.45),
              )}
              // Store the Leaflet marker instance so MapController can open its popup
              ref={el => {
                if (el) markerRefs.current[issue.id] = el;
              }}
              eventHandlers={{ click: () => onIssueClick(issue) }}
            >
              {/* ── Hover Tooltip ─────────────────────────────────────────
                  Shown on mouse-over; auto-hidden when popup opens       */}
              <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                <div style={{ padding: '8px 13px' }}>
                  {/* Row 1: type + severity badge */}
                  <div style={{
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', gap: 12, marginBottom: 4,
                  }}>
                    <span style={{
                      fontSize: '0.82rem', fontWeight: 700,
                      textTransform: 'capitalize', color: '#E6EDF3',
                    }}>
                      {issue.type || 'Unknown'}
                    </span>
                    <span style={{
                      fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.5px',
                      color: color,
                      background: `${color}1A`,
                      padding: '1px 7px', borderRadius: '99px',
                      border: `1px solid ${color}32`,
                    }}>
                      {getSeverityLabel(issue.severityScore)}
                    </span>
                  </div>
                  {/* Row 2: score + time */}
                  <div style={{ fontSize: '0.7rem', color: '#6B7280' }}>
                    {(issue.severityScore * 10).toFixed(1)}/10
                    &nbsp;·&nbsp;
                    {formatDistanceToNow(new Date(issue.timestamp))} ago
                  </div>
                </div>
              </Tooltip>

              {/* ── Click Popup ───────────────────────────────────────────
                  Full detail card; AI Confidence bar included            */}
              <Popup>
                <div style={{ minWidth: 240, overflow: 'hidden' }}>

                  {/* Colored header band */}
                  <div style={{
                    padding: '13px 15px 10px',
                    background: `linear-gradient(135deg, ${color}1C 0%, transparent 100%)`,
                    borderBottom: `1px solid ${color}20`,
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                  }}>
                    <div style={{
                      padding: 6,
                      background: `${color}1C`, borderRadius: 8,
                      border: `1px solid ${color}2A`,
                      flexShrink: 0, marginTop: 1,
                    }}>
                      <AlertTriangle size={13} color={color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <div style={{
                          fontSize: '0.9rem', fontWeight: 700,
                          textTransform: 'capitalize', color: '#F0F6FC', lineHeight: 1.25,
                        }}>
                          {issue.type || 'Unknown Issue'}
                        </div>
                        {issue.simulated && (
                          <span style={{
                            fontSize: '0.52rem', fontWeight: 800, letterSpacing: '0.8px',
                            color: '#FFC857',
                            background: 'rgba(255,200,87,0.12)',
                            border: '1px solid rgba(255,200,87,0.25)',
                            padding: '1px 5px', borderRadius: '5px',
                          }}>
                            SIMULATED
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: '0.62rem', fontWeight: 700,
                        color: color, letterSpacing: '0.9px', marginTop: 2,
                      }}>
                        {getSeverityLabel(issue.severityScore)}
                        {issue.area ? ` · ${issue.area}` : ''}
                      </div>
                    </div>
                    {/* AI confidence badge (top-right of header) */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{
                        fontSize: '0.55rem', color: '#4B5563',
                        letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 2,
                      }}>
                        AI CONF
                      </div>
                      <div style={{
                        fontSize: '0.88rem', fontWeight: 800, color: '#00E5FF',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}>
                        {(confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <div style={{ padding: '12px 15px' }}>

                    {/* Severity bar */}
                    <div style={{ marginBottom: 9 }}>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', marginBottom: 4,
                      }}>
                        <span style={{
                          fontSize: '0.63rem', color: '#6B7280',
                          letterSpacing: '0.9px', textTransform: 'uppercase',
                        }}>
                          Severity
                        </span>
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 700, color: color,
                          fontFamily: "'JetBrains Mono', monospace",
                        }}>
                          {(issue.severityScore * 10).toFixed(1)}/10
                        </span>
                      </div>
                      <div style={{
                        height: 4, background: 'rgba(255,255,255,0.06)',
                        borderRadius: '99px', overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${issue.severityScore * 100}%`,
                          background: `linear-gradient(90deg, ${color}88, ${color})`,
                          borderRadius: '99px',
                          boxShadow: `0 0 6px ${color}55`,
                        }} />
                      </div>
                    </div>

                    {/* AI Confidence bar */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', marginBottom: 4,
                      }}>
                        <span style={{
                          fontSize: '0.63rem', color: '#6B7280',
                          letterSpacing: '0.9px', textTransform: 'uppercase',
                        }}>
                          AI Confidence
                        </span>
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 700, color: '#00E5FF',
                          fontFamily: "'JetBrains Mono', monospace",
                        }}>
                          {(confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div style={{
                        height: 4, background: 'rgba(255,255,255,0.06)',
                        borderRadius: '99px', overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${confidence * 100}%`,
                          background: 'linear-gradient(90deg, #00B8CC, #00E5FF)',
                          borderRadius: '99px',
                          boxShadow: '0 0 6px rgba(0,229,255,0.4)',
                        }} />
                      </div>
                    </div>

                    {/* Divider */}
                    <div style={{
                      height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 10,
                    }} />

                    {/* Meta — time + coordinates */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <Clock size={10} color="#4B5563" style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: '0.7rem', color: '#6B7280' }}>
                          Reported {formatDistanceToNow(new Date(issue.timestamp))} ago
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <MapPin size={10} color="#4B5563" style={{ flexShrink: 0 }} />
                        <span style={{
                          fontSize: '0.66rem',
                          fontFamily: "'JetBrains Mono', monospace",
                          color: '#4B5563', letterSpacing: '0.3px',
                        }}>
                          {issue.latitude.toFixed(5)}, {issue.longitude.toFixed(5)}
                        </span>
                      </div>
                    </div>

                  </div>
                </div>
              </Popup>

            </Marker>
          );
        })}

        {/* ── AI Risk Layer circles ──────────────────────────────────────── */}
        {showRiskLayer && predictions.map((pred, idx) => (
          <Circle
            key={idx}
            center={[pred.latitude, pred.longitude]}
            radius={150}
            pathOptions={{
              color: '#FF3B3B', fillColor: '#FF3B3B',
              fillOpacity: 0.14, weight: 1.5, dashArray: '5 5',
            }}
          >
            <Popup>
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ padding: 5, background: 'rgba(255,59,59,0.15)', borderRadius: 7 }}>
                    <AlertTriangle size={13} color="#FF3B3B" />
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#FF3B3B', letterSpacing: '0.5px' }}>
                    AI RISK FORECAST
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#D1D5DB', marginBottom: 10, lineHeight: 1.5 }}>
                  {pred.reason}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.7rem', color: '#6B7280' }}>Confidence</span>
                  <span style={{
                    fontSize: '0.75rem', fontWeight: 700, color: '#FF3B3B',
                    background: 'rgba(255,59,59,0.1)', padding: '2px 8px',
                    borderRadius: '99px', border: '1px solid rgba(255,59,59,0.22)',
                  }}>
                    {(pred.riskScore * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </Popup>
          </Circle>
        ))}

        {/* ── Trip polylines ─────────────────────────────────────────────── */}
        {Object.entries(trips).map(([tripId, points]) => {
          if (!points || points.length < 2) return null;
          const last      = points[points.length - 1];
          const roughness = last?.roughness ?? 0;
          const color     = roughness > 0.6 ? '#FF3B3B' : roughness > 0.3 ? '#FFC857' : '#3DDB6B';
          return (
            <Polyline
              key={tripId}
              positions={points.map(p => [p.latitude, p.longitude])}
              pathOptions={{ color, weight: 4, opacity: 0.85 }}
            />
          );
        })}

        {/* ── Route Planner polylines + pins ────────────────────────────── */}
        <RoutePlannerLayers planner={planner} onMapClick={handleMapClick} />

      </MapContainer>

      {/* ── Route Recommender floating panel (outside MapContainer) ────────── */}
      <RouteRecommenderPanel
        planner={planner}
        onAction={handlePlannerAction}
        issues={issues}
      />

      {/* ── Road Health Index panel (outside MapContainer) ───────────────── */}
      <AnimatePresence>
        {showHealthLayer && (
          <RoadHealthPanel cells={healthCells} />
        )}
      </AnimatePresence>
    </div>
  );
}
