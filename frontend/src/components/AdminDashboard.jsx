import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { motion } from 'framer-motion';
import {
  TrendingDown, AlertCircle, BarChart3,
  Activity, ShieldCheck, Map, Trophy, RefreshCw,
} from 'lucide-react';

// ─── Design tokens (local copies for inline styles) ───────────────────────
const C = {
  primary:   '#00E5FF',
  secondary: '#FFC857',
  accent:    '#00E5FF',
  danger:    '#FF3B3B',
  success:   '#3DDB6B',
  surface:   '#0F1620',
  elevated:  '#141E2B',
  border:    'rgba(255, 255, 255, 0.06)',
  borderBright: 'rgba(255, 255, 255, 0.1)',
  text:      '#E6EDF3',
  textSec:   '#8B949E',
  textMuted: '#6B7280',
};

const CHART_COLORS = [C.primary, C.secondary, C.danger, C.success];

// ─── Severity helpers ──────────────────────────────────────────────────────
const getSeverityColor = (score) => {
  if (score > 0.8) return C.danger;
  if (score > 0.5) return C.secondary;
  return C.success;
};

// ─── Custom recharts tooltip ───────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: C.elevated,
      border: `1px solid ${C.border}`,
      borderRadius: '10px',
      padding: '10px 14px',
      fontSize: '0.8rem',
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    }}>
      <p style={{ color: C.textMuted, marginBottom: '4px', fontSize: '0.72rem' }}>{label}</p>
      <p style={{ color: C.text, fontWeight: 700 }}>
        {typeof payload[0].value === 'number' ? payload[0].value.toFixed(1) : payload[0].value}
      </p>
    </div>
  );
};

// ─── Count-up hook ─────────────────────────────────────────────────────────
//     Animates from 0 → target using ease-out cubic, respects decimals + delay
function useCountUp(target, { duration = 1500, decimals = 0, delay = 0 } = {}) {
  const [current,  setCurrent]  = useState(0);
  const rafRef     = useRef(null);
  const timerRef   = useRef(null);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    clearTimeout(timerRef.current);

    if (target === 0) { setCurrent(0); return; }

    setCurrent(0);
    timerRef.current = setTimeout(() => {
      const startTime = performance.now();
      const tick = (now) => {
        const t = Math.min((now - startTime) / duration, 1);
        const e = 1 - Math.pow(1 - t, 3);             // ease-out cubic
        setCurrent(parseFloat((e * target).toFixed(decimals)));
        if (t < 1) rafRef.current = requestAnimationFrame(tick);
        else        setCurrent(target);
      };
      rafRef.current = requestAnimationFrame(tick);
    }, delay * 1000);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(timerRef.current);
    };
  }, [target]);                                        // re-run when data changes

  return current;
}

