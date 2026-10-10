import { normalizeVoiceTranscript } from './voiceRecognition.js'

const COMMANDS = [
  { key: 'pause', pattern: /^(?:pause|stop) (?:voice control|voice commands)$/ },
  { key: 'resume', pattern: /^(?:start|resume) (?:voice control|voice commands)$/ },
  { key: 'stop-microphone', pattern: /^(?:stop microphone|turn off (?:the )?microphone|turn microphone off)$/ },
]

export function parseVoiceControlCommand(transcript) {
  const normalized = normalizeVoiceTranscript(transcript)
  return COMMANDS.find(({ pattern }) => pattern.test(normalized)) || null
}

export function isVoiceControlCommandAllowed(command, commandsPaused) {
  if (!commandsPaused) return true
  return command?.key === 'resume' || command?.key === 'stop-microphone'
}
