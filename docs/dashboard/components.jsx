// Progress bar with weighted segments + click-to-select
function ProgressBar({ sections, selectedId, onSelect }) {
  const totalTokens = sections.reduce((a, s) => a + sectionTargetTokens(s), 0);

  return (
    <div className="progress">
      <div className="progress-track" role="tablist">
        {sections.map(s => {
          const w = sectionTargetTokens(s) / totalTokens;
          const fill = Math.round(sectionProgress(s) * 100);
          const status = sectionRollupStatus(s);
          return (
            <button
              key={s.id}
              className={"seg" + (selectedId === s.id ? " is-selected" : "")}
              data-status={status}
              style={{ "--w": w, "--fill": fill + "%" }}
              onClick={() => onSelect(s.id)}
              title={`${s.name} — ${fill}%`}
            >
              <div className="seg-fill"></div>
            </button>
          );
        })}
      </div>

      <div className="seg-labels">
        {sections.map(s => {
          const w = sectionTargetTokens(s) / totalTokens;
          return (
            <button
              key={s.id}
              className={"seg-label" + (selectedId === s.id ? " is-selected" : "")}
              style={{ "--w": w }}
              onClick={() => onSelect(s.id)}
            >
              {s.short}
            </button>
          );
        })}
      </div>

      <div className="legend">
        <span className="legend-item"><span className="legend-dot" style={{background: "var(--c-gray-200)"}}></span> Not started</span>
        <span className="legend-item"><span className="legend-dot" style={{background: "var(--c-amber-500)"}}></span> Drafted</span>
        <span className="legend-item"><span className="legend-dot" style={{background: "var(--c-blue-500)"}}></span> Reviewed</span>
        <span className="legend-item"><span className="legend-dot" style={{background: "var(--c-gray-900)"}}></span> Published</span>
        <span style={{flex: 1}}></span>
        <span className="legend-item tokens-only" style={{color: "var(--c-gray-400)"}}>Bar widths reflect estimated tokens</span>
      </div>
    </div>
  );
}

