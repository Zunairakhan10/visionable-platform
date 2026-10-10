import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { loginCandidate, loginExaminer, registerCandidate } from '../services/demoAuth'
import { useLoginFaceDetection } from '../hooks/useLoginFaceDetection'
import {
  startEmailRecognitionAfterVoiceControl,
  EMAIL_RECOGNITION_MIN_LISTEN_MS,
  EMAIL_RECOGNITION_START_TIMEOUT_MS,
  getEmailRecognitionErrorMessage,
  isValidEmailTranscript,
  normalizeEmailTranscript,
} from '../services/emailDictation'
import { parseLoginVoiceCommand } from '../services/loginVoiceCommands'
import './AuthPage.css'

function AuthPage({ intent, mode, onModeChange, onSelectLoginIntent, onAuthenticated, onBack, onLogout, sessionActive, errorMessage, speech, voiceControl, registerVoiceCommandHandler }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isDictationStarting, setIsDictationStarting] = useState(false)
  const [isDictationProcessing, setIsDictationProcessing] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('Ready to dictate.')
  const [voiceError, setVoiceError] = useState('')
  const [speechDiagnostics, setSpeechDiagnostics] = useState({
    permission: 'checking',
    recognizer: 'idle',
    events: [],
    errorCode: 'none',
    endedWithoutResult: false,
  })
  const [microphoneTestStatus, setMicrophoneTestStatus] = useState('Not tested')
  const [microphoneTestRunning, setMicrophoneTestRunning] = useState(false)
  const [voiceControlMessage, setVoiceControlMessage] = useState('')
  const [recognizedVoicePhrase, setRecognizedVoicePhrase] = useState('')
  const [recognizedVoiceAction, setRecognizedVoiceAction] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const recognitionRef = useRef(null)
  const voiceControlRef = useRef(voiceControl)
  useLayoutEffect(() => {
    voiceControlRef.current = voiceControl
  }, [voiceControl])
  const dictationResultTimerRef = useRef(null)
  const dictationGenerationRef = useRef(0)
  const startupTimerRef = useRef(null)
  const recognitionStartedAtRef = useRef(null)
  const startupTimedOutRef = useRef(false)
  const microphoneTestStreamRef = useRef(null)
  const microphoneTestAudioContextRef = useRef(null)
  const dictationStartingRef = useRef(false)
  const dictationStoppedByUserRef = useRef(false)
  const lastFocusedFieldRef = useRef(null)
  const authFormRef = useRef(null)
  const errorMessageRef = useRef(null)
  const cameraVideoRef = useRef(null)
  const { supported: speechSupported, isSpeaking, isPaused, speak, pause, resume, stop } = speech
  const { status: cameraStatus, error: cameraError, startCamera, stopCamera } = useLoginFaceDetection(cameraVideoRef)
  const SpeechRecognition = typeof window === 'undefined'
    ? undefined
    : window.SpeechRecognition || window.webkitSpeechRecognition
  const voiceSupported = Boolean(SpeechRecognition)
  const diagnosticsEnabled = import.meta.env.DEV
  const examinerIntent = intent === 'examiner'
  const isSignUp = mode === 'signup'
  const instructions = `${examinerIntent ? 'Examiner demo sign-in.' : isSignUp ? 'Create a candidate account.' : 'Candidate sign-in.'} Available actions: say email field, password field, ${isSignUp ? 'confirm password field, create account,' : 'sign in,'} repeat instructions, or go back. Enter your email with the keyboard or use the microphone button, then review and correct any dictated email. Enter your password using the keyboard, a password manager, or a trusted operating-system input method. The application does not recognize, speak, or announce passwords. OS dictation availability and privacy depend on your device and settings. ${isSignUp ? 'Passwords must contain at least eight characters and match.' : 'Use the sign-in action when your required fields are complete.'} Camera access is optional.`
  useEffect(() => {
    speak(instructions)
  }, [instructions, speak])

  useEffect(() => {
    const message = errorMessage || error || voiceError
    if (message) speak(message)
  }, [errorMessage, error, speak, voiceError])

  useEffect(() => {
    if (errorMessage) window.setTimeout(() => errorMessageRef.current?.focus(), 0)
  }, [errorMessage])

  useEffect(() => {
    if (!diagnosticsEnabled) return undefined
    if (!navigator.permissions?.query) return undefined

    let active = true
    let permissionStatus
    let permissionChangeHandler
    navigator.permissions.query({ name: 'microphone' }).then((status) => {
      if (!active) return
      permissionStatus = status
      setSpeechDiagnostics((current) => ({ ...current, permission: status.state }))
      permissionChangeHandler = () => {
        setSpeechDiagnostics((current) => ({ ...current, permission: status.state }))
      }
      status.addEventListener('change', permissionChangeHandler)
    }).catch(() => {
      if (active) setSpeechDiagnostics((current) => ({ ...current, permission: 'unavailable' }))
    })

    return () => {
      active = false
      if (permissionChangeHandler) permissionStatus?.removeEventListener('change', permissionChangeHandler)
    }
  }, [diagnosticsEnabled, voiceSupported])

  useEffect(() => {
    if (cameraStatus === 'starting') speak('Starting camera and face detection.')
    if (cameraStatus === 'face') speak('Face detected in the camera preview.')
    if (cameraStatus === 'no-face') speak('No face detected in the camera preview.')
    if (cameraStatus === 'stopped') speak('Camera stopped.')
  }, [cameraStatus, speak])

  useEffect(() => {
    if (cameraError) speak(cameraError)
  }, [cameraError, speak])

  const updateMode = useCallback((nextMode) => {
    dictationGenerationRef.current += 1
    dictationStartingRef.current = false
    const recognition = recognitionRef.current
    recognitionRef.current = null
    recognition?.abort()
    setIsListening(false)
    setIsDictationStarting(false)
    setIsDictationProcessing(false)
    setVoiceStatus('Ready to dictate.')
    setVoiceError('')
    setError('')
    setPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    onModeChange(nextMode)
    speak(nextMode === 'signup' ? 'Create candidate account option selected.' : 'Sign in option selected.')
  }, [onModeChange, speak])

  const navigateFields = (direction) => {
    const fields = ['auth-email', 'auth-password', ...(isSignUp ? ['auth-confirm-password'] : []), 'auth-submit']
    const activeIndex = fields.indexOf(document.activeElement?.id)
    const currentIndex = activeIndex === -1 ? fields.indexOf(lastFocusedFieldRef.current) : activeIndex
    const nextIndex = currentIndex === -1
      ? (direction > 0 ? 0 : fields.length - 1)
      : (currentIndex + direction + fields.length) % fields.length
    document.getElementById(fields[nextIndex])?.focus()
  }

  const submitVoiceForm = useCallback(() => {
    const form = authFormRef.current
    if (!form) return
    const invalidField = form.querySelector(':invalid')
    if (invalidField) {
      const message = invalidField.validity.valueMissing
        ? `${invalidField.labels?.[0]?.textContent || 'This field'} is required.`
        : invalidField.validity.typeMismatch
          ? 'Enter a valid email address.'
          : invalidField.validity.tooShort
            ? 'Password must be at least eight characters long.'
            : 'Check this field and try again.'
      setError(message)
      invalidField.focus()
      return
    }
    if (isSignUp && password !== confirmPassword) {
      setError('The passwords do not match.')
      document.getElementById('auth-confirm-password')?.focus()
      return
    }
    form.requestSubmit()
  }, [confirmPassword, isSignUp, password])

  const announceInvalidField = (event) => {
    const input = event.currentTarget
    const label = input.labels?.[0]?.textContent || 'This field'
    const message = input.validity.valueMissing
      ? `${label} is required.`
      : input.validity.typeMismatch
        ? 'Enter a valid email address.'
        : input.validity.tooShort
          ? `${label} must contain at least 8 characters.`
          : `Check ${label.toLowerCase()} and try again.`
    setError(message)
  }

  useEffect(() => () => {
    dictationGenerationRef.current += 1
    window.clearTimeout(startupTimerRef.current)
    window.clearTimeout(dictationResultTimerRef.current)
    const recognition = recognitionRef.current
    recognitionRef.current = null
    recognition?.abort()
    microphoneTestStreamRef.current?.getTracks().forEach((track) => track.stop())
    void microphoneTestAudioContextRef.current?.close()
    voiceControlRef.current.resumeListening()
  }, [])

  const startEmailDictation = async () => {
    if (dictationStartingRef.current || recognitionRef.current) {
      setVoiceStatus('Voice input is already active.')
      return
    }

    dictationStartingRef.current = true
    const requestId = dictationGenerationRef.current + 1
    dictationGenerationRef.current = requestId
    dictationStoppedByUserRef.current = false
    setIsDictationStarting(true)
    setVoiceError('')
    setVoiceStatus('Requesting microphone permission…')
    recognitionStartedAtRef.current = null
    startupTimedOutRef.current = false
    setSpeechDiagnostics((current) => ({
      ...current,
      recognizer: 'waiting-for-voice-control-stop',
      events: [],
      errorCode: 'none',
      endedWithoutResult: false,
    }))
    setIsListening(false)
    setIsDictationProcessing(false)

    let recognition = null
    const handlers = {
      onStart: () => {
        window.clearTimeout(startupTimerRef.current)
        recognitionStartedAtRef.current = Date.now()
        dictationStartingRef.current = false
        setIsDictationStarting(false)
        setIsListening(true)
        setVoiceError('')
        setVoiceStatus('Listening — speak your email address now.')
        setSpeechDiagnostics((current) => ({ ...current, recognizer: 'listening' }))
      },
      onTranscript: (transcript) => {
        window.clearTimeout(dictationResultTimerRef.current)
        dictationResultTimerRef.current = window.setTimeout(() => {
          const emailAddress = normalizeEmailTranscript(transcript)
          setEmail(emailAddress)
          setIsDictationProcessing(false)
          if (!isValidEmailTranscript(emailAddress)) {
            setVoiceError('The recognized text needs correction. Edit the email address or dictate it again.')
            setVoiceStatus('')
            return
          }

          setVoiceError('')
          setVoiceStatus('Email recognized. Review and edit it before continuing.')
        }, 100)
      },
      onProcessing: () => {
        setIsListening(false)
        setIsDictationProcessing(true)
        setVoiceError('')
        setVoiceStatus('Processing recognized speech…')
      },
      onError: (error, metadata = {}) => {
        if (recognition && recognitionRef.current !== recognition) return
        window.clearTimeout(startupTimerRef.current)
        if (startupTimedOutRef.current) return
        const startedAt = metadata.startedAt ?? recognitionStartedAtRef.current
        const elapsedMs = metadata.elapsedMs ?? (startedAt === null ? 0 : Date.now() - startedAt)
        const earlyNoSpeech = error === 'no-speech'
          && (startedAt === null || elapsedMs < EMAIL_RECOGNITION_MIN_LISTEN_MS)
        setVoiceError(earlyNoSpeech
          ? 'Speech recognition stopped before listening long enough to detect speech. Start again and wait for the listening indicator.'
          : getEmailRecognitionErrorMessage(error))
        setIsDictationStarting(false)
        setIsDictationProcessing(false)
        setIsListening(false)
        setVoiceStatus('')
      },
      onDiagnostic: (event) => {
        setSpeechDiagnostics((current) => ({
          ...current,
          recognizer: event.state || current.recognizer,
          events: event.event
            ? [...current.events.filter((name) => name !== event.event), event.event]
            : current.events,
          errorCode: event.error || current.errorCode,
          endedWithoutResult: event.event === 'end' ? !event.receivedResult : current.endedWithoutResult,
        }))
        if (event.event === 'start-requested') {
          startupTimerRef.current = window.setTimeout(() => {
            if (dictationGenerationRef.current !== requestId || !recognitionRef.current || recognitionStartedAtRef.current !== null) return
            startupTimedOutRef.current = true
            dictationStartingRef.current = false
            setIsDictationStarting(false)
            setIsListening(false)
            setVoiceError('Speech recognition did not start. Check browser permission and microphone access, or enter your email using the keyboard.')
            setSpeechDiagnostics((current) => ({ ...current, recognizer: 'start-timeout' }))
            const currentRecognition = recognitionRef.current
            try {
              currentRecognition?.abort()
            } catch {
              setSpeechDiagnostics((current) => ({ ...current, recognizer: 'start-timeout-abort-failed' }))
            }
          }, EMAIL_RECOGNITION_START_TIMEOUT_MS)
        }
        if (event.event === 'start' || event.event === 'start-failed' || event.event === 'end') {
          window.clearTimeout(startupTimerRef.current)
        }
      },
      onEnd: ({ receivedResult, receivedError, startedAt, elapsedMs }) => {
        if (!recognition) return
        if (recognitionRef.current !== recognition) {
          if (!dictationStartingRef.current && !recognitionRef.current) voiceControl.resumeListening()
          return
        }
        if (startupTimedOutRef.current) {
          setVoiceStatus('')
        } else if (dictationStoppedByUserRef.current) {
          setVoiceStatus('Voice input stopped. You can start dictation again or edit the email.')
        } else if (!receivedResult && !receivedError) {
          setVoiceError(startedAt === null
            ? 'Speech recognition ended before it confirmed listening. Check browser support and microphone permission, then try again.'
            : elapsedMs < EMAIL_RECOGNITION_MIN_LISTEN_MS
              ? 'Speech recognition ended too soon to listen reliably. Try again and wait for the listening indicator.'
              : getEmailRecognitionErrorMessage('no-speech'))
          setVoiceStatus('')
        }
        recognitionRef.current = null
        dictationStartingRef.current = false
        setIsDictationStarting(false)
        setIsListening(false)
        if (!receivedResult) setIsDictationProcessing(false)
        voiceControl.resumeListening()
      },
    }

    const startedRecognition = await startEmailRecognitionAfterVoiceControl({
      stopVoiceControl: () => voiceControl.suspendListening('email dictation'),
      SpeechRecognition,
      handlers,
      onCreated: (createdRecognition) => {
        recognition = createdRecognition
        recognitionRef.current = createdRecognition
      },
      onDiagnostic: handlers.onDiagnostic,
      shouldStart: () => dictationGenerationRef.current === requestId,
    })

    if (dictationGenerationRef.current !== requestId) return
    if (!startedRecognition) {
      recognitionRef.current = null
      dictationStartingRef.current = false
      setIsDictationStarting(false)
      setIsDictationProcessing(false)
      setIsListening(false)
      voiceControl.resumeListening()
    }
  }

  const stopEmailDictation = () => {
    dictationGenerationRef.current += 1
    dictationStartingRef.current = false
    window.clearTimeout(startupTimerRef.current)
    const recognition = recognitionRef.current
    recognitionRef.current = null
    dictationStoppedByUserRef.current = true
    setIsListening(false)
    setVoiceError('')
    setVoiceStatus('Voice input stopped. You can start dictation again or edit the email.')
    try {
      recognition?.stop()
    } catch {
      setVoiceError('Voice input could not be stopped cleanly. You can continue using the keyboard.')
    }
    dictationStartingRef.current = false
    setIsDictationStarting(false)
    setIsDictationProcessing(false)
  }

  const testMicrophone = async () => {
    if (microphoneTestRunning) return
    const resumeVoiceControl = voiceControl.isActive
    setMicrophoneTestRunning(true)
    setMicrophoneTestStatus('Requesting local microphone access…')
    let stream
    let audioContext
    try {
      if (resumeVoiceControl && !await voiceControl.suspendListening('microphone test')) {
        throw new Error('microphone-busy')
      }
      if (!window.isSecureContext) {
        throw new Error('secure-context-required')
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('microphone-api-unsupported')
      }
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      microphoneTestStreamRef.current = stream
      setSpeechDiagnostics((current) => ({ ...current, permission: 'granted' }))

      const AudioContextConstructor = window.AudioContext || window.webkitAudioContext
      if (!AudioContextConstructor) {
        setMicrophoneTestStatus('Microphone access works; audio-level measurement is not supported in this browser.')
        return
      }

      audioContext = new AudioContextConstructor()
      microphoneTestAudioContextRef.current = audioContext
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 512
      audioContext.createMediaStreamSource(stream).connect(analyser)
      const samples = new Uint8Array(analyser.fftSize)
      let maxLevel = 0
      for (let sampleIndex = 0; sampleIndex < 12; sampleIndex += 1) {
        analyser.getByteTimeDomainData(samples)
        const rms = Math.sqrt(samples.reduce((sum, sample) => sum + (sample - 128) ** 2, 0) / samples.length)
        maxLevel = Math.max(maxLevel, rms)
        if (sampleIndex < 11) await new Promise((resolve) => window.setTimeout(resolve, 100))
      }
      setMicrophoneTestStatus(maxLevel > 1.5
        ? 'Microphone access works and local audio-level changes were detected. No audio was recorded or uploaded.'
        : 'Microphone access works, but little audio-level change was detected. Check the selected microphone and speak during the test.')
    } catch (testError) {
      const errorName = testError?.name || testError?.message
      if (errorName === 'NotAllowedError' || errorName === 'SecurityError') {
        setSpeechDiagnostics((current) => ({ ...current, permission: 'denied' }))
        setMicrophoneTestStatus('Microphone permission denied. Allow it in browser settings or use keyboard entry.')
      } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError' || errorName === 'NotReadableError' || errorName === 'microphone-busy') {
        setMicrophoneTestStatus('Microphone unavailable or busy. Connect a microphone and close other apps using it.')
      } else if (errorName === 'secure-context-required') {
        setMicrophoneTestStatus('Microphone testing requires HTTPS or localhost. Keyboard entry remains available.')
      } else if (errorName === 'microphone-api-unsupported') {
        setMicrophoneTestStatus('Local microphone testing is unsupported in this browser.')
      } else {
        setMicrophoneTestStatus('Microphone test failed. Check browser permissions and device access.')
      }
    } finally {
      stream?.getTracks().forEach((track) => track.stop())
      if (microphoneTestStreamRef.current === stream) microphoneTestStreamRef.current = null
      if (audioContext) {
        await audioContext.close().catch(() => {
          setMicrophoneTestStatus('Microphone test finished, but the browser could not close its audio analyzer cleanly.')
        })
        if (microphoneTestAudioContextRef.current === audioContext) microphoneTestAudioContextRef.current = null
      }
      setMicrophoneTestRunning(false)
      if (resumeVoiceControl) voiceControl.resumeListening()
    }
  }

  const handleLoginVoiceCommand = useCallback((transcript) => {
    setRecognizedVoicePhrase(transcript)
    const command = parseLoginVoiceCommand(transcript, 'form')
    if (!command) {
      setRecognizedVoiceAction('No login action matched.')
      speak('I did not understand that login command. Try email field, password field, sign in, create account, repeat instructions, go back, or stop voice control.')
      return
    }

    setRecognizedVoiceAction(`Action: ${command.label}`)
    switch (command.key) {
      case 'candidate-login':
        onSelectLoginIntent?.('candidate')
        if (mode === 'signup') updateMode('login')
        document.getElementById('auth-email')?.focus()
        speak('Candidate sign-in selected. Email address field.')
        break
      case 'examiner-login':
        onSelectLoginIntent?.('examiner')
        updateMode('login')
        document.getElementById('auth-email')?.focus()
        speak('Examiner demo sign-in selected. Email address field. Enter the password using your keyboard or trusted password manager.')
        break
      case 'signup':
        onSelectLoginIntent?.('candidate')
        if (isSignUp) submitVoiceForm()
        else {
          updateMode('signup')
          document.getElementById('auth-email')?.focus()
        }
        break
      case 'email-field':
        document.getElementById('auth-email')?.focus()
        break
      case 'password-field':
        document.getElementById('auth-password')?.focus()
        break
      case 'confirm-password-field':
        if (isSignUp) document.getElementById('auth-confirm-password')?.focus()
        else speak('Password confirmation is available only when creating a candidate account.')
        break
      case 'submit-login':
        if (isSignUp) {
          speak('You are creating a candidate account. Say create account to submit it.')
        } else {
          submitVoiceForm()
        }
        break
      case 'create-account':
        if (isSignUp) submitVoiceForm()
        else {
          onSelectLoginIntent?.('candidate')
          updateMode('signup')
          document.getElementById('auth-email')?.focus()
        }
        break
      case 'go-back':
        onBack()
        break
      case 'read-instructions':
        speak(instructions)
        break
      case 'start-camera':
        if (intent === 'examiner' || mode === 'signup') {
          speak('The optional camera face check is available on candidate sign-in only.')
        } else {
          void startCamera()
        }
        break
      case 'stop-camera':
        stopCamera()
        break
      case 'stop-voice':
        voiceControl.stopListening()
        break
      default:
        break
    }
  }, [intent, instructions, isSignUp, mode, onBack, onSelectLoginIntent, speak, startCamera, stopCamera, submitVoiceForm, updateMode, voiceControl])

  useLayoutEffect(() => registerVoiceCommandHandler('auth', handleLoginVoiceCommand), [handleLoginVoiceCommand, registerVoiceCommandHandler])

  const startLoginVoiceControl = () => {
    if (isListening || isDictationStarting || isDictationProcessing) {
      setVoiceControlMessage('Stop email dictation before starting voice control.')
      speak('Stop email dictation before starting voice control.')
      return
    }
    voiceControl.startListening()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (isSignUp && examinerIntent) {
      setError('Examiner access is separate. Candidate registration cannot create examiner accounts.')
      return
    }

    if (isSignUp && password !== confirmPassword) {
      setError('The passwords do not match.')
      document.getElementById('auth-confirm-password')?.focus()
      return
    }

    setLoading(true)
    try {
      const session = isSignUp
        ? await registerCandidate(email, password)
        : examinerIntent
          ? await loginExaminer(email, password)
          : await loginCandidate(email, password)
      await onAuthenticated(session)
    } catch (submitError) {
      setError(submitError?.message || 'Authentication could not be completed. Please try again.')
      window.setTimeout(() => errorMessageRef.current?.focus(), 0)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-screen" id="main">
      <a className="skip-link" href="#auth-form">Skip to sign in form</a>
      <section className="auth-card" aria-labelledby="auth-heading">
        <button className="auth-brand" type="button" onClick={onBack} aria-label="Return to VisionAble home">
          <span className="brand-mark" aria-hidden="true">V</span>
          <span>VISION<span>ABLE</span></span>
        </button>
        <span className="section-kicker">{examinerIntent ? 'EXAMINER ACCESS' : 'CANDIDATE ACCESS'}</span>
        <h1 id="auth-heading">
          {isSignUp ? 'Create a candidate account' : examinerIntent ? 'Examiner demo sign-in' : 'Sign in to VisionAble'}
        </h1>
        <p className="auth-description" id="auth-page-instructions">
          {isSignUp
            ? 'Create a demo account for the candidate examination. Candidate registration always receives candidate access.'
            : examinerIntent
              ? 'Use the shared examiner demo credentials below. This demo sign-in is for demonstration only and must not protect real exams.'
              : 'Sign in or create an account to continue to the accessible examination.'}
        </p>
        {!examinerIntent && (
          <section className="auth-camera" aria-labelledby="auth-camera-heading">
            <h2 id="auth-camera-heading">Optional camera face check</h2>
            <p>Face detection is for camera feedback only. It does not sign you in. You can continue without allowing camera access.</p>
            <div className="auth-camera-actions">
              <button type="button" onClick={() => { void startCamera() }} disabled={['starting', 'detecting', 'face', 'no-face'].includes(cameraStatus)}>Start camera</button>
              <button type="button" onClick={stopCamera} disabled={!['starting', 'detecting', 'face', 'no-face'].includes(cameraStatus)}>Stop camera</button>
            </div>
            <div className={`auth-camera-preview ${['starting', 'detecting', 'face', 'no-face'].includes(cameraStatus) ? 'is-visible' : ''}`}>
              <video ref={cameraVideoRef} muted playsInline aria-label="Live camera preview for optional face detection" />
            </div>
            <p className="auth-camera-status" role="status" aria-live="polite">
              {cameraStatus === 'idle' && 'Camera is off. Camera access is optional.'}
              {cameraStatus === 'starting' && 'Starting camera and loading face detection…'}
              {cameraStatus === 'detecting' && 'Camera is on. Checking for a face…'}
              {cameraStatus === 'face' && 'Face detected in camera preview.'}
              {cameraStatus === 'no-face' && 'No face detected in camera preview.'}
              {cameraStatus === 'stopped' && 'Camera is off. You can continue signing in.'}
              {cameraStatus === 'error' && cameraError}
            </p>
          </section>
        )}
        <section className="auth-speech-controls" aria-label="Spoken login guidance">
          <div className="auth-speech-actions">
            <button type="button" onClick={() => speak(instructions)} disabled={!speechSupported}>Repeat instructions</button>
            <button type="button" onClick={isPaused ? resume : pause} disabled={!speechSupported || !isSpeaking} aria-label={isPaused ? 'Resume spoken guidance' : 'Pause spoken guidance'}>
              {isPaused ? 'Resume guidance' : 'Pause guidance'}
            </button>
            <button type="button" onClick={stop} disabled={!speechSupported || (!isSpeaking && !isPaused)}>Stop guidance</button>
          </div>
          {!speechSupported && <p role="status">Spoken guidance is unavailable in this browser. All instructions and controls remain available as text and by keyboard or screen reader.</p>}
          {speechSupported && <p>Spoken guidance uses your browser. Passwords are never spoken.</p>}
        </section>
        <nav className="auth-field-navigation" aria-label="Login field navigation">
          <button type="button" onClick={() => navigateFields(-1)}>Previous field</button>
          <button type="button" onClick={() => navigateFields(1)}>Next field</button>
          <span>Use Tab and Shift+Tab to navigate, or choose an account option below.</span>
        </nav>

        {examinerIntent && (
          <p className="auth-hint">
            Sign in with the examiner credentials configured for this environment.
          </p>
        )}
        {(errorMessage || error) && <p ref={errorMessageRef} id="auth-error" className="auth-error" role="alert" aria-live="assertive" tabIndex="-1">{errorMessage || error}</p>}

        <section className="auth-voice-control" aria-labelledby="auth-voice-control-heading">
          <div>
            <h2 id="auth-voice-control-heading">Voice Control</h2>
            <p>Start explicitly to keep listening for login commands. The browser may ask for microphone permission. Passwords are never dictated or spoken. Continuous recognition varies by browser.</p>
          </div>
          <div className="auth-voice-control-actions">
            <button type="button" onClick={startLoginVoiceControl} disabled={!voiceControl.supported || voiceControl.isActive || microphoneTestRunning || isDictationStarting || isDictationProcessing}>{voiceControl.status === 'unavailable' ? 'Restart Voice Control' : 'Start Voice Control'}</button>
            {voiceControl.isActive && !['pausing', 'paused', 'microphone-paused'].includes(voiceControl.status) && <button type="button" onClick={voiceControl.isCommandsPaused ? voiceControl.resumeCommands : voiceControl.pauseCommands}>{voiceControl.isCommandsPaused ? 'Resume Voice Commands' : 'Pause Voice Commands'}</button>}
            {voiceControl.isActive && <button type="button" onClick={voiceControl.stopListening}>Stop Microphone</button>}
          </div>
          <p className={`auth-voice-control-status ${['unsupported', 'unavailable'].includes(voiceControl.status) ? 'is-error' : ''}`} role="status" aria-live="polite">
            {voiceControl.status === 'ready' && 'Ready. Voice control is off.'}
            {voiceControl.status === 'starting' && 'Requesting microphone permission…'}
            {voiceControl.status === 'listening' && 'Listening for login commands.'}
            {voiceControl.status === 'processing' && 'Processing command…'}
            {voiceControl.status === 'recovering' && 'Reconnecting to speech recognition…'}
            {voiceControl.status === 'pausing' && 'Pausing recognition before the microphone is handed off…'}
            {voiceControl.status === 'commands-paused' && 'Voice commands paused. The microphone remains on for resume and stop-microphone only.'}
            {voiceControl.status === 'paused' && 'Recognition is temporarily suspended and is not listening.'}
            {voiceControl.status === 'microphone-paused' && 'Recognition is suspended and is not using the microphone.'}
            {voiceControl.status === 'stopped' && 'Voice control stopped.'}
            {voiceControl.status === 'unsupported' && 'Speech recognition is not supported in this browser. Use keyboard or screen-reader controls.'}
            {voiceControl.status === 'unavailable' && (voiceControlMessage || 'Voice control is unavailable. Use keyboard or screen-reader controls.')}
          </p>
          {voiceControl.supported && <p className="auth-voice-control-help">Try “Pause voice control”, then “Resume voice control” to continue. While paused, only resume and “Stop microphone” are accepted. Email dictation temporarily takes the microphone and voice commands resume afterward when supported. “Stop microphone” requires the labeled button for reactivation.</p>}
          {recognizedVoicePhrase && <p className="auth-voice-control-recognized" aria-live="polite">Recognized: “{recognizedVoicePhrase}”. {recognizedVoiceAction}</p>}
          {voiceControlMessage && voiceControl.status !== 'unavailable' && <p className="auth-voice-control-help" role="status" aria-live="polite">{voiceControlMessage}</p>}
        </section>

        {!examinerIntent && (
          <div className="auth-mode-tabs" role="group" aria-label="Authentication options">
            <button type="button" aria-pressed={!isSignUp} onClick={() => updateMode('login')} onFocus={() => speak('Sign in option.')}>Sign in</button>
            <button type="button" aria-pressed={isSignUp} onClick={() => updateMode('signup')} onFocus={() => speak('Create candidate account option.')}>Create candidate account</button>
          </div>
        )}

        <form ref={authFormRef} id="auth-form" className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="auth-email">Email address</label>
            <div className="auth-email-entry">
              <input
                id="auth-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => { setEmail(event.target.value); setError('') }}
                disabled={loading || isDictationStarting || isDictationProcessing || microphoneTestRunning}
                aria-describedby={`auth-email-voice-help${error || errorMessage ? ' auth-error' : ''}`}
                onFocus={() => speak('Email address. Enter your email address, or use the microphone to dictate it. Review and correct dictated text before continuing.')}
                onFocusCapture={(event) => { lastFocusedFieldRef.current = event.target.id }}
                onInvalid={announceInvalidField}
              />
              <button
                className="auth-voice-button"
                type="button"
                onClick={isListening ? stopEmailDictation : () => { void startEmailDictation() }}
                aria-pressed={isListening}
                aria-label={isListening ? 'Stop voice input for email' : isDictationStarting ? 'Requesting microphone permission for email dictation' : isDictationProcessing ? 'Processing recognized email speech' : 'Use microphone for email'}
                disabled={loading || isDictationStarting || isDictationProcessing || microphoneTestRunning}
              >
                {isListening ? 'Stop voice input' : isDictationStarting ? 'Requesting microphone…' : isDictationProcessing ? 'Processing speech…' : 'Use microphone for email'}
              </button>
            </div>
            <p className="auth-voice-help" id="auth-email-voice-help">
              {voiceSupported
                ? 'Voice input uses your browser’s speech recognition. Audio handling depends on your browser; review the recognized email before submitting.'
                : 'Voice email entry may not be supported in this browser. Activate the microphone button to check; keyboard entry is always available.'}
            </p>
            <p className={voiceError ? 'auth-voice-error' : `auth-voice-status${isListening ? ' is-listening' : ''}`} role={voiceError ? 'alert' : 'status'} aria-live={voiceError ? 'assertive' : 'polite'}>
              {isListening && <span className="auth-listening-indicator" aria-hidden="true" />}
              {voiceError || voiceStatus || (!voiceSupported && getEmailRecognitionErrorMessage('unsupported'))}
            </p>
            {diagnosticsEnabled && (
              <details className="auth-speech-diagnostics">
                <summary>Development speech diagnostics</summary>
                <dl>
                  <div><dt>Speech recognition API</dt><dd>{voiceSupported ? 'Supported' : 'Not supported'}</dd></div>
                  <div><dt>Secure context</dt><dd>{window.isSecureContext ? 'Yes' : 'No'}</dd></div>
                  <div><dt>Microphone permission</dt><dd>{navigator.permissions?.query ? speechDiagnostics.permission : 'unavailable'}</dd></div>
                  <div><dt>Recognizer state</dt><dd>{speechDiagnostics.recognizer}</dd></div>
                  <div><dt>Audio/speech events</dt><dd>{speechDiagnostics.events.join(', ') || 'None yet'}</dd></div>
                  <div><dt>Recognition error code</dt><dd>{speechDiagnostics.errorCode}</dd></div>
                  <div><dt>Ended without result</dt><dd>{speechDiagnostics.endedWithoutResult ? 'Yes' : 'No'}</dd></div>
                </dl>
                <button
                  type="button"
                  onClick={() => { void testMicrophone() }}
                  disabled={microphoneTestRunning || isListening || isDictationStarting || isDictationProcessing}
                >
                  {microphoneTestRunning ? 'Testing microphone…' : 'Test microphone'}
                </button>
                <p role="status" aria-live="polite">{microphoneTestStatus}</p>
                <p>The test checks local audio levels only. It does not record, save, or upload audio.</p>
              </details>
            )}
          </div>
          <div className="auth-field">
            <label htmlFor="auth-password">Password</label>
            <div className="auth-password-entry">
              <input
                id="auth-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                minLength={8}
                required
                value={password}
                onChange={(event) => { setPassword(event.target.value); setError('') }}
                disabled={loading}
                aria-describedby={`auth-password-help${error || errorMessage ? ' auth-error' : ''}`}
                onFocus={() => {
                  void voiceControl.suspendListening('password entry')
                  speak('Password field. Voice control is paused to protect your password. Enter it with the keyboard, a trusted password manager, or a trusted operating-system input method.')
                }}
                onBlur={() => voiceControl.resumeListening()}
                onFocusCapture={(event) => { lastFocusedFieldRef.current = event.target.id }}
                onInvalid={announceInvalidField}
              />
              <button
                className="auth-visibility-button"
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-pressed={showPassword}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="auth-hint" id="auth-password-help">
              {examinerIntent
                ? 'Use a keyboard or trusted password manager. Voice control pauses when this field receives focus and may resume when focus leaves. The application does not provide password dictation or speak password values.'
                : 'Passwords must be at least 8 characters. Candidate passwords are stored on the demo server only as salted hashes. Voice control pauses when this field receives focus and may resume when focus leaves. The application does not provide password dictation. Operating-system input tools may have separate privacy behavior.'}
            </p>
          </div>
          {isSignUp && (
            <div className="auth-field">
              <label htmlFor="auth-confirm-password">Confirm password</label>
              <input
                id="auth-confirm-password"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmPassword}
                onChange={(event) => { setConfirmPassword(event.target.value); setError('') }}
                disabled={loading}
                aria-describedby={error || errorMessage ? 'auth-error' : undefined}
                onFocus={() => {
                  void voiceControl.suspendListening('password confirmation entry')
                  speak('Confirm password field. Voice control is paused to protect your password. Re-enter it with the keyboard, a trusted password manager, or a trusted operating-system input method.')
                }}
                onBlur={() => voiceControl.resumeListening()}
                onInvalid={announceInvalidField}
                onFocusCapture={(event) => { lastFocusedFieldRef.current = event.target.id }}
              />
            </div>
          )}
          <button className="auth-submit" id="auth-submit" type="submit" disabled={loading} onFocus={() => { lastFocusedFieldRef.current = 'auth-submit' }}>
            {loading ? 'Please wait…' : isSignUp ? 'Create candidate account' : 'Sign in'}
          </button>
        </form>

        {sessionActive && (
          <button className="auth-text-button" type="button" onClick={onLogout}>Sign out of current account</button>
        )}
        <button className="auth-back" type="button" onClick={onBack}>Return to VisionAble</button>
      </section>
    </main>
  )
}

export default AuthPage
