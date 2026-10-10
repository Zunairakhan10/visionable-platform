import { useState } from 'react'
import { reviewMonitoringEvent } from '../../services/monitoringEventStore'

function formatEventTime(timestamp) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return 'Time unavailable'
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }).format(date)
}

function getReviewStatusLabel(event) {
  if (event.status === 'needs_review') return 'Needs human review'
  if (event.status === 'reviewed') return 'Reviewed · no issue'
  if (event.status === 'escalated') return 'Escalated for review'
  return 'Logged'
}

function EventTimeline({ events }) {
  const [selectedEventId, setSelectedEventId] = useState(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const recentEvents = [...events].sort((first, second) => new Date(second.timestamp) - new Date(first.timestamp)).slice(0, 6)
  const selectedEvent = recentEvents.find((event) => event.id === selectedEventId)

  if (recentEvents.length === 0) {
    return <div className="events-empty"><span className="events-empty-icon" aria-hidden="true">⌁</span><strong>No monitoring events yet</strong><p>Events recorded during the candidate exam will appear here.</p></div>
  }

  const selectEvent = (event) => {
    setSelectedEventId(event.id)
    setNote(event.review?.note ?? '')
    setError('')
  }

  const saveReview = async (action) => {
    setSaving(true)
    try {
      await reviewMonitoringEvent(selectedEvent.id, action, note)
      setError('')
    } catch {
      setError('The review could not be saved. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <ol className="event-timeline">
        {recentEvents.map((event) => (
          <li className={`timeline-event severity-${event.severity}`} key={event.id}>
            <span className="timeline-marker" aria-hidden="true"><i /></span>
            <button
              className="timeline-select"
              type="button"
              aria-pressed={selectedEventId === event.id}
              onClick={() => selectEvent(event)}
            >
              <span className="timeline-content">
                <span className="timeline-event-top"><strong>{event.type}</strong><time dateTime={event.timestamp}>{formatEventTime(event.timestamp)}</time></span>
                <span className="timeline-event-meta">
                  <span>Candidate: {event.candidateId}</span>
                  <span className={`event-review-status status-${event.status}`}>{getReviewStatusLabel(event)}</span>
                </span>
                {event.syncStatus !== 'synced' ? (
                  <span className={`event-sync-status${event.syncStatus === 'failed' || !event.syncStatus ? ' is-unsynced' : ''}`} role={event.syncStatus === 'failed' ? 'alert' : 'status'}>
                    {event.syncStatus === 'pending'
                      ? 'Saving to server…'
                      : event.syncStatus === 'failed'
                        ? 'Not saved to server'
                        : 'Local demo only'}
                  </span>
                ) : <span className="event-sync-status">Saved to demo server</span>}
              </span>
            </button>
          </li>
        ))}
      </ol>
      {selectedEvent && (
        <section className="event-review-form" aria-labelledby="event-review-heading">
          <div className="event-review-heading">
            <div><span className="panel-kicker">HUMAN-IN-THE-LOOP REVIEW</span><h3 id="event-review-heading">Review {selectedEvent.type}</h3></div>
            <span className={`event-review-status status-${selectedEvent.status}`}>{getReviewStatusLabel(selectedEvent)}</span>
          </div>
          <label className="event-review-note">
            <span>Examiner note <span>(optional)</span></span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows="3" placeholder="Add context for the human review record" />
          </label>
          <div className="event-review-actions">
            <button type="button" className="review-action-button" onClick={() => saveReview('no_issue')} disabled={saving}>Mark reviewed / no issue</button>
            <button type="button" className="review-action-button is-escalate" onClick={() => saveReview('escalated')} disabled={saving}>Escalate</button>
          </div>
          {error && <p className="event-review-error" role="alert">{error}</p>}
          {selectedEvent.review && !error && <p className="event-review-confirmation" role="status">Review saved for human follow-up.</p>}
        </section>
      )}
    </>
  )
}

export default EventTimeline