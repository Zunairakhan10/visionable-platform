import { normalizeVoiceTranscript } from './voiceRecognition.js'

const COMMANDS = [
  { key: 'next', label: 'Next question', pattern: /^(?:next|next question|go to next question)$/ },
  { key: 'previous', label: 'Previous question', pattern: /^(?:previous|previous question|go back|go to previous question)$/ },
  { key: 'read', label: 'Read question and options aloud', pattern: /^(?:read|repeat)(?: the)? question(?: aloud)?$/ },
  { key: 'read-instructions', label: 'Read examination instructions aloud', pattern: /^(?:read|repeat)(?: the)? instructions(?: aloud)?$/ },
  { key: 'read-options', label: 'Read available options', pattern: /^(?:read|repeat)(?: the)? (?:available )?options(?: aloud)?$/ },
  { key: 'read-answer', label: 'Read selected answer', pattern: /^(?:read|repeat)(?:(?: my| the selected| selected))? answer(?: aloud)?$/ },
  { key: 'review-unanswered', label: 'Review unanswered questions', pattern: /^(?:review|go to|show)(?: the)? unanswered questions?$/ },
  { key: 'mark', label: 'Mark for review', pattern: /^mark(?: this question)? for review$/ },
  { key: 'unmark', label: 'Unmark for review', pattern: /^unmark(?: this question)? for review$/ },
  { key: 'submit', label: 'Open exam submission confirmation', pattern: /^(?:submit|finish) (?:the )?exam$/ },
  { key: 'stop-voice', label: 'Stop voice control', pattern: /^stop (?:voice control|voice commands|listening)$/ },
  ...['a', 'b', 'c', 'd'].map((option) => ({
    key: `select-${option}`,
    label: `Select option ${option.toUpperCase()}`,
    pattern: new RegExp(`^(?:(?:select|choose|answer) )?(?:option )?${option}$`),
  })),
]

export function parseExamVoiceCommand(transcript) {
  const normalized = normalizeVoiceTranscript(transcript)
  return COMMANDS.find(({ pattern }) => pattern.test(normalized)) || null
}
