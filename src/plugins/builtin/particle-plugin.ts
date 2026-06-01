import * as THREE from 'three'
import { BasePlugin, PluginUpdateData } from '../plugin-interface'
import { GestureType } from '../../core/gesture-recognizer'

export class ParticlePlugin extends BasePlugin {
  name = 'ParticlePlugin'
  version = '1.0.0'
  private particleSystem: THREE.Points | null = null
  private velocities: THREE.Vector3[] = []

  async init(): Promise<void> {
    const particleCount = 1000
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(particleCount * 3)

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 4
      positions[i + 1] = (Math.random() - 0.5) * 4
      positions[i + 2] = (Math.random() - 0.5) * 2
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const material = new THREE.PointsMaterial({
      color: 0x00ff9f,
      size: 0.02,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.8
    })

    this.particleSystem = new THREE.Points(geometry, material)

    // Initialize velocities
    this.velocities = Array(particleCount)
      .fill(null)
      .map(() => new THREE.Vector3(
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02
      ))

    console.log(`✅ ParticlePlugin initialized`)
  }

  update(data: PluginUpdateData): void {
    if (!this.particleSystem) return

    const positions = (this.particleSystem.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array

    // Update particle positions
    for (let i = 0; i < positions.length; i += 3) {
      const idx = i / 3
      positions[i] += this.velocities[idx].x
      positions[i + 1] += this.velocities[idx].y
      positions[i + 2] += this.velocities[idx].z

      // Bounce at boundaries
      if (Math.abs(positions[i]) > 2) this.velocities[idx].x *= -1
      if (Math.abs(positions[i + 1]) > 2) this.velocities[idx].y *= -1
      if (Math.abs(positions[i + 2]) > 1) this.velocities[idx].z *= -1
    }

    // Add attraction to hand positions
    data.hands.forEach(hand => {
      const palmCenter = hand.landmarks[9]
      const attractPos = new THREE.Vector3(
        (palmCenter.x - 0.5) * 2,
        -(palmCenter.y - 0.5) * 2,
        palmCenter.z * 2
      )

      for (let i = 0; i < positions.length; i += 3) {
        const particlePos = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2])
        const direction = attractPos.clone().sub(particlePos).normalize()
        const idx = i / 3
        this.velocities[idx].add(direction.multiplyScalar(0.001))
      }
    })

    // Damping
    this.velocities.forEach(v => v.multiplyScalar(0.98))

    (this.particleSystem.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true

    if (!this.particleSystem.parent) {
      data.scene.add(this.particleSystem)
    }
  }

  async cleanup(): Promise<void> {
    if (this.particleSystem) {
      this.particleSystem.geometry.dispose()
      (this.particleSystem.material as THREE.Material).dispose()
    }
  }
}
