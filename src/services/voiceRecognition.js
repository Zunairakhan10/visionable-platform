export function normalizeVoiceTranscript(transcript) {
  return transcript
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[.,!?;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isDuplicateVoiceTranscript(previous, transcript, now, windowMs = 900) {
  const normalized = normalizeVoiceTranscript(transcript)
  if (!normalized) return true
  return previous.transcript === normalized && now - previous.at < windowMs
}
