import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Features from './components/Features'
import Footer from './components/Footer'
import AuthPage from './components/AuthPage'
import AuthSelectionPage from './components/AuthSelectionPage'
import Exam from './components/exam/Exam'
import ExaminerDashboard from './components/examiner/ExaminerDashboard'
import { getDemoSession, signOutDemoUser } from './services/demoAuth'
import { signOutSupabaseUser } from './services/authClient'
import { clearRemoteMonitoringEvents } from './services/monitoringEventStore'
import { getRoleShortcut, getRoleShortcutDestination, isTypingTarget } from './services/roleKeyboardShortcuts'
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis'
import { useVoiceCommands } from './hooks/useVoiceCommands'
import { parseLoginVoiceCommand } from './services/loginVoiceCommands'
import { parseVoiceControlCommand } from './services/voiceControlCommands'
import { createVoiceCommandRouter } from './services/voiceCommandRouter'
import './App.css'

const steps = [
  ['01', 'Accessibility profile', 'Set the support your examination authority permits.'],
  ['02', 'Device check', 'Confirm audio, keyboard and session readiness.'],
  ['03', 'Accessible exam', 'Move through questions with the controls that work for you.'],
  ['04', 'AI-assisted monitoring', 'Policy events are logged without treating accessibility as suspicious.'],
  ['05', 'Examiner review', 'Human examiners review answers, sessions and flagged events.'],
]

function LandingVoiceControl({ speech, onCandidateLogin, onExaminerLogin, onCandidateSignup, voiceControl, registerVoiceCommandHandler, message }) {
  const [recognizedPhrase, setRecognizedPhrase] = useState('')
  const [recognizedAction, setRecognizedAction] = useState('')
  const { speak } = speech
  const instructions = 'Landing page voice control. Say candidate login, examiner login, create candidate account or sign up, read instructions, go back, or stop voice control. Voice recognition is optional. You can always use the labeled buttons, keyboard, and screen reader.'

  const handleCommand = useCallback((transcript) => {
    setRecognizedPhrase(transcript)
    const command = parseLoginVoiceCommand(transcript)
    if (!command) {
      setRecognizedAction('No navigation action matched.')
      speak('I did not understand that. Try candidate login, examiner login, create candidate account, read instructions, or go back.')
      return
    }
    setRecognizedAction(`Action: ${command.label}`)
    switch (command.key) {
      case 'candidate-login':
        onCandidateLogin()
        speak('Opening candidate login.')
        break
      case 'examiner-login':
        onExaminerLogin()
        speak('Opening examiner login.')
        break
      case 'signup':
        onCandidateSignup()
        speak('Opening candidate account creation.')
        break
      case 'read-instructions':
        speak(instructions)
        break
      case 'start-camera':
      case 'stop-camera':
        speak('Camera controls are available after opening candidate login.')
        break
      case 'go-back':
        speak('You are already on the VisionAble landing page.')
        break
      case 'stop-voice':
        voiceControl.stopListening()
        break
      default:
        break
    }
  }, [instructions, onCandidateLogin, onCandidateSignup, onExaminerLogin, speak, voiceControl])

  useLayoutEffect(() => registerVoiceCommandHandler('landing', handleCommand), [handleCommand, registerVoiceCommandHandler])

  return (
    <section className="landing-voice-control" aria-labelledby="landing-voice-heading">
      <div>
        <h2 id="landing-voice-heading">Voice access</h2>
        <p>Start voice control when ready, then say “Candidate login”, “Examiner login”, or “Create candidate account”. Microphone permission is requested only after you start.</p>
      </div>
      <div className="landing-voice-actions">
        <button type="button" onClick={voiceControl.startListening} disabled={!voiceControl.supported || voiceControl.isActive}>{voiceControl.status === 'unavailable' ? 'Restart Voice Control' : 'Start Voice Control'}</button>
        {voiceControl.isActive && !['pausing', 'paused', 'microphone-paused'].includes(voiceControl.status) && <button type="button" onClick={voiceControl.isCommandsPaused ? voiceControl.resumeCommands : voiceControl.pauseCommands}>{voiceControl.isCommandsPaused ? 'Resume Voice Commands' : 'Pause Voice Commands'}</button>}
        {voiceControl.isActive && <button type="button" onClick={voiceControl.stopListening}>Stop Microphone</button>}
      </div>
      <p className="landing-voice-status" role="status" aria-live="polite">
        {voiceControl.status === 'ready' && 'Ready. Voice control is off.'}
        {voiceControl.status === 'starting' && 'Requesting microphone permission…'}
        {voiceControl.status === 'listening' && 'Listening for navigation commands.'}
        {voiceControl.status === 'processing' && 'Processing command…'}
        {voiceControl.status === 'recovering' && 'Reconnecting to speech recognition…'}
        {voiceControl.status === 'pausing' && 'Pausing before a protected input or dictation uses the microphone…'}
        {voiceControl.status === 'commands-paused' && 'Voice commands paused. The microphone remains on for resume and stop-microphone commands only.'}
        {voiceControl.status === 'paused' && 'Recognition is temporarily suspended and is not listening.'}
        {voiceControl.status === 'microphone-paused' && 'Recognition is suspended and is not using the microphone.'}
        {voiceControl.status === 'stopped' && 'Voice control stopped.'}
        {voiceControl.status === 'unsupported' && 'Speech recognition is not supported in this browser. Use keyboard or screen-reader controls.'}
        {voiceControl.status === 'unavailable' && (message || 'Voice control is unavailable. Use keyboard or screen-reader controls.')}
      </p>
      {voiceControl.supported && <p className="landing-voice-help">Say “Pause voice control” to pause commands while keeping a minimal resume listener active; say “Resume voice control” to continue, or “Stop microphone” to fully stop recognition. Voice control remains active across VisionAble screens but not across reloads or external pages.</p>}
      {recognizedPhrase && <p className="landing-voice-recognized" aria-live="polite">Recognized: “{recognizedPhrase}”. {recognizedAction}</p>}
      {message && status !== 'unavailable' && <p className="landing-voice-help" role="status" aria-live="polite">{message}</p>}
    </section>
  )
}

