import { normalizeVoiceTranscript } from './voiceRecognition.js'

const COMMANDS = [
  { key: 'candidate-login', label: 'Candidate login', contexts: ['navigation'], pattern: /^(?:candidate )?(?:login|log in|sign in|sign-in)(?: as candidate)?$/ },
  { key: 'examiner-login', label: 'Examiner login', contexts: ['navigation'], pattern: /^(?:examiner )?(?:login|log in|sign in|sign-in)(?: as examiner)?$/ },
  { key: 'submit-login', label: 'Sign in', contexts: ['form'], pattern: /^(?:sign in|sign-in|log in|login)$/ },
  { key: 'examiner-login', label: 'Examiner login', contexts: ['form'], pattern: /^examiner (?:login|log in|sign in|sign-in)$/ },
  { key: 'candidate-login', label: 'Candidate login', contexts: ['form'], pattern: /^candidate (?:login|log in|sign in|sign-in)$/ },
  { key: 'signup', label: 'Create candidate account', contexts: ['navigation', 'form'], pattern: /^(?:create (?:a )?candidate account|sign up|signup)$/ },
  { key: 'create-account', label: 'Create account', contexts: ['form'], pattern: /^create account$/ },
  { key: 'go-back', label: 'Go back', contexts: ['navigation', 'form'], pattern: /^(?:go back|return|back)$/ },
  { key: 'email-field', label: 'Email field', contexts: ['form'], pattern: /^(?:email|email address)(?: field)?$/ },
  { key: 'password-field', label: 'Password field', contexts: ['form'], pattern: /^password(?: field)?$/ },
  { key: 'confirm-password-field', label: 'Password confirmation field', contexts: ['form'], pattern: /^(?:confirm|confirmation) password(?: field)?$/ },
  { key: 'read-instructions', label: 'Read instructions', contexts: ['navigation', 'form'], pattern: /^(?:read|repeat)(?: the)? instructions(?: aloud)?$/ },
  { key: 'start-camera', label: 'Start camera', contexts: ['navigation', 'form'], pattern: /^(?:start|turn on|enable)(?: the)? camera$/ },
  { key: 'stop-camera', label: 'Stop camera', contexts: ['navigation', 'form'], pattern: /^(?:stop|turn off|disable)(?: the)? camera$/ },
  { key: 'stop-voice', label: 'Stop voice control', contexts: ['navigation', 'form'], pattern: /^stop (?:voice control|voice commands|listening)$/ },
]

export function parseLoginVoiceCommand(transcript, context = 'navigation') {
  const normalized = normalizeVoiceTranscript(transcript)
  return COMMANDS.find(({ contexts, pattern }) => contexts.includes(context) && pattern.test(normalized)) || null
}
