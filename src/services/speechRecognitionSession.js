let activeSession = null

export function claimSpeechRecognitionSession(owner) {
  if (activeSession) return null
  const session = { owner }
  activeSession = session
  return () => {
    if (activeSession === session) activeSession = null
  }
}

export function getSpeechRecognitionSessionOwner() {
  return activeSession?.owner || null
}
