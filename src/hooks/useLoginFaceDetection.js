import { useCallback, useEffect, useRef, useState } from 'react'
import { createFaceDetector } from '../services/faceDetector.js'

const DETECTION_INTERVAL_MS = 250
const DETECTION_STABILITY_MS = 700
const VIDEO_FRAME_TIMEOUT_MS = 10_000

export function getLoginCameraErrorMessage(error) {
  if (error?.name === 'NotSupportedError') {
    return 'Camera access is not supported in this browser or page. You can continue without camera detection.'
  }
  if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError' || error?.name === 'SecurityError') {
    return 'Camera permission was denied. You can continue signing in without camera detection.'
  }
  if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
    return 'No camera was found. You can continue signing in without camera detection.'
  }
  if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') {
    return 'The camera could not be started. Check that it is not in use by another app, or continue without camera detection.'
  }
  return 'Face detection could not start or continue. Check camera access and network connectivity, or continue without camera detection.'
}

export function useLoginFaceDetection(videoRef) {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const generationRef = useRef(0)
  const streamRef = useRef(null)
  const cameraTrackRef = useRef(null)
  const cameraEndedHandlerRef = useRef(null)
  const detectorRef = useRef(null)
  const timeoutRef = useRef(null)
  const pendingStatusRef = useRef('')
  const pendingSinceRef = useRef(0)
  const reportedStatusRef = useRef('')

  const releaseResources = useCallback(() => {
    window.clearTimeout(timeoutRef.current)
    timeoutRef.current = null
    cameraTrackRef.current?.removeEventListener('ended', cameraEndedHandlerRef.current)
    cameraTrackRef.current = null
    cameraEndedHandlerRef.current = null
    detectorRef.current?.close()
    detectorRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    pendingStatusRef.current = ''
    pendingSinceRef.current = 0
    reportedStatusRef.current = ''
  }, [videoRef])

  const fail = useCallback((generation, message) => {
    if (generationRef.current !== generation) return
    generationRef.current += 1
    releaseResources()
    setError(message)
    setStatus('error')
  }, [releaseResources])

  const startCamera = useCallback(async () => {
    if (['starting', 'detecting', 'face', 'no-face'].includes(status)) return false

    releaseResources()
    const generation = generationRef.current + 1
    generationRef.current = generation
    setError('')
    setStatus('starting')

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        const unsupportedError = new Error('Camera is not supported.')
        unsupportedError.name = 'NotSupportedError'
        throw unsupportedError
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user' },
      })
      if (generationRef.current !== generation) {
        stream.getTracks().forEach((track) => track.stop())
        return false
      }

      const video = videoRef.current
      if (!video) {
        stream.getTracks().forEach((track) => track.stop())
        throw new Error('Camera preview is unavailable.')
      }

      streamRef.current = stream
      const cameraTrack = stream.getVideoTracks()[0]
      if (!cameraTrack) throw new Error('The camera stream has no video track.')
      cameraTrackRef.current = cameraTrack
      const handleCameraEnded = () => {
        fail(generation, 'The camera connection ended. Restart the camera or continue signing in without it.')
      }
      cameraEndedHandlerRef.current = handleCameraEnded
      cameraTrack.addEventListener('ended', handleCameraEnded)
      video.srcObject = stream
      await video.play()
      if (generationRef.current !== generation) return false

      const detector = await createFaceDetector()
      if (generationRef.current !== generation) {
        detector.close()
        return false
      }
      detectorRef.current = detector
      setStatus('detecting')
      const frameWaitStartedAt = performance.now()

      const detectFrame = () => {
        if (generationRef.current !== generation) return
        try {
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            const faceCount = detector.detectForVideo(video, performance.now()).detections.length
            const nextStatus = faceCount > 0 ? 'face' : 'no-face'
            const now = performance.now()
            if (pendingStatusRef.current !== nextStatus) {
              pendingStatusRef.current = nextStatus
              pendingSinceRef.current = now
            } else if (reportedStatusRef.current !== nextStatus && now - pendingSinceRef.current >= DETECTION_STABILITY_MS) {
              reportedStatusRef.current = nextStatus
              setStatus(nextStatus)
            }
          } else if (performance.now() - frameWaitStartedAt >= VIDEO_FRAME_TIMEOUT_MS) {
            fail(generation, 'The camera preview did not provide video frames. Restart the camera or continue signing in without face detection.')
            return
          }
          timeoutRef.current = window.setTimeout(detectFrame, DETECTION_INTERVAL_MS)
        } catch {
          fail(generation, 'Face detection stopped unexpectedly. Restart the camera or continue signing in without it.')
        }
      }

      detectFrame()
      return true
    } catch (cameraError) {
      fail(generation, getLoginCameraErrorMessage(cameraError))
      return false
    }
  }, [fail, releaseResources, status, videoRef])

  const stopCamera = useCallback(() => {
    generationRef.current += 1
    releaseResources()
    setError('')
    setStatus('stopped')
    pendingStatusRef.current = ''
    reportedStatusRef.current = ''
  }, [releaseResources])

  useEffect(() => () => {
    generationRef.current += 1
    releaseResources()
  }, [releaseResources])

  return { status, error, startCamera, stopCamera }
}
