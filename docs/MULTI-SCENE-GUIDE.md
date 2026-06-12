# 多场景管理器 - 分层 Near/Far 实现指南

## 📋 概述

多场景管理器通过在一个 canvas 内使用多个场景和相机，实现了分层 near/far 渲染，解决了大坐标场景的深度精度问题。

## 🏗️ 架构设计

### 场景分层

```
┌─────────────────────────────────────────────────────────┐
│                    Canvas (原始层)                      │
├─────────────────────────────────────────────────────────┤
│  Scene1_Large (大坐标场景)                              │
│  - near: 0.1, far: 15000000                            │
│  - 渲染千万级坐标的 glb 大模型                          │
│  - 使用对数深度缓冲区                                   │
├─────────────────────────────────────────────────────────┤
│  Scene1_Small (小坐标场景)                              │
│  - near: 36, far: 1802                                 │
│  - 渲染相对坐标的小模型                                 │
│  - 标准深度缓冲区                                       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    Canvas (BIM层)                       │
├─────────────────────────────────────────────────────────┤
│  Scene2_Large (大坐标场景)                              │
│  - near: 0.1, far: 15000000                            │
│  - 渲染千万级坐标的 glb 大模型                          │
│  - 使用对数深度缓冲区                                   │
├─────────────────────────────────────────────────────────┤
│  Scene2_Small (小坐标场景)                              │
│  - near: 36, far: 1802                                 │
│  - 渲染相对坐标的小模型                                 │
│  - 标准深度缓冲区                                       │
└─────────────────────────────────────────────────────────┘
```

### 坐标系统

```
墨卡托世界坐标                          相对坐标
[12793352.71, 70.36, 3134460.35]       [0, 70.36, 50]
    ↓                                       ↓
大坐标场景                              小坐标场景
深度精度问题                             深度精度充足
```

## 🚀 快速开始

### 1. 加载脚本

在 HTML 中添加：

```html
<script src="multi-scene-manager.js"></script>
<script src="multi-scene-debug.js"></script>
```

或在浏览器控制台执行：

```javascript
// 加载多场景管理器
const script1 = document.createElement('script');
script1.src = 'multi-scene-manager.js';
document.head.appendChild(script1);

// 加载调试工具
const script2 = document.createElement('script');
script2.src = 'multi-scene-debug.js';
document.head.appendChild(script2);

// 等待加载完成后执行
setTimeout(() => {
  // 执行初始化脚本
  const initScript = document.createElement('script');
  initScript.src = 'init-multi-scene.js';
  document.head.appendChild(initScript);
}, 1000);
```

### 2. 初始化

在浏览器控制台执行：

```javascript
// 方法1：使用初始化脚本（推荐）
// 首先加载 init-multi-scene.js
```

或手动初始化：

```javascript
// 方法2：手动初始化
const manager = new MultiSceneManager(window.__dualCanvasViewer);
manager.initialize();
window.__multiSceneManager = manager;
```

### 3. 调试

```javascript
// 显示调试面板
showMultiSceneDebug();

// 打印调试信息到控制台
printMultiSceneDebug();

// 隐藏调试面板
hideMultiSceneDebug();
```

## 🔧 配置选项

修改 `multi-scene-manager.js` 中的 `CONFIG` 对象：

```javascript
const CONFIG = {
  // 大坐标阈值（超过此值视为大坐标模型）
  LARGE_COORD_THRESHOLD: 10000,

  // 大坐标场景的 near/far
  LARGE_SCENE_NEAR: 0.1,
  LARGE_SCENE_FAR: 15000000,

  // 小坐标场景的 near/far
  SMALL_SCENE_NEAR: 36,
  SMALL_SCENE_FAR: 1802,

  // 是否启用对数深度缓冲区
  LARGE_SCENE_LOG_DEPTH: true,
  SMALL_SCENE_LOG_DEPTH: false
};
```

## 📊 工作原理

### 1. 模型分类

```javascript
// 自动分类模型
const isLarge = Math.abs(pos.x) > 10000 || Math.abs(pos.z) > 10000;

if (isLarge) {
  // 大坐标模型 → Large 场景
} else {
  // 小坐标模型 → Small 场景（转换为相对坐标）
}
```

