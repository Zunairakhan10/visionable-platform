import { useCallback, useEffect, useRef, useState } from 'react'

export function useSpeechSynthesis() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const utteranceIdRef = useRef(0)

  const stop = useCallback(() => {
    if (!supported) return
    utteranceIdRef.current += 1
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
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

    const utteranceId = utteranceIdRef.current + 1
    utteranceIdRef.current = utteranceId
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
    setIsPaused(false)

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.9
    utterance.onstart = () => {
      if (utteranceId !== utteranceIdRef.current) return
      setIsSpeaking(true)
      setIsPaused(false)
    }
    utterance.onpause = () => {
      if (utteranceId === utteranceIdRef.current) setIsPaused(true)
    }
    utterance.onresume = () => {
      if (utteranceId === utteranceIdRef.current) setIsPaused(false)
    }
    utterance.onend = () => {
      if (utteranceId !== utteranceIdRef.current) return
      setIsSpeaking(false)
      setIsPaused(false)
      onEnd?.()
    }
    utterance.onerror = () => {
      if (utteranceId !== utteranceIdRef.current) return
      setIsSpeaking(false)
      setIsPaused(false)
      onEnd?.()
    }

    window.speechSynthesis.speak(utterance)
    return true
  }, [supported])

  useEffect(() => () => {
    if (supported) window.speechSynthesis.cancel()
  }, [supported])

  return { supported, isSpeaking, isPaused, speak, pause, resume, stop }
}
