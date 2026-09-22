import React from 'react';
import { motion } from 'framer-motion';
import { Shield, ArrowRight, BrainCircuit, Activity } from 'lucide-react';

const cardVariants = {
  hidden:   { y: 24, opacity: 0 },
  visible: (i) => ({
    y: 0,
    opacity: 1,
    transition: { delay: i * 0.12, duration: 0.5, ease: 'easeOut' },
  }),
};

const BG_URL = 'https://raw.githubusercontent.com/antigravity-ai/assets/main/roadwatch/smart_city_bg.png';

export function LandingPage({ onStart }) {
  return (
    <div className="landing-hero" style={{ backgroundImage: `url(${BG_URL})` }}>
      <div className="landing-content">

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255, 59, 48, 0.1)',
            padding: '7px 20px',
            borderRadius: '100px',
            color: '#FF3B30',
            fontSize: '0.82rem',
            fontWeight: 700,
            marginBottom: '28px',
            border: '1px solid rgba(255, 59, 48, 0.22)',
            letterSpacing: '0.5px',
          }}>
            <Shield size={14} />
            NATIONAL INFRASTRUCTURE SECURITY
          </div>

          <h1 className="landing-title">RoadWatch AI</h1>

          <p className="landing-pitch">
            Advanced AI-Driven Infrastructure Intelligence &amp; Proactive Road Health Analytics.
            Empowering modern cities with real-time detection and predictive maintenance.
          </p>

          {/* CTA buttons */}
          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <motion.button
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="btn btn-primary"
              style={{ padding: '15px 36px', fontSize: '1rem', borderRadius: '14px' }}
              onClick={onStart}
            >
              Access Command Center <ArrowRight size={18} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.97 }}
              className="btn btn-ghost"
              style={{ padding: '15px 28px', fontSize: '1rem', borderRadius: '14px' }}
            >
              <Activity size={18} /> Technical Whitepaper
            </motion.button>
          </div>
        </motion.div>

        {/* Feature cards */}
        <div className="feature-grid">
          {[
            {
              icon: Shield,
              title: 'AI Detection',
              body: 'Computer vision models detect potholes and cracks with 98% accuracy in real-time.',
            },
            {
              icon: BrainCircuit,
              title: 'Predictive Analytics',
              body: 'ML forecasting identifies high-risk areas before damage becomes critical.',
            },
            {
              icon: Activity,
              title: 'Passive Monitoring',
              body: 'Analyzing vehicle telemetry to monitor road quality across the national network.',
            },
          ].map((card, i) => (
            <motion.div
              key={card.title}
              className="feature-card glass"
              custom={i + 1}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
            >
              <motion.div
                className="feature-icon"
                whileHover={{ scale: 1.18, rotate: 8 }}
                transition={{ type: 'spring', stiffness: 360, damping: 18 }}
              >
                <card.icon color="#00E5FF" size={20} />
              </motion.div>
              <h3 style={{ marginBottom: '10px', fontSize: '1.05rem' }}>{card.title}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
                {card.body}
              </p>
            </motion.div>
          ))}
        </div>

      </div>
    </div>
  );
}