// ─── Stat card ─────────────────────────────────────────────────────────────
//
// Props:
//   title      — uppercase label string
//   rawValue   — raw number (drives count-up animation)
//   decimals   — decimal places shown (default 0)
//   suffix     — appended after number, e.g. "/10" (default '')
//   icon       — Lucide icon component
//   color      — accent hex color for this card
//   subtitle   — small muted description below the number
//   delay      — seconds before counter starts (stagger cards)
//
const StatCard = ({ title, rawValue, decimals = 0, suffix = '', icon: Icon, color, subtitle, delay = 0 }) => {
  const count = useCountUp(rawValue, { decimals, delay });
  const displayNum = decimals > 0 ? count.toFixed(decimals) : String(count);

  // Derived RGB for the glow (parse the hex color into an rgba string)
  const glowRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay }}
      whileHover={{
        y: -10,
        scale: 1.022,
        boxShadow: `0 28px 56px rgba(0,0,0,0.45), 0 0 48px ${glowRgba(color, 0.15)}, inset 0 1px 0 rgba(255,255,255,0.07)`,
        transition: { duration: 0.24, ease: 'easeOut' },
      }}
      style={{
        flex: 1,
        borderRadius: '22px',
        /* ── Gradient border technique ──────────────────────────────────────
           Two background layers stacked:
             1. Solid surface color clipped to padding-box (fills the card)
             2. Accent gradient clipped to border-box (fills the 1px border gap)
        ─────────────────────────────────────────────────────────────────── */
        border: '1px solid transparent',
        background: `
          linear-gradient(${C.surface}, ${C.surface}) padding-box,
          linear-gradient(140deg, ${glowRgba(color, 0.55)}, ${glowRgba(color, 0.08)} 40%, transparent 65%, ${glowRgba(color, 0.25)}) border-box
        `,
        boxShadow: `0 6px 28px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)`,
        position: 'relative',
        overflow: 'hidden',
        cursor: 'default',
      }}
    >
      {/* ── Top accent glow strip ──────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: '3px',
        background: `linear-gradient(90deg, transparent 0%, ${color} 40%, ${color} 60%, transparent 100%)`,
        opacity: 0.8,
      }} />

      {/* ── Animated corner radial glow (behind icon) ─────────────────── */}
      <div style={{
        position: 'absolute', top: '-20%', right: '-5%',
        width: '140px', height: '140px', borderRadius: '50%',
        background: `radial-gradient(circle, ${glowRgba(color, 0.18)} 0%, transparent 70%)`,
        animation: `statCardGlow ${3.5 + delay}s ease-in-out infinite`,
        pointerEvents: 'none',
      }} />

      {/* ── Slow shimmer sweep ─────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: 0,
        width: '45%',
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.032) 50%, transparent 100%)',
        animation: `statCardShimmer ${7 + delay * 1.5}s ease-in-out infinite`,
        animationDelay: `${delay + 0.8}s`,
        pointerEvents: 'none',
      }} />

      {/* ── Inner content ─────────────────────────────────────────────── */}
      <div style={{ padding: '26px 26px 24px', position: 'relative', zIndex: 1 }}>

        {/* Row 1: label + icon */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-start', marginBottom: '20px',
        }}>
          <span style={{
            fontSize: '0.67rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '1.6px',
            color: C.textMuted,
            lineHeight: 1.5,
            maxWidth: '70%',
          }}>
            {title}
          </span>

          {/* Icon box */}
          <motion.div
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            style={{
              padding: '10px',
              background: `linear-gradient(135deg, ${glowRgba(color, 0.2)}, ${glowRgba(color, 0.08)})`,
              borderRadius: '12px',
              border: `1px solid ${glowRgba(color, 0.28)}`,
              boxShadow: `0 0 20px ${glowRgba(color, 0.15)}, inset 0 1px 0 rgba(255,255,255,0.08)`,
              flexShrink: 0,
            }}
          >
            <Icon size={18} color={color} style={{ display: 'block' }} />
          </motion.div>
        </div>

        {/* Row 2: animated number */}
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: '3px',
          marginBottom: subtitle ? '10px' : 0,
          animation: `statNumPop 0.5s cubic-bezier(0.34,1.56,0.64,1) ${delay + 0.15}s both`,
        }}>
          <span style={{
            fontSize: '2.8rem',
            fontWeight: 800,
            fontFamily: 'Outfit, sans-serif',
            letterSpacing: '-0.03em',
            lineHeight: 1,
            background: `linear-gradient(160deg, #FFFFFF 30%, ${color} 120%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            {displayNum}
          </span>
          {suffix && (
            <span style={{
              fontSize: '1.1rem',
              fontWeight: 700,
              color: C.textSec,
              letterSpacing: '-0.01em',
              lineHeight: 1,
            }}>
              {suffix}
            </span>
          )}
        </div>

        {/* Row 3: subtitle */}
        {subtitle && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            {/* Color pip */}
            <div style={{
              width: 5, height: 5, borderRadius: '50%',
              background: color, flexShrink: 0,
              boxShadow: `0 0 5px ${glowRgba(color, 0.7)}`,
            }} />
            <span style={{
              fontSize: '0.72rem',
              color: C.textMuted,
              letterSpacing: '0.2px',
            }}>
              {subtitle}
            </span>
          </div>
        )}

      </div>

      {/* ── Bottom inner glow line ─────────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 0, left: '15%', right: '15%',
        height: '1px',
        background: `linear-gradient(90deg, transparent, ${glowRgba(color, 0.25)}, transparent)`,
      }} />
    </motion.div>
  );
};

// ─── Skeleton building block ───────────────────────────────────────────────
const SkeletonBlock = ({ width = '100%', height = 14, radius = 7, style = {} }) => (
  <div
    className="skeleton-card"
    style={{ width, height, borderRadius: radius, flexShrink: 0, ...style }}
  />
);

// ─── Main component ────────────────────────────────────────────────────────
export function AdminDashboard({ issues, loading = false, error = false }) {

  const stats = useMemo(() => {
    if (!issues || issues.length === 0) {
      return { total: 0, avgSeverity: 0, criticalCount: 0, timeData: [], typeData: [], worstRoads: [] };
    }

    const total       = issues.length;
    const avgSeverity = issues.reduce((s, i) => s + i.severityScore, 0) / total;
    const criticalCount = issues.filter(i => i.severityScore > 0.8).length;

    const timeData = issues.map((issue, i) => ({
      time:     `T${i + 1}`,
      severity: parseFloat((issue.severityScore * 10).toFixed(2)),
    }));

    const typeMap = {};
    issues.forEach(i => { typeMap[i.type] = (typeMap[i.type] || 0) + 1; });
    const typeData = Object.entries(typeMap).map(([name, value]) => ({ name, value }));

    const roadMap = {};
    issues.forEach(i => {
      const key = `${i.latitude.toFixed(2)}, ${i.longitude.toFixed(2)}`;
      if (!roadMap[key]) roadMap[key] = { count: 0, totalSeverity: 0 };
      roadMap[key].count++;
      roadMap[key].totalSeverity += i.severityScore;
    });

    const worstRoads = Object.entries(roadMap)
      .map(([name, d]) => {
        const avg = d.totalSeverity / d.count;
        return { name, count: d.count, avgSeverity: avg, rankScore: avg * d.count };
      })
      .sort((a, b) => b.rankScore - a.rankScore)
      .slice(0, 5);

    return { total, avgSeverity, criticalCount, timeData, typeData, worstRoads };
  }, [issues]);

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: '36px 40px', height: '100%', overflowY: 'auto', width: '100%' }} className="custom-scrollbar">
        {/* Header skeleton */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
          <SkeletonBlock width={34} height={34} radius={10} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <SkeletonBlock width={220} height={24} radius={8} />
            <SkeletonBlock width={340} height={12} radius={6} />
          </div>
        </div>

        {/* Stat cards skeleton */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 28 }}>
          {[0, 0.08, 0.16].map((delay, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay }}
              style={{
                flex: 1, borderRadius: 22,
                background: C.surface,
                border: `1px solid ${C.border}`,
                padding: '26px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 22 }}>
                <SkeletonBlock width={100} height={10} radius={6} />
                <SkeletonBlock width={38} height={38} radius={11} />
              </div>
              <SkeletonBlock width={90} height={44} radius={8} style={{ marginBottom: 12 }} />
              <SkeletonBlock width={140} height={10} radius={6} />
            </motion.div>
          ))}
        </div>

        {/* Charts row skeleton */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20, marginBottom: 24 }}
        >
          {/* Area chart skeleton */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
              <SkeletonBlock width={18} height={18} radius={4} />
              <SkeletonBlock width={150} height={14} radius={7} />
            </div>
            <div style={{ height: 280, display: 'flex', alignItems: 'flex-end', gap: 5, padding: '0 4px' }}>
              {[55, 32, 72, 48, 88, 38, 62, 52, 78, 43, 82, 58, 45, 70].map((h, i) => (
                <div
                  key={i}
                  className="skeleton-chart-bar"
                  style={{ flex: 1, height: `${h}%` }}
                />
              ))}
            </div>
          </div>

          {/* Pie chart skeleton */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 28 }}>
            <SkeletonBlock width={170} height={14} radius={7} style={{ marginBottom: 22 }} />
            {/* Donut ring */}
            <div style={{
              width: 150, height: 150,
              borderRadius: '50%',
              border: '26px solid rgba(255,255,255,0.04)',
              margin: '0 auto 22px',
            }} />
            {/* Legend rows */}
            {[80, 100, 65, 90].map((w, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
                <SkeletonBlock width={8} height={8} radius={99} />
                <SkeletonBlock width={w} height={10} radius={6} />
                <SkeletonBlock width={20} height={10} radius={6} style={{ marginLeft: 'auto' }} />
              </div>
            ))}
          </div>
        </motion.div>

        {/* Priority table skeleton */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.28 }}
          style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 28 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <SkeletonBlock width={18} height={18} radius={4} />
            <SkeletonBlock width={210} height={14} radius={7} />
          </div>
          {[0, 0.05, 0.1, 0.15, 0.2].map((delay, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay }}
              style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${C.border}` }}
            >
              <SkeletonBlock width={28} height={14} radius={6} />
              <SkeletonBlock width={140} height={12} radius={6} />
              <SkeletonBlock width={30} height={12} radius={6} />
              <SkeletonBlock width={70} height={22} radius={99} />
              <SkeletonBlock width={80} height={6} radius={99} style={{ marginLeft: 'auto' }} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    );
  }

  // ── Error / service unavailable state ──────────────────────────────────
  if (error) {
    return (
      <div style={{
        height: '100%', width: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 40,
      }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{
            maxWidth: 420, width: '100%',
            textAlign: 'center',
            padding: '44px 36px 36px',
            background: 'rgba(11,15,20,0.97)',
            border: '1px solid rgba(255,59,59,0.2)',
            borderRadius: 22,
            boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 0 40px rgba(255,59,59,0.05)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Top strip */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 3,
            background: 'linear-gradient(90deg, transparent, #FF3B3B 40%, #FF3B3B 60%, transparent)',
          }} />
          {/* Radial bleed */}
          <div style={{
            position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)',
            width: 240, height: 240, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,59,59,0.07) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: 'rgba(255,59,59,0.09)', border: '1px solid rgba(255,59,59,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 22px',
          }}>
            <AlertCircle size={26} color="#FF3B3B" />
          </div>
          <h3 style={{
            fontFamily: 'Outfit, sans-serif', fontSize: '1.1rem',
            fontWeight: 800, color: '#E6EDF3', marginBottom: 10, letterSpacing: '-0.01em',
          }}>
            Analytics Unavailable
          </h3>
          <p style={{ fontSize: '0.8rem', color: '#6B7280', lineHeight: 1.7, marginBottom: 28 }}>
            Could not load dashboard data.<br />
            The backend service may be offline.
          </p>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '5px 14px', borderRadius: 99,
            background: 'rgba(255,59,59,0.07)',
            border: '1px solid rgba(255,59,59,0.16)',
            marginBottom: 28,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#FF3B3B', boxShadow: '0 0 6px rgba(255,59,59,0.8)',
            }} />
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#FF3B3B', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Service Unreachable
            </span>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Pie legend ─────────────────────────────────────────────────────────
  const PieLegend = ({ typeData }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
      {typeData.map((entry, i) => (
        <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
            <span style={{ fontSize: '0.78rem', color: C.textSec, textTransform: 'capitalize' }}>{entry.name}</span>
          </div>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: C.text }}>{entry.value}</span>
        </div>
      ))}
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div
      style={{ padding: '36px 40px', height: '100%', overflowY: 'auto', width: '100%' }}
      className="custom-scrollbar"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ marginBottom: '40px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{
            padding: '8px',
            background: `${C.accent}14`,
            borderRadius: '10px',
            border: `1px solid ${C.accent}22`,
          }}>
            <Map size={18} color={C.accent} />
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Intelligence Oversight</h1>
        </div>
        <p style={{ color: C.textMuted, fontSize: '0.875rem', paddingLeft: '42px' }}>
          Sector-wide infrastructure health monitoring &amp; maintenance prioritization.
        </p>
      </motion.div>

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '28px' }}>
        <StatCard
          title="Total Registry Entries"
          rawValue={stats.total}
          decimals={0}
          icon={Activity}
          color={C.accent}
          subtitle="all-time incidents"
          delay={0.18}
        />
        <StatCard
          title="Health Index Avg"
          rawValue={parseFloat((10 - stats.avgSeverity * 10).toFixed(1))}
          decimals={1}
          suffix="/10"
          icon={TrendingDown}
          color={C.secondary}
          subtitle="network condition score"
          delay={0.28}
        />
        <StatCard
          title="Critical Breach Zones"
          rawValue={stats.criticalCount}
          decimals={0}
          icon={AlertCircle}
          color={C.danger}
          subtitle="severity > 80%"
          delay={0.38}
        />
      </div>

      {/* Charts row */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.18 }}
        style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '20px', marginBottom: '24px' }}
      >
        {/* Area chart */}
        <motion.div
          whileHover={{ y: -4, boxShadow: '0 16px 48px rgba(0,0,0,0.4)', transition: { duration: 0.22 } }}
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: '20px',
            padding: '28px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' }}>
            <BarChart3 size={18} color={C.accent} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Severity Trend</h3>
            <span style={{
              marginLeft: 'auto',
              fontSize: '0.68rem',
              color: C.textMuted,
              background: 'rgba(255,255,255,0.04)',
              padding: '3px 9px',
              borderRadius: '99px',
              border: `1px solid ${C.border}`,
            }}>
              All time
            </span>
          </div>
          <div style={{ height: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.timeData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="severityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.accent} stopOpacity={0.28} />
                    <stop offset="95%" stopColor={C.accent} stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke="transparent"
                  tick={{ fill: C.textMuted, fontSize: 11 }}
                />
                <YAxis
                  stroke="transparent"
                  tick={{ fill: C.textMuted, fontSize: 11 }}
                  domain={[0, 10]}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="severity"
                  stroke={C.accent}
                  strokeWidth={2}
                  fill="url(#severityGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: C.accent, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Pie chart */}
        <motion.div
          whileHover={{ y: -4, boxShadow: '0 16px 48px rgba(0,0,0,0.4)', transition: { duration: 0.22 } }}
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: '20px',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '20px' }}>Category Distribution</h3>
          {stats.typeData.length > 0 ? (
            <>
              <div style={{ height: '200px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.typeData}
                      dataKey="value"
                      innerRadius="55%"
                      outerRadius="80%"
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {stats.typeData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <PieLegend typeData={stats.typeData} />
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMuted, fontSize: '0.85rem' }}>
              No data yet
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Priority table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: '20px',
          padding: '28px',
          marginBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
          <Trophy size={18} color={C.secondary} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Maintenance Priority Queue</h3>
        </div>

        {stats.worstRoads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: C.textMuted, fontSize: '0.85rem' }}>
            No road data available yet.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px' }}>
            <thead>
              <tr>
                {['Rank', 'Coordinates', 'Reports', 'Avg Severity', 'Priority'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left',
                    padding: '8px 14px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: C.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    borderBottom: `1px solid ${C.border}`,
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.worstRoads.map((road, idx) => {
                const color  = getSeverityColor(road.avgSeverity);
                const isTop  = idx === 0;
                return (
                  <motion.tr
                    key={road.name}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)', x: 2, transition: { duration: 0.15 } }}
                    transition={{ delay: idx * 0.06 }}
                    style={{ background: isTop ? `${C.danger}09` : 'rgba(255,255,255,0.015)', cursor: 'default' }}
                  >
                    <td style={{ padding: '12px 14px', borderRadius: idx === 0 ? '8px 0 0 8px' : 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isTop && <ShieldCheck size={14} color={C.danger} />}
                        <span style={{
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          color: isTop ? C.danger : C.textSec,
                        }}>
                          #{idx + 1}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        fontSize: '0.78rem',
                        fontFamily: "'JetBrains Mono', monospace",
                        color: C.text,
                      }}>
                        {road.name}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: C.textSec }}>
                        {road.count}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color,
                        background: `${color}14`,
                        padding: '3px 10px',
                        borderRadius: '99px',
                        border: `1px solid ${color}28`,
                      }}>
                        {(road.avgSeverity * 10).toFixed(1)} / 10
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', borderRadius: idx === 0 ? '0 8px 8px 0' : 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min(100, road.rankScore * 20)}%`,
                            background: color,
                            borderRadius: '99px',
                          }} />
                        </div>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        )}
      </motion.div>
    </div>
  );
}
