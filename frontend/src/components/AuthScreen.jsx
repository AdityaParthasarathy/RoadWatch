import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Satellite, Mail, Lock, Eye, EyeOff, AlertTriangle, Loader2, UserPlus, LogIn } from 'lucide-react';
import {
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from '../firebase';

// ─── tiny reusable field ────────────────────────────────────────────────────
function Field({ label, type, value, onChange, icon: Icon, placeholder, error }) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  const inputType  = isPassword ? (show ? 'text' : 'password') : type;

  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{
        display: 'block',
        fontSize: '0.68rem',
        fontWeight: 700,
        color: '#6B7280',
        letterSpacing: '1px',
        textTransform: 'uppercase',
        marginBottom: 7,
      }}>
        {label}
      </label>

      <div style={{ position: 'relative' }}>
        {/* Left icon */}
        <div style={{
          position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
          pointerEvents: 'none',
        }}>
          <Icon size={14} color={error ? '#FF3B3B' : '#3D4957'} />
        </div>

        <input
          type={inputType}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${error ? 'rgba(255,59,59,0.45)' : 'rgba(255,255,255,0.09)'}`,
            borderRadius: 11,
            padding: `11px 42px 11px ${isPassword ? '40px' : '40px'}`,
            color: '#E6EDF3',
            fontSize: '0.875rem',
            fontFamily: 'Inter, sans-serif',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          }}
          onFocus={e => {
            e.target.style.borderColor = error ? 'rgba(255,59,59,0.7)' : 'rgba(0,229,255,0.4)';
            e.target.style.boxShadow   = error ? '0 0 0 3px rgba(255,59,59,0.08)' : '0 0 0 3px rgba(0,229,255,0.07)';
          }}
          onBlur={e => {
            e.target.style.borderColor = error ? 'rgba(255,59,59,0.45)' : 'rgba(255,255,255,0.09)';
            e.target.style.boxShadow   = 'none';
          }}
        />

        {/* Show/hide toggle for password */}
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(v => !v)}
            style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 2,
              color: '#4B5563', display: 'flex', alignItems: 'center',
            }}
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ fontSize: '0.7rem', color: '#FF3B3B', marginTop: 5, display: 'flex', alignItems: 'center', gap: 5 }}
        >
          <AlertTriangle size={10} />
          {error}
        </motion.div>
      )}
    </div>
  );
}

// ─── map Firebase error codes to friendly messages ───────────────────────────
function friendlyError(code) {
  const map = {
    'auth/user-not-found':       'No account found with this email.',
    'auth/wrong-password':       'Incorrect password.',
    'auth/invalid-email':        'Please enter a valid email address.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password':        'Password must be at least 6 characters.',
    'auth/too-many-requests':    'Too many attempts. Please try again later.',
    'auth/invalid-credential':   'Email or password is incorrect.',
    'auth/network-request-failed': 'Network error — check your connection.',
  };
  return map[code] ?? 'Something went wrong. Please try again.';
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN AUTH SCREEN
// ═══════════════════════════════════════════════════════════════════════════
export function AuthScreen() {
  const [mode,     setMode]     = useState('login');   // 'login' | 'signup'
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [fieldErr, setFieldErr] = useState({});

  const isSignup = mode === 'signup';

  const clearErrors = () => { setError(null); setFieldErr({}); };

  const switchMode = (m) => {
    setMode(m);
    setEmail(''); setPassword(''); setConfirm('');
    clearErrors();
  };

  const validate = () => {
    const errs = {};
    if (!email)    errs.email    = 'Email is required.';
    if (!password) errs.password = 'Password is required.';
    if (isSignup && password && password.length < 6)
      errs.password = 'Minimum 6 characters.';
    if (isSignup && password !== confirm)
      errs.confirm = 'Passwords do not match.';
    setFieldErr(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setError(null);
    try {
      if (isSignup) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      // onAuthStateChanged in App.jsx handles the rest
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: '100vh', width: '100vw',
      background: '#0B0F14',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
    }}>

      {/* ── Background grid ── */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(rgba(0,229,255,0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,229,255,0.025) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
        maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
      }} />

      {/* ── Ambient glow blobs ── */}
      <div style={{ position: 'absolute', top: '15%', left: '20%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,229,255,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '15%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,59,59,0.03) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* ── Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1    }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{
          width: '100%',
          maxWidth: 420,
          margin: '0 16px',
          background: 'rgba(13,20,32,0.97)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 24,
          overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.03)',
          position: 'relative',
        }}
      >
        {/* Cyan top accent */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, transparent, #00E5FF88, #00E5FF, #00E5FF88, transparent)' }} />

        {/* Radial glow behind logo */}
        <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: 260, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,229,255,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ padding: '36px 36px 32px', position: 'relative' }}>

          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              width: 52, height: 52,
              background: 'linear-gradient(135deg, rgba(0,229,255,0.15), rgba(0,229,255,0.06))',
              border: '1px solid rgba(0,229,255,0.25)',
              borderRadius: 15,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px',
              boxShadow: '0 0 24px rgba(0,229,255,0.12)',
            }}>
              <Satellite size={24} color="#00E5FF" />
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: '#E6EDF3', letterSpacing: '-0.02em', marginBottom: 4 }}>
              RoadWatch AI
            </div>
            <div style={{ fontSize: '0.65rem', color: '#3D4957', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600 }}>
              Infrastructure Intelligence Platform
            </div>
          </div>

          {/* Mode tabs */}
          <div style={{
            display: 'flex',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12, padding: 4, marginBottom: 28,
          }}>
            {[
              { id: 'login',  label: 'Sign In',    icon: LogIn    },
              { id: 'signup', label: 'Create Account', icon: UserPlus },
            ].map(({ id, label, icon: Icon }) => (
              <motion.button
                key={id}
                onClick={() => switchMode(id)}
                whileTap={{ scale: 0.97 }}
                style={{
                  flex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '9px 0',
                  borderRadius: 9,
                  border: 'none',
                  background: mode === id
                    ? 'linear-gradient(135deg, rgba(0,229,255,0.14), rgba(0,229,255,0.06))'
                    : 'transparent',
                  color: mode === id ? '#00E5FF' : '#4B5563',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  transition: 'all 0.2s ease',
                  boxShadow: mode === id ? 'inset 0 0 0 1px rgba(0,229,255,0.2)' : 'none',
                }}
              >
                <Icon size={13} />
                {label}
              </motion.button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate>
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={v => { setEmail(v); clearErrors(); }}
              icon={Mail}
              placeholder="you@example.com"
              error={fieldErr.email}
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={v => { setPassword(v); clearErrors(); }}
              icon={Lock}
              placeholder={isSignup ? 'Minimum 6 characters' : 'Your password'}
              error={fieldErr.password}
            />

            <AnimatePresence>
              {isSignup && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginBottom: 0 }}
                  exit={{   opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.22 }}
                >
                  <Field
                    label="Confirm Password"
                    type="password"
                    value={confirm}
                    onChange={v => { setConfirm(v); clearErrors(); }}
                    icon={Lock}
                    placeholder="Repeat password"
                    error={fieldErr.confirm}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Global error banner */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1,  y:  0 }}
                  exit={{   opacity: 0,  y: -6  }}
                  transition={{ duration: 0.22 }}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 9,
                    padding: '11px 14px',
                    borderRadius: 11,
                    background: 'rgba(255,59,59,0.08)',
                    border: '1px solid rgba(255,59,59,0.25)',
                    marginBottom: 18,
                  }}
                >
                  <AlertTriangle size={14} color="#FF3B3B" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: '0.78rem', color: '#FF3B3B', lineHeight: 1.5 }}>
                    {error}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={!loading ? { scale: 1.02, y: -1 } : {}}
              whileTap={!loading  ? { scale: 0.97  }        : {}}
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '13px 0',
                borderRadius: 12,
                border: 'none',
                background: loading
                  ? 'rgba(0,229,255,0.08)'
                  : 'linear-gradient(135deg, #00B8CC, #00E5FF)',
                color: loading ? '#3D4957' : '#0B0F14',
                fontSize: '0.9rem',
                fontWeight: 800,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'Inter, sans-serif',
                letterSpacing: '0.02em',
                boxShadow: loading ? 'none' : '0 6px 24px rgba(0,229,255,0.28)',
                transition: 'background 0.2s ease, box-shadow 0.2s ease, color 0.2s ease',
              }}
            >
              {loading
                ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Authenticating…</>
                : isSignup
                  ? <><UserPlus size={16} /> Create Account</>
                  : <><LogIn size={16} /> Sign In</>
              }
            </motion.button>
          </form>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 36px 20px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          textAlign: 'center',
          fontSize: '0.65rem',
          color: '#3D4957',
          letterSpacing: '0.3px',
        }}>
          Secured by Firebase Authentication · RoadWatch AI
        </div>
      </motion.div>
    </div>
  );
}
