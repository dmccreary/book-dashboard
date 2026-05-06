// Burn Tokens — modal panel that lists pending tasks and runs a "parallel burn"
// animation against the sliding 5-hour limit.

const { useState: useStateB, useEffect: useEffectB, useMemo: useMemoB, useRef: useRefB } = React;

// Pull every NOT-published item out of the project as a "task"
function collectPendingTasks() {
  const tasks = [];
  window.SECTIONS.forEach(s => {
    if (s.children) {
      s.children.forEach(c => {
        if (c.status !== "published") {
          tasks.push({
            id: `${s.id}/${c.id}`,
            sectionId: s.id,
            section: s.short || s.name,
            title: c.title,
            status: c.status,
            // remaining tokens to spend on this item
            tokens: Math.round(c.tokens * (1 - STATUS_WEIGHT[c.status])),
          });
        }
      });
    } else if (s.status !== "published") {
      const target = sectionTargetTokens(s);
      tasks.push({
        id: s.id,
        sectionId: s.id,
        section: s.short || s.name,
        title: s.name,
        status: s.status,
        tokens: Math.round(target * (1 - STATUS_WEIGHT[s.status])),
      });
    }
  });
  return tasks;
}

// fmt mm:ss for countdown
function fmtClock(ms) {
  if (ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function BurnTokensButton({ onOpen }) {
  return (
    <div className="burn-rail">
      <div className="burn-rail-text">
        <div className="burn-rail-title">Got tokens to burn?</div>
        <div className="burn-rail-sub">Run every pending task in parallel before your 5-hour window resets.</div>
      </div>
      <button className="btn burn-trigger" onClick={onOpen}>
        <span className="burn-flame" aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none">
            <path d="M8 1.5s.5 2.2 2 3.7 2.5 2.7 2.5 4.5a4.5 4.5 0 0 1-9 0c0-1.1.4-2 1.2-2.7C5.5 7 6 5.5 6 4c.5 1 1.5 1.5 2 1.5 0-1.5 0-2.5 0-4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
          </svg>
        </span>
        Burn Tokens
      </button>
    </div>
  );
}

function BurnTokensPanel({ open, onClose, plan }) {
  const [selected, setSelected] = useStateB(() => new Set());
  const [phase, setPhase] = useStateB("idle"); // idle | burning | done
  const [progress, setProgress] = useStateB({}); // taskId -> 0..1
  const [mode, setMode] = useStateB("parallel"); // "parallel" | "sequential"
  // sliding 5h window – fake "started 47 minutes ago"
  const windowStartRef = useRefB(Date.now() - 47 * 60 * 1000);
  const [now, setNow] = useStateB(Date.now());
  const tasks = useMemoB(() => collectPendingTasks(), []);

  // select-all by default when panel opens
  useEffectB(() => {
    if (open && phase === "idle") {
      setSelected(new Set(tasks.map(t => t.id)));
    }
  }, [open, tasks, phase]);

  // tick clock
  useEffectB(() => {
    if (!open) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [open]);

  // Esc to close
  useEffectB(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const selectedTasks = tasks.filter(t => selected.has(t.id));
  const totalSelected = selectedTasks.reduce((a, t) => a + t.tokens, 0);
  const sessionBudget = PROJECT.sessionBudget[plan];
  const elapsed = now - windowStartRef.current;
  const remainingMs = 5 * 60 * 60 * 1000 - elapsed;
  const remainingTokens = Math.max(0, sessionBudget - 220_000); // pretend 220K already used
  const overBudget = totalSelected > remainingTokens;

  function toggle(id) {
    if (phase !== "idle") return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function selectAll() {
    if (phase !== "idle") return;
    if (selected.size === tasks.length) setSelected(new Set());
    else setSelected(new Set(tasks.map(t => t.id)));
  }

  function startBurn() {
    setPhase("burning");
    setProgress({});
    const start = performance.now();
    const finishAt = {};
    let cumulative = 0;
    if (mode === "parallel") {
      // All tasks start at t=0, finish at randomized times (6–14s each).
      selectedTasks.forEach(t => {
        finishAt[t.id] = { startAt: 0, endAt: 6000 + Math.random() * 8000 };
      });
    } else {
      // Sequential: each task starts when the previous one ends. Slower per task too.
      selectedTasks.forEach(t => {
        const dur = 4000 + Math.random() * 4000; // 4–8s each, sequentially
        finishAt[t.id] = { startAt: cumulative, endAt: cumulative + dur };
        cumulative += dur;
      });
    }
    let raf;
    const tick = () => {
      const t = performance.now() - start;
      const next = {};
      let allDone = true;
      selectedTasks.forEach(task => {
        const { startAt, endAt } = finishAt[task.id];
        if (t < startAt) {
          next[task.id] = 0;
          allDone = false;
        } else {
          const p = Math.min(1, (t - startAt) / (endAt - startAt));
          next[task.id] = p;
          if (p < 1) allDone = false;
        }
      });
      setProgress(next);
      if (allDone) {
        setPhase("done");
      } else {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
  }

  function reset() {
    setPhase("idle");
    setProgress({});
  }

  // tokens already burnt in this session (animated)
  const tokensBurned = selectedTasks.reduce(
    (a, t) => a + (progress[t.id] || 0) * t.tokens, 0
  );

  return (
    <div className="burn-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="burn-panel" role="dialog" aria-modal="true">
        <div className="burn-header">
          <div className="burn-header-left">
            <div className="burn-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 2s.8 3.5 3.2 5.8c2.4 2.3 3.8 4.2 3.8 7.2a7 7 0 0 1-14 0c0-1.7.6-3.1 1.8-4.2C8.5 9.5 9.5 7 9.5 4.5c.8 1.6 2.5 2.5 2.5 2.5C12 5 12 3.5 12 2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <h2 className="burn-title">Burn Tokens</h2>
              <p className="burn-sub">Run every selected task before your 5-hour window resets.</p>
            </div>
          </div>
          <button className="burn-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="burn-stats">
          <div className="burn-stat">
            <div className="burn-stat-label">Window resets in</div>
            <div className={"burn-stat-value mono" + (remainingMs < 30 * 60 * 1000 ? " is-urgent" : "")}>
              {fmtClock(remainingMs)}
            </div>
          </div>
          <div className="burn-stat">
            <div className="burn-stat-label">Tokens left in window</div>
            <div className="burn-stat-value">{formatTokens(remainingTokens)}</div>
          </div>
          <div className="burn-stat">
            <div className="burn-stat-label">{phase === "idle" ? "Selected" : "Burning"}</div>
            <div className={"burn-stat-value" + (overBudget ? " is-urgent" : "")}>
              {phase === "idle"
                ? `${formatTokens(totalSelected)} · ${selectedTasks.length} tasks`
                : `${formatTokens(Math.round(tokensBurned))} / ${formatTokens(totalSelected)}`}
            </div>
          </div>
        </div>

        <div className="burn-mode">
          <div className="burn-mode-label">Execution mode</div>
          <div className="burn-mode-options">
            <label className={"burn-mode-opt" + (mode === "sequential" ? " is-active" : "") + (phase !== "idle" ? " is-disabled" : "")}>
              <input type="radio" name="burn-mode" value="sequential"
                checked={mode === "sequential"}
                onChange={() => setMode("sequential")}
                disabled={phase !== "idle"} />
              <div className="burn-mode-opt-body">
                <div className="burn-mode-opt-title">Sequential</div>
                <div className="burn-mode-opt-sub">Slower · low cost</div>
              </div>
            </label>
            <label className={"burn-mode-opt" + (mode === "parallel" ? " is-active" : "") + (phase !== "idle" ? " is-disabled" : "")}>
              <input type="radio" name="burn-mode" value="parallel"
                checked={mode === "parallel"}
                onChange={() => setMode("parallel")}
                disabled={phase !== "idle"} />
              <div className="burn-mode-opt-body">
                <div className="burn-mode-opt-title">Parallel <span className="burn-mode-opt-flame">🔥</span></div>
                <div className="burn-mode-opt-sub">Fast · expensive</div>
              </div>
            </label>
          </div>
        </div>

        <div className="burn-list-head">
          <button className="burn-selectall" onClick={selectAll} disabled={phase !== "idle"}>
            {selected.size === tasks.length ? "Clear all" : "Select all"}
          </button>
          <div className="burn-list-meta">{tasks.length} pending tasks across {new Set(tasks.map(t => t.sectionId)).size} sections</div>
        </div>

        <div className="burn-list">
          {tasks.map(t => {
            const isSel = selected.has(t.id);
            const p = progress[t.id] || 0;
            const isBurning = phase !== "idle" && isSel;
            const isDone = isBurning && p >= 1;
            return (
              <label key={t.id} className={"burn-row" + (isSel ? " is-selected" : "") + (isBurning ? " is-burning" : "") + (isDone ? " is-done" : "")}>
                <input
                  type="checkbox"
                  checked={isSel}
                  onChange={() => toggle(t.id)}
                  disabled={phase !== "idle"}
                />
                <div className="burn-row-main">
                  <div className="burn-row-section">{t.section}</div>
                  <div className="burn-row-title">{t.title}</div>
                </div>
                <div className="burn-row-tokens tokens-only">{formatTokens(t.tokens)}</div>
                <div className="burn-row-status">
                  {phase === "idle" && <StatusPill status={t.status} />}
                  {isBurning && !isDone && (
                    <div className="burn-bar"><div className="burn-bar-fill" style={{width: (p * 100) + "%"}}></div></div>
                  )}
                  {isDone && <span className="burn-done-tag">{Icon.check} Done</span>}
                </div>
              </label>
            );
          })}
        </div>

        <div className="burn-footer">
          <div className="burn-footer-warn">
            {overBudget && phase === "idle" && (
              <span>⚠︎ Selected exceeds remaining window budget by <strong>{formatTokens(totalSelected - remainingTokens)}</strong></span>
            )}
            {phase === "burning" && (
              <span>🔥 Burning {selectedTasks.length} tasks {mode === "parallel" ? "in parallel" : "sequentially"}…</span>
            )}
            {phase === "done" && (
              <span>✓ All {selectedTasks.length} tasks burned. {formatTokens(Math.round(totalSelected))} consumed.</span>
            )}
          </div>
          <div className="burn-footer-actions">
            <button className="btn" onClick={onClose}>{phase === "done" ? "Close" : "Cancel"}</button>
            {phase === "idle" && (
              <button
                className="btn burn-now"
                disabled={selectedTasks.length === 0}
                onClick={startBurn}
              >
                <span className="burn-flame"><svg viewBox="0 0 16 16" fill="none"><path d="M8 1.5s.5 2.2 2 3.7 2.5 2.7 2.5 4.5a4.5 4.5 0 0 1-9 0c0-1.1.4-2 1.2-2.7C5.5 7 6 5.5 6 4c.5 1 1.5 1.5 2 1.5 0-1.5 0-2.5 0-4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg></span>
                Burn Now
              </button>
            )}
            {phase === "burning" && (
              <button className="btn burn-now is-disabled" disabled>Burning…</button>
            )}
            {phase === "done" && (
              <button className="btn" onClick={reset}>Run again</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { BurnTokensButton, BurnTokensPanel });
