function App() {
  const [tweaks, setTweak] = useTweaks(window.TWEAK_DEFAULTS);
  const { showTokens, density, plan } = tweaks;
  const [selectedId, setSelectedId] = useState(null);
  const [burnOpen, setBurnOpen] = useState(false);
  const [nextTaskOpen, setNextTaskOpen] = useState(false);
  const nextTask = useMemo(() => pickNextTask(), []);

  // sync data attrs to <html> for token visibility + density
  useEffect(() => {
    document.documentElement.dataset.showTokens = showTokens ? "true" : "false";
    document.documentElement.dataset.density = density;
  }, [showTokens, density]);

  const sections = window.SECTIONS;
  const selected = selectedId ? sections.find(s => s.id === selectedId) : null;

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">IT</div>
          <span>Interactive Textbook Studio</span>
        </div>
        <div className="topbar-actions">
          <button className="btn">{Icon.eye} Preview book</button>
          <button className="btn primary">{Icon.sparkle} Continue building</button>
        </div>
      </div>

      <div className="header">
        <div className="title-block">
          <h1>{PROJECT.title}</h1>
          <p className="subtitle">{PROJECT.subtitle}</p>
        </div>
        <div className="percent-readout">
          <div className="percent-num">
            {Math.round(
              sections.reduce((a, s) => a + sectionDoneTokens(s), 0) /
              sections.reduce((a, s) => a + sectionTargetTokens(s), 0) * 100
            )}<small>%</small>
          </div>
          <div className="percent-label">Complete</div>
        </div>
      </div>

      <ProgressBar
        sections={sections}
        selectedId={selectedId}
        onSelect={(id) => setSelectedId(id === selectedId ? null : id)}
      />

      <SummaryStrip
        sections={sections}
        plan={plan}
        onPlanChange={(p) => setTweak("plan", p)}
      />

      <RunNextTaskButton task={nextTask} onOpen={() => setNextTaskOpen(true)} />
      <RunNextTaskModal open={nextTaskOpen} onClose={() => setNextTaskOpen(false)} task={nextTask} plan={plan} />

      <div className="detail-shell">
        {selected
          ? <DetailPanel section={selected} onBack={() => setSelectedId(null)} />
          : <OverviewGrid sections={sections} onSelect={setSelectedId} />
        }
      </div>

      <BurnTokensButton onOpen={() => setBurnOpen(true)} />
      <BurnTokensPanel open={burnOpen} onClose={() => setBurnOpen(false)} plan={plan} />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Display">
          <TweakToggle
            label="Show token estimates"
            value={showTokens}
            onChange={(v) => setTweak("showTokens", v)}
          />
          <TweakRadio
            label="Density"
            value={density}
            options={[{value: "comfy", label: "Comfy"}, {value: "compact", label: "Compact"}]}
            onChange={(v) => setTweak("density", v)}
          />
        </TweakSection>
        <TweakSection label="Plan">
          <TweakRadio
            label="Subscription"
            value={plan}
            options={[{value: "pro", label: "Pro"}, {value: "max", label: "Max"}]}
            onChange={(v) => setTweak("plan", v)}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
