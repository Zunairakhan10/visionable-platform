import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getRoleShortcut,
  getRoleShortcutDestination,
  isTypingTarget,
} from './roleKeyboardShortcuts.js'

test('recognizes lowercase and uppercase C and E', () => {
  assert.equal(getRoleShortcut({ key: 'c' }), 'candidate')
  assert.equal(getRoleShortcut({ key: 'C', shiftKey: true }), 'candidate')
  assert.equal(getRoleShortcut({ key: 'e' }), 'examiner')
  assert.equal(getRoleShortcut({ key: 'E', shiftKey: true }), 'examiner')
})

test('ignores unrelated keys, modifiers, and repeated keydown events', () => {
  for (const event of [
    { key: 'x' },
    { key: 'c', ctrlKey: true },
    { key: 'E', altKey: true, shiftKey: true },
    { key: 'e', metaKey: true },
    { key: 'c', repeat: true },
  ]) {
    assert.equal(getRoleShortcut(event), null)
  }
})

test('ignores editable and form-control targets', () => {
  for (const target of [
    { tagName: 'INPUT' },
    { tagName: 'TEXTAREA' },
    { tagName: 'SELECT' },
    { tagName: 'DIV', isContentEditable: true },
    { tagName: 'SPAN', closest: () => ({}) },
  ]) {
    assert.equal(isTypingTarget(target), true)
  }
  assert.equal(isTypingTarget({ tagName: 'BUTTON' }), false)
})

test('routes only matching authenticated roles directly to protected views', () => {
  assert.deepEqual(getRoleShortcutDestination('candidate', 'candidate'), {
    view: 'exam',
    intent: 'candidate',
  })
  assert.deepEqual(getRoleShortcutDestination('examiner', 'examiner'), {
    view: 'examiner',
    intent: 'examiner',
  })
  assert.deepEqual(getRoleShortcutDestination('examiner', 'candidate'), {
    view: 'auth',
    intent: 'examiner',
  })
  assert.deepEqual(getRoleShortcutDestination('candidate', 'examiner'), {
    view: 'auth',
    intent: 'candidate',
  })
  assert.deepEqual(getRoleShortcutDestination('candidate', null), {
    view: 'auth',
    intent: 'candidate',
  })
  assert.deepEqual(getRoleShortcutDestination('examiner', null), {
    view: 'auth',
    intent: 'examiner',
  })
  assert.equal(getRoleShortcutDestination('admin', 'admin'), null)
})
