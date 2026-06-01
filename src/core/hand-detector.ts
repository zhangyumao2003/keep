import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

export interface HandLandmark {
  x: number
  y: number
  z: number
  visibility: number
}

export interface Hand {
  landmarks: HandLandmark[]
  handedness: string
  confidence: number
}

export interface DetectionResult {
  hands: Hand[]
  timestamp: number
}

let handLandmarker: HandLandmarker | null = null
let isInitialized = false

export async function initHandDetector() {
  try {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm'
    )

    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-studio/latest/hand_landmarker.task'
      },
      numHands: 2,
      runningMode: 'VIDEO'
    })

    isInitialized = true
    console.log('✅ Hand detector initialized')
  } catch (error) {
    console.error('❌ Failed to initialize hand detector:', error)
    throw error
  }
}

export function detectHands(videoElement: HTMLVideoElement): DetectionResult {
  if (!handLandmarker || !isInitialized) {
    throw new Error('Hand detector not initialized')
  }

  const now = performance.now()
  const result = handLandmarker.detectForVideo(videoElement, now)

  return {
    hands: result.landmarks.map((landmarks, idx) => ({
      landmarks: landmarks.map(lm => ({
        x: lm.x,
        y: lm.y,
        z: lm.z ?? 0,
        visibility: lm.visibility ?? 1
      })),
      handedness: result.handednesses?.[idx]?.[0]?.categoryName ?? 'Unknown',
      confidence: result.handednesses?.[idx]?.[0]?.score ?? 0
    })),
    timestamp: now
  }
}

export function getHandDetector() {
  return handLandmarker
}
