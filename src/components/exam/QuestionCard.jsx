import { useState } from 'react'

function QuestionCard({ question, questionIndex, selectedAnswer, isMarked, onAnswer, onToggleReview }) {
  const [isReading, setIsReading] = useState(false)

  const readQuestion = () => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const text = `Question ${questionIndex + 1}. ${question.question}. Options: ${question.options.map((option, index) => `${String.fromCharCode(65 + index)}, ${option}`).join('. ')}`
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.9
    utterance.onstart = () => setIsReading(true)
    utterance.onend = () => setIsReading(false)
    utterance.onerror = () => setIsReading(false)
    window.speechSynthesis.speak(utterance)
  }

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
      <button className="read-question" type="button" onClick={readQuestion} disabled={isReading}>
        <span aria-hidden="true">◉</span> {isReading ? 'Reading question…' : 'Read question aloud'}
      </button>
      {!('speechSynthesis' in window) && <p className="speech-note">Text-to-speech is not available in this browser.</p>}
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
