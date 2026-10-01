import { useEffect } from 'react'

export function useExamMonitoring(onEvent) {
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        onEvent({
          type: 'FOCUS_LOST',
          timestamp: new Date().toISOString(),
          severity: 'warning',
          status: 'needs_review',
        })
      } else {
        onEvent({
          type: 'FOCUS_RESTORED',
          timestamp: new Date().toISOString(),
          severity: 'info',
          status: 'logged',
        })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      )
    }
  }, [onEvent])
}