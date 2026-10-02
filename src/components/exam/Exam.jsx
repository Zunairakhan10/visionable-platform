import { useCallback, useMemo, useState } from 'react'
import { examDurationMinutes, questions } from '../../data/questions'
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis'
import { useVoiceCommands } from '../../hooks/useVoiceCommands'
import AccessibilityToolbar from './AccessibilityToolbar'
import ExamTimer from './ExamTimer'
import QuestionCard from './QuestionCard'
import QuestionNavigator from './QuestionNavigator'
//simmy added
import { useExamMonitoring } from '../../hooks/useExamMonitoring'

function Exam({ onExit }) {
  //simmy added
  const handleMonitoringEvent = useCallback((event) => {
  console.log('Monitoring event:', event)
}, [])

useExamMonitoring(handleMonitoringEvent)

  const [examState, setExamState] = useState('instructions')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [markedQuestions, setMarkedQuestions] = useState(new Set())
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [largeText, setLargeText] = useState(false)
  const [highContrast, setHighContrast] = useState(false)
  const [feedback, setFeedback] = useState({ message: '', tone: 'info' })
  const { supported: speechSupported, isSpeaking, speak, stop: stopReading } = useSpeechSynthesis()

  const answeredCount = Object.keys(answers).length
  const currentQuestion = questions[currentIndex]
  const isSubmitted = examState === 'submitted'

  const showFeedback = useCallback((message, tone = 'info') => {
    setFeedback({ message, tone })
  }, [])

  const readCurrentQuestion = useCallback(() => {
    const optionText = currentQuestion.options.map((option, index) => `${String.fromCharCode(65 + index)}, ${option}`).join('. ')
    const didSpeak = speak(`Question ${currentIndex + 1}. ${currentQuestion.question}. Options: ${optionText}`)
    if (didSpeak) showFeedback('Reading the current question and available options aloud.', 'info')
    else showFeedback('Text-to-speech is not supported in this browser.', 'error')
  }, [currentIndex, currentQuestion, showFeedback, speak])

  const selectAnswer = useCallback((answerIndex) => {
    setAnswers((current) => ({ ...current, [currentIndex]: answerIndex }))
  }, [currentIndex])

  const toggleReview = useCallback(() => {
    setMarkedQuestions((current) => {
      const next = new Set(current)
      if (next.has(currentIndex)) next.delete(currentIndex)
      else next.add(currentIndex)
      return next
    })
  }, [currentIndex])

  const goNext = useCallback(() => setCurrentIndex((current) => Math.min(questions.length - 1, current + 1)), [])
  const goPrevious = useCallback(() => setCurrentIndex((current) => Math.max(0, current - 1)), [])

  const submitExam = useCallback(() => {
    setShowSubmitDialog(false)
    setExamState('submitted')
    stopReading()
  }, [stopReading])

  const handleTimeUp = useCallback(() => {
    setExamState('submitted')
    stopReading()
  }, [stopReading])

  const clearAnswer = () => {
    setAnswers((current) => {
      const next = { ...current }
      delete next[currentIndex]
      return next
    })
    showFeedback('Response cleared.', 'info')
  }

  const handleVoiceCommand = useCallback((transcript) => {
    const command = transcript.toLowerCase().replace(/[?.!,]/g, '').trim()
    const recognized = (label, action) => {
      action()
      showFeedback(`Voice command recognized: ${label}`, 'success')
    }

    if (command.includes('next')) return recognized('Next question', goNext)
    if (command.includes('previous') || command.includes('back')) return recognized('Previous question', goPrevious)
    if (command.includes('repeat') || command.includes('read question')) return recognized('Read question', readCurrentQuestion)
    if (command.includes('mark') && command.includes('review')) return recognized(markedQuestions.has(currentIndex) ? 'Unmark for review' : 'Mark for review', toggleReview)
    if (command.includes('submit')) return recognized('Submit exam', () => setShowSubmitDialog(true))

    const optionMatch = command.match(/(?:select|choose)?\s*(?:option\s*)?([abcd])\b/)
    if (optionMatch) {
      const optionIndex = optionMatch[1].charCodeAt(0) - 97
      return recognized(`Select option ${optionMatch[1].toUpperCase()}`, () => selectAnswer(optionIndex))
    }

    showFeedback('Sorry, command not recognized. Try: “Next question”.', 'error')
  }, [currentIndex, goNext, goPrevious, markedQuestions, readCurrentQuestion, selectAnswer, showFeedback, toggleReview])

  const { supported: voiceSupported, status: voiceStatus, startListening, stopListening } = useVoiceCommands({ onCommand: handleVoiceCommand, onFeedback: showFeedback })

  const examProgress = useMemo(() => Math.round(((currentIndex + 1) / questions.length) * 100), [currentIndex])
  const examClassName = `exam-app active-exam ${largeText ? 'large-text' : ''} ${highContrast ? 'high-contrast' : ''}`

  if (isSubmitted) {
    return (
      <main className="exam-app submission-screen" id="main">
        <div className="submission-card">
          <div className="submission-icon">✓</div><span className="exam-kicker">Submission received</span><h1>Your exam has been submitted.</h1>
          <p>Your responses have been recorded locally for this prototype. In a connected version, the examination authority would securely process the submission.</p>
          <div className="submission-summary"><span><b>{answeredCount}</b> answered</span><span><b>{questions.length - answeredCount}</b> unanswered</span><span><b>{markedQuestions.size}</b> marked for review</span></div>
          <button className="exam-primary-button" type="button" onClick={onExit}>Return to VisionAble</button>
        </div>
      </main>
    )
  }

  if (examState === 'instructions') {
    return (
      <main className={`exam-app instructions-screen ${highContrast ? 'high-contrast' : ''}`} id="main">
        <div className="exam-header compact-header"><button className="exam-brand" type="button" onClick={onExit}><span className="brand-mark">V</span><span>VISION<span>ABLE</span></span></button><span className="prototype-badge">Candidate prototype</span></div>
        <section className="instructions-card" aria-labelledby="instructions-heading">
          <div className="instructions-intro"><span className="exam-kicker">Candidate examination portal</span><h1 id="instructions-heading">General Aptitude &amp; Awareness Test</h1><p>Read the instructions carefully before beginning. This sample demonstrates the VisionAble accessible CBT experience.</p></div>
          <div className="instructions-details"><div><span>08</span><small>Questions</small></div><div><span>30 min</span><small>Duration</small></div><div><span>01</span><small>Correct answer</small></div></div>
          <div className="instruction-columns"><div><h2>Before you begin</h2><ul><li>Use the question palette to move directly between questions.</li><li>Your answer is saved locally when you select an option.</li><li>Use “Mark for review” when you want to revisit a question.</li></ul></div><div><h2>Accessibility foundation</h2><ul><li>All controls are keyboard accessible with visible focus states.</li><li>Use “Read question aloud” where browser speech synthesis is supported.</li><li>Approved accommodations will ultimately be configured by the examination authority.</li></ul></div></div>
          <div className="instructions-footer"><span>By continuing, you are entering a frontend-only prototype.</span><button className="exam-primary-button" type="button" onClick={() => setExamState('active')}>Begin examination <span aria-hidden="true">→</span></button></div>
        </section>
      </main>
    )
  }

  return (
    <main className={examClassName} id="main">
      <header className="exam-header"><button className="exam-brand" type="button" onClick={onExit} aria-label="Return to VisionAble home"><span className="brand-mark">V</span><span>VISION<span>ABLE</span></span></button><div className="exam-title"><span>GENERAL APTITUDE &amp; AWARENESS</span><small>Candidate examination portal</small></div><ExamTimer durationMinutes={examDurationMinutes} isRunning={examState === 'active'} onTimeUp={handleTimeUp} /></header>
      <div className="exam-layout">
        <section className="question-area" aria-label="Current examination question">
          <div className="exam-breadcrumb"><span>EXAM / SECTION 01</span><span>{examProgress}% complete</span></div><div className="exam-progress-bar"><span style={{ width: `${examProgress}%` }} /></div>
          <AccessibilityToolbar speechSupported={speechSupported} isSpeaking={isSpeaking} onReadQuestion={readCurrentQuestion} onStopReading={stopReading} voiceSupported={voiceSupported} voiceStatus={voiceStatus} onStartVoice={startListening} onStopVoice={stopListening} largeText={largeText} highContrast={highContrast} onToggleLargeText={() => setLargeText((value) => !value)} onToggleHighContrast={() => setHighContrast((value) => !value)} feedback={feedback} />
          <QuestionCard question={currentQuestion} questionIndex={currentIndex} selectedAnswer={answers[currentIndex]} isMarked={markedQuestions.has(currentIndex)} speechSupported={speechSupported} isSpeaking={isSpeaking} onReadQuestion={readCurrentQuestion} onStopReading={stopReading} onAnswer={selectAnswer} onToggleReview={toggleReview} />
          <div className="question-navigation"><button className="exam-secondary-button" type="button" onClick={goPrevious} disabled={currentIndex === 0}>← Previous</button><button className="clear-button" type="button" onClick={clearAnswer} disabled={answers[currentIndex] === undefined}>Clear response</button>{currentIndex === questions.length - 1 ? <button className="exam-primary-button" type="button" onClick={() => setShowSubmitDialog(true)}>Submit exam <span aria-hidden="true">→</span></button> : <button className="exam-primary-button" type="button" onClick={goNext}>Next question <span aria-hidden="true">→</span></button>}</div>
        </section>
        <QuestionNavigator questions={questions} answers={answers} markedQuestions={markedQuestions} currentIndex={currentIndex} onNavigate={setCurrentIndex} />
      </div>
      {showSubmitDialog && <div className="dialog-backdrop" role="presentation"><section className="submit-dialog" role="dialog" aria-modal="true" aria-labelledby="submit-heading"><span className="exam-kicker">Final check</span><h2 id="submit-heading">Submit your examination?</h2><p>You have answered {answeredCount} of {questions.length} questions. You can still return to review your responses.</p><div className="dialog-actions"><button className="exam-secondary-button" type="button" onClick={() => setShowSubmitDialog(false)}>Continue exam</button><button className="exam-primary-button" type="button" onClick={submitExam}>Submit exam</button></div></section></div>}
    </main>
  )
}

export default Exam
