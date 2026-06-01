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

// 国内可访问的CDN镜像列表
const CDN_SOURCES = [
  // jsDelivr 国内加速节点 (推荐)
  'https://fastly.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm',
  // 备用：jsDelivr 主节点
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm',
]

// 模型文件URL
const MODEL_URLS = [
  // 优先使用本地
  '/keep/models/hand_landmarker.task',
  // jsDelivr 国内加速
  'https://fastly.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm/hand_landmarker.task',
  // 备用：jsDelivr 主节点
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm/hand_landmarker.task',
]

export async function initHandDetector() {
  try {
    let vision = null
    let lastError = null

    // 尝试多个WASM源
    for (const wasmPath of CDN_SOURCES) {
      try {
        console.log(`📥 尝试加载WASM: ${wasmPath}`)
        vision = await FilesetResolver.forVisionTasks(wasmPath)
        console.log(`✅ WASM加载成功: ${wasmPath}`)
        break
      } catch (error) {
        lastError = error
        console.warn(`⚠️  WASM加载失败: ${wasmPath}`, error)
        continue
      }
    }

    if (!vision) {
      throw new Error(`无法加载MediaPipe WASM文件。错误: ${lastError}`)
    }

    // 尝试多个模型源
    let modelPath = null
    for (const url of MODEL_URLS) {
      try {
        console.log(`📥 尝试加载模型: ${url}`)
        // 测试URL可访问性
        const response = await fetch(url, { method: 'HEAD', mode: 'no-cors' })
        if (response.ok || response.status === 0) {
          modelPath = url
          console.log(`✅ 模型可访问: ${url}`)
          break
        }
      } catch (error) {
        console.warn(`⚠️  模型不可访问: ${url}`, error)
        continue
      }
    }

    if (!modelPath) {
      // 降级处理：使用jsDelivr的主节点
      modelPath = MODEL_URLS[MODEL_URLS.length - 1]
      console.warn(`⚠️  使用备用模型源: ${modelPath}`)
    }

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
