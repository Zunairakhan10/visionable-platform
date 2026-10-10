import { useEffect } from 'react'
import { getCandidateId, recordMonitoringEvent } from '../services/monitoringEventStore'
import { createFaceDetector } from '../services/faceDetector.js'

const PRESENCE_STABILITY_MS = 1500
const DETECTION_INTERVAL_MS = 200

function getDetectionState(faceCount) {
  if (faceCount === 0) return 'CANDIDATE_ABSENT'
  if (faceCount === 1) return 'CANDIDATE_PRESENT'
  return 'MULTIPLE_PEOPLE_DETECTED'
}

function getCameraErrorMessage(error) {
  if (error?.name === 'NotSupportedError') {
    return 'Camera access is unavailable in this browser or page context. Use a supported browser over HTTPS; you can continue the exam.'
  }
  if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
    return 'Camera permission was denied. You can continue the exam, but camera presence monitoring is unavailable.'
  }
  if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
    return 'No camera was found. You can continue the exam, but camera presence monitoring is unavailable.'
  }
  if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') {
    return 'The camera could not be started. You can continue the exam, but camera presence monitoring is unavailable.'
  }
  return 'Camera monitoring could not start. You can continue the exam; check camera access and network connectivity, then try again.'
}

export function useCameraMonitoring(isActive, onFeedback) {
  useEffect(() => {
    if (!isActive) return undefined

    let cancelled = false
    let stream
    let video
    let detector
    let timeoutId
    let reportedState = null
    let pendingState = null
    let pendingSince = 0
    let cameraTrack
    let cameraEnded = false

    const stopStream = () => {
      stream?.getTracks().forEach((track) => track.stop())
      if (video) video.srcObject = null
    }

    const handleCameraEnded = () => {
      if (cancelled) return
      cameraEnded = true
      window.clearTimeout(timeoutId)
      detector?.close()
      detector = null
      stopStream()
      onFeedback('The camera connection ended. No candidate-absent event was recorded; camera monitoring is unavailable.', 'error')
    }

    const reportDetectionState = (state) => {
      if (reportedState === state) return

      reportedState = state
      recordMonitoringEvent({
        candidateId: getCandidateId(),
        type: state,
        timestamp: new Date().toISOString(),
        severity: state === 'CANDIDATE_PRESENT' ? 'info' : 'warning',
        status: state === 'CANDIDATE_PRESENT' ? 'logged' : 'needs_review',
      }).catch((error) => {
        onFeedback('A camera presence event could not be saved to the demo server. You can continue the exam.', 'error')
        console.error('Camera monitoring event could not be saved to the demo server.', error)
      })
    }

    const detectPresence = () => {
      if (cancelled || cameraEnded || !detector || !video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return

      const state = getDetectionState(detector.detectForVideo(video, performance.now()).detections.length)
      if (state !== pendingState) {
        pendingState = state
        pendingSince = performance.now()
      } else if (reportedState !== state && performance.now() - pendingSince >= PRESENCE_STABILITY_MS) {
        reportDetectionState(state)
      }
    }

    const runMonitoring = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          const error = new Error('Camera access is not supported in this browser or context.')
          error.name = 'NotSupportedError'
          throw error
        }

        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: 'user' },
        })
        if (cancelled) {
          stopStream()
          return
        }

        video = document.createElement('video')
        video.autoplay = true
        video.muted = true
        video.playsInline = true
        video.srcObject = stream
        cameraTrack = stream.getVideoTracks()[0]
        if (!cameraTrack) throw new Error('The camera stream has no video track.')
        cameraTrack.addEventListener('ended', handleCameraEnded)
        await video.play()
        if (cancelled || cameraEnded) return

        const loadedDetector = await createFaceDetector()
        if (cancelled || cameraEnded) {
          loadedDetector.close()
          stopStream()
          return
        }

        detector = loadedDetector
        onFeedback('Camera presence monitoring is active. Presence signals are for human review.', 'info')

        const processFrame = () => {
          if (cancelled) return
          try {
            detectPresence()
          } catch {
            if (!cancelled) {
              onFeedback('Camera monitoring stopped unexpectedly. A presence signal may not have been recorded; you can continue the exam.', 'error')
              detector?.close()
              detector = null
              stopStream()
            }
            return
          }
          timeoutId = window.setTimeout(processFrame, DETECTION_INTERVAL_MS)
        }

        processFrame()
      } catch (error) {
        if (!cancelled) {
          detector?.close()
          detector = null
          stopStream()
          onFeedback(getCameraErrorMessage(error), 'error')
        }
      }
    }

    void runMonitoring()

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
      cameraTrack?.removeEventListener('ended', handleCameraEnded)
      detector?.close()
      stopStream()
    }
  }, [isActive, onFeedback])
}
