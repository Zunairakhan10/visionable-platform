function Hero() {
  return (
    <section className="hero section-shell" aria-labelledby="hero-heading">
      <div className="hero-copy">
        <p className="hero-badge"><span /> AI <b>•</b> ACCESSIBILITY <b>•</b> SECURITY</p>
        <h1 id="hero-heading">Exams Without <em>Barriers.</em></h1>
        <p className="hero-lead">An AI-powered examination platform designed to make assessments more accessible for visually impaired candidates — while supporting configurable exam security.</p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="#get-started">Get Started <span aria-hidden="true">→</span></a>
          <a className="btn btn-ghost" href="#features">Explore Features <span aria-hidden="true">↘</span></a>
        </div>
        <p className="hero-note"><span aria-hidden="true">✦</span> Built for accessible, secure and independent examination.</p>
      </div>
      <div className="hero-visual" aria-label="Visual preview of an accessible AI examination interface">
        <div className="visual-grid" aria-hidden="true" />
        <div className="data-line line-one" aria-hidden="true" /><div className="data-line line-two" aria-hidden="true" />
        <div className="floating-chip chip-top"><span className="chip-icon">◉</span><span><b>Voice Active</b><small>Listening for commands</small></span><i className="live-dot" /></div>
        <div className="floating-chip chip-bottom"><span className="chip-icon purple">◌</span><span><b>Audio Enabled</b><small>Text-to-speech ready</small></span><i className="check-dot">✓</i></div>
        <div className="core-wrap">
          <div className="core-ring ring-outer" /><div className="core-ring ring-inner" /><div className="core-glow" />
          <div className="core-mark">✦</div>
          <span className="core-dot dot-a" /><span className="core-dot dot-b" /><span className="core-dot dot-c" />
        </div>
        <div className="visual-caption"><span className="secure-icon">✓</span><span><b>Secure Session</b><small>Ready for accessible assessment</small></span></div>
        <div className="waveform" aria-hidden="true">{[24, 38, 72, 48, 92, 58, 32, 66, 42, 78, 28, 52, 36, 64, 44].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div>
      </div>
    </section>
  )
}

export default Hero
