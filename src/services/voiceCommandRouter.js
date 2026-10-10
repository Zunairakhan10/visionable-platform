export function createVoiceCommandRouter() {
  let activeRegistration = null

  return {
    register(screen, handler) {
      const registration = { screen, handler }
      activeRegistration = registration
      return () => {
        if (activeRegistration === registration) activeRegistration = null
      }
    },
    dispatch(currentScreen, ...args) {
      if (!activeRegistration || activeRegistration.screen !== currentScreen) return false
      activeRegistration.handler(...args)
      return true
    },
  }
}
