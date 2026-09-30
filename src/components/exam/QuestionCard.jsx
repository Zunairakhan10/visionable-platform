function QuestionCard({ question, questionIndex, selectedAnswer, isMarked, speechSupported, isSpeaking, onReadQuestion, onStopReading, onAnswer, onToggleReview }) {
  return (
    <article className="question-card" aria-labelledby={`question-${question.id}`}>
      <div className="question-meta">
        <span>{question.subject}</span>
        <span>Single correct answer</span>
      </div>
      <h2 id={`question-${question.id}`}>
        <span className="question-number">Q{String(questionIndex + 1).padStart(2, '0')}</span>
        {question.question}
      </h2>
      <button className="read-question" type="button" onClick={isSpeaking ? onStopReading : onReadQuestion} disabled={!speechSupported} title={!speechSupported ? 'Text-to-speech is unavailable in this browser' : undefined}>
        <span aria-hidden="true">{isSpeaking ? '■' : '◉'}</span> {isSpeaking ? 'Stop reading' : 'Read question aloud'}
      </button>
      {!speechSupported && <p className="speech-note">Text-to-speech is not available in this browser.</p>}
      <fieldset className="options-list">
        <legend className="sr-only">Choose one answer</legend>
        {question.options.map((option, index) => {
          const letter = String.fromCharCode(65 + index)
          return (
            <label className={`option-row ${selectedAnswer === index ? 'is-selected' : ''}`} key={option}>
              <input type="radio" name={`question-${question.id}`} checked={selectedAnswer === index} onChange={() => onAnswer(index)} />
              <span className="option-letter" aria-hidden="true">{letter}</span>
              <span>{option}</span>
              {selectedAnswer === index && <span className="option-check" aria-label="Selected">✓</span>}
            </label>
          )
        })}
      </fieldset>
      <div className="question-actions">
        <button className={`review-button ${isMarked ? 'is-marked' : ''}`} type="button" onClick={onToggleReview}>
          <span aria-hidden="true">◇</span> {isMarked ? 'Unmark for review' : 'Mark for review'}
        </button>
        <span className="question-hint">Your answer is saved locally as you work.</span>
      </div>
    </article>
  )
}

export default QuestionCard
