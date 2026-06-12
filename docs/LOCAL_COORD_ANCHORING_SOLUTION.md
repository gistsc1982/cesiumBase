# 局部坐标系模式锚定解决方案

## 问题描述

在主项目局部坐标系模式下，大坐标模型中心不能锚定在 Cesium 固定经纬度的地面。

### 原因分析

| 特性 | 子项目 | 主项目（局部坐标系） |
|------|--------|---------------------|
| **floorCenterMercator** | 模型绝对墨卡托坐标 | `(0, 0, 0)` |
| **同步循环** | ✅ 正常工作 | ❌ 被跳过 |
| **Cesium 锚定** | ✅ 锚定在固定经纬度 | ❌ 无法锚定 |

### 核心问题

```javascript
// cesium-dual-sync-v2.js:561-564 (修改前)
if (isUsingENUCoordinateSystem()) {
  console.log('[CesiumDualSyncV2] ENU坐标系模式：跳过 Dual → Cesium 同步');
  return;  // ❌ 直接返回，导致无法锚定
}
```

## 解决方案

### 修改 `cesium-dual-sync-v2.js` 支持局部坐标系模式

#### 修改内容

**文件**: `public/cesium-dual-sync-v2.js`
**位置**: `syncDualToCesium()` 函数开头（约 560 行）

#### 修改后的逻辑

```javascript
// ⭐ 关键修改：局部坐标系模式下，使用 MercatorProjectionManager 进行坐标转换
if (isUsingLocalCoord) {
  if (!mercatorProjection) {
    console.warn('[CesiumDualSyncV2] 局部坐标系模式但缺少 MercatorProjectionManager');
    return;
  }

  // ⚠️ 检查是否正在用户操作（避免冲突）
  if (syncState.isUserDragging) {
    return;
  }

  // ⭐ 局部坐标系模式：使用 SyncManager 的统一状态进行同步
  if (syncManager.syncUnifiedToCesium) {
    const cesiumViewer = syncState.cesiumViewer;
    if (cesiumViewer?.camera && cesiumViewer?.scene) {
      // 使用 SyncManager 的同步方法，它会处理局部坐标系的转换
      syncManager.syncUnifiedToCesium(cesiumViewer.camera, cesiumViewer.scene);
      console.log('[CesiumDualSyncV2] ⭐ 局部坐标系模式：锚定同步到 Cesium');
    }
  }
  return;
}
```

### 锚定原理

```
┌─────────────────────────────────────────────────────────────┐
│              局部坐标系模式锚定流程                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Dual 相机位置（相对坐标）                                   │
│  position: (206, 541, 187)  →  相对模型原点                │
│  target: (207, 460, 127)                                   │
│                  ↓                                          │
│  同步循环检测到变化                                          │
│  requestAnimationFrame                                      │
│                  ↓                                          │
│  判断：isUsingLocalCoordinateSystem() = true               │
│                  ↓                                          │
│  使用 SyncManager.syncUnifiedToCesium()                     │
│                  ↓                                          │
│  MercatorProjectionManager.syncDirectionToCesium()         │
│  - 使用 modelAbsoluteMercator 作为参考点                    │
│  - 计算局部坐标 → 绝对墨卡托坐标 → ECEF 坐标                │
│                  ↓                                          │
│  Cesium 相机更新                                            │
│  - 锚定在模型的固定经纬度                                    │
│  - 视角跟随 Dual 变化                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 关键代码

#### 1. 局部坐标系检测

```javascript
// cesium-dual-sync-v2.js:106-115
function isUsingLocalCoordinateSystem() {
  const syncManager = typeof window !== 'undefined' && window.__syncManager__;
  if (syncManager && syncManager.mercatorProjection) {
    const isUsing = syncManager.mercatorProjection.isUsingLocalCoordinateSystem;
    if (typeof isUsing === 'function') {
      return isUsing.call(syncManager.mercatorProjection);
    }
  }
  return false;
}
```

#### 2. 坐标转换（MercatorProjectionManager）

```javascript
// src/utils/MercatorProjectionManager.js:749-753
const success = this.mercatorProjection.syncDirectionToCesium(
  this.unifiedCameraState,
  cesiumCamera,
  cesiumScene
);
```

#### 3. 模型绝对位置参考

```javascript
// src/utils/MercatorProjectionManager.js:175-179
this.modelAbsoluteMercator = {
  x: floorCenter.x,  // 模型的绝对墨卡托 X 坐标
  y: floorCenter.y,  // 模型的绝对墨卡托 Y 坐标
  z: floorCenter.z   // 模型的地面高度
};
```

## 测试验证

### 验证步骤

1. **启用局部坐标系模式**
   ```javascript
   mercatorProjection.setUseLocalCoordinateSystem(true);
   ```

2. **加载大坐标模型**
   ```javascript
   dualCanvasViewer.loadModel({
     url: 'L16_10302_ECEF_to_ThreeJS.glb',
     position: { x: 0, y: 0, z: 0 },
     useLocalCoordinateSystem: true,
     modelAbsoluteMercator: {
       x: 12793352.71,  // 模型的绝对墨卡托坐标
       y: 3134460.35,
       z: 0
     }
   });
   ```

3. **验证锚定效果**
   - Dual 中旋转/平移相机
   - Cesium 视口应该同步变化
   - Cesium 的地面位置应该保持在模型的固定经纬度

### 预期日志

```
[CesiumDualSyncV2] ⭐ 局部坐标系模式：锚定同步到 Cesium
[MercatorProjectionManager] syncDirectionToCesium 使用局部坐标系参考点
[MercatorProjectionManager] 局部坐标系模式：高度转换
[MercatorProjectionManager] 坐标系转换: 统一坐标系(EUS) → 墨卡托坐标系(ENU)
[MercatorProjectionManager] syncDirectionToCesium 完成
```

## 注意事项

### 1. 用户操作期间暂停同步

```javascript
// ⚠️ 检查是否正在用户操作（避免冲突）
if (syncState.isUserDragging) {
  return;  // 用户操作期间，暂停自动锚定同步
}
```

### 2. 左键翻转保护

左键翻转期间，`setUserDragging(false, false, true, true)` 会永久停止同步循环，这是预期行为。

### 3. 性能优化

同步循环使用 `requestAnimationFrame`，只在检测到相机变化时才同步，避免不必要的性能开销。

## 对比：修改前 vs 修改后

| 场景 | 修改前 | 修改后 |
|------|--------|--------|
| **Dual 相机变化** | Cesium 不同步 | Cesium 同步 ✅ |
| **Cesium 锚定** | 无法锚定 | 锚定在模型经纬度 ✅ |
| **用户操作冲突** | 可能冲突 | 自动暂停 ✅ |
| **性能** | N/A | 使用 RAF 优化 ✅ |

## 总结

通过修改 `cesium-dual-sync-v2.js`，让同步循环支持局部坐标系模式，实现了：

1. ✅ 大坐标模型中心锚定在 Cesium 固定经纬度的地面
2. ✅ Dual 视角变化时，Cesium 同步更新
3. ✅ 用户操作期间自动暂停，避免冲突
4. ✅ 使用 `SyncManager.syncUnifiedToCesium` 确保坐标转换正确

**核心思路**：局部坐标系模式下，不再跳过同步，而是使用 `SyncManager` 的坐标转换能力，将局部坐标正确映射到 Cesium 的绝对坐标。
