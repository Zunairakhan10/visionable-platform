const features = [
  {
    title: 'Voice Interaction',
    body: 'Ask for a question, repeat a section, or move ahead using clear spoken commands designed for exam flow.',
  },
  {
    title: 'Text-to-Speech',
    body: 'Hear questions, options, and instructions read aloud with a calm, consistent voice you can control.',
  },
  {
    title: 'Speech-to-Text',
    body: 'Speak your answers and have them transcribed accurately, so writing is never a barrier to completing an exam.',
  },
  {
    title: 'Accessible Navigation',
    body: 'Move through the paper with keyboard support, skip links, high contrast, and a layout that stays easy to follow.',
  },
  {
    title: 'Secure Examination',
    body: 'Protect exam integrity with a locked-down session, candidate identity checks, and a trustworthy submission trail.',
  },
]

function Features() {
  return (
    <section id="features" className="features" aria-labelledby="features-heading">
      <div className="section-intro">
        <p className="eyebrow">Built-in support</p>
        <h2 id="features-heading">Everything needed for an accessible exam</h2>
        <p>
          Five capabilities work together so visually impaired candidates can
          take assessments independently and fairly.
        </p>
      </div>

      <ul className="feature-grid">
        {features.map((feature) => (
          <li key={feature.title} className="feature-card">
            <h3>{feature.title}</h3>
            <p>{feature.body}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default Features
