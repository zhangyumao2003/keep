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
import { GestureController } from '../interaction/gesture-controller'
import { PluginManager } from '../plugins/plugin-interface'
import { ParticlePlugin } from '../plugins/builtin/particle-plugin'

const canvas = ref<HTMLCanvasElement | null>(null)
const initialized = ref(false)
const loadingMessage = ref('初始化中...')
const fps = ref(0)
const detectionStatus = ref('Ready')
const detectedHands = ref(0)
const gestures = ref<Gesture[]>([])

let sceneManager: SceneManager | null = null
let gestureController: GestureController | null = null
let pluginManager: PluginManager | null = null
let videoElement: HTMLVideoElement | null = null
let animationId: number | null = null
let lastTime = performance.now()
let frameCount = 0

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
    gestureController = new GestureController(sceneManager.getCamera(), sceneManager.getScene())

    loadingMessage.value = '步骤4/5: 加载特效插件...'

    // Initialize plugin system
    pluginManager = new PluginManager()
    await pluginManager.register(new ParticlePlugin())

    // Add some demo objects
    const cube1 = sceneManager.createCube(0.2, 0x00ff9f)
    sceneManager.addObject(cube1, new THREE.Vector3(0, 0, 0.5))

    const cube2 = sceneManager.createCube(0.15, 0xff00ff)
    sceneManager.addObject(cube2, new THREE.Vector3(0.3, 0.3, 0.5))

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

function animate() {
  animationId = requestAnimationFrame(animate)

  if (!sceneManager || !gestureController || !videoElement || !pluginManager) return

  try {
    // 确保视频已准备好
    if (videoElement.readyState < 2) {
      // 视频还没准备好，跳过这帧
      sceneManager.render()
      return
    }

    // Detect hands
    const result = detectHands(videoElement)
    detectedHands.value = result.hands.length
    detectionStatus.value = result.hands.length > 0 ? 'Tracking' : 'Searching'

    // Recognize gestures
    const newGestures = recognizeGestures(result.hands)
    gestures.value = newGestures

    // Update scene
    sceneManager.updateHands(result.hands)

    // Handle interactions
    result.hands.forEach((hand, idx) => {
      gestureController!.handleGesture(newGestures[idx], hand, sceneManager!.getScene())
      gestureController!.updateObjectPosition(hand, sceneManager!.getScene())
    })

    // Update plugins
    const now = performance.now()
    const deltaTime = now - lastTime
    pluginManager.update({
      scene: sceneManager.getScene(),
      camera: sceneManager.getCamera(),
      renderer: sceneManager.getRenderer(),
      hands: result.hands,
      gestures: newGestures,
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
