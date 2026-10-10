import assert from 'node:assert/strict'
import test from 'node:test'
import { getLoginCameraErrorMessage } from '../hooks/useLoginFaceDetection.js'

test('login camera failures leave a usable no-camera alternative', () => {
  assert.match(getLoginCameraErrorMessage({ name: 'NotAllowedError' }), /permission was denied.*continue signing in/i)
  assert.match(getLoginCameraErrorMessage({ name: 'NotFoundError' }), /no camera was found.*continue signing in/i)
  assert.match(getLoginCameraErrorMessage(new Error('model failed')), /face detection could not start or continue.*continue without camera detection/i)
})
