import { useEffect } from 'react'
import { getCandidateId, recordMonitoringEvent } from '../services/monitoringEventStore'

const ACTIVITY_THRESHOLD = 0.035
const SUSTAINED_ACTIVITY_MS = 1500
const QUIET_PERIOD_MS = 1000
const DETECTION_INTERVAL_MS = 100

function getMicrophoneErrorMessage(error) {
  if (error?.name === 'NotSupportedError' || error?.name === 'SecurityError') {
    return 'Microphone access is unavailable in this browser or page context. Use a supported browser over HTTPS; you can continue the exam.'
  }

  if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
    return 'Microphone permission was denied. You can continue the exam, but audio activity monitoring is unavailable.'
  }
  if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
    return 'No microphone was found. You can continue the exam, but audio activity monitoring is unavailable.'
  }
  if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') {
    return 'The microphone could not be started. You can continue the exam, but audio activity monitoring is unavailable.'
  }
  return 'Audio monitoring could not start. You can continue the exam; check microphone access, then try again.'
}

export function useAudioMonitoring(isActive, onFeedback) {
  useEffect(() => {
    if (!isActive) return undefined

    let cancelled = false
    let stream
    let audioContext
    let microphoneTrack
    let intervalId

    const stopMonitoring = () => {
      window.clearInterval(intervalId)
      microphoneTrack?.removeEventListener('ended', handleMicrophoneEnded)
      stream?.getTracks().forEach((track) => track.stop())
      if (audioContext && audioContext.state !== 'closed') {
        void audioContext.close().catch((error) => {
          console.error('Audio monitoring could not close its AudioContext.', error)
        })
      }
    }

    const handleMicrophoneEnded = () => {
      if (cancelled) return
      stopMonitoring()
      onFeedback('The microphone connection ended. You can continue the exam, but audio activity monitoring is unavailable.', 'error')
    }

    const runMonitoring = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
          const error = new Error('Microphone access is not supported in this browser or context.')
          error.name = 'NotSupportedError'
          throw error
        }

        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        if (cancelled) {
          stopMonitoring()
          return
        }

        microphoneTrack = stream.getAudioTracks()[0]
        if (!microphoneTrack) throw new Error('The microphone stream has no audio track.')
        microphoneTrack.addEventListener('ended', handleMicrophoneEnded)

        audioContext = new window.AudioContext()
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 2048
        const samples = new Uint8Array(analyser.fftSize)
        const microphone = audioContext.createMediaStreamSource(stream)
        microphone.connect(analyser)
        if (audioContext.state === 'suspended') await audioContext.resume()
        if (cancelled) {
          stopMonitoring()
          return
        }

        let activityStartedAt = null
        let lastActivityAt = null
        let eventRecorded = false

        intervalId = window.setInterval(() => {
          if (cancelled) return

          try {
            analyser.getByteTimeDomainData(samples)
            let squaredSum = 0
            for (const sample of samples) {
              const amplitude = (sample - 128) / 128
              squaredSum += amplitude * amplitude
            }

            const isActive = Math.sqrt(squaredSum / samples.length) >= ACTIVITY_THRESHOLD
            const now = performance.now()
            if (isActive) {
              if (activityStartedAt === null) activityStartedAt = now
              lastActivityAt = now

              if (!eventRecorded && now - activityStartedAt >= SUSTAINED_ACTIVITY_MS) {
                eventRecorded = true
                try {
                  recordMonitoringEvent({
                    candidateId: getCandidateId(),
                    type: 'VOICE_ACTIVITY_DETECTED',
                    timestamp: new Date().toISOString(),
                    severity: 'warning',
                    status: 'needs_review',
                  })
                } catch (error) {
                  onFeedback('Audio activity was detected, but the monitoring event could not be saved.', 'error')
                  console.error('Audio monitoring event could not be recorded.', error)
                }
              }
            } else if (lastActivityAt !== null && now - lastActivityAt >= QUIET_PERIOD_MS) {
              activityStartedAt = null
              lastActivityAt = null
              eventRecorded = false
            }
          } catch (error) {
            if (!cancelled) {
              stopMonitoring()
              onFeedback('Audio monitoring stopped unexpectedly. You can continue the exam.', 'error')
              console.error('Audio monitoring stopped unexpectedly.', error)
            }
          }
        }, DETECTION_INTERVAL_MS)
      } catch (error) {
        if (!cancelled) {
          stopMonitoring()
          onFeedback(getMicrophoneErrorMessage(error), 'error')
        }
      }
    }

    void runMonitoring()

    return () => {
      cancelled = true
      stopMonitoring()
    }
  }, [isActive, onFeedback])
}
