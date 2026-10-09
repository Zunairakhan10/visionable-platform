function AccessibilityToolbar({ speechSupported, isSpeaking, isPaused, onReadQuestion, onReadOptions, onPauseReading, onResumeReading, onStopReading, voiceSupported, isListening, voiceStatus, onStartVoice, onStopVoice, largeText, highContrast, onToggleLargeText, onToggleHighContrast, feedback }) {
  const statusLabel = {
    ready: 'Ready to listen',
    starting: 'Starting microphone…',
    listening: 'Listening…',
    paused: 'Paused while audio plays',
    stopped: 'Voice commands stopped',
    error: 'Voice recognition interrupted',
    unsupported: 'Voice controls are not supported in this browser',
  }[voiceStatus] || 'Voice controls ready'
  const voiceActive = voiceStatus !== 'stopped' && voiceStatus !== 'unsupported' && voiceStatus !== 'error'

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
        <button className="accessibility-control" type="button" onClick={onReadOptions} disabled={!speechSupported}><span aria-hidden="true">☷</span> Read options</button>
        <button className="accessibility-control" type="button" onClick={isPaused ? onResumeReading : onPauseReading} disabled={!isSpeaking || !speechSupported}><span aria-hidden="true">{isPaused ? '▶' : 'Ⅱ'}</span>{isPaused ? 'Resume audio' : 'Pause audio'}</button>
        <button className="accessibility-control" type="button" onClick={onReadQuestion} disabled={!speechSupported}><span aria-hidden="true">↻</span> Repeat question</button>
        <button className="accessibility-control compact" type="button" aria-pressed={largeText} onClick={onToggleLargeText}><span aria-hidden="true">A<sup>+</sup></span><span className="sr-only">{largeText ? 'Disable' : 'Enable'} larger text</span></button>
        <button className="accessibility-control compact" type="button" aria-pressed={highContrast} onClick={onToggleHighContrast}><span aria-hidden="true">◐</span><span className="sr-only">{highContrast ? 'Disable' : 'Enable'} high contrast</span></button>
      </div>
      <div className="voice-controls-panel" aria-labelledby="voice-controls-heading">
        <div className="voice-controls-title"><span className="voice-mic" aria-hidden="true">⌁</span><div><h3 id="voice-controls-heading">Voice Controls</h3><p>Voice recognition stays available between commands and pauses while audio is playing.</p></div></div>
        <div className="voice-actions">
          <button className="voice-start-button" type="button" onClick={onStartVoice} disabled={!voiceSupported || isListening || voiceStatus === 'starting'}><span aria-hidden="true">●</span> Start Voice Commands</button>
          <button className="voice-stop-button" type="button" onClick={onStopVoice} disabled={!voiceSupported || !voiceActive}><span aria-hidden="true">■</span> Stop Voice Commands</button>
        </div>
        <div className={`voice-status ${isListening ? 'is-listening' : ''} ${voiceStatus === 'unsupported' || voiceStatus === 'error' ? 'is-error' : ''}`} role="status" aria-live="polite"><span className="status-indicator" aria-hidden="true" />{statusLabel}</div>
        <p className="voice-command-examples"><strong>Try:</strong> “Repeat question” · “Read options” · “Select option B” · “How much time is left?” · “Submit exam”</p>
      </div>
      <div className={`voice-feedback ${feedback?.tone || 'info'}`} aria-live="polite"><span aria-hidden="true">{feedback?.tone === 'error' ? '!' : 'i'}</span><span>{feedback?.message || 'Audio-first mode will read each question and its options automatically.'}</span></div>
    </section>
  )
}
export default AccessibilityToolbar
