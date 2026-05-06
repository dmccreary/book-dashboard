// "Run Next Task" — picks the next pending task and renders a button + modal.

const { useState: useStateN, useMemo: useMemoN, useEffect: useEffectN } = React;

function pickNextTask() {
  // priority: drafted > not-started; within that, first encountered in section order.
  // For aggregate sections, pick the first non-published child.
  const pri = { "drafted": 0, "reviewed": 1, "not-started": 2, "published": 99 };
  let best = null;
  let bestPri = 99;
  window.SECTIONS.forEach(s => {
    if (s.children) {
      s.children.forEach(c => {
        if (c.status === "published") return;
        const p = pri[c.status];
        if (p < bestPri) {
          bestPri = p;
          best = {
            id: `${s.id}/${c.id}`,
            section: s.short || s.name,
            sectionId: s.id,
            title: c.title,
            status: c.status,
            tokens: Math.round(c.tokens * (1 - STATUS_WEIGHT[c.status])),
          };
        }
      });
    } else if (s.status !== "published") {
      const p = pri[s.status];
      if (p < bestPri) {
        bestPri = p;
        best = {
          id: s.id,
          section: s.short || s.name,
          sectionId: s.id,
          title: s.name,
          status: s.status,
          tokens: Math.round(sectionTargetTokens(s) * (1 - STATUS_WEIGHT[s.status])),
          description: s.description,
        };
      }
    }
  });
  return best;
}

// Get a description for the task (use section description for child tasks)
function taskDescription(task) {
  if (task.description) return task.description;
  // fall back: look up parent section's description
  const parent = window.SECTIONS.find(s => s.id === task.sectionId);
  if (parent && parent.description) {
    return `Part of ${parent.name}. ` + parent.description;
  }
  return "Generate this section using the project's house style and learning objectives.";
}

// Estimate clock time: ~2,000 tokens / second of model output is plausible for a fast model;
// add some thinking overhead. We'll use 1,400 tok/s effective.
function estimateClockSeconds(tokens) {
  return Math.max(20, Math.round(tokens / 1400));
}
function fmtDuration(sec) {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

function RunNextTaskButton({ task, onOpen }) {
  if (!task) {
    return (
      <div className="next-task-card is-empty">
        <div className="next-task-eyebrow">Up next</div>
        <div className="next-task-title">All tasks complete 🎉</div>
        <div className="next-task-desc">Nothing pending — your textbook is fully published.</div>
      </div>
    );
  }
  return (
    <button className="next-task-card" onClick={onOpen}>
      <div className="next-task-left">
        <div className="next-task-eyebrow">
          <span>Run next task</span>
          <span className="next-task-section">{task.section}</span>
          <StatusPill status={task.status} size="sm" />
        </div>
        <div className="next-task-title">{task.title}</div>
        <div className="next-task-desc">{taskDescription(task).slice(0, 140)}{taskDescription(task).length > 140 ? "…" : ""}</div>
      </div>
      <div className="next-task-cta">
        <span className="next-task-cta-label">Start</span>
        <svg viewBox="0 0 16 16" fill="none" width="14" height="14"><path d="M5 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
    </button>
  );
}

function RunNextTaskModal({ open, onClose, task, plan }) {
  // Esc to close
  useEffectN(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !task) return null;

  const clockSec = estimateClockSeconds(task.tokens);
  const sessionBudget = PROJECT.sessionBudget[plan];
  const tokensUsedSoFar = 220_000; // same fake "already used" baseline as Burn panel
  const remainingBefore = Math.max(0, sessionBudget - tokensUsedSoFar);
  const remainingAfter  = Math.max(0, remainingBefore - task.tokens);
  const cost = formatCost(task.tokens, PROJECT.costPerMTokens);
  const description = taskDescription(task);

  return (
    <div className="rn-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rn-panel" role="dialog" aria-modal="true">
        <div className="rn-header">
          <div className="rn-header-left">
            <div className="rn-eyebrow">
              <span className="rn-eyebrow-dot"></span>
              Run next task
              <span className="rn-eyebrow-section">· {task.section}</span>
            </div>
            <h2 className="rn-title">{task.title}</h2>
          </div>
          <button className="rn-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="rn-body">
          <div className="rn-status-row">
            <StatusPill status={task.status} />
            <span className="rn-status-meta">→ Drafted, ready for the model</span>
          </div>

          <p className="rn-desc">{description}</p>

          <div className="rn-stats">
            <div className="rn-stat">
              <div className="rn-stat-icon">
                <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/><path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div className="rn-stat-label">Estimated clock time</div>
              <div className="rn-stat-value">{fmtDuration(clockSec)}</div>
              <div className="rn-stat-sub">at ~1,400 tok / sec</div>
            </div>
            <div className="rn-stat tokens-only">
              <div className="rn-stat-icon">
                <svg viewBox="0 0 16 16" fill="none"><rect x="2" y="4" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M2 7h12" stroke="currentColor" strokeWidth="1.4"/></svg>
              </div>
              <div className="rn-stat-label">Tokens this task</div>
              <div className="rn-stat-value">{formatTokens(task.tokens)}</div>
              <div className="rn-stat-sub">{task.tokens.toLocaleString()} estimated</div>
            </div>
            <div className="rn-stat">
              <div className="rn-stat-icon">
                <svg viewBox="0 0 16 16" fill="none"><path d="M2 12V4M14 12V8M2 12h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M5 12V7M8 12V5M11 12V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
              </div>
              <div className="rn-stat-label">Window remaining after</div>
              <div className="rn-stat-value">{formatTokens(remainingAfter)}</div>
              <div className="rn-stat-sub">of {formatTokens(remainingBefore)} · Claude {plan === "max" ? "Max" : "Pro"}</div>
            </div>
            <div className="rn-stat tokens-only">
              <div className="rn-stat-icon">
                <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/><path d="M10 5.5H7a1.5 1.5 0 0 0 0 3h2a1.5 1.5 0 0 1 0 3H6M8 4v8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
              </div>
              <div className="rn-stat-label">If billed via API</div>
              <div className="rn-stat-value">{cost}</div>
              <div className="rn-stat-sub">at ${PROJECT.costPerMTokens} / M output</div>
            </div>
          </div>

          <div className="rn-mini-bar">
            <div className="rn-mini-bar-track">
              <div className="rn-mini-bar-used" style={{width: (tokensUsedSoFar / sessionBudget * 100) + "%"}}></div>
              <div className="rn-mini-bar-task" style={{
                left: (tokensUsedSoFar / sessionBudget * 100) + "%",
                width: Math.min(100 - (tokensUsedSoFar / sessionBudget * 100), task.tokens / sessionBudget * 100) + "%"
              }}></div>
            </div>
            <div className="rn-mini-bar-legend tokens-only">
              <span><span className="dot" style={{background: "var(--c-gray-700)"}}></span> Already used {formatTokens(tokensUsedSoFar)}</span>
              <span><span className="dot" style={{background: "var(--c-accent)"}}></span> This task {formatTokens(task.tokens)}</span>
              <span style={{color: "var(--c-gray-500)"}}>Window total {formatTokens(sessionBudget)}</span>
            </div>
          </div>
        </div>

        <div className="rn-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn accent" onClick={onClose}>
            {Icon.sparkle} Run task
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { pickNextTask, RunNextTaskButton, RunNextTaskModal });
