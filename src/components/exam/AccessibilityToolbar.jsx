function AccessibilityToolbar({ speechSupported, isSpeaking, isPaused, onReadQuestion, onStopReading, onPauseReading, onResumeReading, voiceSupported, voiceStatus, voiceControlActive, onStartVoice, onPauseVoice, onResumeVoice, onStopMicrophone, voiceCommandsPaused, largeText, highContrast, onToggleLargeText, onToggleHighContrast, feedback, recognizedCommand, recognizedAction, pendingCommands, onConfirmCommand }) {
  const statusLabel = {
    ready: 'Ready. Voice control is off.',
    starting: 'Requesting microphone permission…',
    listening: 'Listening',
    processing: 'Processing command…',
    recovering: 'Reconnecting to speech recognition…',
    pausing: 'Pausing voice control…',
    'commands-paused': 'Voice commands paused; microphone remains on for resume and stop-microphone only',
    paused: 'Recognition is temporarily suspended and is not listening',
    'microphone-paused': 'Recognition is suspended and is not using the microphone',
    stopped: 'Voice control stopped',
    unsupported: 'Voice controls are not supported in this browser',
    unavailable: 'Voice control unavailable. Start again or use keyboard controls.',
  }[voiceStatus]

  return (
    <section className="accessibility-toolbar" aria-labelledby="accessibility-heading">
      <div className="accessibility-heading">
        <span className="exam-kicker">Accessibility mode</span>
        <h2 id="accessibility-heading">Candidate controls</h2>
      </div>
      <div className="accessibility-controls">
        <button className={`accessibility-control ${isSpeaking ? 'is-active' : ''}`} type="button" onClick={isSpeaking ? onStopReading : onReadQuestion} disabled={!speechSupported} title={!speechSupported ? 'Text-to-speech is unavailable in this browser' : undefined}>
          <span aria-hidden="true">{isSpeaking ? '■' : '◉'}</span>{isSpeaking ? 'Stop reading' : 'Read Question Aloud'}
        </button>
        <button className="accessibility-control" type="button" onClick={isPaused ? onResumeReading : onPauseReading} disabled={!speechSupported || !isSpeaking}>
          {isPaused ? 'Resume spoken guidance' : 'Pause spoken guidance'}
        </button>
        <button className="accessibility-control compact" type="button" aria-pressed={largeText} onClick={onToggleLargeText}><span aria-hidden="true">A<sup>+</sup></span><span className="sr-only">{largeText ? 'Disable' : 'Enable'} larger text</span></button>
        <button className="accessibility-control compact" type="button" aria-pressed={highContrast} onClick={onToggleHighContrast}><span aria-hidden="true">◐</span><span className="sr-only">{highContrast ? 'Disable' : 'Enable'} high contrast</span></button>
      </div>
      <div className="voice-controls-panel" aria-labelledby="voice-controls-heading">
        <div className="voice-controls-title"><span className="voice-mic" aria-hidden="true">⌁</span><div><h3 id="voice-controls-heading">Voice Control</h3><p>Start explicitly to let the browser keep listening for commands. Microphone permission is requested when you start. Continuous listening depends on browser support; keyboard controls always work.</p></div></div>
        <div className="voice-actions">
          <button className="voice-start-button" type="button" onClick={onStartVoice} disabled={!voiceSupported || ['starting', 'listening', 'processing', 'recovering', 'commands-paused', 'pausing', 'paused', 'microphone-paused'].includes(voiceStatus)}><span aria-hidden="true">●</span> {voiceStatus === 'unavailable' ? 'Restart Voice Control' : 'Start Voice Control'}</button>
          {voiceControlActive && !['pausing', 'paused', 'microphone-paused'].includes(voiceStatus) && <button className="voice-stop-button" type="button" onClick={voiceCommandsPaused ? onResumeVoice : onPauseVoice}>{voiceCommandsPaused ? 'Resume Voice Commands' : 'Pause Voice Commands'}</button>}
          {voiceControlActive && <button className="voice-stop-button" type="button" onClick={onStopMicrophone}>Stop Microphone</button>}
        </div>
        <div className={`voice-status ${voiceStatus === 'listening' ? 'is-listening' : ''} ${['unsupported', 'unavailable'].includes(voiceStatus) ? 'is-error' : ''}`} role="status" aria-live="polite"><span className="status-indicator" aria-hidden="true" />{statusLabel}</div>
        {!voiceSupported && <p className="voice-command-examples" role="status">This browser does not provide speech recognition. Use the keyboard, screen reader, or visible controls instead.</p>}
        {voiceSupported && <p className="voice-command-examples"><strong>Try:</strong> “Read question” · “Read available options” · “Select option B” · “Read selected answer” · “Review unanswered questions” · “Next question” · “Pause voice control” · “Resume voice control” · “Stop microphone”. “Submit exam” opens confirmation only. A paused listener still uses the microphone for the two voice-control commands only.</p>}
      </div>
      {recognizedCommand && <div className="voice-feedback" role="status" aria-live="polite"><span aria-hidden="true">i</span><span>Recognized speech: “{recognizedCommand}”. {recognizedAction}</span></div>}
      {pendingCommands?.length > 0 && (
        <div className="voice-command-confirmation" role="group" aria-label="Confirm the voice command">
          <p>I’m not sure which command you meant. Choose the intended action; no action has been taken yet.</p>
          {pendingCommands.map((command) => (
            <button type="button" key={command.key} onClick={() => onConfirmCommand(command)}>{command.label}</button>
          ))}
        </div>
      )}
      <div className={`voice-feedback ${feedback?.tone || 'info'}`} aria-live="polite"><span aria-hidden="true">{feedback?.tone === 'error' ? '!' : 'i'}</span><span>{feedback?.message || 'Voice command feedback will appear here.'}</span></div>
    </section>
  )
}

export default AccessibilityToolbar
