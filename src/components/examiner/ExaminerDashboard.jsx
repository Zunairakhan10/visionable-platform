import { useEffect, useState } from 'react'
import { getMonitoringEvents, subscribeToMonitoringEvents } from '../../services/monitoringEventStore'
import CandidateTable from './CandidateTable'
import EventTimeline from './EventTimeline'
import './ExaminerDashboard.css'

const demoCandidates = [
  { id: 'VA-1048', exam: 'General Aptitude & Awareness', progress: 72 },
  { id: 'VA-1052', exam: 'General Aptitude & Awareness', progress: 46 },
  { id: 'VA-1061', exam: 'General Aptitude & Awareness', progress: 88 },
  { id: 'VA-1064', exam: 'General Aptitude & Awareness', progress: 31 },
]

function ExaminerDashboard({ onExit }) {
  const [events, setEvents] = useState(() => getMonitoringEvents())

  useEffect(() => {
    return subscribeToMonitoringEvents(setEvents)
  }, [])

  const needsReview = events.filter((event) => event.status === 'needs_review').length
  const candidateCount = demoCandidates.length

  return (
    <div className="examiner-dashboard">
      <aside className="examiner-sidebar" aria-label="Examiner navigation">
        <button className="examiner-brand" type="button" onClick={onExit} aria-label="Return to VisionAble home">
          <span className="brand-mark" aria-hidden="true">V</span>
          <span>VISION<span>ABLE</span></span>
        </button>

        <div className="examiner-sidebar-label">WORKSPACE</div>
        <nav className="examiner-nav" aria-label="Dashboard">
          <a className="examiner-nav-link is-current" href="#dashboard-main" aria-current="page"><span aria-hidden="true">◫</span>Dashboard</a>
          <a className="examiner-nav-link" href="#candidates"><span aria-hidden="true">◉</span>Candidates</a>
          <a className="examiner-nav-link" href="#monitoring-events"><span aria-hidden="true">⌁</span>Monitoring events</a>
        </nav>

        <div className="examiner-sidebar-bottom">
          <div className="examiner-review-note"><span className="review-note-icon" aria-hidden="true">◎</span><p>Monitoring supports review. People make decisions.</p></div>
          <button className="examiner-profile" type="button" onClick={onExit}>
            <span className="profile-avatar" aria-hidden="true">EX</span>
            <span><strong>Examiner</strong><small>Return to VisionAble</small></span>
            <span className="profile-arrow" aria-hidden="true">↗</span>
          </button>
        </div>
      </aside>

      <main className="examiner-main" id="dashboard-main">
        <header className="examiner-topbar">
          <div className="examiner-breadcrumb"><span>Workspace</span><span aria-hidden="true">/</span><strong>Dashboard</strong></div>
          <div className="secure-session"><span className="secure-session-dot" aria-hidden="true" /><span>Secure session</span><strong>ACTIVE</strong></div>
        </header>

        <div className="examiner-content">
          <section className="examiner-heading" aria-labelledby="examiner-heading">
            <div>
              <div className="examiner-eyebrow"><span>AI</span><i /> <span>ACCESSIBILITY</span><i /> <span>SECURITY</span></div>
              <h1 id="examiner-heading">Examiner Dashboard</h1>
              <p>Monitor active sessions and review recorded events.</p>
            </div>
            <div className="demo-data-label"><span aria-hidden="true">●</span>Local prototype data</div>
          </section>

          <section className="examiner-stats" aria-label="Candidate statistics">
            <article className="examiner-stat">
              <div className="stat-heading"><span>Candidates</span><span className="stat-icon" aria-hidden="true">◉</span></div>
              <div className="stat-value">{String(candidateCount).padStart(2, '0')}</div>
              <div className="stat-foot">Illustrative roster</div>
            </article>
            <article className="examiner-stat review-stat">
              <div className="stat-heading"><span>Needs Review</span><span className="stat-icon" aria-hidden="true">◎</span></div>
              <div className="stat-value">{String(needsReview).padStart(2, '0')}</div>
              <div className="stat-foot">Recorded events awaiting human review</div>
            </article>
            <article className="examiner-stat active-stat">
              <div className="stat-heading"><span>Active candidates</span><span className="stat-icon" aria-hidden="true">⌁</span></div>
              <div className="stat-value">{String(candidateCount).padStart(2, '0')}</div>
              <div className="stat-foot"><span className="active-pulse" />Sessions in progress</div>
            </article>
          </section>

          <div className="examiner-panels">
            <section className="examiner-panel candidates-panel" id="candidates" aria-labelledby="candidates-heading">
              <div className="panel-heading">
                <div><span className="panel-kicker">LIVE OVERVIEW</span><h2 id="candidates-heading">Active candidates</h2></div>
                <span className="panel-count">{String(candidateCount).padStart(2, '0')} <span>candidates</span></span>
              </div>
              <CandidateTable candidates={demoCandidates} />
              <p className="candidate-data-note">Illustrative roster. Candidate sessions are not connected to a backend.</p>
            </section>

            <section className="examiner-panel events-panel" id="monitoring-events" aria-labelledby="events-heading">
              <div className="panel-heading">
                <div><span className="panel-kicker">SESSION ACTIVITY</span><h2 id="events-heading">Recent monitoring events</h2></div>
                <span className="event-live"><span className="active-pulse" />LOCAL</span>
              </div>
              <EventTimeline events={events} />
            </section>
          </div>

          <footer className="human-review-footer">
            <span className="human-review-icon" aria-hidden="true">✳</span>
            <p><strong>Human review is essential.</strong> Monitoring events provide context only. No automated conclusion is made about a candidate.</p>
            <span className="review-footer-tag">PEOPLE FIRST</span>
          </footer>
        </div>
      </main>
    </div>
  )
}

export default ExaminerDashboard