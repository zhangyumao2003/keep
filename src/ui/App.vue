<template>
  <div class="iron-man-container">
    <canvas ref="canvas" class="canvas"></canvas>

    <div class="hud-overlay">
      <div class="hud-corner top-left">
        <div class="hud-text">HAND TRACKER</div>
        <div class="hud-info">FPS: {{ fps }}</div>
      </div>

      <div class="hud-corner top-right">
        <div class="hud-text">SYSTEM STATUS</div>
        <div class="hud-info">{{ detectionStatus }}</div>
        <div class="hud-info">Hands: {{ detectedHands }}</div>
      </div>

      <div class="hud-corner bottom-left">
        <div v-for="(gesture, idx) in gestures" :key="idx" class="gesture-info">
          {{ gesture.hand }}: {{ gesture.type }}
        </div>
      </div>

      <div class="hud-center">
        <div class="crosshair"></div>
      </div>
    </div>

    <ModulePanel
      :visible="panelVisible"
      :modules="moduleStore.modules"
      :hoveredModuleId="hoveredModuleId"
      :selectedModuleId="selectedModuleId"
    />

    <div v-if="!initialized" class="loading-screen">
      <div class="loading-text">{{ loadingMessage }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
import { initHandDetector, detectHands, Hand } from '../core/hand-detector'
import { recognizeGestures, Gesture } from '../core/gesture-recognizer'
import { SceneManager } from '../rendering/scene-manager'
import { ManipulationController } from '../interaction/manipulation-controller'
import { SwipeDetector } from '../core/swipe-detector'
import { PluginManager } from '../plugins/plugin-interface'
import { ParticlePlugin } from '../plugins/builtin/particle-plugin'
import { useModuleStore } from '../stores/module-store'
import ModulePanel from './ModulePanel.vue'

const canvas = ref<HTMLCanvasElement | null>(null)
const initialized = ref(false)
const loadingMessage = ref('初始化中...')
const fps = ref(0)
const detectionStatus = ref('Ready')
const detectedHands = ref(0)
const gestures = ref<Gesture[]>([])
const panelVisible = ref(false)
const hoveredModuleId = ref<string | null>(null)
const selectedModuleId = ref<string | null>(null)

let sceneManager: SceneManager | null = null
let manipulationController: ManipulationController | null = null
let swipeDetector: SwipeDetector | null = null
let pluginManager: PluginManager | null = null
let videoElement: HTMLVideoElement | null = null
let animationId: number | null = null
let lastTime = performance.now()
let frameCount = 0
let hoverTimer: number | null = null

// Hand persistence: keep last known hands when tracking is lost at screen edges
let lastHands: Hand[] = []
let lastGestures: Gesture[] = []
let lastHandsTimestamp = 0
const HAND_PERSIST_MS = 1000

const moduleStore = useModuleStore()

async function init() {
  try {
    loadingMessage.value = '步骤1/5: 加载AI手部检测模型...'

    if (!canvas.value) {
      throw new Error('Canvas not found')
    }

    // Initialize hand detector
    await initHandDetector()
    loadingMessage.value = '步骤2/5: 请求摄像头权限...'

    // Setup video
    videoElement = document.createElement('video')
    videoElement.setAttribute('autoplay', 'true')
    videoElement.setAttribute('playsinline', 'true')
    videoElement.setAttribute('muted', 'true')
    videoElement.style.display = 'none'
    document.body.appendChild(videoElement)

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
    })
    videoElement.srcObject = stream

    loadingMessage.value = '步骤3/5: 初始化3D引擎...'

    // Initialize scene
    sceneManager = new SceneManager(canvas.value)
    manipulationController = new ManipulationController()
    swipeDetector = new SwipeDetector()

    loadingMessage.value = '步骤4/5: 加载特效插件...'

    // Initialize plugin system
    pluginManager = new PluginManager()
    await pluginManager.register(new ParticlePlugin())

    // Add some demo objects
    const cube1 = sceneManager.createCube(0.2, 0x00ff9f)
    sceneManager.addObject(cube1, new THREE.Vector3(0, 0, -0.5))

    const cube2 = sceneManager.createCube(0.15, 0xff00ff)
    sceneManager.addObject(cube2, new THREE.Vector3(0.3, 0.3, -0.5))

    loadingMessage.value = '步骤5/5: 启动摄像头采集...'
    initialized.value = true

    // 等待视频元数据加载完成
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('视频加载超时')), 10000)
      videoElement!.onloadedmetadata = () => {
        clearTimeout(timeout)
        resolve(undefined)
      }
      if (videoElement!.readyState >= 1) {
        clearTimeout(timeout)
        resolve(undefined)
      }
    })

    // 播放视频（需要await因为浏览器可能阻止自动播放）
    try {
      await videoElement.play()
      console.log('✅ 摄像头视频流已启动')
    } catch (playError) {
      console.warn('⚠️ 视频播放被浏览器限制:', playError)
      // 某些浏览器需要用户交互才能播放，继续执行
    }

    console.log('🚀 启动主循环')
    animate()
  } catch (error) {
    const err = error as Error
    console.error('❌ 初始化失败:', err.message, err.stack)
    loadingMessage.value = `初始化失败\n步骤: ${loadingMessage.value}\n错误: ${err.message}\n\n请按F12打开控制台查看详情`
    detectionStatus.value = 'Error'
  }
}

