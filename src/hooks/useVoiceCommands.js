import { useCallback, useEffect, useRef, useState } from 'react'
import { isDuplicateVoiceTranscript, normalizeVoiceTranscript } from '../services/voiceRecognition.js'
import { claimSpeechRecognitionSession } from '../services/speechRecognitionSession.js'
import { isVoiceControlCommandAllowed, parseVoiceControlCommand } from '../services/voiceControlCommands.js'

const MAX_RESTARTS_PER_SESSION = 3
const RESTART_DELAY_MS = 450
const PROCESSING_DISPLAY_MS = 350
const STOP_WAIT_TIMEOUT_MS = 2000

function getRecognitionConstructor() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

function getMicrophoneError(error) {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone permission was denied. Allow microphone access in your browser settings and start voice control again. Keyboard and screen-reader controls remain available.'
    case 'audio-capture':
      return 'No usable microphone was found. Connect a microphone or use the keyboard controls.'
    case 'language-not-supported':
      return 'This browser does not support the requested recognition language. Voice control is unavailable; use the keyboard controls.'
    case 'network':
      return 'The browser speech-recognition service lost its network connection. Voice control will try to reconnect.'
    case 'no-speech':
      return 'No speech was detected. Voice control will keep listening; speak a short command or stop voice control.'
    default:
      return 'Speech recognition encountered a recoverable problem and will try to reconnect.'
  }
}

