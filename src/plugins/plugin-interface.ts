import * as THREE from 'three'
import { Hand } from '../core/hand-detector'
import { Gesture } from '../core/gesture-recognizer'

export interface IPlugin {
  name: string
  version: string
  init(): Promise<void>
  update(data: PluginUpdateData): void
  cleanup(): Promise<void>
}

export interface PluginUpdateData {
  scene: THREE.Scene
  camera: THREE.Camera
  renderer: THREE.WebGLRenderer
  hands: Hand[]
  gestures: Gesture[]
  deltaTime: number
  timestamp: number
}

export class BasePlugin implements IPlugin {
  name = 'BasePlugin'
  version = '1.0.0'

  async init(): Promise<void> {
    console.log(`✅ Plugin ${this.name} initialized`)
  }

  update(data: PluginUpdateData): void {
    // Override in subclass
  }

  async cleanup(): Promise<void> {
    console.log(`🛑 Plugin ${this.name} cleaned up`)
  }
}

export class PluginManager {
  private plugins: Map<string, IPlugin> = new Map()

  async register(plugin: IPlugin) {
    await plugin.init()
    this.plugins.set(plugin.name, plugin)
    console.log(`📦 Plugin registered: ${plugin.name}`)
  }

  unregister(pluginName: string) {
    const plugin = this.plugins.get(pluginName)
    if (plugin) {
      plugin.cleanup()
      this.plugins.delete(pluginName)
      console.log(`📦 Plugin unregistered: ${pluginName}`)
    }
  }

  update(data: PluginUpdateData) {
    this.plugins.forEach(plugin => {
      try {
        plugin.update(data)
      } catch (error) {
        console.error(`Error in plugin ${plugin.name}:`, error)
      }
    })
  }

  async cleanup() {
    for (const plugin of this.plugins.values()) {
      await plugin.cleanup()
    }
    this.plugins.clear()
  }

  getPlugin(name: string) {
    return this.plugins.get(name)
  }

  getPlugins() {
    return Array.from(this.plugins.values())
  }
}
