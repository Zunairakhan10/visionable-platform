import { useEffect } from 'react'
import { getCandidateId, recordMonitoringEvent } from '../services/monitoringEventStore'

const FACE_DETECTOR_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'
const PRESENCE_STABILITY_MS = 1500
const DETECTION_INTERVAL_MS = 200

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
    let reportedPresence = null
    let pendingPresence = null
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

    const reportPresence = (present) => {
      if (reportedPresence === present) return

      reportedPresence = present
      recordMonitoringEvent({
        candidateId: getCandidateId(),
        type: present ? 'CANDIDATE_PRESENT' : 'CANDIDATE_ABSENT',
        timestamp: new Date().toISOString(),
        severity: present ? 'info' : 'warning',
        status: present ? 'logged' : 'needs_review',
      })
    }

    const detectPresence = () => {
      if (cancelled || cameraEnded || !detector || !video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return

      const present = detector.detectForVideo(video, performance.now()).detections.length > 0
      if (present !== pendingPresence) {
        pendingPresence = present
        pendingSince = performance.now()
      } else if (reportedPresence !== present && performance.now() - pendingSince >= PRESENCE_STABILITY_MS) {
        reportPresence(present)
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

        const [
          { FaceDetector },
          { default: wasmLoaderPath },
          { default: wasmBinaryPath },
        ] = await Promise.all([
          import('@mediapipe/tasks-vision'),
          import('@mediapipe/tasks-vision/vision_wasm_internal.js?url'),
          import('@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'),
        ])

        const loadedDetector = await FaceDetector.createFromOptions(
          { wasmLoaderPath, wasmBinaryPath },
          {
            baseOptions: { modelAssetPath: FACE_DETECTOR_MODEL_URL },
            runningMode: 'VIDEO',
            minDetectionConfidence: 0.5,
          }
        )
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