### 2. 相对坐标变换

```javascript
// 小模型坐标减去参考点（大模型位置）
const relativePos = model.position.clone().sub(referencePoint);
model.position.copy(relativePos);
```

### 3. 多场景合成渲染

```javascript
// 渲染循环
renderer.clear(true, true, false);  // 清除颜色缓冲区
renderer.render(largeScene, largeCamera);  // 渲染大坐标场景
renderer.clearDepth();  // 清除深度缓冲区
renderer.render(smallScene, smallCamera);  // 渲染小坐标场景
```

### 4. 相机同步

```javascript
// 所有相机共享相同的 position、rotation、zoom
// 大坐标相机：直接使用基准相机位置
// 小坐标相机：转换为相对坐标
```

## 🐛 常见问题

### Q1: 模型显示位置不正确

**原因：** 参考点选择不合适

**解决方案：**
```javascript
// 检查参考点
const debugInfo = window.__multiSceneManager.getDebugInfo();
console.log('参考点:', debugInfo.referencePoints);

// 手动设置参考点
manager.referencePoints.layer1 = new THREE.Vector3(x, y, z);
manager.classifyAndMoveModels();  // 重新分类模型
```

### Q2: 深度排序错误

**原因：** near/far 范围设置不当

**解决方案：**
```javascript
// 调整 near/far 值
manager.cameras.layer1Small.near = 10;
manager.cameras.layer1Small.far = 2000;
manager.cameras.layer1Small.updateProjectionMatrix();
```

### Q3: 性能问题

**原因：** 渲染四个场景

**解决方案：**
```javascript
// 启用视锥体剔除
manager.scenes.layer1Large.frustumCulled = true;

// 减少渲染频率
// 修改渲染循环，降低帧率
```

### Q4: 相机同步不同步

**原因：** 控制器事件监听问题

**解决方案：**
```javascript
// 手动触发相机同步
manager.syncCameras();
```

## 📝 API 参考

### MultiSceneManager

#### constructor(dualViewer)
创建多场景管理器实例

#### initialize()
初始化多场景架构

#### classifyAndMoveModels()
分类并移动模型到对应场景

#### syncCameras()
同步所有相机

#### getDebugInfo()
获取调试信息

## 🔍 调试技巧

### 1. 查看场景内容

```javascript
// 遍历场景中的模型
window.__multiSceneManager.scenes.layer1Large.traverse(obj => {
  if (obj.isMesh) {
    console.log('模型:', obj.name, '位置:', obj.position);
  }
});
```

### 2. 检查相机状态

```javascript
// 查看相机配置
const cameras = window.__multiSceneManager.cameras;
console.log('大坐标相机:', cameras.layer1Large);
console.log('小坐标相机:', cameras.layer1Small);
```

### 3. 渲染调试

```javascript
// 单独渲染某个场景
const manager = window.__multiSceneManager;
const renderer = manager.dualViewer.renderer1;

renderer.clear(true, true, false);
renderer.render(manager.scenes.layer1Large, manager.cameras.layer1Large);
```

## 📈 性能优化

### 1. 使用共享渲染器

```javascript
// 多个场景共享同一个渲染器
renderer.autoClear = false;
renderer.render(scene1, camera1);
renderer.clearDepth();
renderer.render(scene2, camera2);
```

### 2. 启用视锥体剔除

```javascript
scene.traverse(obj => {
  if (obj.isMesh) {
    obj.frustumCulled = true;
  }
});
```

### 3. 使用 LOD（细节级别）

```javascript
const lod = new THREE.LOD();
lod.addLevel(highDetailModel, 0);
lod.addLevel(lowDetailModel, 100);
scene.add(lod);
```

## 🎯 最佳实践

1. **合理设置阈值**：根据实际模型坐标范围调整 `LARGE_COORD_THRESHOLD`

2. **选择合适的参考点**：使用场景中心位置作为参考点

3. **调整 near/far**：根据相机到模型的实际距离调整

4. **启用对数深度**：大坐标场景务必启用对数深度缓冲区

5. **监控性能**：使用调试面板实时监控渲染状态

## 📞 支持

如有问题，请查看：
- 控制台错误日志
- 调试面板信息
- DualCanvasViewer 文档
