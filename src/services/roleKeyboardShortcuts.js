const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

export function getRoleShortcut(event) {
  if (!event || event.ctrlKey || event.altKey || event.metaKey || event.repeat) return null

  const key = event.key?.toLowerCase()
  if (key === 'c') return 'candidate'
  if (key === 'e') return 'examiner'
  return null
}

export function isTypingTarget(target) {
  if (!target) return false
  if (TYPING_TAGS.has(target.tagName) || target.isContentEditable) return true
  if (target.closest?.('[contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return true
  return false
}

export function getRoleShortcutDestination(shortcutRole, authenticatedRole) {
  if (shortcutRole === 'candidate') {
    return authenticatedRole === 'candidate'
      ? { view: 'exam', intent: 'candidate' }
      : { view: 'auth', intent: 'candidate' }
  }
  if (shortcutRole === 'examiner') {
    return authenticatedRole === 'examiner'
      ? { view: 'examiner', intent: 'examiner' }
      : { view: 'auth', intent: 'examiner' }
  }
  return null
}
