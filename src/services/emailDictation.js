export const EMAIL_RECOGNITION_LANGUAGE = 'en-IN'
export const EMAIL_RECOGNITION_FALLBACK_LANGUAGE = 'en-US'

const SPOKEN_NUMBER_WORDS = {
  zero: '0',
  oh: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
}

export function normalizeEmailTranscript(transcript) {
  const trimmedTranscript = transcript.trim()
  const hasSpokenEmailTerms = /\b(?:at|dot|underscore|under\s+score|hyphen|dash|plus)\b/i.test(trimmedTranscript)
  if (!hasSpokenEmailTerms) return trimmedTranscript

  return trimmedTranscript
    .toLowerCase()
    .replace(/\bunder\s+score\b|\bunderscore\b/g, '_')
    .replace(/\bhyphen\b|\bdash\b/g, '-')
    .replace(/\bplus\b/g, '+')
    .replace(/\bat\b/g, '@')
    .replace(/\bdot\b/g, '.')
    .replace(/\b(zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/g, (word) => SPOKEN_NUMBER_WORDS[word])
    .replace(/\s*([@._+-])\s*/g, '$1')
    .replace(/\s+/g, '')
}

export function getEmailRecognitionErrorMessage(error) {
  switch (error) {
    case 'unsupported':
      return 'Voice email entry is not supported in this browser. Enter your email using the keyboard.'
    case 'construction-failed':
      return 'The browser could not create speech recognition. Try another supported browser or enter your email using the keyboard.'
    case 'start-failed':
      return 'The microphone or speech recognition could not start. Check browser permissions and try again, or enter your email using the keyboard.'
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone or speech-recognition permission was denied. You can enter your email using the keyboard.'
    case 'audio-capture':
      return 'No microphone is available. Connect a microphone or enter your email using the keyboard.'
    case 'no-speech':
      return 'No speech was detected. Check your microphone, speak after listening starts, or enter your email using the keyboard.'
    case 'network':
      return 'The browser speech-recognition service could not be reached. Check your connection or enter your email using the keyboard.'
    case 'language-not-supported':
      return 'English speech recognition is not supported by this browser. Try another supported browser or enter your email using the keyboard.'
    case 'aborted':
      return 'Voice input stopped.'
    case 'empty-transcript':
      return 'No email words were returned by speech recognition. Try again or enter your email using the keyboard.'
    default:
      return 'Voice input could not be completed. Check microphone access and try again, or enter your email using the keyboard.'
  }
}

export function configureEmailRecognition(recognition, handlers) {
  let receivedResult = false
  let receivedError = false

  recognition.lang = EMAIL_RECOGNITION_LANGUAGE
  recognition.continuous = false
  recognition.interimResults = false
  recognition.maxAlternatives = 3
  recognition.onstart = () => {
    receivedResult = false
    receivedError = false
    handlers.onStart()
  }
  recognition.onresult = (event) => {
    const transcript = Array.from(event.results || [])
      .map((result) => result?.[0]?.transcript || '')
      .filter(Boolean)
      .join(' ')
      .trim()

    if (!transcript) {
      receivedError = true
      handlers.onError('empty-transcript')
      return
    }

    receivedResult = true
    handlers.onTranscript(transcript)
  }
  recognition.onerror = (event) => {
    receivedError = true
    handlers.onError(event.error || 'unknown')
  }
  recognition.onend = () => {
    handlers.onEnd({ receivedResult, receivedError })
  }

  return recognition
}

export function startEmailRecognition(SpeechRecognition, handlers, onCreated = () => {}) {
  if (!SpeechRecognition) {
    handlers.onError('unsupported')
    return null
  }

  let recognition
  try {
    recognition = new SpeechRecognition()
  } catch {
    handlers.onError('construction-failed')
    return null
  }

  configureEmailRecognition(recognition, handlers)
  onCreated(recognition)

  try {
    recognition.start()
    return recognition
  } catch {
    try {
      recognition.lang = EMAIL_RECOGNITION_FALLBACK_LANGUAGE
      handlers.onFallbackStart?.()
      recognition.start()
      return recognition
    } catch {
      handlers.onError('start-failed')
      return null
    }
  }
}
