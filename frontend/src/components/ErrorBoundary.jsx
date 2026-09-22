import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// ════════════════════════════════════════════════════════════
//  ErrorBoundary — catches any JS error inside a subtree and
//  renders a contained fallback UI instead of crashing the app.
//
//  Usage:
//    <ErrorBoundary label="Road Map">
//      <RoadMap ... />
//    </ErrorBoundary>
//
//  Props:
//    label    — human-readable name shown in the error card (optional)
//    fallback — completely custom fallback node (optional)
// ════════════════════════════════════════════════════════════
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught in:', this.props.label ?? 'Unknown', '\n', error, info.componentStack);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;

    // Allow a fully custom fallback
    if (this.props.fallback) return this.props.fallback;

    const label = this.props.label ?? 'Panel';
    const msg   = this.state.error?.message ?? 'An unexpected error occurred.';

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        style={{
          width: '100%',
          height: '100%',
          minHeight: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(11,15,20,0.92)',
          backdropFilter: 'blur(18px)',
          padding: 24,
        }}
      >
        <motion.div
          initial={{ scale: 0.94, y: 10, opacity: 0 }}
          animate={{ scale: 1,    y: 0,  opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
          style={{
            maxWidth: 380,
            width: '100%',
            textAlign: 'center',
            padding: '36px 32px 32px',
            background: 'rgba(11,15,20,0.97)',
            border: '1px solid rgba(255,59,59,0.2)',
            borderRadius: 20,
            boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 0 40px rgba(255,59,59,0.06)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* 3-px danger top strip */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: 3,
            background: 'linear-gradient(90deg, transparent, #FF3B3B 40%, #FF3B3B 60%, transparent)',
            pointerEvents: 'none',
          }} />

          {/* Faint radial bleed behind icon */}
          <div style={{
            position: 'absolute',
            top: '-30%', left: '50%', transform: 'translateX(-50%)',
            width: 200, height: 200,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,59,59,0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          {/* Icon */}
          <div style={{
            width: 56, height: 56,
            borderRadius: '50%',
            background: 'rgba(255,59,59,0.09)',
            border: '1px solid rgba(255,59,59,0.22)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            position: 'relative',
          }}>
            <AlertTriangle size={24} color="#FF3B3B" />
          </div>

          {/* Title */}
          <h3 style={{
            fontFamily: 'Outfit, sans-serif',
            fontSize: '1rem',
            fontWeight: 700,
            color: '#E6EDF3',
            marginBottom: 8,
            letterSpacing: '-0.01em',
          }}>
            {label} Error
          </h3>

          {/* Message */}
          <p style={{
            fontSize: '0.75rem',
            color: '#6B7280',
            lineHeight: 1.65,
            marginBottom: 24,
            maxWidth: 280,
            margin: '0 auto 24px',
          }}>
            {msg}
          </p>

          {/* Retry button */}
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={this.reset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '8px 20px',
              borderRadius: 9,
              background: 'rgba(255,59,59,0.1)',
              border: '1px solid rgba(255,59,59,0.28)',
              color: '#FF3B3B',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.3px',
              fontFamily: 'Inter, sans-serif',
              transition: 'background 0.18s ease',
            }}
          >
            <RefreshCw size={13} />
            Retry
          </motion.button>
        </motion.div>
      </motion.div>
    );
  }
}
