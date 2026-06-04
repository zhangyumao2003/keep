import { defineStore } from 'pinia'
import * as THREE from 'three'

export interface ModuleDefinition {
  id: string
  name: string
  icon: string
  color: number
  createObject: () => THREE.Object3D
}

export const useModuleStore = defineStore('module', {
  state: () => ({
    isPanelVisible: false,
    panelEnterProgress: 0,
    hoveredModuleId: null as string | null,
    hoverDuration: 0,
    modules: [
      {
        id: 'cube',
        name: 'Cube',
        icon: '🟩',
        color: 0x00ff9f,
        createObject: (): THREE.Mesh => {
          const geo = new THREE.BoxGeometry(0.15, 0.15, 0.15)
          const mat = new THREE.MeshStandardMaterial({
            color: 0x00ff9f,
            metalness: 0.7,
            roughness: 0.2,
            emissive: 0x00ff9f,
            emissiveIntensity: 0.5
          })
          return new THREE.Mesh(geo, mat)
        }
      },
      {
        id: 'sphere',
        name: 'Sphere',
        icon: '🔵',
        color: 0x00aaff,
        createObject: (): THREE.Mesh => {
          const geo = new THREE.SphereGeometry(0.1, 32, 32)
          const mat = new THREE.MeshStandardMaterial({
            color: 0x00aaff,
            metalness: 0.7,
            roughness: 0.2,
            emissive: 0x00aaff,
            emissiveIntensity: 0.5
          })
          return new THREE.Mesh(geo, mat)
        }
      },
      {
        id: 'torus',
        name: 'Ring',
        icon: '💍',
        color: 0xff00ff,
        createObject: (): THREE.Mesh => {
          const geo = new THREE.TorusGeometry(0.1, 0.03, 16, 32)
          const mat = new THREE.MeshStandardMaterial({
            color: 0xff00ff,
            metalness: 0.7,
            roughness: 0.2,
            emissive: 0xff00ff,
            emissiveIntensity: 0.5
          })
          return new THREE.Mesh(geo, mat)
        }
      },
      {
        id: 'cylinder',
        name: 'Pillar',
        icon: '🟪',
        color: 0xffaa00,
        createObject: (): THREE.Mesh => {
          const geo = new THREE.CylinderGeometry(0.08, 0.08, 0.2, 32)
          const mat = new THREE.MeshStandardMaterial({
            color: 0xffaa00,
            metalness: 0.7,
            roughness: 0.2,
            emissive: 0xffaa00,
            emissiveIntensity: 0.5
          })
          return new THREE.Mesh(geo, mat)
        }
      }
    ] as ModuleDefinition[]
  }),
  actions: {
    showPanel() {
      this.isPanelVisible = true
    },
    hidePanel() {
      this.isPanelVisible = false
    },
    setHoveredModule(moduleId: string | null) {
      this.hoveredModuleId = moduleId
    },
    setPanelProgress(progress: number) {
      this.panelEnterProgress = progress
    }
  }
})
