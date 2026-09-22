import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, CheckCircle2, Loader2, AlertCircle, ImagePlus } from 'lucide-react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8080/api`;
const UPLOAD_URL = `${API_BASE}/issues/upload`;

// status: 'idle' | 'uploading' | 'processing' | 'success' | 'error'

export function UploadModal({ onClose, onSuccess }) {
  const [file,    setFile]    = useState(null);
  const [preview, setPreview] = useState(null);
  const [status,  setStatus]  = useState('idle');
  const [error,   setError]   = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  // ── File selection ─────────────────────────────────────────────────────
  const applyFile = (f) => {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setError('');
  };

  const handleFileChange = (e) => applyFile(e.target.files[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    applyFile(e.dataTransfer.files[0]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  // ── Upload ─────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!file || status !== 'idle') return;

    setStatus('uploading');
    setError('');

    // Simulate GPS coordinates near NYC (normally from EXIF / user pin)
    const lat = 40.7128 + (Math.random() - 0.5) * 0.1;
    const lng = -74.006  + (Math.random() - 0.5) * 0.1;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('lat',  lat);
    formData.append('lng',  lng);

    // Small delay → show "uploading" state for UX feedback
    await new Promise(r => setTimeout(r, 900));
    setStatus('processing');

    try {
      const res = await axios.post(UPLOAD_URL, formData);
      setStatus('success');
      setTimeout(() => onSuccess(res.data), 1600);
    } catch (err) {
      const msg = err.response
        ? `Server error ${err.response.status}: ${err.response.data?.message || 'Upload failed'}`
        : 'Cannot reach backend. Is it running on port 8080?';
      setError(msg);
      setStatus('idle'); // let user retry
    }
  };

  const isProcessing = status === 'uploading' || status === 'processing';

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
    }}>
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 12 }}
        animate={{ scale: 1,    opacity: 1, y: 0  }}
        exit={{   scale: 0.92, opacity: 0, y: 12  }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        style={{
          width: '100%',
          maxWidth: '480px',
          background: '#111722',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '22px',
          padding: '32px',
          position: 'relative',
          boxShadow: '0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(0,229,255,0.06)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px',
            color: '#9CA3AF',
            cursor: 'pointer',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#9CA3AF'; }}
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div style={{ marginBottom: '24px', paddingRight: '40px' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '4px' }}>Analyze Road Condition</h2>
          <p style={{ fontSize: '0.8rem', color: '#6B7280' }}>Upload an image for AI-powered damage detection.</p>
        </div>

        {/* ── Content area (swaps by status) ────────────────────────────── */}
        <AnimatePresence mode="wait">

          {/* Idle / file picker */}
          {status === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div
                onClick={() => document.getElementById('rw-file-input').click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={() => setIsDragOver(false)}
                animate={{ scale: isDragOver ? 1.025 : 1 }}
                transition={{ type: 'spring', stiffness: 340, damping: 26 }}
                style={{
                  border: `2px dashed ${isDragOver ? 'rgba(0,229,255,0.5)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '16px',
                  height: '220px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  position: 'relative',
                  background: isDragOver
                    ? 'rgba(0, 229, 255, 0.05)'
                    : preview ? 'transparent' : 'rgba(255,255,255,0.015)',
                  transition: 'border-color 0.2s ease, background 0.2s ease',
                }}
              >
                {preview ? (
                  <>
                    <img
                      src={preview}
                      alt="Preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {/* Overlay hint */}
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(0,0,0,0.45)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0,
                      transition: 'opacity 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = 1; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = 0; }}
                    >
                      <span style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 600 }}>Click to change</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{
                      padding: '14px',
                      background: 'rgba(0, 229, 255, 0.08)',
                      borderRadius: '50%',
                      marginBottom: '14px',
                      border: '1px solid rgba(0,229,255,0.15)',
                    }}>
                      <ImagePlus size={28} color="#00E5FF" />
                    </div>
                    <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '6px' }}>
                      {isDragOver ? 'Drop to upload' : 'Drop road image here'}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                      or click to browse · JPG, PNG, MP4 · up to 50 MB
                    </p>
                  </>
                )}
                <input id="rw-file-input" type="file" hidden onChange={handleFileChange} accept="image/*,video/*" />
              </motion.div>

              {/* Inline error message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{
                      marginTop: '12px',
                      padding: '10px 14px',
                      background: 'rgba(255,59,59,0.08)',
                      border: '1px solid rgba(255,59,59,0.2)',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.78rem',
                      color: '#FF3B3B',
                    }}
                  >
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Loading states */}
          {isProcessing && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.22 }}
              style={{
                height: '220px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
              }}
            >
              {/* Animated ring */}
              <div style={{ position: 'relative', width: '64px', height: '64px' }}>
                <div style={{
                  position: 'absolute', inset: 0,
                  borderRadius: '50%',
                  border: '2px solid rgba(0,229,255,0.1)',
                }} />
                <div style={{
                  position: 'absolute', inset: 0,
                  borderRadius: '50%',
                  border: '2px solid transparent',
                  borderTopColor: '#00E5FF',
                  animation: 'spin 0.9s linear infinite',
                }} />
                <div style={{
                  position: 'absolute',
                  inset: '14px',
                  borderRadius: '50%',
                  background: 'rgba(0,229,255,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {status === 'uploading'
                    ? <Upload size={16} color="#00E5FF" />
                    : <Loader2 size={16} color="#00E5FF" className="animate-spin" />
                  }
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px' }}>
                  {status === 'uploading' ? 'Uploading Media...' : 'Running AI Detection...'}
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#6B7280', lineHeight: 1.6 }}>
                  {status === 'uploading'
                    ? 'Sending data to the backend server.'
                    : 'Identifying potholes, cracks, and severity score.'}
                </p>
              </div>
            </motion.div>
          )}

          {/* Success */}
          {status === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              style={{
                height: '220px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '14px',
                textAlign: 'center',
              }}
            >
              <motion.div
                initial={{ scale: 0, rotate: -30, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.05 }}
                style={{
                  padding: '18px',
                  background: 'rgba(61, 219, 107, 0.1)',
                  borderRadius: '50%',
                  border: '1px solid rgba(48,209,88,0.2)',
                }}
              >
                <CheckCircle2 size={40} color="#3DDB6B" />
              </motion.div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#3DDB6B', marginBottom: '6px' }}>
                  Issue Detected &amp; Saved
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#6B7280', lineHeight: 1.6 }}>
                  Data has been geo-tagged and pinned to the map.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Action buttons ────────────────────────────────────────────── */}
        {status !== 'success' && (
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <motion.button
              className="btn btn-ghost"
              style={{ flex: 1 }}
              onClick={onClose}
              disabled={isProcessing}
              whileHover={!isProcessing ? { scale: 1.02, y: -1 } : {}}
              whileTap={!isProcessing ? { scale: 0.97 } : {}}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            >
              Cancel
            </motion.button>
            <motion.button
              whileHover={!isProcessing && file ? { scale: 1.02 } : {}}
              whileTap={!isProcessing && file ? { scale: 0.98 } : {}}
              className="btn btn-primary"
              style={{ flex: 2 }}
              disabled={!file || isProcessing}
              onClick={handleUpload}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {status === 'uploading' ? 'Uploading...' : 'Processing...'}
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Start Analysis
                </>
              )}
            </motion.button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