function onModuleSelect(moduleId: string) {
  const mod = moduleStore.modules.find(m => m.id === moduleId)
  if (!mod || !sceneManager) return

  const obj = mod.createObject()
  // Place at origin (within hand's reachable z range)
  sceneManager.addObject(obj, new THREE.Vector3(0, 0, -0.5))
  selectedModuleId.value = moduleId
  console.log(`📦 Module added: ${mod.name}`)
}

function animate() {
  animationId = requestAnimationFrame(animate)

  if (!sceneManager || !manipulationController || !videoElement || !pluginManager || !swipeDetector) return

  try {
    const now = performance.now()

    // 确保视频已准备好
    if (videoElement.readyState < 2) {
      // 视频还没准备好，跳过这帧
      sceneManager.render()
      return
    }

    // Detect hands
    const result = detectHands(videoElement)

    // Persist last known hands for edge recovery (1s grace period)
    if (result.hands.length > 0) {
      lastHands = result.hands
      lastGestures = recognizeGestures(result.hands)
      lastHandsTimestamp = now
    }
    const handsLost = result.hands.length === 0 && lastHands.length > 0
    const inGracePeriod = now - lastHandsTimestamp < HAND_PERSIST_MS
    const effectiveHands = result.hands.length > 0
      ? result.hands
      : (handsLost && inGracePeriod ? lastHands : [])

    detectedHands.value = effectiveHands.length
    detectionStatus.value = effectiveHands.length > 0
      ? (handsLost ? 'Tracking (cached)' : 'Tracking')
      : 'Searching'

    // Recognize gestures (use effective hands)
    const newGestures = recognizeGestures(effectiveHands)
    // When using cached hands, also use cached gestures
    const effectiveGestures = result.hands.length > 0
      ? newGestures
      : (handsLost && inGracePeriod ? lastGestures : [])
    gestures.value = effectiveGestures

    // Update scene (render skeleton with effective hands)
    sceneManager.updateHands(effectiveHands)

    // Natural pinch-to-manipulate
    effectiveHands.forEach((hand, idx) => {
      manipulationController!.update(effectiveGestures[idx], hand, sceneManager!)
    })

    // Swipe detection for module panel
    const swipeState = swipeDetector!.update(effectiveHands, now)
    panelVisible.value = swipeState.shouldShowPanel

    // Canvas z-index: raise above panel so hand skeleton is visible on top
    if (canvas.value) {
      if (panelVisible.value) {
        canvas.value.style.zIndex = '501'
        canvas.value.style.pointerEvents = 'none' // let elementFromPoint see panel below
      } else {
        canvas.value.style.zIndex = ''
        canvas.value.style.pointerEvents = ''
      }
    }

    // Panel module hover detection
    if (panelVisible.value && effectiveHands.length > 0) {
      // Use the first hand's index tip for hover position
      const tip = effectiveHands[0].landmarks[8]
      const sx = tip.x * window.innerWidth
      const sy = tip.y * window.innerHeight

      // Check if finger is over the panel area (left 260px)
      if (sx < 260 && sx > 0 && sy > 0 && sy < window.innerHeight) {
        const el = document.elementFromPoint(sx, sy)
        const moduleItem = el?.closest('[data-module-id]')
        const newHoveredId = moduleItem?.getAttribute('data-module-id') ?? null

        if (newHoveredId !== hoveredModuleId.value) {
          // Hover target changed — reset timer
          hoveredModuleId.value = newHoveredId
          if (hoverTimer) {
            clearTimeout(hoverTimer)
            hoverTimer = null
          }
          selectedModuleId.value = null
        }

        // Auto-select on sustained hover (500ms)
        if (newHoveredId && newHoveredId !== selectedModuleId.value) {
          if (!hoverTimer) {
            hoverTimer = window.setTimeout(() => {
              onModuleSelect(newHoveredId)
              hoverTimer = null
            }, 500)
          }
        }
      } else {
        // Finger outside panel area
        if (hoveredModuleId.value !== null) {
          hoveredModuleId.value = null
          selectedModuleId.value = null
          if (hoverTimer) {
            clearTimeout(hoverTimer)
            hoverTimer = null
          }
        }
      }
    } else {
      // Panel not visible
      if (hoveredModuleId.value !== null) {
        hoveredModuleId.value = null
        selectedModuleId.value = null
        if (hoverTimer) {
          clearTimeout(hoverTimer)
          hoverTimer = null
        }
      }
    }

    // Update plugins
    const deltaTime = now - lastTime
    pluginManager.update({
      scene: sceneManager.getScene(),
      camera: sceneManager.getCamera(),
      renderer: sceneManager.getRenderer(),
      hands: effectiveHands,
      gestures: effectiveGestures,
      deltaTime,
      timestamp: now
    })

    // Render
    sceneManager.render()

    // FPS calculation
    frameCount++
    if (now - lastTime > 1000) {
      fps.value = frameCount
      frameCount = 0
      lastTime = now
    }
  } catch (error) {
    console.error('Animation error:', error)
    detectionStatus.value = `Error: ${(error as Error).message}`
  }
}

