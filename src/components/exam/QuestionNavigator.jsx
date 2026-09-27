function getStatus(questionIndex, answers, markedQuestions, currentIndex) {
  const answered = answers[questionIndex] !== undefined
  const marked = markedQuestions.has(questionIndex)
  if (questionIndex === currentIndex) return 'current'
  if (answered && marked) return 'answered-marked'
  if (marked) return 'marked'
  if (answered) return 'answered'
  return 'unanswered'
}

function QuestionNavigator({ questions, answers, markedQuestions, currentIndex, onNavigate }) {
  return (
    <aside className="question-navigator" aria-label="Question navigator">
      <div className="navigator-heading">
        <div><span className="exam-kicker">Question palette</span><h2>Navigate exam</h2></div>
        <span className="palette-count">{Object.keys(answers).length}/{questions.length}</span>
      </div>
      <div className="question-palette">
        {questions.map((question, index) => {
          const status = getStatus(index, answers, markedQuestions, currentIndex)
          return <button key={question.id} className={`palette-button ${status}`} type="button" aria-label={`Question ${index + 1}, ${status.replace('-', ' ')}`} aria-current={status === 'current' ? 'step' : undefined} onClick={() => onNavigate(index)}>{String(index + 1).padStart(2, '0')}</button>
        })}
      </div>
      <div className="status-legend" aria-label="Question status legend">
        <span><i className="legend-dot answered" /> Answered</span>
        <span><i className="legend-dot unanswered" /> Not answered</span>
        <span><i className="legend-dot marked" /> Marked for review</span>
        <span><i className="legend-dot answered-marked" /> Answered + marked</span>
      </div>
      <div className="navigator-note"><span aria-hidden="true">i</span><p>Approved accommodations are set by the examination authority and may vary by candidate.</p></div>
    </aside>
  )
}

export default QuestionNavigator