function AppVoiceControl({ voiceControl, message }) {
  const statusText = {
    ready: 'Voice control is off. Activate Start Voice Control when ready.',
    starting: 'Requesting microphone permission.',
    listening: 'Listening for commands across VisionAble screens.',
    processing: 'Processing a recognized command.',
    recovering: 'Speech recognition ended. Reconnecting with a bounded retry.',
    pausing: 'Stopping speech recognition before a protected input or dictation uses the microphone.',
    'commands-paused': 'Voice commands are paused. The microphone remains on for “Resume voice control” and “Stop microphone” only.',
    paused: 'Voice recognition is temporarily suspended; it is not listening while email dictation or protected input owns the microphone.',
    'microphone-paused': 'Voice recognition is suspended and is not using the microphone.',
    stopped: message || 'Speech recognition stopped. The voice-control microphone is off. Use Start Voice Control to reactivate.',
    unsupported: 'Speech recognition is unsupported. Use the keyboard, screen reader, and visible controls.',
    unavailable: message || 'Voice control is unavailable. Use Restart Voice Control or keyboard controls.',
  }[voiceControl.status]
  const canStart = ['ready', 'stopped', 'unavailable'].includes(voiceControl.status)

  return (
    <aside className="app-voice-dock" aria-label="Persistent voice control">
      <div className="app-voice-dock-copy">
        <strong>Voice Control</strong>
        <p role="status" aria-live="polite" aria-atomic="true">{statusText}</p>
      </div>
      <div className="app-voice-dock-actions">
        {canStart && <button type="button" onClick={voiceControl.startListening} disabled={!voiceControl.supported}>{voiceControl.status === 'unavailable' ? 'Restart Voice Control' : 'Start Voice Control'}</button>}
        {voiceControl.isActive && !['pausing', 'paused', 'microphone-paused'].includes(voiceControl.status) && <button type="button" onClick={voiceControl.isCommandsPaused ? voiceControl.resumeCommands : voiceControl.pauseCommands}>{voiceControl.isCommandsPaused ? 'Resume Voice Commands' : 'Pause Voice Commands'}</button>}
        {voiceControl.isActive && <button type="button" onClick={voiceControl.stopListening}>Stop Microphone</button>}
      </div>
    </aside>
  )
}

function restoreDemoAuth() {
  try {
    return { session: getDemoSession(), error: '' }
  } catch (error) {
    return {
      session: null,
      error: error.message || 'Your demo session could not be restored.',
    }
  }
}

