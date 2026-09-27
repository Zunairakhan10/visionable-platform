import { useEffect, useState } from 'react'

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const seconds = (totalSeconds % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

function ExamTimer({ durationMinutes, isRunning, onTimeUp }) {
  const [remainingSeconds, setRemainingSeconds] = useState(durationMinutes * 60)

  useEffect(() => {
    if (!isRunning || remainingSeconds <= 0) return undefined

    const timerId = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timerId)
          onTimeUp()
          return 0
        }
        return current - 1
      })
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [isRunning, onTimeUp, remainingSeconds])

  const isUrgent = remainingSeconds <= 300

  return (
    <div className={`exam-timer ${isUrgent ? 'is-urgent' : ''}`} aria-live="polite">
      <span className="timer-label">Time remaining</span>
      <strong aria-label={`${Math.floor(remainingSeconds / 60)} minutes ${remainingSeconds % 60} seconds remaining`}>
        {formatTime(remainingSeconds)}
      </strong>
    </div>
  )
}

export default ExamTimer
