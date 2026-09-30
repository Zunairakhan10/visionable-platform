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
  const intentionalStopRef = useRef(false)
  const [isListening, setIsListening] = useState(false)
  const supported = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
  const [status, setStatus] = useState(supported ? 'ready' : 'unsupported')

  const stopListening = useCallback(() => {
    intentionalStopRef.current = true
    recognitionRef.current?.stop()
    setIsListening(false)
    setStatus('stopped')
    onFeedback('Voice commands stopped.', 'info')
  }, [onFeedback])

  const startListening = useCallback(() => {
    if (!supported) {
      setStatus('unsupported')
      onFeedback('Voice controls are not supported in this browser.', 'error')
      return false
    }

    if (isListening) return true

    const recognition = getRecognition()
    if (!recognition) {
      setStatus('unsupported')
      onFeedback('Voice controls are not supported in this browser.', 'error')
      return false
    }

    intentionalStopRef.current = false
    setStatus('starting')
    recognition.onstart = () => {
      setIsListening(true)
      setStatus('listening')
      onFeedback('Listening… say a supported exam command.', 'info')
    }
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim()
      onCommand(transcript)
    }
    recognition.onerror = (event) => {
      setIsListening(false)
      if (event.error === 'aborted' && intentionalStopRef.current) return
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setStatus('stopped')
        onFeedback('Microphone access was not allowed. Voice controls remain available when permission is granted.', 'error')
      } else {
        setStatus('stopped')
        onFeedback('Sorry, command not recognized. Try: “Next question”.', 'error')
      }
    }
    recognition.onend = () => {
      setIsListening(false)
      if (!intentionalStopRef.current && status !== 'stopped') setStatus('ready')
    }
    recognitionRef.current = recognition

    try {
      recognition.start()
      return true
    } catch {
      setIsListening(false)
      setStatus('stopped')
      onFeedback('Voice controls could not start. Please try again.', 'error')
      return false
    }
  }, [isListening, onCommand, onFeedback, status, supported])

  useEffect(() => () => {
    intentionalStopRef.current = true
    recognitionRef.current?.stop()
  }, [])

  return { supported, isListening, status, startListening, stopListening }
}
