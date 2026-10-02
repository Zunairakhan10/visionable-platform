function formatEventTime(timestamp) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return 'Time unavailable'
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }).format(date)
}

function EventTimeline({ events }) {
  const recentEvents = [...events].sort((first, second) => new Date(second.timestamp) - new Date(first.timestamp)).slice(0, 6)

  if (recentEvents.length === 0) {
    return <div className="events-empty"><span className="events-empty-icon" aria-hidden="true">⌁</span><strong>No monitoring events yet</strong><p>Events recorded during the candidate exam will appear here.</p></div>
  }

  return (
    <ol className="event-timeline">
      {recentEvents.map((event) => (
        <li className={`timeline-event severity-${event.severity}`} key={event.id}>
          <span className="timeline-marker" aria-hidden="true"><i /></span>
          <div className="timeline-content">
            <div className="timeline-event-top"><strong>{event.type}</strong><time dateTime={event.timestamp}>{formatEventTime(event.timestamp)}</time></div>
            <div className="timeline-event-meta"><span>{event.candidateId}</span><span className={`event-review-status status-${event.status}`}>{event.status === 'needs_review' ? 'Needs review' : 'Logged'}</span></div>
          </div>
        </li>
      ))}
    </ol>
  )
}

export default EventTimeline