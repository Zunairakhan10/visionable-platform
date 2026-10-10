import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { parseLoginVoiceCommand } from '../services/loginVoiceCommands'
import './AuthSelectionPage.css'

function AuthSelectionPage({ onCandidateLogin, onCandidateSignup, onExaminerLogin, onBack, speech, voiceControl, registerVoiceCommandHandler, voiceMessage }) {
  const [recognizedPhrase, setRecognizedPhrase] = useState('')
  const [recognizedAction, setRecognizedAction] = useState('')
  const { supported, isSpeaking, isPaused, speak, pause, resume, stop } = speech
  const instructions = 'Choose how to continue. Say candidate login, examiner login, create candidate account or sign up, read instructions, or go back. Candidate account creation provides candidate access only. The examiner dashboard uses shared demo credentials and is not secure for real exams.'

  useEffect(() => {
    speak(instructions)
  }, [instructions, speak])

  const handleVoiceCommand = useCallback((transcript) => {
    setRecognizedPhrase(transcript)
    const command = parseLoginVoiceCommand(transcript)
    if (!command) {
      setRecognizedAction('No account action matched.')
      speak('I did not understand that account command. Try candidate login, examiner login, create candidate account, read instructions, go back, or stop voice control.')
      return
    }

    setRecognizedAction(`Action: ${command.label}`)
    switch (command.key) {
      case 'candidate-login':
        onCandidateLogin()
        break
      case 'examiner-login':
        onExaminerLogin()
        break
      case 'signup':
        onCandidateSignup()
        break
      case 'go-back':
        onBack()
        break
      case 'read-instructions':
        speak(instructions)
        break
      case 'start-camera':
      case 'stop-camera':
        speak('Camera controls are available after opening candidate login. Say candidate login, then start voice control there.')
        break
      case 'stop-voice':
        voiceControl.stopListening()
        break
      default:
        break
    }
  }, [instructions, onBack, onCandidateLogin, onCandidateSignup, onExaminerLogin, speak, voiceControl])

  useLayoutEffect(() => registerVoiceCommandHandler('auth-selection', handleVoiceCommand), [handleVoiceCommand, registerVoiceCommandHandler])

  return (
    <main className="auth-selection-screen" id="main">
      <a className="auth-selection-skip" href="#auth-options">Skip to account options</a>
      <section className="auth-selection-shell" aria-labelledby="auth-selection-title">
        <button className="auth-selection-brand" type="button" onClick={onBack} aria-label="Return to VisionAble home">
          <span className="auth-selection-mark" aria-hidden="true">V</span>
          <span>VISION<span>ABLE</span></span>
        </button>
        <header className="auth-selection-heading">
          <span className="auth-selection-eyebrow">VISIONABLE ACCESS</span>
          <h1 id="auth-selection-title">Choose how to continue</h1>
          <p>Choose a candidate or examiner demo sign-in. Demo role checks run only in this browser and are not secure for real exams.</p>
        </header>
        <section className="auth-selection-speech" aria-label="Spoken account selection guidance">
          <div className="auth-selection-speech-actions">
            <button type="button" onClick={() => speak(instructions)} disabled={!supported}>Repeat instructions</button>
            <button type="button" onClick={isPaused ? resume : pause} disabled={!supported || !isSpeaking}>{isPaused ? 'Resume guidance' : 'Pause guidance'}</button>
            <button type="button" onClick={stop} disabled={!supported || (!isSpeaking && !isPaused)}>Stop guidance</button>
          </div>
          {!supported && <p role="status">Spoken guidance is unavailable in this browser. Use the labeled buttons, keyboard, or screen reader to choose an account option.</p>}
        </section>
        <section className="auth-selection-voice" aria-labelledby="auth-selection-voice-heading">
          <div>
            <h2 id="auth-selection-voice-heading">Voice Control</h2>
            <p>Start explicitly to keep listening for account commands. Microphone permission is requested by your browser when you start.</p>
          </div>
          <div className="auth-selection-voice-actions">
            <button type="button" onClick={voiceControl.startListening} disabled={!voiceControl.supported || voiceControl.isActive}>{voiceControl.status === 'unavailable' ? 'Restart Voice Control' : 'Start Voice Control'}</button>
            {voiceControl.isActive && !['pausing', 'paused', 'microphone-paused'].includes(voiceControl.status) && <button type="button" onClick={voiceControl.isCommandsPaused ? voiceControl.resumeCommands : voiceControl.pauseCommands}>{voiceControl.isCommandsPaused ? 'Resume Voice Commands' : 'Pause Voice Commands'}</button>}
            {voiceControl.isActive && <button type="button" onClick={voiceControl.stopListening}>Stop Microphone</button>}
          </div>
          <p className={`auth-selection-voice-status ${['unsupported', 'unavailable'].includes(voiceControl.status) ? 'is-error' : ''}`} role="status" aria-live="polite">
            {voiceControl.status === 'ready' && 'Ready. Voice control is off.'}
            {voiceControl.status === 'starting' && 'Requesting microphone permission…'}
            {voiceControl.status === 'listening' && 'Listening for account commands.'}
            {voiceControl.status === 'processing' && 'Processing command…'}
            {voiceControl.status === 'recovering' && 'Reconnecting to speech recognition…'}
            {voiceControl.status === 'pausing' && 'Pausing recognition before the microphone is handed off…'}
            {voiceControl.status === 'commands-paused' && 'Voice commands paused. Microphone remains on for resume and stop-microphone only.'}
            {voiceControl.status === 'paused' && 'Recognition is temporarily suspended and is not listening.'}
            {voiceControl.status === 'microphone-paused' && 'Recognition is suspended and is not using the microphone.'}
            {voiceControl.status === 'stopped' && 'Voice control stopped.'}
            {voiceControl.status === 'unsupported' && 'Speech recognition is not supported in this browser. Use keyboard or screen-reader controls.'}
            {voiceControl.status === 'unavailable' && (voiceMessage || 'Voice control is unavailable. Use keyboard or screen-reader controls.')}
          </p>
          {voiceControl.supported && <p className="auth-selection-voice-help">Say “Pause voice control” to pause commands while keeping a minimal resume listener active, “Resume voice control” to continue, or “Stop microphone” to completely stop recognition. Commands stay active across VisionAble screens.</p>}
          {recognizedPhrase && <p className="auth-selection-voice-recognized" aria-live="polite">Recognized: “{recognizedPhrase}”. {recognizedAction}</p>}
          {voiceMessage && voiceControl.status !== 'unavailable' && <p className="auth-selection-voice-help" role="status" aria-live="polite">{voiceMessage}</p>}
        </section>

        <div className="auth-selection-panels" id="auth-options">
          <section className="auth-selection-panel" aria-labelledby="candidate-access-heading">
            <span className="auth-selection-icon candidate-icon" aria-hidden="true">C</span>
            <h2 id="candidate-access-heading">Candidate</h2>
            <p>Sign in to continue to your accessible examination, or create a candidate account.</p>
            <div className="auth-selection-actions">
              <button className="auth-selection-primary" type="button" onClick={onCandidateLogin} onFocus={() => speak('Candidate login. Sign in to continue to the accessible examination.')}>Candidate Login</button>
              <button className="auth-selection-secondary" type="button" onClick={onCandidateSignup} onFocus={() => speak('Create candidate account. Candidate registration cannot grant examiner access.')}>Create Account</button>
            </div>
          </section>

          <section className="auth-selection-panel examiner-panel" aria-labelledby="examiner-access-heading">
            <span className="auth-selection-icon examiner-icon" aria-hidden="true">E</span>
            <h2 id="examiner-access-heading">Examiner</h2>
            <p>Open the local examiner dashboard with the shared demo credentials.</p>
            <div className="auth-selection-actions">
              <button className="auth-selection-primary" type="button" onClick={onExaminerLogin} onFocus={() => speak('Examiner login. Open the local examiner dashboard with shared demo credentials.')}>Examiner Login</button>
            </div>
            <p className="examiner-access-note">Frontend-only demo access can be manipulated and is not suitable for production or protecting real exams. Candidate signup cannot grant examiner access.</p>
          </section>
        </div>

        <aside className="auth-selection-shortcuts" aria-labelledby="keyboard-shortcuts-heading">
          <h2 id="keyboard-shortcuts-heading">Keyboard shortcuts</h2>
          <ul>
            <li><kbd>C</kbd><span>Open candidate sign-in or examination</span></li>
            <li><kbd>E</kbd><span>Open examiner sign-in or dashboard</span></li>
          </ul>
        </aside>

        <button className="auth-selection-back" type="button" onClick={onBack}>Return to VisionAble home</button>
      </section>
    </main>
  )
}

export default AuthSelectionPage
