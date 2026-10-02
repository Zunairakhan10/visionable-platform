import { useState } from 'react'

function CandidateTable({ candidates }) {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()
  const filteredCandidates = normalizedQuery
    ? candidates.filter((candidate) => `${candidate.id} ${candidate.exam}`.toLowerCase().includes(normalizedQuery))
    : candidates

  return (
    <>
      <div className="candidate-table-toolbar">
        <label className="candidate-search">
          <span aria-hidden="true">⌕</span>
          <span className="sr-only">Search candidates</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search candidates" />
        </label>
        <span className="table-filter-label"><span className="filter-dot" />All sessions</span>
      </div>
      <div className="candidate-table-wrap">
        <table className="candidate-table">
          <thead><tr><th scope="col">Candidate</th><th scope="col">Examination</th><th scope="col">Progress</th><th scope="col">Session</th><th scope="col">Latest activity</th></tr></thead>
          <tbody>
            {filteredCandidates.map((candidate, index) => (
              <tr key={candidate.id}>
                <td><div className="candidate-identity"><span className={`candidate-avatar avatar-${index % 4}`} aria-hidden="true">{candidate.id.slice(-2)}</span><span><strong>Candidate {candidate.id.slice(-4)}</strong><small>{candidate.id}</small></span></div></td>
                <td><span className="candidate-exam">{candidate.exam}</span></td>
                <td><div className="candidate-progress"><span className="progress-value">{candidate.progress}%</span><span className="candidate-progress-track"><i style={{ width: `${candidate.progress}%` }} /></span></div></td>
                <td><span className="candidate-status"><i />In progress</span></td>
                <td><span className="candidate-activity">Session active</span></td>
              </tr>
            ))}
            {filteredCandidates.length === 0 && <tr><td className="candidate-empty" colSpan="5">No candidates match “{query}”.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default CandidateTable