import assert from 'node:assert/strict'
import test from 'node:test'
import { parseExamVoiceCommand } from './examVoiceCommands.js'

test('parses only short, explicit exam commands', () => {
  assert.equal(parseExamVoiceCommand('Next question').key, 'next')
  assert.equal(parseExamVoiceCommand('  GO TO NEXT QUESTION! ').key, 'next')
  assert.equal(parseExamVoiceCommand('choose option b').key, 'select-b')
  assert.equal(parseExamVoiceCommand('Repeat the question aloud.').key, 'read')
  assert.equal(parseExamVoiceCommand('Read available options').key, 'read-options')
  assert.equal(parseExamVoiceCommand('Read my answer').key, 'read-answer')
  assert.equal(parseExamVoiceCommand('Review unanswered questions').key, 'review-unanswered')
  assert.equal(parseExamVoiceCommand('mark for review').key, 'mark')
  assert.equal(parseExamVoiceCommand('submit exam').key, 'submit')
  assert.equal(parseExamVoiceCommand('stop voice control').key, 'stop-voice')
})

test('does not infer an action from unclear or extended speech', () => {
  assert.equal(parseExamVoiceCommand('maybe go to the next question'), null)
  assert.equal(parseExamVoiceCommand('select'), null)
  assert.equal(parseExamVoiceCommand('submit'), null)
  assert.equal(parseExamVoiceCommand('I want to choose option b'), null)
})

test('command keys map directly to the corresponding exam action types', () => {
  const actionTypes = [
    ['next question', 'next'],
    ['previous question', 'previous'],
    ['read question', 'read'],
    ['read options', 'read-options'],
    ['read selected answer', 'read-answer'],
    ['review unanswered questions', 'review-unanswered'],
    ['select option c', 'select-c'],
    ['stop voice control', 'stop-voice'],
  ]
  for (const [phrase, expectedAction] of actionTypes) {
    assert.equal(parseExamVoiceCommand(phrase)?.key, expectedAction)
  }
})
