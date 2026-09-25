function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-heading">
      <div className="hero-copy">
        <p className="eyebrow">Accessible examinations</p>
        <h1 id="hero-heading">
          Independent, secure exams for visually impaired candidates
        </h1>
        <p className="hero-lead">
          VisionAble is an AI-powered examination platform designed so
          candidates can listen, speak, and navigate an exam with confidence —
          without relying on a scribe.
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="#get-started">
            Get Started
          </a>
          <a className="btn btn-secondary" href="#features">
            Explore features
          </a>
        </div>
      </div>

      <div className="hero-visual" aria-hidden="true">
        <div className="visual-card">
          <div className="visual-header">
            <span className="status-dot" />
            Live voice session
          </div>
          <p className="visual-prompt">“Read question three aloud.”</p>
          <div className="waveform">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <ul className="visual-list">
            <li>Question read with text-to-speech</li>
            <li>Answer captured by speech-to-text</li>
            <li>Keyboard-friendly exam controls</li>
          </ul>
        </div>
      </div>
    </section>
  )
}

export default Hero
