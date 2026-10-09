import { useCallback, useEffect, useRef, useState } from 'react'

const getRecognition = () => {
  if (typeof window === 'undefined') return null
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!Recognition) return null
  const recognition = new Recognition()
  recognition.continuous = false
  recognition.interimResults = false
  recognition.lang = 'en-US'
  return recognition
}

export function useVoiceCommands({ onCommand, onFeedback }) {
  const recognitionRef = useRef(null)
  const restartTimerRef = useRef(null)
  const enabledRef = useRef(false)
  const pausedRef = useRef(false)
  const intentionalStopRef = useRef(false)
  const [isListening, setIsListening] = useState(false)
  const supported = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
  const [status, setStatus] = useState(supported ? 'ready' : 'unsupported')
  const onCommandRef = useRef(onCommand)
  const onFeedbackRef = useRef(onFeedback)
  const startRecognitionRef = useRef(() => false)

  useEffect(() => {
    onCommandRef.current = onCommand
    onFeedbackRef.current = onFeedback
  }, [onCommand, onFeedback])

  const startRecognition = useCallback(() => {
    if (!enabledRef.current || pausedRef.current || recognitionRef.current) return false
    const recognition = getRecognition()
    if (!recognition) {
      setStatus('unsupported')
      return false
    }

    intentionalStopRef.current = false
    recognition.onstart = () => {
      setIsListening(true)
      setStatus('listening')
      onFeedbackRef.current('Listening… say a supported exam command.', 'info')
    }
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim()
      onCommandRef.current(transcript)
    }
    recognition.onerror = (event) => {
      setIsListening(false)
      recognitionRef.current = null
      if (event.error === 'aborted' && intentionalStopRef.current) return
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        enabledRef.current = false
        setStatus('stopped')
        onFeedbackRef.current('Microphone access was not allowed. Voice controls remain available when permission is granted.', 'error')
      } else {
        setStatus('error')
        onFeedbackRef.current('Voice recognition was interrupted. Try the command again.', 'error')
      }
    }
    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
      if (intentionalStopRef.current || !enabledRef.current) return
      if (pausedRef.current) {
        setStatus('paused')
        return
      }
      setStatus('ready')
      restartTimerRef.current = window.setTimeout(() => {
        restartTimerRef.current = null
        startRecognitionRef.current()
      }, 80)
    }
    recognitionRef.current = recognition
    setStatus('starting')
    try {
      recognition.start()
      return true
    } catch {
      recognitionRef.current = null
      setIsListening(false)
      setStatus('error')
      onFeedbackRef.current('Voice controls could not start. Please try again.', 'error')
      return false
    }
  }, [])

  useEffect(() => {
    startRecognitionRef.current = startRecognition
  }, [startRecognition])

  const startListening = useCallback(() => {
    if (!supported) {
      setStatus('unsupported')
      onFeedbackRef.current('Voice controls are not supported in this browser.', 'error')
      return false
    }
    enabledRef.current = true
    pausedRef.current = false
    intentionalStopRef.current = false
    return startRecognition()
  }, [startRecognition, supported])

  const stopListening = useCallback((message = 'Voice commands stopped.') => {
    enabledRef.current = false
    pausedRef.current = false
    intentionalStopRef.current = true
    if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current)
    restartTimerRef.current = null
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setIsListening(false)
    setStatus('stopped')
    if (message) onFeedbackRef.current(message, 'info')
  }, [])

  const pauseListening = useCallback(() => {
    if (!enabledRef.current) return
    pausedRef.current = true
    intentionalStopRef.current = true
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setIsListening(false)
    setStatus('paused')
  }, [])

  const resumeListening = useCallback(() => {
    if (!enabledRef.current) return
    pausedRef.current = false
    intentionalStopRef.current = false
    startRecognition()
  }, [startRecognition])

  useEffect(() => () => {
    enabledRef.current = false
    intentionalStopRef.current = true
    if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current)
    recognitionRef.current?.stop()
  }, [])

  return { supported, isListening, status, startListening, stopListening, pauseListening, resumeListening }
}
