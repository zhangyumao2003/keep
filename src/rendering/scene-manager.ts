import * as THREE from 'three'
import { Hand } from './hand-detector'

export class SceneManager {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private canvas: HTMLCanvasElement
  private handSkeletons: THREE.Group[] = []
  private objects: THREE.Object3D[] = []
  private particleSystem: THREE.Points | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas

    // Scene setup
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0a0e27)

    // Camera setup
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    this.camera.position.z = 1

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(window.devicePixelRatio)

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x00ff9f, 0.6)
    this.scene.add(ambientLight)

    const pointLight = new THREE.PointLight(0x00ff9f, 1)
    pointLight.position.set(5, 5, 5)
    this.scene.add(pointLight)

    // Add grid for reference
    this.addGrid()

    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize())
  }

  private addGrid() {
    const gridHelper = new THREE.GridHelper(10, 20, 0x00ff9f, 0x1a2a47)
    gridHelper.position.z = -2
    this.scene.add(gridHelper)
  }

  private onWindowResize() {
    const width = window.innerWidth
    const height = window.innerHeight
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  updateHands(hands: Hand[]) {
    // Clear old skeletons
    this.handSkeletons.forEach(skeleton => this.scene.remove(skeleton))
    this.handSkeletons = []

    // Create new skeletons
    hands.forEach((hand, handIdx) => {
      const group = new THREE.Group()
      const color = hand.handedness === 'Right' ? 0x00ff9f : 0xff00ff

      // Draw landmarks
      hand.landmarks.forEach((landmark, idx) => {
        const geometry = new THREE.SphereGeometry(0.01, 8, 8)
        const material = new THREE.MeshBasicMaterial({ color })
        const sphere = new THREE.Mesh(geometry, material)

        // Convert from normalized coordinates to scene coordinates
        sphere.position.set(
          (landmark.x - 0.5) * 2,
          -(landmark.y - 0.5) * 2,
          landmark.z * 2
        )

        group.add(sphere)
      })

      // Draw connections
      const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
        [0, 5], [5, 6], [6, 7], [7, 8], // Index
        [5, 9], [9, 10], [10, 11], [11, 12], // Middle
        [9, 13], [13, 14], [14, 15], [15, 16], // Ring
        [13, 17], [17, 18], [18, 19], [19, 20], // Pinky
        [0, 17], [0, 5] // Palm
      ]

      connections.forEach(([start, end]) => {
        const geometry = new THREE.BufferGeometry()
        const positions = new Float32Array([
          hand.landmarks[start].x * 2 - 1,
          -(hand.landmarks[start].y * 2 - 1),
          hand.landmarks[start].z * 2,
          hand.landmarks[end].x * 2 - 1,
          -(hand.landmarks[end].y * 2 - 1),
          hand.landmarks[end].z * 2
        ])
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

        const material = new THREE.LineBasicMaterial({ color })
        const line = new THREE.Line(geometry, material)
        group.add(line)
      })

      this.scene.add(group)
      this.handSkeletons.push(group)
    })
  }

  addObject(object: THREE.Object3D, position: THREE.Vector3) {
    object.position.copy(position)
    this.scene.add(object)
    this.objects.push(object)
    return object
  }

  removeObject(object: THREE.Object3D) {
    this.scene.remove(object)
    const idx = this.objects.indexOf(object)
    if (idx > -1) {
      this.objects.splice(idx, 1)
    }
  }

  createCube(size = 0.2, color = 0x00ff9f): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(size, size, size)
    const material = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.7,
      roughness: 0.2,
      emissive: color,
      emissiveIntensity: 0.5
    })
    return new THREE.Mesh(geometry, material)
  }

  render() {
    this.renderer.render(this.scene, this.camera)
  }

  getScene() {
    return this.scene
  }

  getCamera() {
    return this.camera
  }

  getRenderer() {
    return this.renderer
  }

  getObjects() {
    return this.objects
  }
}
