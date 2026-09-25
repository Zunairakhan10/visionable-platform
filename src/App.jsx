import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Features from './components/Features'
import Footer from './components/Footer'
import './App.css'

function App() {
  return (
    <div className="page" id="top">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <Navbar />
      <main id="main">
        <Hero />
        <section id="about" className="about" aria-labelledby="about-heading">
          <div className="section-intro">
            <p className="eyebrow">About</p>
            <h2 id="about-heading">Exams should not depend on someone else reading the paper</h2>
            <p>
              VisionAble is being built so visually impaired candidates can sit
              secure examinations independently. Voice, speech, and accessible
              navigation are first-class parts of the experience — not add-ons.
            </p>
          </div>
        </section>
        <Features />
        <section
          id="get-started"
          className="get-started"
          aria-labelledby="cta-heading"
        >
          <h2 id="cta-heading">Ready when you are</h2>
          <p>
            Candidate accounts, voice exams, and secure submissions are coming
            next. This landing page is the starting point for the VisionAble
            platform.
          </p>
          <a className="btn btn-primary" href="#features">
            Review the features
          </a>
        </section>
      </main>
      <Footer />
    </div>
  )
}

export default App
