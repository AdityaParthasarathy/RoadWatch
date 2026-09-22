import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Clock, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// ─── Helpers ───────────────────────────────────────────────────────────────
const getSeverityColor = (score) => {
  if (score > 0.8) return '#FF3B3B';
  if (score > 0.5) return '#FFC857';
  return '#3DDB6B';
};

const getSeverityLabel = (score) => {
  if (score > 0.8) return 'CRITICAL';
  if (score > 0.5) return 'WARNING';
  return 'MINOR';
};

const getTypeBadgeStyle = (type) => {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: '99px',
    fontSize: '0.65rem',
    fontWeight: 700,
    letterSpacing: '0.5px',
    textTransform: 'capitalize',
  };
  switch ((type || '').toLowerCase()) {
    case 'pothole':
      return { ...base, background: 'rgba(255,59,59,0.12)', color: '#FF3B3B', border: '1px solid rgba(255,59,59,0.22)' };
    case 'crack':
      return { ...base, background: 'rgba(255,200,87,0.12)', color: '#FFC857', border: '1px solid rgba(255,200,87,0.22)' };
    case 'waterlogging':
      return { ...base, background: 'rgba(0,229,255,0.1)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.2)' };
    default:
      return { ...base, background: 'rgba(139,148,158,0.1)', color: '#8B949E', border: '1px solid rgba(139,148,158,0.15)' };
  }
};

// ─── Skeleton card ─────────────────────────────────────────────────────────
const SkeletonCard = ({ delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay, duration: 0.3 }}
    className="skeleton-card"
    style={{
      borderRadius: '14px',
      padding: '16px',
      marginBottom: '10px',
      border: '1px solid rgba(255,255,255,0.05)',
      background: 'rgba(255,255,255,0.02)',
    }}
  >
    {/* Row 1 */}
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
      <div className="skeleton-card" style={{ width: '70px', height: '18px', borderRadius: '99px' }} />
      <div className="skeleton-card" style={{ width: '50px', height: '14px', borderRadius: '99px' }} />
    </div>
    {/* Row 2 */}
    <div className="skeleton-card" style={{ width: '130px', height: '13px', borderRadius: '6px', marginBottom: '12px' }} />
    {/* Row 3 */}
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div className="skeleton-card" style={{ flex: 1, height: '3px', borderRadius: '99px' }} />
      <div className="skeleton-card" style={{ width: '44px', height: '13px', borderRadius: '6px' }} />
    </div>
  </motion.div>
);

// ─── Component ─────────────────────────────────────────────────────────────
export function Sidebar({ issues, onSelectIssue, selectedIssue, loading, error }) {

  if (loading) {
    return (
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
        {/* Section header skeleton */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
          paddingBottom: '10px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div className="skeleton-card" style={{ width: '120px', height: '12px', borderRadius: '6px' }} />
          <div className="skeleton-card" style={{ width: '24px', height: '18px', borderRadius: '99px' }} />
        </div>
        {[0, 0.08, 0.16, 0.24].map((delay, i) => (
          <SkeletonCard key={i} delay={delay} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: '32px',
          paddingBottom: '24px',
          gap: '14px',
          textAlign: 'center',
        }}
      >
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            padding: '18px',
            background: 'rgba(255,59,59,0.06)',
            borderRadius: '50%',
            border: '1px solid rgba(255,59,59,0.16)',
          }}
        >
          <AlertCircle size={28} color="#FF3B3B" style={{ opacity: 0.75 }} />
        </motion.div>
        <div>
          <p style={{
            fontSize: '0.82rem',
            fontWeight: 700,
            color: 'var(--text-secondary)',
            marginBottom: '6px',
          }}>
            Failed to Load
          </p>
          <p style={{
            fontSize: '0.72rem',
            lineHeight: 1.65,
            color: 'var(--text-muted)',
          }}>
            Backend unreachable.<br />
            Check service status.
          </p>
        </div>

        {/* Inline status pill */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 11px',
          borderRadius: 99,
          background: 'rgba(255,59,59,0.06)',
          border: '1px solid rgba(255,59,59,0.14)',
          marginTop: 4,
        }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%',
            background: '#FF3B3B',
            boxShadow: '0 0 5px rgba(255,59,59,0.7)',
          }} />
          <span style={{
            fontSize: '0.6rem',
            fontWeight: 700,
            color: '#FF3B3B',
            letterSpacing: '0.8px',
            textTransform: 'uppercase',
          }}>
            Service Down
          </span>
        </div>
      </motion.div>
    );
  }

  return (
    <div
      style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}
      className="custom-scrollbar"
    >
      {/* Section header */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
          paddingBottom: '10px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          color: 'var(--text-muted)',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
        }}>
          Incident Registry
        </span>
        {issues.length > 0 && (
          <motion.span
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 20, delay: 0.15 }}
            style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              color: 'var(--text-muted)',
              background: 'rgba(0,229,255,0.06)',
              padding: '2px 8px',
              borderRadius: '99px',
              border: '1px solid rgba(0,229,255,0.14)',
              display: 'inline-block',
            }}
          >
            {issues.length}
          </motion.span>
        )}
      </motion.div>

      {/* Issue list */}
      <AnimatePresence>
        {issues.map((issue, index) => {
          const isActive = selectedIssue?.id === issue.id;
          const color    = getSeverityColor(issue.severityScore);

          return (
            <motion.div
              key={issue.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.28 }}
              className={`issue-card ${isActive ? 'active-issue' : ''}`}
              onClick={() => onSelectIssue(issue)}
              whileHover={{ x: 2 }}
              style={{ borderLeft: `3px solid ${isActive ? 'var(--primary)' : color}` }}
            >
              {/* Subtle active glow strip */}
              {isActive && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 'inherit',
                  background: 'rgba(0,229,255,0.04)',
                  pointerEvents: 'none',
                }} />
              )}

              {/* Row 1: type badge + time */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '9px' }}>
                <span style={getTypeBadgeStyle(issue.type)}>
                  {issue.type || 'unknown'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                  <Clock size={10} />
                  {formatDistanceToNow(new Date(issue.timestamp))} ago
                </div>
              </div>

              {/* Row 2: coordinates */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                color: 'var(--text-muted)',
                fontSize: '0.72rem',
                marginBottom: '11px',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                <MapPin size={10} />
                {issue.latitude.toFixed(4)}, {issue.longitude.toFixed(4)}
              </div>

              {/* Row 3: severity bar + label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '99px', overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${issue.severityScore * 100}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut', delay: index * 0.04 }}
                    style={{
                      height: '100%',
                      background: color,
                      borderRadius: '99px',
                      boxShadow: `0 0 8px ${color}55`,
                    }}
                  />
                </div>
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  color,
                  minWidth: '48px',
                  textAlign: 'right',
                  letterSpacing: '0.3px',
                }}>
                  {getSeverityLabel(issue.severityScore)}
                </span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Empty state */}
      {issues.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: '48px',
            gap: '14px',
            color: 'var(--text-muted)',
          }}
        >
          <motion.div
            animate={{ y: [0, -7, 0] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              padding: '22px',
              background: 'rgba(0,229,255,0.04)',
              borderRadius: '50%',
              border: '1px solid rgba(0,229,255,0.1)',
            }}
          >
            <AlertCircle size={30} color="var(--primary)" style={{ opacity: 0.5 }} />
          </motion.div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              No incidents detected
            </p>
            <p style={{ fontSize: '0.75rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>
              Upload a road photo to start<br />AI-powered monitoring.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
