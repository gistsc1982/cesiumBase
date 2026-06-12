# 多场景架构快速使用指南

## 📋 概述

多场景架构通过分层 near/far 实现，解决了大坐标场景下的深度精度问题。

## 🚀 快速开始

### 步骤1: 加载多场景管理器

在浏览器控制台执行：

```javascript
// 加载多场景管理器（如果还没有加载）
const script = document.createElement('script');
script.src = './multi-scene-manager.js';
document.head.appendChild(script);
```

### 步骤2: 初始化多场景架构

```javascript
// 加载初始化脚本
const initScript = document.createElement('script');
initScript.src = './init-multi-scene.js';
document.head.appendChild(initScript);
```

或者直接在控制台粘贴并执行 `init-multi-scene.js` 的内容。

### 步骤3: 优化深度设置

```javascript
// 加载修复脚本
const fixScript = document.createElement('script');
fixScript.src = './fix-logarithmic-depth-v2.js';
document.head.appendChild(fixScript);
```

## 🔧 常见问题

### Q: 为什么显示 "THREE 库未找到"？

A: 这是正常的。多场景管理器会自动使用构造函数模式初始化，不影响功能。

### Q: BIM层渲染器不存在怎么办？

A: 这是正常的。系统会自动使用原始层渲染器来渲染 BIM 层。

### Q: 模型透视仍然反转怎么办？

A: 检查以下几点：
1. 模型是否正确分类到大/小坐标场景
2. 相机位置是否合理
3. near/far 值是否合适

## 📊 调试命令

```javascript
// 查看调试信息
window.__dualCanvasViewer.multiSceneManager.getDebugInfo()

// 同步相机
window.__dualCanvasViewer.multiSceneManager.syncCameras()

// 手动渲染层1
window.__dualCanvasViewer.multiSceneManager.renderLayer1()
```

## 🎯 架构说明

### 场景分层

- **原始层大坐标场景**: 用于显示大坐标模型（坐标绝对值 > 10000）
- **原始层小坐标场景**: 用于显示小坐标模型
- **BIM层大坐标场景**: 用于显示 BIM 层的大坐标模型
- **BIM层小坐标场景**: 用于显示 BIM 层的小坐标模型

### 相机配置

- **大坐标相机**: near=1, far=50000000（适合大坐标场景）
- **小坐标相机**: near=0.1, far=5000（适合小坐标场景）

### 渲染顺序

1. 先渲染小坐标场景（近处物体）
2. 再渲染大坐标场景（远处物体）

这样可以确保正确的深度排序。

## 📝 注意事项

1. **多场景管理器必须在 DualCanvasViewer 初始化后才能使用**
2. **如果页面刷新，需要重新执行初始化脚本**
3. **对数深度缓冲区在创建渲染器时设置，无法在运行时修改**
4. **通过优化 near/far 值可以提高深度精度**

## 🆘 获取帮助

如果遇到问题，请检查：

1. 浏览器控制台是否有错误信息
2. DualCanvasViewer 是否正确初始化
3. 多场景管理器是否正确加载
4. 模型是否正确加载

## 📚 相关文件

- `multi-scene-manager.js` - 多场景管理器核心代码
- `init-multi-scene.js` - 初始化脚本
- `fix-logarithmic-depth-v2.js` - 深度优化脚本
