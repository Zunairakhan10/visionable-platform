import { useCallback, useLayoutEffect, useMemo, useState } from 'react'
import { examDurationMinutes, questions } from '../../data/questions'
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis'
import AccessibilityToolbar from './AccessibilityToolbar'
import ExamTimer from './ExamTimer'
import QuestionCard from './QuestionCard'
import QuestionNavigator from './QuestionNavigator'
import { useExamMonitoring } from '../../hooks/useExamMonitoring'
import { useCameraMonitoring } from '../../hooks/useCameraMonitoring'
import { useAudioMonitoring } from '../../hooks/useAudioMonitoring'
import { parseExamVoiceCommand } from '../../services/examVoiceCommands'

function Exam({ onExit, onLogout, voiceControl, registerVoiceCommandHandler }) {
  useExamMonitoring()

  const [examState, setExamState] = useState('instructions')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [markedQuestions, setMarkedQuestions] = useState(new Set())
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [largeText, setLargeText] = useState(false)
  const [highContrast, setHighContrast] = useState(false)
  const [feedback, setFeedback] = useState({ message: '', tone: 'info' })
  const [recognizedCommand, setRecognizedCommand] = useState('')
  const [recognizedAction, setRecognizedAction] = useState('')
  const [pendingCommands, setPendingCommands] = useState([])
  const { supported: speechSupported, isSpeaking, isPaused, speak, pause: pauseReading, resume: resumeReading, stop: stopReading } = useSpeechSynthesis()

  const answeredCount = Object.keys(answers).length
  const currentQuestion = questions[currentIndex]
  const isSubmitted = examState === 'submitted'

  const showFeedback = useCallback((message, tone = 'info') => {
    setFeedback({ message, tone })
    if (!message.startsWith('Voice control is listening')
      && !message.startsWith('Recognized:')
      && !message.includes('Reconnecting')) speak(message)
  }, [speak])

  useCameraMonitoring(examState === 'active', showFeedback)
  useAudioMonitoring(examState === 'active', showFeedback)

  const readCurrentQuestion = useCallback(() => {
    const optionText = currentQuestion.options.map((option, index) => `${String.fromCharCode(65 + index)}, ${option}`).join('. ')
    const didSpeak = speak(`Question ${currentIndex + 1}. ${currentQuestion.question}. Options: ${optionText}`)
    if (didSpeak) setFeedback({ message: 'Reading the current question and available options aloud.', tone: 'info' })
    else showFeedback('Text-to-speech is not supported in this browser.', 'error')
  }, [currentIndex, currentQuestion, setFeedback, showFeedback, speak])

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
    speak('Your examination has been submitted.')
  }, [speak, stopReading])

  const openSubmitConfirmation = useCallback(() => {
    setShowSubmitDialog(true)
    speak(`Submission confirmation. You have answered ${answeredCount} of ${questions.length} questions. Choose Continue exam to return or Submit exam to confirm.`)
  }, [answeredCount, speak])

  const handleTimeUp = useCallback(() => {
    setExamState('submitted')
    stopReading()
    speak('The examination time has ended. Your examination has been submitted.')
  }, [speak, stopReading])

  const clearAnswer = () => {
    setAnswers((current) => {
      const next = { ...current }
      delete next[currentIndex]
      return next
    })
    showFeedback('Response cleared.', 'info')
  }

  const performVoiceCommand = useCallback((command) => {
    setPendingCommands([])
    setRecognizedAction(command.label)
    switch (command.key) {
      case 'next':
        goNext()
        break
      case 'previous':
        goPrevious()
        break
      case 'read':
        readCurrentQuestion()
        break
      case 'read-options': {
        const optionText = currentQuestion.options
          .map((option, index) => `${String.fromCharCode(65 + index)}, ${option}`)
          .join('. ')
        speak(`Available options for question ${currentIndex + 1}. ${optionText}`)
        break
      }
      case 'read-answer': {
        const selectedAnswer = answers[currentIndex]
        if (selectedAnswer === undefined) {
          speak('No answer is selected for this question.')
        } else {
          speak(`Your selected answer is option ${String.fromCharCode(65 + selectedAnswer)}. ${currentQuestion.options[selectedAnswer]}`)
        }
        break
      }
      case 'review-unanswered': {
        const unansweredIndex = questions.findIndex((_, index) => answers[index] === undefined)
        if (unansweredIndex === -1) {
          speak('There are no unanswered questions.')
          break
        }
        setCurrentIndex(unansweredIndex)
        speak(`Question ${unansweredIndex + 1} is unanswered. Opening it now.`)
        break
      }
      case 'mark':
      case 'unmark':
        setMarkedQuestions((current) => {
          const next = new Set(current)
          if (command.key === 'mark') next.add(currentIndex)
          else next.delete(currentIndex)
          return next
        })
        showFeedback(`Voice command action: ${command.label}.`, 'success')
        break
      case 'submit':
        openSubmitConfirmation()
        setFeedback({ message: 'Submission confirmation opened. The examination has not been submitted.', tone: 'info' })
        break
      case 'stop-voice':
        voiceControl.stopListening()
        break
      default: {
        const optionIndex = command.key.charCodeAt(command.key.length - 1) - 97
        if (optionIndex >= currentQuestion.options.length) {
          showFeedback(`Option ${String.fromCharCode(65 + optionIndex)} is not available for this question.`, 'error')
          return
        }
        selectAnswer(optionIndex)
        showFeedback(`Voice command action: ${command.label}.`, 'success')
      }
    }
    if (['read', 'read-options', 'read-answer', 'review-unanswered', 'submit'].includes(command.key)) {
      setFeedback({
        message: command.key === 'submit'
          ? 'Submission confirmation opened. The examination has not been submitted.'
          : `Voice command action: ${command.label}.`,
        tone: 'info',
      })
    }
  }, [answers, currentIndex, currentQuestion, goNext, goPrevious, openSubmitConfirmation, readCurrentQuestion, selectAnswer, setFeedback, showFeedback, speak, voiceControl])

  const handleVoiceCommand = useCallback((transcript, alternatives = []) => {
    setRecognizedCommand(transcript)
    setPendingCommands([])
    const candidates = alternatives
      .map((alternative) => ({
        command: parseExamVoiceCommand(alternative.transcript),
        confidence: alternative.confidence,
      }))
      .filter(({ command }) => command)
    const distinctCommands = [...new Map(candidates.map(({ command }) => [command.key, command])).values()]
    const confidence = alternatives[0]?.confidence
    const primaryCommand = parseExamVoiceCommand(transcript)
    const uncertain = distinctCommands.length > 1
      || (distinctCommands.length === 1 && (primaryCommand?.key !== distinctCommands[0].key
        || (typeof confidence === 'number' && confidence < 0.6)))

    if (uncertain && distinctCommands.length) {
      setPendingCommands(distinctCommands)
      setRecognizedAction(`Possible action: ${distinctCommands.map((command) => command.label).join(' or ')}`)
      showFeedback('The recognized speech may match more than one command. Please confirm the intended action.', 'info')
      return
    }

    const command = primaryCommand
    if (!command) {
      setRecognizedAction('No action matched')
      showFeedback('No action was taken. Use a short command such as “Next question” or use the keyboard controls.', 'error')
      return
    }
    setRecognizedAction(`Action: ${command.label}`)
    performVoiceCommand(command)
  }, [performVoiceCommand, showFeedback])

  useLayoutEffect(() => registerVoiceCommandHandler('exam', handleVoiceCommand), [handleVoiceCommand, registerVoiceCommandHandler])
  const readInstructions = () => {
    speak('Examination instructions. There are eight questions and thirty minutes. Use the question palette or previous and next controls to navigate. Answers are saved locally when selected. Use Mark for review to revisit a question. Camera presence monitoring is optional; declining camera access will not prevent you from continuing. All controls are keyboard accessible. Activate Begin examination when you are ready.')
  }

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
          <button className="auth-logout-button" type="button" onClick={onLogout}>Sign out</button>
        </div>
      </main>
    )
  }

  if (examState === 'instructions') {
    return (
      <main className={`exam-app instructions-screen ${highContrast ? 'high-contrast' : ''}`} id="main">
        <div className="exam-header compact-header"><button className="exam-brand" type="button" onClick={onExit}><span className="brand-mark">V</span><span>VISION<span>ABLE</span></span></button><div className="exam-auth-actions"><span className="prototype-badge">Candidate prototype</span><button className="auth-logout-button" type="button" onClick={onLogout}>Sign out</button></div></div>
        <section className="instructions-card" aria-labelledby="instructions-heading">
          <div className="instructions-intro"><span className="exam-kicker">Candidate examination portal</span><h1 id="instructions-heading">General Aptitude &amp; Awareness Test</h1><p>Read the instructions carefully before beginning. This sample demonstrates the VisionAble accessible CBT experience.</p></div>
          <div className="instructions-details"><div><span>08</span><small>Questions</small></div><div><span>30 min</span><small>Duration</small></div><div><span>01</span><small>Correct answer</small></div></div>
          <div className="instruction-columns"><div><h2>Before you begin</h2><ul><li>Use the question palette to move directly between questions.</li><li>Your answer is saved locally when you select an option.</li><li>Use “Mark for review” when you want to revisit a question.</li><li>Camera access is requested during the exam for on-device presence signals. Declining it will not prevent you from continuing.</li></ul></div><div><h2>Accessibility foundation</h2><ul><li>All controls are keyboard accessible with visible focus states.</li><li>Use “Read question aloud” where browser speech synthesis is supported.</li><li>Approved accommodations will ultimately be configured by the examination authority.</li></ul></div></div>
          <div className="instructions-footer">
            <span>By continuing, you are entering a frontend-only prototype.</span>
            <div className="instructions-actions">
              <button className="exam-secondary-button" type="button" onClick={readInstructions} disabled={!speechSupported}>Read instructions aloud</button>
              <button className="accessibility-control" type="button" onClick={isPaused ? resumeReading : pauseReading} disabled={!speechSupported || !isSpeaking}>{isPaused ? 'Resume guidance' : 'Pause guidance'}</button>
              <button className="accessibility-control" type="button" onClick={stopReading} disabled={!speechSupported || (!isSpeaking && !isPaused)}>Stop guidance</button>
              <button className="exam-primary-button" type="button" onClick={() => { stopReading(); setExamState('active') }}>Begin examination <span aria-hidden="true">→</span></button>
            </div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className={examClassName} id="main">
      <header className="exam-header"><button className="exam-brand" type="button" onClick={onExit} aria-label="Return to VisionAble home"><span className="brand-mark">V</span><span>VISION<span>ABLE</span></span></button><div className="exam-title"><span>GENERAL APTITUDE &amp; AWARENESS</span><small>Candidate examination portal</small></div><div className="exam-auth-actions"><ExamTimer durationMinutes={examDurationMinutes} isRunning={examState === 'active'} onTimeUp={handleTimeUp} /><button className="auth-logout-button" type="button" onClick={onLogout}>Sign out</button></div></header>
      <div className="exam-layout">
        <section className="question-area" aria-label="Current examination question">
          <div className="exam-breadcrumb"><span>EXAM / SECTION 01</span><span>{examProgress}% complete</span></div><div className="exam-progress-bar"><span style={{ width: `${examProgress}%` }} /></div>
          <AccessibilityToolbar speechSupported={speechSupported} isSpeaking={isSpeaking} isPaused={isPaused} onReadQuestion={readCurrentQuestion} onStopReading={stopReading} onPauseReading={pauseReading} onResumeReading={resumeReading} voiceSupported={voiceControl.supported} voiceStatus={voiceControl.status} voiceControlActive={voiceControl.isActive} voiceCommandsPaused={voiceControl.isCommandsPaused} onStartVoice={voiceControl.startListening} onPauseVoice={voiceControl.pauseCommands} onResumeVoice={voiceControl.resumeCommands} onStopMicrophone={voiceControl.stopListening} largeText={largeText} highContrast={highContrast} onToggleLargeText={() => setLargeText((value) => !value)} onToggleHighContrast={() => setHighContrast((value) => !value)} feedback={feedback} recognizedCommand={recognizedCommand} recognizedAction={recognizedAction} pendingCommands={pendingCommands} onConfirmCommand={performVoiceCommand} />
          <QuestionCard question={currentQuestion} questionIndex={currentIndex} selectedAnswer={answers[currentIndex]} isMarked={markedQuestions.has(currentIndex)} speechSupported={speechSupported} isSpeaking={isSpeaking} onReadQuestion={readCurrentQuestion} onStopReading={stopReading} onAnswer={selectAnswer} onToggleReview={toggleReview} />
          <div className="question-navigation"><button className="exam-secondary-button" type="button" onClick={goPrevious} disabled={currentIndex === 0}>← Previous</button><button className="clear-button" type="button" onClick={clearAnswer} disabled={answers[currentIndex] === undefined}>Clear response</button>{currentIndex === questions.length - 1 ? <button className="exam-primary-button" type="button" onClick={openSubmitConfirmation}>Submit exam <span aria-hidden="true">→</span></button> : <button className="exam-primary-button" type="button" onClick={goNext}>Next question <span aria-hidden="true">→</span></button>}</div>
        </section>
        <QuestionNavigator questions={questions} answers={answers} markedQuestions={markedQuestions} currentIndex={currentIndex} onNavigate={setCurrentIndex} />
      </div>
      {showSubmitDialog && <div className="dialog-backdrop" role="presentation"><section className="submit-dialog" role="dialog" aria-modal="true" aria-labelledby="submit-heading"><span className="exam-kicker">Final check</span><h2 id="submit-heading">Submit your examination?</h2><p>You have answered {answeredCount} of {questions.length} questions. You can still return to review your responses.</p><div className="dialog-actions"><button className="exam-secondary-button" type="button" onClick={() => { setShowSubmitDialog(false); speak('Continuing the examination.') }}>Continue exam</button><button className="exam-primary-button" type="button" onClick={submitExam}>Submit exam</button></div></section></div>}
    </main>
  )
}

export default Exam
