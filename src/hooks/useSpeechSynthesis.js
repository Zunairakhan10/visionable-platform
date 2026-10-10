import { useCallback, useEffect, useRef, useState } from 'react'

export function useSpeechSynthesis() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const utteranceRef = useRef(null)

  const stop = useCallback(() => {
    if (!supported) return
    utteranceRef.current = null
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
    setIsPaused(false)
  }, [supported])

  const pause = useCallback(() => {
    if (!supported || !window.speechSynthesis.speaking) return
    window.speechSynthesis.pause()
    setIsPaused(true)
  }, [supported])

  const resume = useCallback(() => {
    if (!supported || !window.speechSynthesis.paused) return
    window.speechSynthesis.resume()
    setIsPaused(false)
  }, [supported])

  const pause = useCallback(() => {
    if (!supported || !isSpeaking || isPaused) return
    window.speechSynthesis.pause()
    setIsPaused(true)
  }, [isPaused, isSpeaking, supported])

  const resume = useCallback(() => {
    if (!supported || !isSpeaking || !isPaused) return
    window.speechSynthesis.resume()
    setIsPaused(false)
  }, [isPaused, isSpeaking, supported])

  const speak = useCallback((text, { onEnd } = {}) => {
    if (!supported) return false
    utteranceRef.current = null
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
    setIsPaused(false)

    const utterance = new SpeechSynthesisUtterance(text)
    utteranceRef.current = utterance
    utterance.rate = 0.9
    utterance.onstart = () => {
      if (utteranceRef.current !== utterance) return
      setIsSpeaking(true)
      setIsPaused(false)
    }
    utterance.onend = () => {
      if (utteranceRef.current !== utterance) return
      utteranceRef.current = null
      setIsSpeaking(false)
      setIsPaused(false)
    }
    utterance.onerror = () => {
      if (utteranceRef.current !== utterance) return
      utteranceRef.current = null
      setIsSpeaking(false)
      setIsPaused(false)
    }
    setIsSpeaking(false)
    setIsPaused(false)
    window.speechSynthesis.speak(utterance)
    return true
  }, [supported])

  useEffect(() => () => {
    if (supported) {
      utteranceRef.current = null
      window.speechSynthesis.cancel()
    }
  }, [supported])

  return { supported, isSpeaking, isPaused, speak, pause, resume, stop }
}
