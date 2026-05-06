// Helpers + small primitives
const { useState, useMemo, useEffect, useRef } = React;

// ── Utilities ────────────────────────────────────────────
function formatTokens(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "") + "K";
  return String(n);
}
function formatCost(tokens, perM) {
  const dollars = (tokens / 1_000_000) * perM;
  if (dollars < 1) return "$" + dollars.toFixed(2);
  if (dollars < 100) return "$" + dollars.toFixed(2);
  return "$" + Math.round(dollars).toLocaleString();
}

// % from a section: leaf = STATUS_WEIGHT, parent = weighted by children tokens
function sectionProgress(section) {
  if (section.children) {
    const total = section.children.reduce((a, c) => a + c.tokens, 0);
    const done  = section.children.reduce((a, c) => a + c.tokens * STATUS_WEIGHT[c.status], 0);
    return total ? done / total : 0;
  }
  if (section.tokensTarget && section.tokensDone != null) {
    // blend status-weighted target with actual done — bias to status
    const w = STATUS_WEIGHT[section.status];
    return w;
  }
  return STATUS_WEIGHT[section.status] || 0;
}
function sectionTargetTokens(section) {
  if (section.children) return section.children.reduce((a, c) => a + c.tokens, 0);
  return section.tokensTarget || 0;
}
function sectionDoneTokens(section) {
  if (section.children) {
    return section.children.reduce((a, c) => a + Math.round(c.tokens * STATUS_WEIGHT[c.status]), 0);
  }
  return section.tokensDone != null
    ? section.tokensDone
    : Math.round(sectionTargetTokens(section) * STATUS_WEIGHT[section.status]);
}
function sectionStatusSummary(section) {
  // returns {published, reviewed, drafted, "not-started"} counts (or 1/0 markers for leaf)
  const counts = { published: 0, reviewed: 0, drafted: 0, "not-started": 0 };
  if (section.children) {
    section.children.forEach(c => counts[c.status]++);
    return counts;
  }
  counts[section.status] = 1;
  return counts;
}
function sectionRollupStatus(section) {
  // for the segment fill color — pick the dominant or "current working" status
  if (!section.children) return section.status;
  const counts = sectionStatusSummary(section);
  // if any drafted/reviewed: pick the highest one that's in progress
  if (counts.reviewed > 0 && counts["not-started"] === 0 && counts.drafted === 0 && counts.published === 0) return "reviewed";
  if (counts.published === section.children.length) return "published";
  if (counts["not-started"] === section.children.length) return "not-started";
  // mixed → drafted
  return "drafted";
}

// ── Icons ─────────────────────────────────────────────
const Icon = {
  check: (<svg viewBox="0 0 16 16" fill="none"><path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  refresh: (<svg viewBox="0 0 16 16" fill="none"><path d="M2 8a6 6 0 0 1 10.5-3.97M14 8a6 6 0 0 1-10.5 3.97" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M11 1.5v3h3M5 14.5v-3H2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  sparkle: (<svg viewBox="0 0 16 16" fill="none"><path d="M8 1v4M8 11v4M1 8h4M11 8h4M3.2 3.2l2.8 2.8M10 10l2.8 2.8M3.2 12.8l2.8-2.8M10 6l2.8-2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>),
  eye: (<svg viewBox="0 0 16 16" fill="none"><path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" stroke="currentColor" strokeWidth="1.5"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/></svg>),
  comment: (<svg viewBox="0 0 16 16" fill="none"><path d="M2 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6l-3 2.5V12H4a2 2 0 0 1-2-2V4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>),
  arrowLeft: (<svg viewBox="0 0 16 16" fill="none"><path d="M9.5 3L4.5 8l5 5M4.5 8H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  chev: (<svg viewBox="0 0 16 16" fill="none" className="chev-svg"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>),
};

// ── Atoms ─────────────────────────────────────────────
function StatusPill({ status, size = "md" }) {
  const m = STATUS_META[status];
  return (
    <span className="pill" style={{ background: m.bg, color: m.fg, fontSize: size === "sm" ? 10 : 11 }}>
      <span className="dot" style={{ background: m.dot }}></span>
      {m.label}
    </span>
  );
}

Object.assign(window, {
  formatTokens, formatCost,
  sectionProgress, sectionTargetTokens, sectionDoneTokens,
  sectionStatusSummary, sectionRollupStatus,
  Icon, StatusPill,
});
