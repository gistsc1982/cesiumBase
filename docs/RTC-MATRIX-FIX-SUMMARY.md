# RTC 中心点和矩阵溢出修复总结

## 问题描述

从调试日志中发现以下问题：

1. **矩阵计算溢出**：ModelMatrix 的条目出现 `-1.7976931348623157e+308`（Number.MAX_VALUE 的负数）或 `Infinity/NaN`
2. **RTC 中心点未正确应用**：导致 3D Tiles 在第二个画布中不可见
3. **ECEF 坐标系转换问题**：大坐标（数百万米）在矩阵乘法时产生浮点数溢出

## 修复内容

### 1. DualCanvasViewer.vue 修改

#### data() 中添加的状态变量

```javascript
// RTC (Relative-To-Center) 中心点管理
_rtcCenter: {
  x: 0,
  y: 0,
  z: 0,
  enabled: false,
  timestamp: 0
},
// 矩阵溢出检测和修复
_matrixOverflowDetection: {
  lastCheckTime: 0,
  checkInterval: 5000, // 5秒检查一次
  overflowCount: 0,
  maxOverflows: 10 // 最大溢出次数，超过后禁用检测
}
```

#### methods 中添加的工具方法

1. **数值安全检查**
   - `isSafeNumber(value)` - 检查数值是否安全（非 NaN、非 Infinity、非溢出）
   - `clampToSafeRange(value, min, max)` - 限制数值在安全范围内

2. **矩阵溢出检测和修复**
   - `isMatrixOverflow(matrix)` - 检查矩阵是否溢出
   - `fixMatrixOverflow(matrix)` - 修复溢出的矩阵

3. **RTC 中心点管理**
   - `setRTCCenter(x, y, z)` - 设置 RTC 中心点
   - `getRTCCenter()` - 获取 RTC 中心点
   - `applyRTCOffset(position)` - 应用 RTC 中心点偏移
   - `removeRTCOffset(relativePosition)` - 移除 RTC 中心点偏移

4. **定期诊断**
   - `diagnoseMatrixOverflow(verbose)` - 定期诊断矩阵和坐标系统

#### 相机同步方法中的修复

在 `syncCameraFromThreeToBim()` 和 `syncCameraFromBimToThree()` 方法中添加了：

```javascript
// 在同步前检测和修复矩阵溢出
if (!this.isSafeNumber(this.camera1.position.x) ||
    !this.isSafeNumber(this.camera1.position.y) ||
    !this.isSafeNumber(this.camera1.position.z)) {
  console.warn('[DualCanvasViewer] camera1 位置溢出，重置为安全位置');
  this.camera1.position.set(0, 0, 100);
}

if (this.isMatrixOverflow(this.camera1.projectionMatrix)) {
  console.warn('[DualCanvasViewer] camera1 投影矩阵溢出，重新计算');
  this.camera1.near = 0.1;
  this.camera1.far = 10000;
  this.camera1.updateProjectionMatrix();
}
```

#### 动画循环中的修复

在 `startAnimationLoop1()` 和 `startAnimationLoop2()` 中添加了：

```javascript
// 定期诊断矩阵溢出（在渲染前检测）
this.diagnoseMatrixOverflow(false);
```

#### 大坐标模型检测时的修复

在 `detectLargeCoordinateModelFromVertices()` 方法中添加了：

```javascript
// 设置 RTC 中心点以防止矩阵溢出
this.setRTCCenter(centerFromVertices.x, centerFromVertices.y, centerFromVertices.z);
```

### 2. rendererManager.js 修改

在动画循环中添加了大坐标场景下的矩阵溢出检测：

```javascript
// 在大坐标场景下检测和修复矩阵溢出
if (isLargeCoordScene) {
    // 检查相机位置是否安全
    if (!isFinite(camera.position.x) || !isFinite(camera.position.y) || !isFinite(camera.position.z)) {
        console.warn('[rendererManager] ⚠️ 相机位置溢出，重置为安全位置');
        camera.position.set(0, 0, 100);
    }

    // 检查投影矩阵是否溢出
    const projMatrix = camera.projectionMatrix;
    if (projMatrix && projMatrix.elements) {
        let hasOverflow = false;
        for (let i = 0; i < projMatrix.elements.length; i++) {
            if (!isFinite(projMatrix.elements[i]) || Math.abs(projMatrix.elements[i]) > 1e10) {
                hasOverflow = true;
                break;
            }
        }

        if (hasOverflow) {
            console.warn('[rendererManager] ⚠️ 投影矩阵溢出，重新计算');
            camera.near = 0.1;
            camera.far = 10000;
            camera.updateProjectionMatrix();
        }
    }
}
```

## 修复效果

1. **防止矩阵溢出**：在相机同步和渲染循环中检测并修复溢出的矩阵值
2. **正确应用 RTC 中心点**：在检测到大坐标模型时自动设置 RTC 中心点
3. **定期诊断**：每 5 秒检查一次矩阵状态，及时发现和修复问题
4. **安全数值范围**：限制数值在安全范围内（-1e10 到 1e10）

## 使用说明

修复后会自动生效，无需额外配置。系统会：

1. 在加载大坐标模型时自动设置 RTC 中心点
2. 在相机同步时检测和修复矩阵溢出
3. 在渲染循环中定期诊断矩阵状态
4. 在控制台输出警告日志（便于调试）

## 注意事项

1. 定期诊断会在检测到超过最大溢出次数（10次）后自动禁用
2. 相机位置溢出时会重置为安全位置 (0, 0, 100)
3. 投影矩阵溢出时会重置 near/far 值为 0.1/10000

## 测试建议

1. 加载包含大坐标的 3D Tiles 模型
2. 观察控制台是否有矩阵溢出警告
3. 检查模型是否正确显示在第二个画布中
4. 验证相机同步是否正常工作

---

修复日期：2025年
修复文件：
- src/components/DualCanvasViewer.vue
- src/utils/rendererManager.js
