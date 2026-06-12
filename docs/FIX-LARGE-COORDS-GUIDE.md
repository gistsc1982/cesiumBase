# 大坐标模型自动检测修复工具

## 问题描述

当前场景中存在大坐标模型（位置如 363301, 363301, 0），但相机仍停留在原点 (0, 100, 0)，导致：

- 模型距离相机 600+ 万米
- 超出 near/far 范围 (10/37311)
- 模型不可见

## 快速修复

### 方法 1：在控制台运行（推荐）

在 `demo-bundle.html` 页面的浏览器控制台中执行：

```javascript
fetch('fix-large-coords-now.js').then(r=>r.text()).then(eval)
```

### 方法 2：直接粘贴脚本

打开 `fix-large-coords-now.js` 文件，复制全部内容，粘贴到控制台并回车。

## 工作原理

脚本会自动检测场景中的模型：

1. **如果全是小坐标模型**（位置 < 10000）
   - ✅ 保持现有小坐标逻辑，不做任何调整

2. **如果有大坐标模型**（位置 >= 10000）
   - 🎯 自动设置 `isInRealWorldMode = true`
   - 🎯 自动调用 `adjustCameraForAllModels()` 移动相机

3. **如果相机已在大坐标位置**
   - ✅ 跳过调整，避免重复操作

## 验证结果

修复后，检查控制台输出：

```
[FixLargeCoords] ✅ 已设置 isInRealWorldMode = true
[FixLargeCoords] ✅ 已调用 adjustCameraForAllModels()
[FixLargeCoords] ✅ 相机调整成功！
```

相机位置应该从 `(0, 100, 0)` 变为大坐标位置，如 `(363301, 363301 + distance, 0)`。

## 永久集成

要将此功能集成到代码中，参考 `auto-detect-large-coords-integration.js`：

1. 在 `DualCanvasViewer.vue` 的 `methods` 中添加 `autoDetectAndAdjustForLargeCoords()` 方法
2. 在 `loadThreeModel` 和 `loadBimModel` 方法末尾调用它

## 常见问题

### Q: 脚本执行后模型仍然不可见？
A: 可能需要刷新页面重新加载模型，或者检查 near/far 值是否正确更新。

### Q: 如何判断模型是否为大坐标？
A: 运行 `getViewerInstance()` 后检查模型的 `userData.hasLargeCoordinates` 标志或位置值。

### Q: 会影响小坐标模型吗？
A: 不会。脚本会检测所有模型，只有当存在大坐标模型时才执行调整。

## 文件说明

- `fix-large-coords-now.js` - 可直接在控制台运行的修复脚本
- `auto-detect-large-coords.js` - 完整的检测脚本（带UI）
- `auto-detect-large-coords-integration.js` - Vue 组件集成代码