onMounted(async () => {
  await init()
})

onUnmounted(async () => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  if (videoElement && videoElement.srcObject) {
    const stream = videoElement.srcObject as MediaStream
    stream.getTracks().forEach(track => track.stop())
  }
  if (pluginManager) {
    await pluginManager.cleanup()
  }
})
</script>

<style scoped>
.iron-man-container {
  width: 100%;
  height: 100%;
  position: relative;
  background: linear-gradient(135deg, #0a0e27 0%, #1a2a47 100%);
  overflow: hidden;
}

.canvas {
  width: 100%;
  height: 100%;
  display: block;
  position: relative;
}

.loading-screen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(10, 14, 39, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-text {
  font-size: 24px;
  color: #00ff9f;
  text-shadow: 0 0 10px rgba(0, 255, 159, 0.8);
  animation: glow 2s ease-in-out infinite;
}

@keyframes glow {
  0%, 100% { text-shadow: 0 0 10px rgba(0, 255, 159, 0.8); }
  50% { text-shadow: 0 0 20px rgba(0, 255, 159, 1); }
}

.hud-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.hud-corner {
  position: absolute;
  padding: 20px;
  border: 2px solid rgba(0, 255, 159, 0.5);
  background: rgba(10, 14, 39, 0.7);
  backdrop-filter: blur(5px);
  box-shadow: inset 0 0 10px rgba(0, 255, 159, 0.1), 0 0 20px rgba(0, 255, 159, 0.2);
}

.top-left {
  top: 20px;
  left: 20px;
  min-width: 200px;
}

.top-right {
  top: 20px;
  right: 20px;
  min-width: 200px;
}

.bottom-left {
  bottom: 20px;
  left: 20px;
  max-width: 300px;
}

.hud-text {
  font-size: 14px;
  color: #00ff9f;
  text-shadow: 0 0 5px rgba(0, 255, 159, 0.8);
  margin-bottom: 10px;
  font-weight: bold;
  letter-spacing: 2px;
}

.hud-info {
  font-size: 12px;
  color: #00ff9f;
  margin: 5px 0;
  opacity: 0.8;
}

.gesture-info {
  font-size: 11px;
  color: #ff00ff;
  margin: 3px 0;
  padding: 3px 8px;
  background: rgba(255, 0, 255, 0.1);
  border-left: 2px solid #ff00ff;
}

.hud-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.crosshair {
  width: 40px;
  height: 40px;
  border: 2px solid rgba(0, 255, 159, 0.5);
  border-radius: 50%;
  position: relative;
}

.crosshair::before,
.crosshair::after {
  content: '';
  position: absolute;
  background: rgba(0, 255, 159, 0.5);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.crosshair::before {
  width: 2px;
  height: 20px;
}

.crosshair::after {
  width: 20px;
  height: 2px;
}
</style>
