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

// WASM文件源列表 - 本地优先，CDN备用（按国内可访问性排序）
const WASM_SOURCES = [
  // 本地文件（最可靠，无需网络）
  '/models/wasm',
  '/keep/models/wasm',
  // jsDelivr Fastly CDN（国内速度较快）
  'https://fastly.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm',
  // jsDelivr 通用CDN
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm',
  // unpkg CDN
  'https://unpkg.com/@mediapipe/tasks-vision@0.10.8/wasm',
]

// 模型文件URL - 本地文件优先，CDN备用
const MODEL_URLS = [
  // 本地文件（部署时包含在构建中）
  '/models/hand_landmarker.task',
  '/keep/models/hand_landmarker.task',
  // unpkg CDN（国内访问相对较快）
  'https://unpkg.com/@mediapipe/tasks-vision@0.10.8/wasm/hand_landmarker.task',
  // jsDelivr 备用
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm/hand_landmarker.task',
]

export async function initHandDetector() {
  try {
    let vision = null
    let lastError = null

    // 尝试多个WASM源
    for (const wasmPath of WASM_SOURCES) {
      try {
        console.log(`📥 尝试加载WASM: ${wasmPath}`)
        vision = await FilesetResolver.forVisionTasks(wasmPath)
        console.log(`✅ WASM加载成功: ${wasmPath}`)
        break
      } catch (error) {
        lastError = error
        console.warn(`⚠️  WASM加载失败: ${wasmPath}`)
        continue
      }
    }

    if (!vision) {
      throw new Error(`无法加载MediaPipe WASM文件`)
    }

    // 尝试多个模型源
    let modelPath = null

    for (const url of MODEL_URLS) {
      try {
        console.log(`📥 测试模型源: ${url}`)

        const response = await fetch(url, {
          method: 'HEAD',
          mode: 'cors',
        })

        if (response.status === 200 || response.status === 0) {
          modelPath = url
          console.log(`✅ 模型源可用: ${url}`)
          break
        } else {
          console.warn(`⚠️  模型源返回 ${response.status}: ${url}`)
        }
      } catch (error) {
        console.warn(`⚠️  模型源检测失败: ${url}`)
        continue
      }
    }

    if (!modelPath) {
      // 使用最后一个备用源
      modelPath = MODEL_URLS[MODEL_URLS.length - 1]
      console.warn(`⚠️  使用备用模型源: ${modelPath}`)
    }

    console.log(`🔧 正在初始化HandLandmarker，模型路径: ${modelPath}`)

    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: modelPath
      },
      numHands: 2,
      runningMode: 'VIDEO'
    })

    isInitialized = true
    console.log('✅ Hand detector initialized successfully')
  } catch (error) {
    console.error('❌ Failed to initialize hand detector:', error)
    throw new Error(`Hand detector initialization failed: ${(error as Error).message}`)
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
