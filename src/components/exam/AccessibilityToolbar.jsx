function AccessibilityToolbar({ speechSupported, isSpeaking, onReadQuestion, onStopReading, voiceSupported, voiceStatus, onStartVoice, onStopVoice, largeText, highContrast, onToggleLargeText, onToggleHighContrast, feedback }) {
  const statusLabel = {
    ready: 'Ready to listen',
    starting: 'Starting microphone…',
    listening: 'Listening…',
    stopped: 'Voice commands stopped',
    unsupported: 'Voice controls are not supported in this browser',
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
        <button className="accessibility-control compact" type="button" aria-pressed={largeText} onClick={onToggleLargeText}><span aria-hidden="true">A<sup>+</sup></span><span className="sr-only">{largeText ? 'Disable' : 'Enable'} larger text</span></button>
        <button className="accessibility-control compact" type="button" aria-pressed={highContrast} onClick={onToggleHighContrast}><span aria-hidden="true">◐</span><span className="sr-only">{highContrast ? 'Disable' : 'Enable'} high contrast</span></button>
      </div>
      <div className="voice-controls-panel" aria-labelledby="voice-controls-heading">
        <div className="voice-controls-title"><span className="voice-mic" aria-hidden="true">⌁</span><div><h3 id="voice-controls-heading">Voice Controls</h3><p>Use a short command to control the exam hands-free.</p></div></div>
        <div className="voice-actions">
          <button className="voice-start-button" type="button" onClick={onStartVoice} disabled={!voiceSupported || voiceStatus === 'listening' || voiceStatus === 'starting'}><span aria-hidden="true">●</span> Start Voice Commands</button>
          <button className="voice-stop-button" type="button" onClick={onStopVoice} disabled={!voiceSupported || (!isSpeaking && voiceStatus !== 'listening' && voiceStatus !== 'starting')}><span aria-hidden="true">■</span> Stop Voice Commands</button>
        </div>
        <div className={`voice-status ${voiceStatus === 'listening' ? 'is-listening' : ''} ${voiceStatus === 'unsupported' ? 'is-error' : ''}`} role="status" aria-live="polite"><span className="status-indicator" aria-hidden="true" />{statusLabel}</div>
        <p className="voice-command-examples"><strong>Try:</strong> “Next question” · “Select option B” · “Mark for review” · “Submit exam”</p>
      </div>
      <div className={`voice-feedback ${feedback?.tone || 'info'}`} aria-live="polite"><span aria-hidden="true">{feedback?.tone === 'error' ? '!' : 'i'}</span><span>{feedback?.message || 'Voice command feedback will appear here.'}</span></div>
    </section>
  )
}

export default AccessibilityToolbar
