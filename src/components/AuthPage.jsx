import { useEffect, useRef, useState } from 'react'
import { getAuthClient } from '../services/authClient'
import {
  startEmailRecognition,
  EMAIL_RECOGNITION_FALLBACK_LANGUAGE,
  getEmailRecognitionErrorMessage,
  normalizeEmailTranscript,
} from '../services/emailDictation'
import './AuthPage.css'

function AuthPage({ intent, mode, onModeChange, onAuthenticated, onBack, onLogout, sessionActive, errorMessage }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('')
  const [voiceError, setVoiceError] = useState('')
  const recognitionRef = useRef(null)
  const clientConfigured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
  const SpeechRecognition = typeof window === 'undefined'
    ? undefined
    : window.SpeechRecognition || window.webkitSpeechRecognition
  const voiceSupported = Boolean(SpeechRecognition)
  const examinerIntent = intent === 'examiner'
  const isSignUp = mode === 'signup'
  const isRecovery = mode === 'recovery'
  const isForgotPassword = mode === 'forgot'

  const updateMode = (nextMode) => {
    const recognition = recognitionRef.current
    recognitionRef.current = null
    recognition?.abort()
    setIsListening(false)
    setVoiceStatus('')
    setVoiceError('')
    setError('')
    setMessage('')
    setPassword('')
    setConfirmPassword('')
    onModeChange(nextMode)
  }

  useEffect(() => () => {
    const recognition = recognitionRef.current
    recognitionRef.current = null
    recognition?.abort()
  }, [])

  const startEmailDictation = () => {
    if (recognitionRef.current) {
      setVoiceStatus('Voice input is already active.')
      return
    }

    setVoiceError('')
    setVoiceStatus('Starting microphone…')
    setIsListening(true)

    let recognition = null
    let transcriptAccepted = false
    let fallbackAttempted = false
    let languageUnsupported = false
    const handlers = {
      onStart: () => {
        setIsListening(true)
        setVoiceError('')
        setVoiceStatus('Listening… Speak your email address now.')
      },
      onTranscript: (transcript) => {
        const emailAddress = normalizeEmailTranscript(transcript)
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) {
          setVoiceError('Speech was detected, but it did not form a valid email address. Type or dictate it again.')
          setVoiceStatus('')
          return
        }

        transcriptAccepted = true
        setEmail(emailAddress)
        setVoiceError('')
        setVoiceStatus('Email recognized. Review and correct it before continuing.')
      },
      onError: (error) => {
        if (recognition && recognitionRef.current !== recognition) return
        if (error === 'language-not-supported' && !fallbackAttempted) {
          languageUnsupported = true
          setVoiceStatus('English (India) is unavailable. Trying English (United States) recognition.')
          return
        }
        setVoiceError(getEmailRecognitionErrorMessage(error))
        setIsListening(false)
        setVoiceStatus('')
        if (recognitionRef.current === recognition) recognitionRef.current = null
      },
      onEnd: ({ receivedResult, receivedError }) => {
        if (!recognition || recognitionRef.current !== recognition) return
        if (languageUnsupported && !fallbackAttempted) {
          fallbackAttempted = true
          languageUnsupported = false
          recognition.lang = EMAIL_RECOGNITION_FALLBACK_LANGUAGE
          setVoiceStatus('Trying English (United States) speech recognition.')
          try {
            recognition.start()
            return
          } catch {
            setVoiceError('English speech recognition could not start. Check microphone access or enter your email using the keyboard.')
            setVoiceStatus('')
            recognitionRef.current = null
            setIsListening(false)
            return
          }
        }
        if (!receivedResult && !receivedError) {
          setVoiceError('Listening ended without an email transcript. Check your microphone and try again, or enter your email using the keyboard.')
          setVoiceStatus('')
        } else if (receivedResult && transcriptAccepted) {
          setVoiceStatus('Listening stopped. Review and correct the recognized email before continuing.')
        }
        recognitionRef.current = null
        setIsListening(false)
      },
      onFallbackStart: () => {
        fallbackAttempted = true
        setVoiceStatus('Trying English (United States) speech recognition.')
      },
    }

    const startedRecognition = startEmailRecognition(SpeechRecognition, handlers, (createdRecognition) => {
      recognition = createdRecognition
      recognitionRef.current = createdRecognition
    })

    if (!startedRecognition) {
      recognitionRef.current = null
      setIsListening(false)
    }
  }

  const stopEmailDictation = () => {
    const recognition = recognitionRef.current
    recognitionRef.current = null
    setIsListening(false)
    setVoiceError('')
    setVoiceStatus('Stopping voice input…')
    try {
      recognition?.stop()
      setVoiceStatus('Voice input stopped.')
    } catch {
      setVoiceError('Voice input could not be stopped cleanly. You can continue using the keyboard.')
      setVoiceStatus('')
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if ((isSignUp || isRecovery) && password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const supabase = getAuthClient()
      if (isForgotPassword) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        })
        if (resetError) throw resetError
        setMessage('If an account exists for that email, password reset instructions have been sent.')
      } else if (isRecovery) {
        const { error: updateError } = await supabase.auth.updateUser({ password })
        if (updateError) throw updateError
        await supabase.auth.signOut()
        setPassword('')
        setConfirmPassword('')
        setMessage('Your password has been updated. Sign in with your new password.')
        onModeChange('login')
      } else if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
        if (signUpError) throw signUpError
        if (data.session) {
          await onAuthenticated(data.session)
        } else {
          setMessage('Check your email to confirm your account, then sign in to continue as a candidate.')
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
        if (!data.session) throw new Error('No authenticated session was returned.')
        await onAuthenticated(data.session)
      }
    } catch (submitError) {
      setError(submitError?.message || 'Authentication could not be completed. Please try again.')
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
          {isRecovery ? 'Choose a new password' : isForgotPassword ? 'Reset your password' : isSignUp ? 'Create a candidate account' : 'Sign in to VisionAble'}
        </h1>
        <p className="auth-description">
          {isSignUp
            ? 'Candidate accounts are created with candidate access. Examiner access is assigned separately by an administrator.'
            : examinerIntent
              ? 'Sign in with an examiner account provisioned by your administrator.'
              : 'Sign in or create an account to continue to the accessible examination.'}
        </p>

        {!clientConfigured && (
          <p className="auth-error" role="alert">
            Authentication is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the frontend environment.
          </p>
        )}
        {(errorMessage || error) && <p id="auth-error" className="auth-error" role="alert" aria-live="assertive">{errorMessage || error}</p>}
        {message && <p className="auth-message" role="status" aria-live="polite">{message}</p>}

        {!isRecovery && (
          <div className="auth-mode-tabs" role="group" aria-label="Authentication options">
            <button type="button" aria-pressed={!isSignUp && !isForgotPassword} onClick={() => updateMode('login')}>Sign in</button>
            {!examinerIntent && <button type="button" aria-pressed={isSignUp} onClick={() => updateMode('signup')}>Create candidate account</button>}
          </div>
        )}

        <form id="auth-form" className="auth-form" onSubmit={handleSubmit}>
          {!isRecovery && (
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
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={loading || !clientConfigured}
                  aria-describedby={`auth-email-voice-help${error || errorMessage ? ' auth-error' : ''}`}
                />
                <button
                  className="auth-voice-button"
                  type="button"
                  onClick={isListening ? stopEmailDictation : startEmailDictation}
                  aria-pressed={isListening}
                  aria-label={isListening ? 'Stop voice input for email' : 'Use microphone for email'}
                >
                  {isListening ? 'Stop voice input' : 'Use microphone for email'}
                </button>
              </div>
              <p className="auth-voice-help" id="auth-email-voice-help">
                {voiceSupported
                  ? 'Voice input uses your browser’s speech recognition. Audio handling depends on your browser; review the recognized email before submitting.'
                  : 'Voice email entry may not be supported in this browser. Activate the microphone button to check; keyboard entry is always available.'}
              </p>
              {(voiceStatus || voiceError) && (
                <p className={voiceError ? 'auth-voice-error' : 'auth-voice-status'} role={voiceError ? 'alert' : 'status'} aria-live={voiceError ? 'assertive' : 'polite'}>
                  {voiceError || voiceStatus}
                </p>
              )}
            </div>
          )}
          {!isForgotPassword && (
            <div className="auth-field">
              <label htmlFor="auth-password">{isRecovery ? 'New password' : 'Password'}</label>
              <input
                id="auth-password"
                name="password"
                type="password"
                autoComplete={isSignUp || isRecovery ? 'new-password' : 'current-password'}
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={loading || !clientConfigured}
                aria-describedby={`auth-password-help${error || errorMessage ? ' auth-error' : ''}`}
              />
              <p className="auth-hint" id="auth-password-help">
                Password voice dictation is not provided. Enter it with the keyboard or your operating system’s accessible text-entry tools; this page will not speak or log it.
              </p>
            </div>
          )}
          {(isSignUp || isRecovery) && (
            <div className="auth-field">
              <label htmlFor="auth-confirm-password">Confirm password</label>
              <input
                id="auth-confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={loading || !clientConfigured}
                aria-describedby={error || errorMessage ? 'auth-error' : undefined}
              />
            </div>
          )}
          <button className="auth-submit" type="submit" disabled={loading || !clientConfigured}>
            {loading ? 'Please wait…' : isRecovery ? 'Update password' : isForgotPassword ? 'Send reset instructions' : isSignUp ? 'Create candidate account' : 'Sign in'}
          </button>
        </form>

        {!isRecovery && !isForgotPassword && !isSignUp && (
          <button className="auth-text-button" type="button" onClick={() => updateMode('forgot')}>Forgot password?</button>
        )}
        {isForgotPassword && (
          <button className="auth-text-button" type="button" onClick={() => updateMode('login')}>Return to sign in</button>
        )}
        {isRecovery && (
          <p className="auth-hint">Use at least 8 characters. Your password remains masked while you type.</p>
        )}
        {sessionActive && (
          <button className="auth-text-button" type="button" onClick={onLogout}>Sign out of current account</button>
        )}
        <button className="auth-back" type="button" onClick={onBack}>Return to VisionAble</button>
      </section>
    </main>
  )
}

export default AuthPage
