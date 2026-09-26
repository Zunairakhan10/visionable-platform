const features = [
  ['01', '◉', 'Voice Interaction', 'Navigate and interact with supported exam controls using voice commands.'],
  ['02', '◌', 'Text-to-Speech', 'Questions and options can be read aloud for audio-first access.'],
  ['03', '⌁', 'Speech-to-Text', 'Convert spoken responses into text for supported descriptive questions.'],
  ['04', '↔', 'Accessible Navigation', 'Keyboard-friendly and screen-reader-friendly examination controls.'],
  ['05', '◈', 'Adaptive Security', 'AI-assisted monitoring can flag unusual events for examiner review.'],
]

function Features() {
  return (
    <section id="features" className="features section-shell" aria-labelledby="features-heading">
      <div className="section-heading">
        <div className="section-kicker">Capabilities / 05</div>
        <h2 id="features-heading">Support that meets candidates where they are.</h2>
        <p>Thoughtful tools for a more independent exam experience — configurable by the examination authority.</p>
      </div>
      <div className="feature-grid">
        {features.map(([number, icon, title, body]) => (
          <article className="feature-card" key={title}>
            <div className="feature-top"><span className="feature-number">{number}</span><span className="feature-icon" aria-hidden="true">{icon}</span></div>
            <h3>{title}</h3>
            <p>{body}</p>
            <span className="card-arrow" aria-hidden="true">↗</span>
          </article>
        ))}
      </div>
    </section>
  )
}

export default Features
