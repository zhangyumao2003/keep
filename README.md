# 🤖 Iron Man 3D Motion Capture System

一个钢铁侠风格的实时手部动作捕捉系统，通过摄像头实时追踪手部动作，驱动3D虚拟对象进行交互。

## 🎯 功能特性

### 核心功能
- ✅ **实时手部追踪** - 双手21个关键点检测，30fps+流畅追踪
- ✅ **手势识别** - 握拳、张手、捏合、点击等多种手势
- ✅ **3D可视化** - WebGL渲染的实时3D场景
- ✅ **交互系统** - 通过手部动作拖拽和操纵虚拟对象
- ✅ **粒子特效** - 跟踪手部的动态粒子系统
- ✅ **钢铁侠风格HUD** - 未来感十足的界面设计

### 可扩展插件系统
- 🔌 标准化的插件接口
- 📦 轻松添加自定义功能
- 🎨 内置粒子特效、音效、录制插件框架

## 🚀 快速开始

### 环境要求
- Node.js 16+
- 现代浏览器（支持WebRTC）
- 摄像头设备

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm run dev
```

然后在浏览器中打开 `http://localhost:5173`

### 构建生产版本
```bash
npm run build
```

## 🎮 交互指南

| 手势 | 功能 |
|------|------|
| 🤚 **张手** | 打开/关闭交互 |
| ✊ **握拳** | 拖动选中的对象 |
| 👉 **指点** | 精确指向和选择 |
| 👌 **捏合** | 选中对象，开始拖拽 |

## 📁 项目结构

```
src/
├── core/                  # 核心逻辑
│   ├── hand-detector.ts       # MediaPipe手部检测
│   └── gesture-recognizer.ts  # 手势识别引擎
├── rendering/             # 3D渲染
│   ├── scene-manager.ts       # Three.js场景管理
│   └── particle-effects.ts    # 粒子效果（规划中）
├── interaction/           # 交互系统
│   └── gesture-controller.ts  # 手势命令处理
├── plugins/               # 可扩展插件
│   ├── plugin-interface.ts    # 插件基类
│   └── builtin/
│       └── particle-plugin.ts # 粒子特效插件
└── ui/
    └── App.vue                # 主应用组件
```

## 🔌 开发自定义插件

### 基础插件模板

```typescript
import { BasePlugin, PluginUpdateData } from '@/plugins/plugin-interface'

export class MyPlugin extends BasePlugin {
  name = 'MyPlugin'
  version = '1.0.0'

  async init() {
    console.log('初始化我的插件')
  }

  update(data: PluginUpdateData) {
    // 每帧调用
    const { scene, hands, gestures, deltaTime } = data
    // 你的逻辑
  }

  async cleanup() {
    console.log('清理资源')
  }
}
```

### 注册插件

```typescript
const pluginManager = new PluginManager()
await pluginManager.register(new MyPlugin())
```

## 📊 性能指标

- 🔍 手部检测延迟: < 50ms
- 🎬 渲染帧率: 30-60fps
- ⏱️ 交互反应: < 100ms

## 🎨 HUD设计元素

- 深蓝/深灰背景 + 霓虹蓝/绿发光效果
- 全息网格背景
- 透视效果和玻璃态设计
- 实时数据显示和状态指示

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Vue 3 + TypeScript |
| 3D渲染 | Three.js |
| 手部检测 | MediaPipe |
| 构建工具 | Vite |
| 状态管理 | Pinia |

## 📋 后续功能规划

- [ ] 性能优化（WebWorker）
- [ ] Electron桌面版本
- [ ] 多人协作（WebSocket）
- [ ] 自定义手势学习
- [ ] 空间定位（SLAM集成）
- [ ] 动作录制和回放
- [ ] 虚拟形象驱动
- [ ] AR模式支持

## 📝 许可证

MIT

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**享受在未来感十足的3D交互世界中的创意体验！** 🚀✨
