import { useState } from 'react'

function Navbar({ onStartExam, onOpenDashboard }) {
  const [open, setOpen] = useState(false)
  const closeMenu = () => setOpen(false)

  const startExam = () => {
    closeMenu()
    onStartExam()
  }

  const openDashboard = () => {
    closeMenu()
    onOpenDashboard()
  }

  return (
    <header className="site-header">
      <div className="nav-inner">
        <a className="brand" href="#top" onClick={closeMenu} aria-label="VisionAble home"><span className="brand-mark" aria-hidden="true">V</span><span className="brand-name">VISION<span>ABLE</span></span></a>
        <button className="menu-toggle" type="button" aria-expanded={open} aria-controls="primary-nav" onClick={() => setOpen((value) => !value)}><span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span><span aria-hidden="true">{open ? '✕' : '☰'}</span></button>
        <nav id="primary-nav" className={open ? 'primary-nav is-open' : 'primary-nav'} aria-label="Primary">
          <a href="#about" onClick={closeMenu}>About</a><a href="#features" onClick={closeMenu}>Features</a><a href="#how-it-works" onClick={closeMenu}>How It Works</a>
          <button className="nav-dashboard" type="button" onClick={openDashboard}>Examiner dashboard</button>
          <button className="nav-cta" type="button" onClick={startExam}>Try exam prototype <span aria-hidden="true">→</span></button>
        </nav>
      </div>
    </header>
  )
}

export default Navbar
