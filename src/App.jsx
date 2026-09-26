import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Features from './components/Features'
import Footer from './components/Footer'
import './App.css'

const steps = [
  ['01', 'Accessibility profile', 'Set the support your examination authority permits.'],
  ['02', 'Device check', 'Confirm audio, keyboard and session readiness.'],
  ['03', 'Accessible exam', 'Move through questions with the controls that work for you.'],
  ['04', 'AI-assisted monitoring', 'Policy events are logged without treating accessibility as suspicious.'],
  ['05', 'Examiner review', 'Human examiners review answers, sessions and flagged events.'],
]

function App() {
  return (
    <div className="page" id="top">
      <a className="skip-link" href="#main">Skip to main content</a>
      <Navbar />
      <main id="main">
        <Hero />

        <section className="capability-strip" aria-label="VisionAble capabilities">
          <div className="capability-item"><span className="capability-icon">◉</span><span>Voice enabled</span></div>
          <div className="capability-item"><span className="capability-icon">◌</span><span>Screen reader friendly</span></div>
          <div className="capability-item"><span className="capability-icon">↔</span><span>Accessible navigation</span></div>
          <div className="capability-item"><span className="capability-icon">⌁</span><span>Secure exam environment</span></div>
        </section>

        <section id="about" className="about section-shell" aria-labelledby="about-heading">
          <div className="section-kicker">01 / The platform</div>
          <div className="about-grid">
            <h2 id="about-heading">Technology that removes barriers.</h2>
            <p>VisionAble brings accessibility, voice interaction and configurable exam security into one calm, considered experience — designed to support independent assessment.</p>
          </div>
        </section>

        <Features />

        <section id="how-it-works" className="process section-shell" aria-labelledby="process-heading">
          <div className="section-heading centered-heading">
            <div className="section-kicker">02 / How it works</div>
            <h2 id="process-heading">A clearer path through every exam.</h2>
            <p>From setup to examiner review, each stage is designed around clarity, choice and accountable support.</p>
          </div>
          <ol className="process-grid">
            {steps.map(([number, title, body]) => (
              <li className="process-step" key={number}>
                <span className="step-number">{number}</span>
                <div className="step-line" aria-hidden="true" />
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="preview-section section-shell" aria-labelledby="preview-heading">
          <div className="preview-copy">
            <div className="section-kicker">03 / Candidate experience</div>
            <h2 id="preview-heading">An exam interface that listens.</h2>
            <p>Audio-first controls, readable structure and familiar interactions help candidates stay focused on the question — not the interface.</p>
            <div className="preview-points">
              <span><b>✓</b> Clear focus states</span>
              <span><b>✓</b> Voice commands kept reliable</span>
              <span><b>✓</b> Answers saved as you go</span>
            </div>
          </div>
          <div className="exam-window" aria-label="Visual prototype of the VisionAble exam interface">
            <div className="exam-topbar"><span className="window-dots"><i /><i /><i /></span><span>VISIONABLE EXAM</span><span className="exam-session">SECURE SESSION <b>●</b></span></div>
            <div className="exam-content">
              <div className="exam-progress"><span>Question 07 / 20</span><span>35% complete</span></div>
              <div className="progress-track"><span /></div>
              <p className="exam-label">DATA STRUCTURES · MULTIPLE CHOICE</p>
              <h3>Which data structure follows the FIFO principle?</h3>
              <div className="answer-list">
                <div className="answer-option"><span>A</span> Stack</div>
                <div className="answer-option selected"><span>B</span> Queue <b className="selected-check">✓</b></div>
                <div className="answer-option"><span>C</span> Tree</div>
                <div className="answer-option"><span>D</span> Graph</div>
              </div>
              <div className="exam-footer"><span>◉ Voice active</span><span>◌ Audio enabled</span><span className="saved">✓ Answer saved</span><button type="button">Next question&nbsp; →</button></div>
            </div>
          </div>
        </section>

        <section className="security section-shell" aria-labelledby="security-heading">
          <div className="security-panel">
            <div className="security-copy">
              <div className="section-kicker">04 / Accountable security</div>
              <h2 id="security-heading">Accessible doesn’t mean compromised.</h2>
              <p>VisionAble supports configurable exam security while keeping approved accessibility behavior separate from suspicious-event detection.</p>
            </div>
            <div className="security-list">
              <div><span className="security-icon">↯</span><span><strong>Event logging</strong><small>Timestamped examination-session events.</small></span></div>
              <div><span className="security-icon">⌁</span><span><strong>AI-assisted monitoring</strong><small>Unusual events can be flagged for human review.</small></span></div>
              <div><span className="security-icon">▣</span><span><strong>Examiner dashboard</strong><small>Review answers, sessions and flagged events.</small></span></div>
            </div>
          </div>
        </section>

        <section id="get-started" className="final-cta section-shell" aria-labelledby="cta-heading">
          <div className="cta-orb" aria-hidden="true" />
          <div className="section-kicker">05 / Start with access</div>
          <h2 id="cta-heading">Make examinations more accessible.</h2>
          <p>Technology should remove barriers — not create them.</p>
          <a className="btn btn-primary" href="#top">Get Started <span aria-hidden="true">→</span></a>
        </section>
      </main>
      <Footer />
    </div>
  )
}

export default App
