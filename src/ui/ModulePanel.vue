<template>
  <transition name="panel-slide">
    <div v-if="visible" class="module-panel">
      <div class="panel-header">
        <span class="panel-title">MODULES</span>
        <span class="panel-hint">hover 500ms to add</span>
      </div>

      <div class="module-grid">
        <div
          v-for="mod in modules"
          :key="mod.id"
          class="module-item"
          :class="{ hovered: mod.id === hoveredModuleId, selected: mod.id === selectedModuleId }"
          :data-module-id="mod.id"
          :style="{ borderColor: '#' + mod.color.toString(16).padStart(6, '0') }"
        >
          <span class="module-icon">{{ mod.icon }}</span>
          <span class="module-name">{{ mod.name }}</span>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import type { ModuleDefinition } from '../stores/module-store'

defineProps<{
  visible: boolean
  modules: ModuleDefinition[]
  hoveredModuleId: string | null
  selectedModuleId: string | null
}>()

const emit = defineEmits<{
  'select-module': [moduleId: string]
}>()
</script>

<style scoped>
.module-panel {
  position: fixed;
  top: 0;
  left: 0;
  width: 260px;
  height: 100vh;
  background: rgba(10, 14, 39, 0.93);
  backdrop-filter: blur(12px);
  border-right: 2px solid rgba(0, 255, 159, 0.45);
  box-shadow: 4px 0 25px rgba(0, 255, 159, 0.1),
              inset -1px 0 0 rgba(0, 255, 159, 0.06);
  z-index: 500;
  padding: 20px 16px;
  box-sizing: border-box;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(0, 255, 159, 0.3);
  flex-shrink: 0;
}

.panel-title {
  font-size: 16px;
  color: #00ff9f;
  font-weight: bold;
  letter-spacing: 3px;
  text-shadow: 0 0 8px rgba(0, 255, 159, 0.6);
}

.panel-hint {
  font-size: 10px;
  color: rgba(0, 255, 159, 0.45);
  letter-spacing: 1px;
}

.module-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.module-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px 8px;
  border: 1px solid rgba(0, 255, 159, 0.2);
  border-radius: 8px;
  background: rgba(0, 255, 159, 0.04);
  cursor: default;
  transition: all 0.2s ease;
  min-height: 80px;
  user-select: none;
}

.module-item.hovered {
  border-color: #00ff9f;
  background: rgba(0, 255, 159, 0.15);
  box-shadow: 0 0 16px rgba(0, 255, 159, 0.3),
              inset 0 0 10px rgba(0, 255, 159, 0.1);
  transform: scale(1.06);
}

.module-item.selected {
  border-color: #00ff9f;
  background: rgba(0, 255, 159, 0.25);
  box-shadow: 0 0 24px rgba(0, 255, 159, 0.5),
              inset 0 0 14px rgba(0, 255, 159, 0.15);
  transform: scale(1.08);
}

.module-icon {
  font-size: 28px;
  margin-bottom: 6px;
}

.module-name {
  font-size: 11px;
  color: #00ff9f;
  letter-spacing: 1px;
  text-shadow: 0 0 4px rgba(0, 255, 159, 0.4);
}

/* Slide transition */
.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.panel-slide-enter-from,
.panel-slide-leave-to {
  transform: translateX(-100%);
}
</style>
