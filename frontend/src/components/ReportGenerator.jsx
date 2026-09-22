import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileText, Loader2, Download } from 'lucide-react';

// ── Severity helpers ──────────────────────────────────────────────────────
const severityLabel = s => s > 0.8 ? 'CRITICAL' : s > 0.4 ? 'WARNING' : 'MINOR';
const severityRGB   = s =>
  s > 0.8 ? [255, 59,  59]  :   // red
  s > 0.4 ? [255, 200, 87]  :   // amber
             [61,  219, 107];    // green

// ═══════════════════════════════════════════════════════════════════════════
// PDF GENERATOR
// ═══════════════════════════════════════════════════════════════════════════
function buildPDF(issues) {
  const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W    = doc.internal.pageSize.getWidth();
  const now  = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const critical = issues.filter(i => i.severityScore > 0.8).length;
  const warning  = issues.filter(i => i.severityScore > 0.4 && i.severityScore <= 0.8).length;
  const minor    = issues.filter(i => i.severityScore <= 0.4).length;
  const avgScore = issues.length
    ? (issues.reduce((s, i) => s + i.severityScore, 0) / issues.length).toFixed(2)
    : '0.00';

  // ── Header band ─────────────────────────────────────────────────────────
  doc.setFillColor(11, 15, 20);
  doc.rect(0, 0, W, 38, 'F');

  // Cyan top accent strip
  doc.setDrawColor(0, 229, 255);
  doc.setLineWidth(1.2);
  doc.line(0, 0, W, 0);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(230, 237, 243);
  doc.text('ROADWATCH AI', 14, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(59, 73, 87);
  doc.text('INFRASTRUCTURE INTELLIGENCE REPORT', 14, 21);

  // Date + "OFFICIAL REPORT" badge (right side)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(0, 229, 255);
  doc.text('OFFICIAL REPORT', W - 14, 13, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(75, 85, 99);
  doc.text(`Generated: ${dateStr} at ${timeStr}`, W - 14, 19, { align: 'right' });
  doc.text(`Total issues: ${issues.length}`, W - 14, 24, { align: 'right' });

  // Cyan horizontal rule
  doc.setDrawColor(0, 229, 255);
  doc.setLineWidth(0.3);
  doc.line(14, 34, W - 14, 34);

  // ── Section: Executive Summary ───────────────────────────────────────────
  let y = 44;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(139, 148, 158);
  doc.text('EXECUTIVE SUMMARY', 14, y);

  y += 7;

  // 4-box stat row
  const boxes = [
    { label: 'Total Issues', value: String(issues.length), color: [0, 229, 255] },
    { label: 'Critical',     value: String(critical),      color: [255, 59, 59] },
    { label: 'Warning',      value: String(warning),       color: [255, 200, 87] },
    { label: 'Minor',        value: String(minor),         color: [61, 219, 107] },
  ];

  const boxW = (W - 28 - 9) / 4;
  boxes.forEach(({ label, value, color }, i) => {
    const bx = 14 + i * (boxW + 3);

    // Box background
    doc.setFillColor(20, 27, 38);
    doc.roundedRect(bx, y, boxW, 20, 2, 2, 'F');

    // Colored top border
    doc.setDrawColor(...color);
    doc.setLineWidth(0.8);
    doc.line(bx + 2, y, bx + boxW - 2, y);

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...color);
    doc.text(value, bx + boxW / 2, y + 10, { align: 'center' });

    // Label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(75, 85, 99);
    doc.text(label.toUpperCase(), bx + boxW / 2, y + 16, { align: 'center' });
  });

  y += 28;

  // Avg severity bar
  const barX = 14, barW = W - 28;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text(`Average Severity Score: ${avgScore} / 1.00`, barX, y);
  y += 4;

  doc.setFillColor(28, 36, 50);
  doc.roundedRect(barX, y, barW, 4, 1, 1, 'F');

  const fillPct = Math.min(1, parseFloat(avgScore));
  const fillColor = fillPct > 0.8 ? [255, 59, 59] : fillPct > 0.4 ? [255, 200, 87] : [61, 219, 107];
  doc.setFillColor(...fillColor);
  doc.roundedRect(barX, y, barW * fillPct, 4, 1, 1, 'F');

  y += 12;

  // ── Section: Recommendations ─────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(139, 148, 158);
  doc.text('RECOMMENDATIONS', 14, y);

  y += 6;

  const recommendations = [];
  if (critical > 0)
    recommendations.push(`• ${critical} CRITICAL issue${critical > 1 ? 's' : ''} require immediate repair within 48 hours to prevent vehicle damage and liability.`);
  if (warning > 0)
    recommendations.push(`• ${warning} WARNING issue${warning > 1 ? 's' : ''} should be scheduled for repair within 2–4 weeks.`);
  if (minor > 0)
    recommendations.push(`• ${minor} MINOR issue${minor > 1 ? 's' : ''} should be included in the next routine maintenance cycle.`);
  if (issues.length === 0)
    recommendations.push('• No road issues currently detected. Continue routine inspections.');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 187, 198);

  recommendations.forEach(line => {
    const lines = doc.splitTextToSize(line, W - 28);
    doc.text(lines, 14, y);
    y += lines.length * 5;
  });

  y += 5;

  // ── Section: Issue Register (table) ──────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(139, 148, 158);
  doc.text('ISSUE REGISTER', 14, y);

  y += 4;

  const rows = issues.map((issue, idx) => {
    const label = severityLabel(issue.severityScore);
    const ts    = issue.timestamp
      ? new Date(issue.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
      : '—';
    return [
      String(idx + 1).padStart(3, '0'),
      (issue.type || 'unknown').toUpperCase(),
      label,
      (issue.severityScore * 10).toFixed(1),
      `${(issue.latitude  || 0).toFixed(5)}`,
      `${(issue.longitude || 0).toFixed(5)}`,
      ts,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['#', 'TYPE', 'LEVEL', 'SCORE', 'LATITUDE', 'LONGITUDE', 'DATE']],
    body: rows,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
      textColor: [180, 187, 198],
      fillColor: [13, 20, 32],
      lineColor: [28, 36, 50],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [20, 27, 38],
      textColor: [0, 229, 255],
      fontStyle: 'bold',
      fontSize: 7,
      lineWidth: 0,
    },
    alternateRowStyles: {
      fillColor: [17, 24, 36],
    },
    didDrawCell: (data) => {
      // Colorize the LEVEL column text
      if (data.section === 'body' && data.column.index === 2) {
        const level   = data.cell.raw;
        const rgb     = level === 'CRITICAL' ? [255, 59, 59] : level === 'WARNING' ? [255, 200, 87] : [61, 219, 107];
        const origDraw = doc.internal.getCurrentPageInfo;
        doc.setTextColor(...rgb);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text(level, data.cell.x + 4, data.cell.y + data.cell.height / 2 + 1.2);
        // Reset
        doc.setTextColor(180, 187, 198);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
      }
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 26 },
      2: { cellWidth: 22, textColor: [180, 187, 198] },
      3: { cellWidth: 16, halign: 'right', font: 'courier' },
      4: { cellWidth: 28, font: 'courier', fontSize: 7 },
      5: { cellWidth: 28, font: 'courier', fontSize: 7 },
      6: { cellWidth: 24, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  // ── Footer on every page ─────────────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    const pH = doc.internal.pageSize.getHeight();

    doc.setDrawColor(28, 36, 50);
    doc.setLineWidth(0.3);
    doc.line(14, pH - 14, W - 14, pH - 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(59, 73, 87);
    doc.text('RoadWatch AI · Infrastructure Intelligence Platform · CONFIDENTIAL', 14, pH - 8);
    doc.text(`Page ${p} of ${pageCount}`, W - 14, pH - 8, { align: 'right' });
  }

  return doc;
}

// ═══════════════════════════════════════════════════════════════════════════
// BUTTON COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export function ReportGenerator({ issues, compact = false }) {
  const [generating, setGenerating] = useState(false);
  const [done,       setDone]       = useState(false);

  const handleGenerate = async () => {
    if (generating || !issues.length) return;
    setGenerating(true);
    setDone(false);

    // Yield to the browser so the spinner renders before the sync PDF work
    await new Promise(r => setTimeout(r, 80));

    try {
      const doc = buildPDF(issues);
      const ts  = new Date().toISOString().slice(0, 10);
      doc.save(`RoadWatch-Report-${ts}.pdf`);
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } finally {
      setGenerating(false);
    }
  };

  if (compact) {
    return (
      <motion.button
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        onClick={handleGenerate}
        disabled={generating || issues.length === 0}
        title="Download official PDF report"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 40, height: 40,
          borderRadius: 10,
          border: done
            ? '1px solid rgba(61,219,107,0.3)'
            : '1px solid rgba(0,229,255,0.2)',
          background: done
            ? 'rgba(61,219,107,0.08)'
            : 'rgba(0,229,255,0.07)',
          color: done ? '#3DDB6B' : '#00E5FF',
          cursor: generating || issues.length === 0 ? 'not-allowed' : 'pointer',
          opacity: issues.length === 0 ? 0.4 : 1,
          transition: 'all 0.2s ease',
        }}
      >
        {generating
          ? <Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} />
          : done
            ? <Download size={15} />
            : <FileText size={15} />
        }
      </motion.button>
    );
  }

  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.97 }}
      onClick={handleGenerate}
      disabled={generating || issues.length === 0}
      style={{
        width: '100%',
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '11px 14px',
        borderRadius: 11,
        border: done
          ? '1px solid rgba(61,219,107,0.25)'
          : '1px solid rgba(0,229,255,0.18)',
        background: done
          ? 'linear-gradient(135deg, rgba(61,219,107,0.1), rgba(61,219,107,0.04))'
          : 'linear-gradient(135deg, rgba(0,229,255,0.09), rgba(0,229,255,0.03))',
        color: done ? '#3DDB6B' : '#00E5FF',
        fontSize: '0.8rem',
        fontWeight: 700,
        cursor: generating || issues.length === 0 ? 'not-allowed' : 'pointer',
        opacity: issues.length === 0 ? 0.45 : 1,
        fontFamily: 'Inter, sans-serif',
        letterSpacing: '0.02em',
        transition: 'all 0.2s ease',
        boxShadow: done
          ? '0 0 18px rgba(61,219,107,0.08)'
          : '0 0 18px rgba(0,229,255,0.06)',
        flexShrink: 0,
      }}
    >
      {generating ? (
        <Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
      ) : done ? (
        <Download size={15} style={{ flexShrink: 0 }} />
      ) : (
        <FileText size={15} style={{ flexShrink: 0 }} />
      )}
      <span style={{ flex: 1, textAlign: 'left' }}>
        {generating ? 'Generating…' : done ? 'Report Downloaded!' : 'Generate PDF Report'}
      </span>
      {!generating && !done && issues.length > 0 && (
        <span style={{
          fontSize: '0.6rem', color: 'rgba(0,229,255,0.5)',
          fontWeight: 400, letterSpacing: 0,
        }}>
          {issues.length} issues
        </span>
      )}
    </motion.button>
  );
}
