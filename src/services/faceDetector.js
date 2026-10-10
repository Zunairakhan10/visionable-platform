export const FACE_DETECTOR_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'

export async function createFaceDetector() {
  const [
    { FaceDetector },
    { default: wasmLoaderPath },
    { default: wasmBinaryPath },
  ] = await Promise.all([
    import('@mediapipe/tasks-vision'),
    import('@mediapipe/tasks-vision/vision_wasm_internal.js?url'),
    import('@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'),
  ])

  return FaceDetector.createFromOptions(
    { wasmLoaderPath, wasmBinaryPath },
    {
      baseOptions: { modelAssetPath: FACE_DETECTOR_MODEL_URL },
      runningMode: 'VIDEO',
      minDetectionConfidence: 0.5,
    },
  )
}