// Summary cards
function SummaryStrip({ sections, plan, onPlanChange }) {
  const totalTarget = sections.reduce((a, s) => a + sectionTargetTokens(s), 0);
  const totalDone   = sections.reduce((a, s) => a + sectionDoneTokens(s), 0);
  const remaining   = Math.max(0, totalTarget - totalDone);
  const overallPct  = Math.round((totalDone / totalTarget) * 100);
  const totalCost   = formatCost(totalTarget, PROJECT.costPerMTokens);
  const sessionsLeft = remaining / PROJECT.sessionBudget[plan];

  return (
    <div className="summary">
      <div className="summary-card">
        <div className="label">Overall progress</div>
        <div className="value">{overallPct}<small>%</small></div>
        <div className="sub">{formatTokens(totalDone)} of {formatTokens(totalTarget)} tokens</div>
        <div className="sub tokens-only">≈ {formatCost(totalTarget, PROJECT.costPerMTokens)} estimated cost</div>
      </div>
      <div className="summary-card tokens-only">
        <div className="label">Total token budget <span style={{color: "var(--c-gray-400)", fontWeight: 400, textTransform: "none", letterSpacing: 0}}>· Claude {plan === "max" ? "Max" : "Pro"}</span></div>
        <div className="value">{formatTokens(totalTarget)}</div>
        <div className="sub">≈ {totalCost} at ${PROJECT.costPerMTokens}/M out</div>
      </div>
      <div className="summary-card">
        <div className="label">Time to completion</div>
        <div className="value">~{Math.ceil(remaining / 80_000)}<small> days</small></div>
        <div className="sub">at your current pace</div>
      </div>
      <div className="summary-card">
        <div className="label">Five-hour sessions left</div>
        <div className="value">{sessionsLeft < 1 ? "<1" : Math.ceil(sessionsLeft)}</div>
        <div className="plan-toggle">
          {["pro","max"].map(p => (
            <button key={p}
              className={plan === p ? "is-active" : ""}
              onClick={() => onPlanChange(p)}
            >{p === "pro" ? "Pro" : "Max"}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Overview grid (master view, before any section is selected)
function OverviewGrid({ sections, onSelect }) {
  return (
    <div className="detail-empty" style={{padding: 0}}>
      <div style={{padding: "28px 32px 16px"}}>
        <h2>All sections</h2>
        <p>Click a segment in the bar above, or pick a section below, to see its description, token estimate, and actions.</p>
      </div>
      <div className="section-grid">
        {sections.map(s => {
          const pct = Math.round(sectionProgress(s) * 100);
          const status = sectionRollupStatus(s);
          return (
            <button key={s.id} className="section-tile" onClick={() => onSelect(s.id)}>
              <div className="tile-head">
                <div className="tile-name">{s.name}</div>
                {s.countLabel && <div className="tile-count">{s.countLabel}</div>}
              </div>
              <div className="tile-bar">
                <div className="tile-bar-fill"
                  style={{
                    width: pct + "%",
                    background: status === "not-started" ? "var(--c-gray-200)"
                      : status === "drafted" ? "var(--c-amber-500)"
                      : status === "reviewed" ? "var(--c-blue-500)"
                      : "var(--c-gray-900)"
                  }}
                />
              </div>
              <div className="tile-foot">
                <span>{pct}%</span>
                <span className="tokens-only">{formatTokens(sectionTargetTokens(s))} tok</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Detail panel
function DetailPanel({ section, onBack }) {
  const [expanded, setExpanded] = useState(false);
  // Reset expanded state when switching sections
  useEffect(() => { setExpanded(false); }, [section.id]);

  const target = sectionTargetTokens(section);
  const done   = sectionDoneTokens(section);
  const pct    = Math.round((done / target) * 100);
  const cost   = formatCost(target, PROJECT.costPerMTokens);
  const status = sectionRollupStatus(section);
  const counts = sectionStatusSummary(section);
  const isAggregate = !!section.children;

  return (
    <div className="detail">
      <div className="detail-main">
        <div className="detail-eyebrow">
          <button onClick={onBack}>{Icon.arrowLeft} All sections</button>
          <span style={{color: "var(--c-gray-300)"}}>/</span>
          <span>{section.name}</span>
        </div>

        <h2>
          {section.name}
          {section.countLabel && <span className="count-pill">{section.countLabel}</span>}
        </h2>

        <div style={{marginBottom: 18}}>
          <StatusPill status={status} />
        </div>

        <p className="detail-desc">{section.description}</p>

        <div className="actions">
          <button className="btn accent">{Icon.sparkle} Generate</button>
          <button className="btn">{Icon.eye} Preview</button>
          <button className="btn">{Icon.refresh} Regenerate</button>
          <button className="btn">{Icon.check} Mark complete</button>
          <button className="btn">{Icon.comment} Notes</button>
        </div>

        {isAggregate && (
          <div className="children">
            <div className="children-summary">
              <div className="cs-cell"><div className="v">{counts.published}</div><div className="l">Published</div></div>
              <div className="cs-cell"><div className="v">{counts.reviewed}</div><div className="l">Reviewed</div></div>
              <div className="cs-cell"><div className="v">{counts.drafted}</div><div className="l">Drafted</div></div>
              <div className="cs-cell"><div className="v">{counts["not-started"]}</div><div className="l">To do</div></div>
            </div>

            <div className="children-head">
              <h3>{section.children.length} items</h3>
              <button
                className={"expand-toggle" + (expanded ? " is-open" : "")}
                onClick={() => setExpanded(e => !e)}
              >
                <span className="chev">{Icon.chev}</span>
                {expanded ? "Hide list" : "Show list"}
              </button>
            </div>

            {expanded && (
              <div className="child-list">
                {section.children.map(c => (
                  <div className="child-row" key={c.id}>
                    <span className="child-num">{String(c.n).padStart(2, "0")}</span>
                    <span className="child-title">{c.title}</span>
                    <span className="child-tokens tokens-only">{formatTokens(c.tokens)} tok</span>
                    <ChildPill status={c.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="detail-side">
        <div className="stats">
          <div>
            <div className="stat-label">Progress</div>
            <div className="stat-value">{pct}%</div>
            <div className="minibar"><div className="minibar-fill" style={{
              width: pct + "%",
              background: status === "not-started" ? "var(--c-gray-200)"
                : status === "drafted" ? "var(--c-amber-500)"
                : status === "reviewed" ? "var(--c-blue-500)"
                : "var(--c-gray-900)"
            }}/></div>
          </div>

          <div className="tokens-only">
            <div className="stat-label">Tokens estimated</div>
            <div className="stat-value">{formatTokens(target)}</div>
            <div className="stat-sub">{target.toLocaleString()} total</div>
          </div>

          <div className="tokens-only">
            <div className="stat-label">Tokens generated</div>
            <div className="stat-value">{formatTokens(done)}</div>
            <div className="stat-sub">{Math.max(0, target - done).toLocaleString()} remaining</div>
          </div>

          <div className="tokens-only">
            <div className="stat-label">Estimated cost</div>
            <div className="stat-value">{cost}</div>
            <div className="stat-sub">at ${PROJECT.costPerMTokens} / M output tokens</div>
          </div>

          <div>
            <div className="stat-label">Last updated</div>
            <div className="stat-value" style={{fontSize: 14}}>2 hours ago</div>
            <div className="stat-sub">by you</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChildPill({ status }) {
  const m = STATUS_META[status];
  return (
    <span className="child-pill" style={{ background: m.bg, color: m.fg }}>
      <span className="dot" style={{ background: m.dot }}></span>
      {m.label}
    </span>
  );
}

Object.assign(window, { ProgressBar, SummaryStrip, OverviewGrid, DetailPanel });
