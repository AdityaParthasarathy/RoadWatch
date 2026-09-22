import React, { useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { Heart, TrendingDown, CheckCircle } from 'lucide-react';

// Grid cell size in degrees — ~1.1 km per cell
const GRID = 0.01;

// ── Score computation ──────────────────────────────────────────────────────

export function computeHealthGrid(issues) {
  const cells = {};

  issues.forEach(issue => {
    const cellLat = Math.round(issue.latitude  / GRID) * GRID;
    const cellLng = Math.round(issue.longitude / GRID) * GRID;
    const key = `${cellLat.toFixed(3)},${cellLng.toFixed(3)}`;

    if (!cells[key]) {
      cells[key] = { lat: cellLat, lng: cellLng, issues: [], score: 100, key };
    }
    cells[key].issues.push(issue);
  });

  Object.values(cells).forEach(cell => {
    let penalty = 0;
    cell.issues.forEach(issue => {
      // Age decay: full weight up to 30d, fades to 20% at 90d
      const ageDays = (Date.now() - (issue.timestamp || Date.now())) / 86400000;
      const ageFactor = Math.max(0.2, 1 - ageDays / 90);
      if      (issue.severityScore > 0.7) penalty += 25 * ageFactor;
      else if (issue.severityScore > 0.4) penalty += 12 * ageFactor;
      else                                penalty +=  5 * ageFactor;
    });
    cell.score = Math.max(0, Math.min(100, Math.round(100 - penalty)));
  });

  return Object.values(cells).sort((a, b) => a.score - b.score);
}

// ── Color helpers ──────────────────────────────────────────────────────────

function scoreColor(score) {
  if (score >= 80) return '#3DDB6B';
  if (score >= 60) return '#8FDB6B';
  if (score >= 40) return '#FFC857';
  if (score >= 20) return '#FF8C42';
  return '#FF3B3B';
}

function scoreLabel(score) {
  if (score >= 80) return 'GOOD';
  if (score >= 60) return 'FAIR';
  if (score >= 40) return 'POOR';
  if (score >= 20) return 'BAD';
  return 'CRITICAL';
}

// ════════════════════════════════════════════════════════════════════════════
// LEAFLET OVERLAY — must live inside <MapContainer>
// ════════════════════════════════════════════════════════════════════════════
export function RoadHealthOverlay({ cells, visible }) {
  const map      = useMap();
  const layerRef = useRef(null);

  // Create the LayerGroup once; clean up on unmount
  useEffect(() => {
    layerRef.current = L.layerGroup().addTo(map);
    return () => {
      layerRef.current?.remove();
      layerRef.current = null;
    };
  }, [map]);

  // Rebuild rectangles whenever cells or visibility changes
  useEffect(() => {
    if (!layerRef.current) return;
    layerRef.current.clearLayers();

    if (!visible || !cells.length) return;

    cells.forEach(cell => {
      const color   = scoreColor(cell.score);
      const opacity = cell.score < 60 ? 0.38 : 0.18;

      L.rectangle(
        [
          [cell.lat - GRID / 2, cell.lng - GRID / 2],
          [cell.lat + GRID / 2, cell.lng + GRID / 2],
        ],
        {
          color,
          fillColor: color,
          fillOpacity: opacity,
          weight: 0.8,
          opacity: 0.5,
        }
      )
        .bindTooltip(
          `Health: ${cell.score}/100 · ${scoreLabel(cell.score)} · ${cell.issues.length} issue${cell.issues.length !== 1 ? 's' : ''}`,
          { sticky: true, className: 'rw-tooltip' }
        )
        .addTo(layerRef.current);
    });
  }, [cells, visible]);

  return null;
}

// ════════════════════════════════════════════════════════════════════════════
// FLOATING PANEL — lives outside <MapContainer>
// ════════════════════════════════════════════════════════════════════════════
export function RoadHealthPanel({ cells }) {
  const avg   = cells.length
    ? Math.round(cells.reduce((s, c) => s + c.score, 0) / cells.length)
    : 100;

  const worst = cells.slice(0, 5);
  const good  = cells.filter(c => c.score >= 80).length;

  return (
    <motion.div
      initial={{ opacity: 0, x: -18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -18 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: 'absolute',
        bottom: 28,
        left: 16,
        zIndex: 800,
        width: 232,
        background: 'rgba(11,15,20,0.94)',
        backdropFilter: 'blur(18px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        padding: '14px 16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        pointerEvents: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
        <Heart size={11} color={scoreColor(avg)} style={{ filter: `drop-shadow(0 0 4px ${scoreColor(avg)}88)` }} />
        <span style={{
          fontSize: '0.59rem', fontWeight: 700,
          color: '#8B949E', letterSpacing: '1.4px', textTransform: 'uppercase',
        }}>
          Road Health Index
        </span>
      </div>

      {/* Network average score */}
      <div style={{ marginBottom: 13 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
          <span style={{ fontSize: '0.68rem', color: '#6B7280' }}>Network Average</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.5px',
              color: scoreColor(avg),
              background: `${scoreColor(avg)}18`,
              border: `1px solid ${scoreColor(avg)}30`,
              padding: '1px 6px', borderRadius: 99,
            }}>
              {scoreLabel(avg)}
            </span>
            <span style={{
              fontSize: '0.88rem', fontWeight: 800,
              color: scoreColor(avg),
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {avg}
            </span>
            <span style={{ fontSize: '0.6rem', color: '#4B5563' }}>/100</span>
          </div>
        </div>
        <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${avg}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            style={{
              height: '100%',
              background: avg >= 60
                ? `linear-gradient(90deg, #FFC857, ${scoreColor(avg)})`
                : `linear-gradient(90deg, #FF3B3B, ${scoreColor(avg)})`,
              borderRadius: 99,
              boxShadow: `0 0 6px ${scoreColor(avg)}44`,
            }}
          />
        </div>
      </div>

      {/* Mini stats */}
      {cells.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <div style={{
            flex: 1, padding: '7px 8px', borderRadius: 9, textAlign: 'center',
            background: 'rgba(61,219,107,0.07)', border: '1px solid rgba(61,219,107,0.15)',
          }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#3DDB6B', lineHeight: 1 }}>{good}</div>
            <div style={{ fontSize: '0.55rem', color: '#4B5563', marginTop: 2 }}>Healthy</div>
          </div>
          <div style={{
            flex: 1, padding: '7px 8px', borderRadius: 9, textAlign: 'center',
            background: 'rgba(255,59,59,0.07)', border: '1px solid rgba(255,59,59,0.15)',
          }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#FF3B3B', lineHeight: 1 }}>
              {cells.filter(c => c.score < 40).length}
            </div>
            <div style={{ fontSize: '0.55rem', color: '#4B5563', marginTop: 2 }}>Critical</div>
          </div>
          <div style={{
            flex: 1, padding: '7px 8px', borderRadius: 9, textAlign: 'center',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#E6EDF3', lineHeight: 1 }}>{cells.length}</div>
            <div style={{ fontSize: '0.55rem', color: '#4B5563', marginTop: 2 }}>Segments</div>
          </div>
        </div>
      )}

      {/* Divider */}
      {worst.length > 0 && (
        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', marginBottom: 10 }} />
      )}

      {/* Worst segments */}
      {worst.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
            <TrendingDown size={9} color="#FF3B3B" />
            <span style={{
              fontSize: '0.57rem', fontWeight: 700,
              color: '#4B5563', letterSpacing: '1px', textTransform: 'uppercase',
            }}>
              Worst Segments
            </span>
          </div>

          {worst.map((cell, i) => {
            const color = scoreColor(cell.score);
            return (
              <div key={cell.key} style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '6px 0',
                borderBottom: i < worst.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}>
                {/* Score badge */}
                <div style={{
                  width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                  background: `${color}15`,
                  border: `1px solid ${color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.6rem', fontWeight: 800,
                  color, fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {cell.score}
                </div>
                {/* Coords + count */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.62rem', color: '#C9D1D9',
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: '-0.2px',
                  }}>
                    {cell.lat.toFixed(3)}°, {cell.lng.toFixed(3)}°
                  </div>
                  <div style={{ fontSize: '0.57rem', color: '#4B5563', marginTop: 1 }}>
                    {cell.issues.length} issue{cell.issues.length !== 1 ? 's' : ''}
                  </div>
                </div>
                {/* Mini bar */}
                <div style={{
                  width: 28, height: 4, background: 'rgba(255,255,255,0.05)',
                  borderRadius: 99, overflow: 'hidden', flexShrink: 0,
                }}>
                  <div style={{
                    height: '100%', width: `${cell.score}%`,
                    background: color, borderRadius: 99,
                  }} />
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Empty state */}
      {cells.length === 0 && (
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <CheckCircle size={18} color="#3DDB6B" style={{ margin: '0 auto 6px', display: 'block', opacity: 0.4 }} />
          <div style={{ fontSize: '0.7rem', color: '#3DDB6B', fontWeight: 600 }}>All Clear</div>
          <div style={{ fontSize: '0.62rem', color: '#3D4957', marginTop: 3 }}>
            No issues in database yet
          </div>
        </div>
      )}
    </motion.div>
  );
}
