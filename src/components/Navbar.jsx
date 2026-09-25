import { useState } from 'react'

function Navbar() {
  const [open, setOpen] = useState(false)

  const closeMenu = () => setOpen(false)

  return (
    <header className="site-header">
      <div className="nav-inner">
        <a className="brand" href="#top" onClick={closeMenu}>
          <span className="brand-mark" aria-hidden="true">
            V
          </span>
          <span className="brand-name">VisionAble</span>
        </a>

        <button
          className="menu-toggle"
          type="button"
          aria-expanded={open}
          aria-controls="primary-nav"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
          <span aria-hidden="true">{open ? '✕' : '☰'}</span>
        </button>

        <nav
          id="primary-nav"
          className={open ? 'primary-nav is-open' : 'primary-nav'}
          aria-label="Primary"
        >
          <a href="#about" onClick={closeMenu}>
            About
          </a>
          <a href="#features" onClick={closeMenu}>
            Features
          </a>
          <a className="btn btn-primary nav-cta" href="#get-started" onClick={closeMenu}>
            Get Started
          </a>
        </nav>
      </div>
    </header>
  )
}

export default Navbar
