# 原始模型层（Layer 1）模型不显示问题排查与修复

## 问题描述

BIM 层模型透视翻转问题已经修复，但是原始模型层加载模型后不显示。

## 问题排查

### 1. 代码结构分析

通过检查 `DualCanvasViewer.vue` 和 `rendererManager.js` 的代码，发现以下关键点：

1. **原始模型层初始化**（`initThreeLayer` 方法）：
   - 创建 scene1、camera1、controls1
   - 创建 modelGroup1 并添加到 scene1
   - 使用 rendererManager 进行渲染

2. **模型加载流程**（`loadGLTFModel` 方法）：
   - 加载 GLTF/GLB 模型
   - 检测大坐标模型
   - 将模型添加到 modelGroup1

3. **渲染流程**（`rendererManager.js` 的 `animate` 函数）：
   - 遍历所有场景进行渲染
   - 计算视口和可见区域
   - 设置材质状态

### 2. 发现的问题

#### 问题 1：材质原始状态未保存

在 `rendererManager.js` 中，代码会遍历场景中的所有对象来设置材质的透明度状态：

```javascript
// 不透明场景：恢复默认状态
material.transparent = material.userData.originalTransparent || false;
material.opacity = material.userData.originalOpacity || 1.0;
```

但是，在模型加载时没有保存 `originalTransparent` 和 `originalOpacity`，导致：
- 如果原始材质是透明的（`transparent: true`），会被错误地设置为不透明
- 如果原始材质有特定的透明度值，会被重置为 1.0

#### 问题 2：undefined 被当作 false

使用 `||` 运算符会导致：
```javascript
material.transparent = material.userData.originalTransparent || false;
// 如果 originalTransparent 是 undefined，transparent 会被设置为 false
```

这对于本身就是透明的材质（如玻璃、半透明材质）会造成显示问题。

## 修复方案

### 修复 1：在模型加载时保存材质原始状态

在 `DualCanvasViewer.vue` 的两处模型加载代码中添加：

```javascript
model.traverse((child) => {
  if (child.isMesh && child.material) {
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach(mat => {
      // ✅ 保存材质的原始状态，以便 rendererManager 可以正确恢复
      if (!mat.userData._hasOriginalStateSaved) {
        mat.userData.originalTransparent = mat.transparent;
        mat.userData.originalOpacity = mat.opacity;
        mat.userData._hasOriginalStateSaved = true;
      }

      mat.depthTest = true;
      mat.depthWrite = true;
      mat.needsUpdate = true;
    });
  }
});
```

### 修复 2：改进 rendererManager 的材质恢复逻辑

修改 `rendererManager.js` 中的材质状态恢复代码：

```javascript
// ✅ 关键修复：第一次遇到材质时保存其原始状态
if (!material.userData._hasOriginalStateSaved) {
  material.userData.originalTransparent = material.transparent;
  material.userData.originalOpacity = material.opacity;
  material.userData._hasOriginalStateSaved = true;
}

if (isTransparent) {
  // 透明场景设置...
} else {
  // ✅ 修复：使用 hasOwnProperty 检查，避免 undefined 被当作 false
  if (material.userData.hasOwnProperty('originalTransparent')) {
    material.transparent = material.userData.originalTransparent;
  }
  if (material.userData.hasOwnProperty('originalOpacity')) {
    material.opacity = material.userData.originalOpacity;
  }
  material.depthWrite = true;
  material.depthTest = true;
}
```

### 修复 3：添加调试日志

在 `rendererManager.js` 中添加场景渲染信息日志，帮助排查问题：

```javascript
// 🔍 调试：每60帧输出场景渲染信息
if (animate.frameCount % 60 === 0) {
  console.log(`[rendererManager] 场景 ${sortedIndex} 渲染信息:`, {
    elementClass: element.className,
    sceneName: scene.name || 'unnamed',
    sceneChildren: scene.children.length,
    modelGroupChildren: scene.children.filter(c => c.type === 'Group' && c.name && c.name.includes('modelGroup')).map(g => ({ name: g.name, children: g.children.length })),
    opacity: sceneOpacity,
    isTransparent: isTransparent
  });
}
```

## 修复效果

1. **正确保存材质原始状态**：模型加载时保存材质的透明度和透明属性
2. **正确恢复材质状态**：rendererManager 在渲染时正确恢复材质的原始状态
3. **避免 undefined 问题**：使用 `hasOwnProperty` 检查，避免 undefined 被当作 false
4. **增强调试能力**：添加调试日志，便于排查问题

## 测试建议

1. **加载普通 GLTF 模型**：
   - 验证模型是否正确显示
   - 检查材质透明度是否正确

2. **加载透明材质模型**：
   - 验证透明材质（如玻璃）是否正确显示
   - 检查透明度是否正确应用

3. **加载大坐标模型**：
   - 验证大坐标模型是否正确显示
   - 检查相机位置和 near/far 值

4. **查看控制台日志**：
   - 检查场景渲染信息
   - 确认材质状态是否正确

## 注意事项

1. **材质原始状态只保存一次**：使用 `_hasOriginalStateSaved` 标志避免重复保存
2. **透明度检查使用 `hasOwnProperty`**：避免 undefined 被当作 false
3. **定期检查控制台日志**：确认场景和模型状态

---

修复日期：2025年
修复文件：
- src/components/DualCanvasViewer.vue（模型加载处）
- src/utils/rendererManager.js（材质状态恢复处）