export function useVoiceCommands({ onCommand, onFeedback }) {
  const recognitionRef = useRef(null)
  const activeRef = useRef(false)
  const generationRef = useRef(0)
  const restartAttemptsRef = useRef(0)
  const restartTimerRef = useRef(null)
  const processingTimerRef = useRef(null)
  const lastFinalResultIndexRef = useRef(-1)
  const lastTranscriptRef = useRef({ transcript: '', at: 0 })
  const lastRecognitionErrorRef = useRef('')
  const stopWaitRef = useRef(null)
  const suspensionPromiseRef = useRef(null)
  const pausedRef = useRef(false)
  const commandsPausedRef = useRef(false)
  const onCommandRef = useRef(onCommand)
  const onFeedbackRef = useRef(onFeedback)
  const [isListening, setIsListening] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [isCommandsPaused, setIsCommandsPaused] = useState(false)
  const [status, setStatus] = useState(getRecognitionConstructor() ? 'ready' : 'unsupported')
  const supported = Boolean(getRecognitionConstructor())

  useEffect(() => {
    onCommandRef.current = onCommand
    onFeedbackRef.current = onFeedback
  }, [onCommand, onFeedback])

  const stopListening = useCallback((feedback = true) => {
    activeRef.current = false
    pausedRef.current = false
    commandsPausedRef.current = false
    setIsCommandsPaused(false)
    generationRef.current += 1
    window.clearTimeout(restartTimerRef.current)
    window.clearTimeout(processingTimerRef.current)
    restartTimerRef.current = null
    processingTimerRef.current = null
    const recognition = recognitionRef.current
    recognitionRef.current = null
    let stopped = Promise.resolve()
    if (recognition) {
      stopped = new Promise((resolve) => {
        const finish = (ended = true) => {
          if (stopWaitRef.current?.recognition !== recognition) return
          window.clearTimeout(stopWaitRef.current.timeoutId)
          stopWaitRef.current = null
          resolve(ended)
        }
        const timeoutId = window.setTimeout(() => finish(false), STOP_WAIT_TIMEOUT_MS)
        stopWaitRef.current = { recognition, resolve: finish, timeoutId }
      })
    }
    try {
      recognition?.abort()
    } catch {
      // The browser may already have ended the recognition session.
      stopWaitRef.current?.resolve(false)
    }
    setIsActive(false)
    setIsListening(false)
    setStatus('stopped')
    if (feedback) onFeedbackRef.current('Speech recognition stopped. The microphone is no longer being used by voice control. Use the Start Voice Control button to activate it again.', 'info')
    return stopped
  }, [])

  const pauseCommands = useCallback(() => {
    if (!activeRef.current) return false
    commandsPausedRef.current = true
    setIsCommandsPaused(true)
    if (!pausedRef.current) setStatus('commands-paused')
    onFeedbackRef.current('Voice commands are paused. The microphone remains active for “Resume voice control” and “Stop microphone” only.', 'info')
    return true
  }, [])

  const resumeCommands = useCallback(() => {
    if (!activeRef.current) return false
    commandsPausedRef.current = false
    setIsCommandsPaused(false)
    if (!pausedRef.current) setStatus(recognitionRef.current ? 'listening' : 'recovering')
    onFeedbackRef.current('Voice commands resumed.', 'info')
    return true
  }, [])

  const suspendListening = useCallback((reason = 'paused') => {
    if (!activeRef.current) return Promise.resolve(true)
    if (pausedRef.current) return suspensionPromiseRef.current || Promise.resolve(true)
    pausedRef.current = true
    generationRef.current += 1
    window.clearTimeout(restartTimerRef.current)
    window.clearTimeout(processingTimerRef.current)
    restartTimerRef.current = null
    processingTimerRef.current = null
    const recognition = recognitionRef.current
    recognitionRef.current = null
    setIsListening(false)
    setStatus(recognition ? 'pausing' : 'microphone-paused')
    if (!recognition) return Promise.resolve(true)

    const stopped = new Promise((resolve) => {
      const finish = (ended = true) => {
        if (stopWaitRef.current?.recognition !== recognition) return
        window.clearTimeout(stopWaitRef.current.timeoutId)
        stopWaitRef.current = null
        resolve(ended)
      }
      const timeoutId = window.setTimeout(() => finish(false), STOP_WAIT_TIMEOUT_MS)
      stopWaitRef.current = { recognition, resolve: finish, timeoutId }
    })
    try {
      recognition.abort()
    } catch {
      stopWaitRef.current?.resolve(false)
    }
    const suspension = stopped.then((ended) => {
      if (ended && activeRef.current && pausedRef.current) setStatus('microphone-paused')
      if (!ended && activeRef.current) {
        activeRef.current = false
        pausedRef.current = false
        setIsActive(false)
        setStatus('unavailable')
        onFeedbackRef.current(`Voice recognition could not pause for ${reason}. The browser may require a fresh user gesture; use Restart Voice Control or keyboard controls.`, 'error')
      }
      return ended
    })
    suspensionPromiseRef.current = suspension
    void suspension.finally(() => {
      if (suspensionPromiseRef.current === suspension) suspensionPromiseRef.current = null
    })
    return suspension
  }, [])

  const startListening = useCallback(() => {
    const Recognition = getRecognitionConstructor()
    if (!Recognition) {
      activeRef.current = false
      setIsActive(false)
      setIsListening(false)
      setStatus('unsupported')
      onFeedbackRef.current('Voice recognition is not supported in this browser. Use the keyboard or screen-reader controls.', 'error')
      return false
    }
    if (activeRef.current && !pausedRef.current) return true

    activeRef.current = true
    pausedRef.current = false
    setIsCommandsPaused(false)
    setIsActive(true)
    setIsListening(false)
    setStatus('starting')
    restartAttemptsRef.current = 0
    lastFinalResultIndexRef.current = -1
    lastTranscriptRef.current = { transcript: '', at: 0 }
    lastRecognitionErrorRef.current = ''
    const generation = generationRef.current + 1
    generationRef.current = generation

    const stopForUnavailable = (message) => {
      if (generationRef.current !== generation) return
      activeRef.current = false
      commandsPausedRef.current = false
      recognitionRef.current = null
      setIsActive(false)
      setIsCommandsPaused(false)
      setIsListening(false)
      setStatus('unavailable')
      onFeedbackRef.current(message, 'error')
    }

    const scheduleRestart = (message) => {
      if (generationRef.current !== generation || !activeRef.current) return
      if (restartAttemptsRef.current >= MAX_RESTARTS_PER_SESSION) {
        stopForUnavailable('Voice recognition stopped repeatedly. Press Restart Voice Control to try again, or use the keyboard controls.')
        return
      }
      restartAttemptsRef.current += 1
      setStatus('recovering')
      setIsListening(false)
      onFeedbackRef.current(message, 'error')
      window.clearTimeout(restartTimerRef.current)
      restartTimerRef.current = window.setTimeout(() => {
        restartTimerRef.current = null
        startRecognition()
      }, RESTART_DELAY_MS * restartAttemptsRef.current)
    }

    const startRecognition = () => {
      if (generationRef.current !== generation || !activeRef.current || recognitionRef.current) return

      const releaseSession = claimSpeechRecognitionSession('voice-control')
      if (!releaseSession) {
        scheduleRestart('Another speech-recognition action is still using the microphone.')
        return
      }

      let recognition
      try {
        recognition = new Recognition()
      } catch {
        releaseSession()
        scheduleRestart('The browser could not create speech recognition. Voice control will retry.')
        return
      }

      recognition.continuous = true
      recognition.interimResults = false
      recognition.lang = 'en-US'
      recognitionRef.current = recognition
      lastFinalResultIndexRef.current = -1
      lastRecognitionErrorRef.current = ''

      recognition.onstart = () => {
        if (generationRef.current !== generation || recognitionRef.current !== recognition) return
        setIsListening(true)
        setStatus(commandsPausedRef.current ? 'commands-paused' : 'listening')
        onFeedbackRef.current(commandsPausedRef.current
          ? 'Voice commands remain paused. The microphone is listening only for “Resume voice control” or “Stop microphone”.'
          : 'Voice control is listening. Say a short command at any time, pause commands, or stop the microphone.', 'info')
      }

      recognition.onresult = (event) => {
        if (generationRef.current !== generation || recognitionRef.current !== recognition) return
        const firstIndex = Math.max(event.resultIndex ?? 0, lastFinalResultIndexRef.current + 1)
        for (let index = firstIndex; index < event.results.length; index += 1) {
          if (!activeRef.current || recognitionRef.current !== recognition) return
          const result = event.results[index]
          if (!result?.isFinal) continue
          lastFinalResultIndexRef.current = index
          const transcript = result[0]?.transcript?.trim() || ''
          const now = Date.now()
          if (isDuplicateVoiceTranscript(lastTranscriptRef.current, transcript, now)) continue

          lastTranscriptRef.current = { transcript: normalizeVoiceTranscript(transcript), at: now }
          const controlCommand = parseVoiceControlCommand(transcript)
          if (!isVoiceControlCommandAllowed(controlCommand, commandsPausedRef.current)) continue
          setStatus('processing')
          onFeedbackRef.current(`Recognized: “${transcript}”. Processing command.`, 'info')
          try {
            onCommandRef.current(transcript, Array.from(result, (alternative) => ({
              transcript: alternative.transcript?.trim() || '',
              confidence: alternative.confidence,
            })).filter((alternative) => alternative.transcript))
          } catch (error) {
            onFeedbackRef.current(error?.message || 'The recognized command could not be completed. Use the keyboard controls.', 'error')
          }
          window.clearTimeout(processingTimerRef.current)
          processingTimerRef.current = window.setTimeout(() => {
            if (generationRef.current === generation && activeRef.current && recognitionRef.current === recognition) {
              setStatus(commandsPausedRef.current ? 'commands-paused' : 'listening')
            }
          }, PROCESSING_DISPLAY_MS)
        }
      }

      recognition.onerror = (event) => {
        if (generationRef.current !== generation || recognitionRef.current !== recognition) return
        const error = event.error || 'unknown'
        lastRecognitionErrorRef.current = error
        setIsListening(false)
        if (error === 'aborted' && !activeRef.current) return
        if (['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported'].includes(error)) {
          stopForUnavailable(getMicrophoneError(error))
          try {
            recognition.abort()
          } catch {
            recognitionRef.current = null
          }
          return
        }
        onFeedbackRef.current(getMicrophoneError(error), error === 'no-speech' ? 'info' : 'error')
      }

      recognition.onend = () => {
        if (recognitionRef.current === recognition) recognitionRef.current = null
        releaseSession()
        if (stopWaitRef.current?.recognition === recognition) stopWaitRef.current.resolve(true)
        if (generationRef.current !== generation || !activeRef.current) return
        if (pausedRef.current) return
        setIsListening(false)
        if (['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported'].includes(lastRecognitionErrorRef.current)) return
        scheduleRestart(lastRecognitionErrorRef.current
          ? 'Speech recognition ended after a recoverable error. Reconnecting…'
          : 'Speech recognition ended unexpectedly. Reconnecting…')
      }

      try {
        recognition.start()
      } catch {
        if (recognitionRef.current === recognition) recognitionRef.current = null
        releaseSession()
        scheduleRestart('The microphone session could not start. Voice control will retry; check browser microphone permission.')
      }
    }

    startRecognition()
    return true
  }, [])

  useEffect(() => () => {
    activeRef.current = false
    pausedRef.current = false
    commandsPausedRef.current = false
    setIsCommandsPaused(false)
    generationRef.current += 1
    window.clearTimeout(restartTimerRef.current)
    window.clearTimeout(processingTimerRef.current)
    const recognition = recognitionRef.current
    recognitionRef.current = null
    stopWaitRef.current?.resolve(false)
    try {
      recognition?.abort()
    } catch {
      // The browser may already have ended the recognition session.
    }
  }, [])

  const resumeListening = useCallback(async () => {
    if (!activeRef.current) return false
    if (suspensionPromiseRef.current && !await suspensionPromiseRef.current) return false
    if (!activeRef.current) return false
    return startListening()
  }, [startListening])

  return {
    supported,
    isListening,
    isActive,
    isCommandsPaused,
    status,
    startListening,
    stopListening,
    pauseCommands,
    resumeCommands,
    suspendListening,
    resumeListening,
  }
}
