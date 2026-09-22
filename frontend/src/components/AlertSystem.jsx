import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, MapPin, Bell, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// ─── Shared helpers ────────────────────────────────────────────────────────
const SEVERITY_COLOR    = s => s > 0.8 ? '#FF3B3B' : s > 0.4 ? '#FFC857' : '#3DDB6B';
const SEVERITY_LABEL    = s => s > 0.8 ? 'CRITICAL' : s > 0.4 ? 'WARNING'  : 'MINOR';
const SEVERITY_DURATION = s => s > 0.8 ? 6000       : s > 0.4 ? 7000       : 8000;

// ══════════════════════════════════════════════════════════════════════════════
//  AlertToast — single floating notification card
//
//  Props:
//    alert     — issue object augmented with `alertId` string
//    onDismiss — (alertId: string) => void
// ══════════════════════════════════════════════════════════════════════════════
export function AlertToast({ alert, onDismiss }) {
  const color    = SEVERITY_COLOR(alert.severityScore);
  const label    = SEVERITY_LABEL(alert.severityScore);
  const duration = SEVERITY_DURATION(alert.severityScore);

  // Auto-dismiss
  useEffect(() => {
    const id = setTimeout(() => onDismiss(alert.alertId), duration);
    return () => clearTimeout(id);
  }, [alert.alertId, duration, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 380, scale: 0.88 }}
      animate={{ opacity: 1, x: 0,   scale: 1    }}
      exit={{   opacity: 0, x: 380,  scale: 0.9,
        transition: { duration: 0.2, ease: 'easeIn' } }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      style={{
        width: 348,
        background: 'rgba(9,13,18,0.98)',
        border: `1px solid ${color}28`,
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: `
          0 20px 56px rgba(0,0,0,0.72),
          0 0 0 1px ${color}10,
          0 0 28px ${color}08
        `,
        backdropFilter: 'blur(28px)',
        flexShrink: 0,
        cursor: 'default',
        userSelect: 'none',
      }}
    >
      {/* 3-px severity strip */}
      <div style={{
        height: 3,
        background: `linear-gradient(90deg, transparent, ${color} 25%, ${color} 75%, transparent)`,
      }} />

      {/* Body row */}
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        gap: 12, padding: '12px 12px 10px',
      }}>

        {/* Pulsing icon ring */}
        <div style={{ position: 'relative', flexShrink: 0, marginTop: 1 }}>
          {/* outer pulse */}
          <div style={{
            position: 'absolute', inset: '-5px', borderRadius: '50%',
            border: `1.5px solid ${color}`,
            animation: 'rw-pulse 2.2s ease-out infinite',
            opacity: 0.45,
          }} />
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: `linear-gradient(135deg, ${color}1c, ${color}07)`,
            border: `1px solid ${color}28`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={15} color={color} />
          </div>
        </div>

        {/* Text block */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Row 1: title + severity pill */}
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: 6, marginBottom: 4,
          }}>
            <span style={{
              fontSize: '0.8rem', fontWeight: 700, color: '#E6EDF3',
              textTransform: 'capitalize',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {alert.type || 'Road Issue'} Detected
            </span>
            <span style={{
              fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.6px',
              color, background: `${color}16`,
              padding: '2px 7px', borderRadius: 99,
              border: `1px solid ${color}2c`,
              flexShrink: 0,
            }}>
              {label}
            </span>
          </div>

          {/* Row 2: location */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            marginBottom: 7,
          }}>
            <MapPin size={10} color={color} style={{ flexShrink: 0, opacity: 0.7 }} />
            {alert.area ? (
              <span style={{ fontSize: '0.7rem', color: '#8B949E' }}>{alert.area}</span>
            ) : (
              <span style={{
                fontSize: '0.65rem', color: '#4B5563',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {alert.latitude?.toFixed(4)}, {alert.longitude?.toFixed(4)}
              </span>
            )}
            {alert.simulated && (
              <span style={{
                fontSize: '0.52rem', fontWeight: 700, color: '#FFC857',
                background: 'rgba(255,200,87,0.1)',
                padding: '1px 5px', borderRadius: 99,
                border: '1px solid rgba(255,200,87,0.2)',
                marginLeft: 2, flexShrink: 0,
              }}>SIM</span>
            )}
          </div>

          {/* Row 3: severity bar + score */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              flex: 1, height: 3,
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 99, overflow: 'hidden',
            }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${alert.severityScore * 100}%` }}
                transition={{ duration: 0.75, delay: 0.15, ease: 'easeOut' }}
                style={{
                  height: '100%',
                  background: `linear-gradient(90deg, ${color}70, ${color})`,
                  borderRadius: 99,
                  boxShadow: `0 0 5px ${color}55`,
                }}
              />
            </div>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.75rem', fontWeight: 700, color,
              flexShrink: 0, lineHeight: 1,
            }}>
              {(alert.severityScore * 10).toFixed(1)}
            </span>
          </div>
        </div>

        {/* Dismiss × */}
        <motion.button
          whileHover={{ scale: 1.12, background: 'rgba(255,255,255,0.09)' }}
          whileTap={{ scale: 0.9 }}
          onClick={() => onDismiss(alert.alertId)}
          style={{
            flexShrink: 0, marginTop: 1,
            width: 22, height: 22, borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.07)',
            background: 'rgba(255,255,255,0.04)',
            color: '#4B5563', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={11} />
        </motion.button>
      </div>

      {/* Auto-dismiss countdown bar (Motion animates width 100→0) */}
      <div style={{ height: 2, background: 'rgba(255,255,255,0.04)' }}>
        <motion.div
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: duration / 1000, ease: 'linear' }}
          style={{
            height: '100%',
            background: `linear-gradient(90deg, ${color}60, ${color})`,
          }}
        />
      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  AlertToastStack — top-right fixed container; max 4 visible toasts
//
//  Props:
//    alerts    — array of alert objects (each has alertId)
//    onDismiss — (alertId: string) => void
// ══════════════════════════════════════════════════════════════════════════════
export function AlertToastStack({ alerts, onDismiss }) {
  return (
    <div style={{
      position: 'fixed',
      top: 66,       // just below the topbar
      right: 16,
      zIndex: 1900,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      pointerEvents: 'none',
      alignItems: 'flex-end',
    }}>
      <AnimatePresence mode="sync">
        {alerts.slice(0, 4).map(alert => (
          <div key={alert.alertId} style={{ pointerEvents: 'auto' }}>
            <AlertToast alert={alert} onDismiss={onDismiss} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  AlertHistoryPanel — right-side sliding panel with full alert log
//
//  Props:
//    history   — array of past alert objects
//    isOpen    — boolean
//    onClose   — () => void
//    onClear   — () => void
// ══════════════════════════════════════════════════════════════════════════════
export function AlertHistoryPanel({ history, isOpen, onClose, onClear }) {
  const critical = history.filter(a => a.severityScore > 0.8).length;
  const warning  = history.filter(a => a.severityScore > 0.4 && a.severityScore <= 0.8).length;
  const minor    = history.filter(a => a.severityScore <= 0.4).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Dim backdrop */}
          <motion.div
            key="alert-history-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0,
              zIndex: 1800,
              background: 'rgba(0,0,0,0.45)',
              backdropFilter: 'blur(4px)',
            }}
          />

          {/* Slide-in panel */}
          <motion.div
            key="alert-history-panel"
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0,   opacity: 1 }}
            exit={{   x: 400, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              position: 'fixed',
              top: 0, right: 0, bottom: 0,
              width: 380,
              zIndex: 1801,
              background: 'rgba(8,11,17,0.99)',
              borderLeft: '1px solid rgba(255,255,255,0.07)',
              boxShadow: '-28px 0 80px rgba(0,0,0,0.65)',
              backdropFilter: 'blur(28px)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Top cyan accent line */}
            <div style={{
              height: 2,
              background: 'linear-gradient(90deg, transparent, rgba(0,229,255,0.55), transparent)',
            }} />

            {/* ── Header ──────────────────────────────────── */}
            <div style={{
              padding: '16px 18px 14px',
              borderBottom: '1px solid rgba(255,255,255,0.055)',
              display: 'flex', alignItems: 'center', gap: 12,
              flexShrink: 0,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(0,229,255,0.08)',
                border: '1px solid rgba(0,229,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Bell size={16} color="#00E5FF" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '0.95rem', fontWeight: 700,
                  fontFamily: 'Outfit, sans-serif', color: '#E6EDF3',
                  letterSpacing: '-0.01em',
                }}>
                  Alert History
                </div>
                <div style={{ fontSize: '0.62rem', color: '#3D4957', marginTop: 1 }}>
                  {history.length} event{history.length !== 1 ? 's' : ''} recorded
                </div>
              </div>
              <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                {history.length > 0 && (
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.93 }}
                    onClick={onClear}
                    title="Clear all history"
                    style={{
                      width: 30, height: 30, borderRadius: 8,
                      border: '1px solid rgba(255,59,59,0.2)',
                      background: 'rgba(255,59,59,0.06)',
                      color: '#FF3B3B', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Trash2 size={13} />
                  </motion.button>
                )}
                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.93 }}
                  onClick={onClose}
                  style={{
                    width: 30, height: 30, borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.04)',
                    color: '#6B7280', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <X size={14} />
                </motion.button>
              </div>
            </div>

            {/* ── Stats strip ─────────────────────────────── */}
            {history.length > 0 && (
              <div style={{
                display: 'flex',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                flexShrink: 0,
              }}>
                {[
                  { label: 'Critical', color: '#FF3B3B', count: critical },
                  { label: 'Warning',  color: '#FFC857', count: warning  },
                  { label: 'Minor',    color: '#3DDB6B', count: minor    },
                ].map(({ label, color, count }, i) => (
                  <div
                    key={label}
                    style={{
                      flex: 1, textAlign: 'center',
                      padding: '10px 0',
                      borderRight: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    }}
                  >
                    <div style={{
                      fontSize: '1.15rem', fontWeight: 800, color,
                      lineHeight: 1, marginBottom: 3,
                      fontFamily: 'Outfit, sans-serif',
                    }}>
                      {count}
                    </div>
                    <div style={{
                      fontSize: '0.58rem', color: '#3D4957',
                      letterSpacing: '0.7px', textTransform: 'uppercase',
                    }}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Alert list ──────────────────────────────── */}
            <div
              style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}
              className="custom-scrollbar"
            >
              {history.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    paddingTop: 64, gap: 14, textAlign: 'center',
                  }}
                >
                  <motion.div
                    animate={{ y: [0, -7, 0] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                    style={{
                      width: 52, height: 52, borderRadius: '50%',
                      background: 'rgba(0,229,255,0.05)',
                      border: '1px solid rgba(0,229,255,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Bell size={22} color="#00E5FF" style={{ opacity: 0.35 }} />
                  </motion.div>
                  <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#2A3544' }}>
                    No alerts recorded
                  </p>
                  <p style={{
                    fontSize: '0.72rem', color: '#1E2A36',
                    lineHeight: 1.65, maxWidth: 200,
                  }}>
                    Incidents will appear here as they are detected.
                  </p>
                </motion.div>
              ) : (
                <AnimatePresence initial={false}>
                  {history.map((alert, idx) => {
                    const color = SEVERITY_COLOR(alert.severityScore);
                    const label = SEVERITY_LABEL(alert.severityScore);

                    return (
                      <motion.div
                        key={alert.alertId}
                        initial={{ opacity: 0, x: 24 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 24, transition: { duration: 0.15 } }}
                        transition={{ duration: 0.22, delay: Math.min(idx * 0.025, 0.2) }}
                        whileHover={{ backgroundColor: 'rgba(255,255,255,0.028)' }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 11,
                          padding: '10px 11px',
                          borderRadius: 12,
                          marginBottom: 3,
                          background: 'rgba(255,255,255,0.015)',
                          border: `1px solid ${color}14`,
                          cursor: 'default',
                          transition: 'background 0.15s',
                        }}
                      >
                        {/* Severity dot */}
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: color,
                          boxShadow: `0 0 6px ${color}88`,
                          flexShrink: 0,
                        }} />

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Row 1 */}
                          <div style={{
                            display: 'flex', alignItems: 'center',
                            gap: 6, marginBottom: 3, flexWrap: 'nowrap',
                          }}>
                            <span style={{
                              fontSize: '0.77rem', fontWeight: 600,
                              color: '#C9D1D9', textTransform: 'capitalize',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {alert.type || 'Issue'}
                            </span>
                            <span style={{
                              fontSize: '0.52rem', fontWeight: 700, color,
                              background: `${color}12`,
                              padding: '1px 6px', borderRadius: 99,
                              border: `1px solid ${color}22`,
                              flexShrink: 0, letterSpacing: '0.4px',
                            }}>
                              {label}
                            </span>
                            {alert.simulated && (
                              <span style={{
                                fontSize: '0.5rem', fontWeight: 700,
                                color: '#FFC857', background: 'rgba(255,200,87,0.08)',
                                padding: '1px 5px', borderRadius: 99,
                                border: '1px solid rgba(255,200,87,0.18)',
                                flexShrink: 0,
                              }}>SIM</span>
                            )}
                          </div>
                          {/* Row 2: location */}
                          <div style={{
                            display: 'flex', alignItems: 'center',
                            gap: 4, fontSize: '0.63rem', color: '#3D4957',
                          }}>
                            <MapPin size={9} color="#3D4957" style={{ flexShrink: 0 }} />
                            <span style={{
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {alert.area || `${alert.latitude?.toFixed(3)}, ${alert.longitude?.toFixed(3)}`}
                            </span>
                          </div>
                        </div>

                        {/* Score + time */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{
                            fontSize: '0.85rem', fontWeight: 800, color,
                            fontFamily: "'JetBrains Mono', monospace",
                            lineHeight: 1,
                          }}>
                            {(alert.severityScore * 10).toFixed(1)}
                          </div>
                          <div style={{ fontSize: '0.58rem', color: '#2A3544', marginTop: 3 }}>
                            {formatDistanceToNow(
                              new Date(alert.timestamp || Date.now()),
                              { addSuffix: false }
                            )} ago
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>

            {/* ── Footer label ────────────────────────────── */}
            <div style={{
              padding: '10px 18px',
              borderTop: '1px solid rgba(255,255,255,0.04)',
              flexShrink: 0,
            }}>
              <p style={{
                fontSize: '0.62rem', color: '#1E2A36',
                textAlign: 'center', letterSpacing: '0.3px',
              }}>
                Showing last {Math.min(history.length, 50)} alerts · Auto-refresh every 15s
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