function App() {
  const speech = useSpeechSynthesis()
  const [voiceMessage, setVoiceMessage] = useState('')
  const voiceControlRef = useRef(null)
  const currentViewRef = useRef('landing')
  const [voiceCommandRouter] = useState(() => createVoiceCommandRouter())
  const [initialAuth] = useState(restoreDemoAuth)
  const [view, setView] = useState(() => (
    initialAuth.session?.role === 'examiner'
      ? 'examiner'
      : initialAuth.session?.role === 'candidate'
        ? 'exam'
        : 'landing'
  ))
  const [authIntent, setAuthIntent] = useState('candidate')
  const [authMode, setAuthMode] = useState('login')
  const [authSession, setAuthSession] = useState(initialAuth.session)
  const [authProfile, setAuthProfile] = useState(initialAuth.session)
  const [authError, setAuthError] = useState(initialAuth.error)
  useLayoutEffect(() => {
    currentViewRef.current = view
  }, [view])

  const registerVoiceCommandHandler = useCallback((screen, handler) => {
    return voiceCommandRouter.register(screen, handler)
  }, [voiceCommandRouter])

  const handleVoiceCommand = useCallback((transcript, alternatives) => {
    const controlCommand = parseVoiceControlCommand(transcript)
    if (controlCommand) {
      const control = voiceControlRef.current
      if (controlCommand.key === 'pause') {
        control?.pauseCommands()
        speech.speak('Voice commands paused. The microphone is still listening only for “Resume voice control” or “Stop microphone”.')
      } else if (controlCommand.key === 'resume') {
        control?.resumeCommands()
        speech.speak('Voice commands resumed.')
      } else {
        control?.stopListening()
        setVoiceMessage('Microphone stopped. Voice recognition is off. Use the Start or Restart Voice Control button to activate it again.')
        speech.speak('Microphone stopped. Voice recognition is off. Use the labeled Start Voice Control button to reactivate.')
      }
      return
    }
    if (parseLoginVoiceCommand(transcript)?.key === 'stop-voice') {
      const control = voiceControlRef.current
      control?.pauseCommands()
      speech.speak('Voice commands paused. The microphone is still listening only for “Resume voice control” or “Stop microphone”.')
      return
    }
    if (!voiceCommandRouter.dispatch(currentViewRef.current, transcript, alternatives)) {
      setVoiceMessage('Voice control is active, but this screen is still loading its command actions. Please repeat the command.')
    }
  }, [speech, voiceCommandRouter])

  const handleVoiceFeedback = useCallback((message, tone) => {
    setVoiceMessage(message)
    if (tone === 'error') speech.speak(message)
  }, [speech])
  const voiceControl = useVoiceCommands({ onCommand: handleVoiceCommand, onFeedback: handleVoiceFeedback })
  useLayoutEffect(() => {
    voiceControlRef.current = voiceControl
  }, [voiceControl])

  const requestAccess = useCallback((intent) => {
    setAuthIntent(intent)
    setAuthMode('login')
    setAuthError('')
    setView('auth')
  }, [])

  const selectLoginIntent = useCallback((intent) => {
    setAuthIntent(intent)
    setAuthMode('login')
    setAuthError('')
  }, [])

  const openAuthSelection = () => {
    setAuthError('')
    setView('auth-selection')
  }

  const requestCandidateSignup = useCallback(() => {
    setAuthIntent('candidate')
    setAuthMode('signup')
    setAuthError('')
    setView('auth')
  }, [])

  const openExam = useCallback(() => {
    if (authProfile?.role !== 'candidate') {
      requestAccess('candidate')
      if (authProfile) setAuthError('This examination is available to candidate accounts only.')
      return
    }
    setView('exam')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [authProfile, requestAccess])

  const returnToLanding = useCallback(() => {
    setView('landing')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const openExaminerDashboard = useCallback(() => {
    if (authProfile?.role !== 'examiner') {
      requestAccess('examiner')
      if (authProfile) setAuthError('Sign in with the examiner demo account to open the examiner dashboard.')
      return
    }
    setView('examiner')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [authProfile, requestAccess])

  const openRoleEntry = useCallback((role) => {
    const destination = getRoleShortcutDestination(role, authProfile?.role)
    if (!destination) return
    if (destination.view === 'exam') {
      openExam()
      return
    }
    if (destination.view === 'examiner') {
      openExaminerDashboard()
      return
    }

    requestAccess(destination.intent)
    if (authProfile) {
      setAuthError(destination.intent === 'examiner'
        ? 'Sign in with the examiner demo account to open the examiner dashboard.'
        : 'This examination is available to candidate accounts only.')
    }
  }, [authProfile, openExam, openExaminerDashboard, requestAccess])

  useEffect(() => {
    if (view === 'exam' || view === 'examiner') return undefined

    const handleKeyDown = (event) => {
      if (isTypingTarget(event.target)) return
      const role = getRoleShortcut(event)
      if (!role) return
      event.preventDefault()
      openRoleEntry(role)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [openRoleEntry, view])

  const handleAuthentication = (session) => {
    setAuthSession(session)
    setAuthProfile(session)
    setAuthError('')

    if (session.role !== authIntent) {
      const message = authIntent === 'examiner'
        ? 'Use the examiner demo login to open the examiner dashboard.'
        : 'Only candidate accounts can access the examination.'
      setAuthError(message)
      return
    }

    speech.speak(session.role === 'examiner'
      ? 'Sign-in successful. Opening the examiner dashboard.'
      : authMode === 'signup'
        ? 'Candidate account created. Opening the examination instructions.'
        : 'Sign-in successful. Opening the candidate examination instructions.')
    setView(session.role === 'examiner' ? 'examiner' : 'exam')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const logout = async () => {
    try {
      await signOutSupabaseUser()
      signOutDemoUser()
      clearRemoteMonitoringEvents()
      speech.speak('You have been signed out.')
      setAuthSession(null)
      setAuthProfile(null)
      setAuthError('')
      setView('landing')
    } catch (error) {
      setAuthError(error.message || 'You could not be signed out. Please try again.')
      setAuthIntent(authProfile?.role || 'candidate')
      setView('auth')
    }
  }

  let activeScreen
  if (view === 'auth') {
    activeScreen = (
      <AuthPage
        intent={authIntent}
        mode={authMode}
        onModeChange={setAuthMode}
        onSelectLoginIntent={selectLoginIntent}
        onAuthenticated={handleAuthentication}
        onBack={returnToLanding}
        onLogout={logout}
        sessionActive={Boolean(authSession)}
        errorMessage={authError}
        speech={speech}
        voiceControl={voiceControl}
        registerVoiceCommandHandler={registerVoiceCommandHandler}
      />
    )
  } else if (view === 'auth-selection') {
    activeScreen = (
      <AuthSelectionPage
        speech={speech}
        voiceControl={voiceControl}
        registerVoiceCommandHandler={registerVoiceCommandHandler}
        voiceMessage={voiceMessage}
        onCandidateLogin={() => {
          openRoleEntry('candidate')
        }}
        onCandidateSignup={() => {
          setAuthIntent('candidate')
          setAuthMode('signup')
          setAuthError('')
          setView('auth')
        }}
        onExaminerLogin={() => {
          openRoleEntry('examiner')
        }}
        onBack={returnToLanding}
      />
    )
  } else if (view === 'exam') {
    activeScreen = <Exam onExit={returnToLanding} onLogout={logout} voiceControl={voiceControl} registerVoiceCommandHandler={registerVoiceCommandHandler} />
  } else if (view === 'examiner') {
    activeScreen = <ExaminerDashboard onExit={returnToLanding} onLogout={logout} />
  } else {

    activeScreen = (
      <div className="page" id="top">
      <a className="skip-link" href="#main">Skip to main content</a>
      <Navbar onStartExam={openAuthSelection} onOpenDashboard={openAuthSelection} />
      <main id="main">
        <LandingVoiceControl
          speech={speech}
          onCandidateLogin={() => requestAccess('candidate')}
          onExaminerLogin={() => requestAccess('examiner')}
          onCandidateSignup={requestCandidateSignup}
          voiceControl={voiceControl}
          registerVoiceCommandHandler={registerVoiceCommandHandler}
          message={voiceMessage}
        />
        <Hero onStartExam={openAuthSelection} />

        <section className="capability-strip" aria-label="VisionAble capabilities">
          <div className="capability-item"><span className="capability-icon">◉</span><span>Voice enabled</span></div>
          <div className="capability-item"><span className="capability-icon">◌</span><span>Screen reader friendly</span></div>
          <div className="capability-item"><span className="capability-icon">↔</span><span>Accessible navigation</span></div>
          <div className="capability-item"><span className="capability-icon">⌁</span><span>Secure exam environment</span></div>
        </section>

        <section id="about" className="about section-shell" aria-labelledby="about-heading">
          <div className="section-kicker">01 / The platform</div>
          <div className="about-grid">
            <h2 id="about-heading">Technology that removes barriers.</h2>
            <p>VisionAble brings accessibility, voice interaction and configurable exam security into one calm, considered experience — designed to support independent assessment.</p>
          </div>
        </section>

        <Features />

        <section id="how-it-works" className="process section-shell" aria-labelledby="process-heading">
          <div className="section-heading centered-heading">
            <div className="section-kicker">02 / How it works</div>
            <h2 id="process-heading">A clearer path through every exam.</h2>
            <p>From setup to examiner review, each stage is designed around clarity, choice and accountable support.</p>
          </div>
          <ol className="process-grid">
            {steps.map(([number, title, body]) => (
              <li className="process-step" key={number}>
                <span className="step-number">{number}</span>
                <div className="step-line" aria-hidden="true" />
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="preview-section section-shell" aria-labelledby="preview-heading">
          <div className="preview-copy">
            <div className="section-kicker">03 / Candidate experience</div>
            <h2 id="preview-heading">An exam interface that listens.</h2>
            <p>Audio-first controls, readable structure and familiar interactions help candidates stay focused on the question — not the interface.</p>
            <div className="preview-points">
              <span><b>✓</b> Clear focus states</span>
              <span><b>✓</b> Voice commands kept reliable</span>
              <span><b>✓</b> Answers saved as you go</span>
            </div>
          </div>
          <div className="exam-window" aria-label="Visual prototype of the VisionAble exam interface">
            <div className="exam-topbar"><span className="window-dots"><i /><i /><i /></span><span>VISIONABLE EXAM</span><span className="exam-session">SECURE SESSION <b>●</b></span></div>
            <div className="exam-content">
              <div className="exam-progress"><span>Question 07 / 20</span><span>35% complete</span></div>
              <div className="progress-track"><span /></div>
              <p className="exam-label">DATA STRUCTURES · MULTIPLE CHOICE</p>
              <h3>Which data structure follows the FIFO principle?</h3>
              <div className="answer-list"><div className="answer-option"><span>A</span> Stack</div><div className="answer-option selected"><span>B</span> Queue <b className="selected-check">✓</b></div><div className="answer-option"><span>C</span> Tree</div><div className="answer-option"><span>D</span> Graph</div></div>
              <div className="exam-footer"><span>◉ Voice active</span><span>◌ Audio enabled</span><span className="saved">✓ Answer saved</span><button type="button" onClick={openExam}>Try exam prototype&nbsp; →</button></div>
            </div>
          </div>
        </section>

        <section className="security section-shell" aria-labelledby="security-heading">
          <div className="security-panel">
            <div className="security-copy"><div className="section-kicker">04 / Accountable security</div><h2 id="security-heading">Accessible doesn’t mean compromised.</h2><p>VisionAble supports configurable exam security while keeping approved accessibility behavior separate from suspicious-event detection.</p></div>
            <div className="security-list"><div><span className="security-icon">↯</span><span><strong>Event logging</strong><small>Timestamped examination-session events.</small></span></div><div><span className="security-icon">⌁</span><span><strong>AI-assisted monitoring</strong><small>Unusual events can be flagged for human review.</small></span></div><div><span className="security-icon">▣</span><span><strong>Examiner dashboard</strong><small>Review answers, sessions and flagged events.</small></span></div></div>
          </div>
        </section>

        <section id="get-started" className="final-cta section-shell" aria-labelledby="cta-heading">
          <div className="cta-orb" aria-hidden="true" /><div className="section-kicker">05 / Start with access</div><h2 id="cta-heading">Make examinations more accessible.</h2><p>Technology should remove barriers — not create them.</p><button className="btn btn-primary" type="button" onClick={openExam}>Try exam prototype <span aria-hidden="true">→</span></button>
        </section>
      </main>
      <Footer />
      </div>
    )
  }

  return (
    <>
      <AppVoiceControl voiceControl={voiceControl} message={voiceMessage} />
      {activeScreen}
    </>
  )
}

export default App
