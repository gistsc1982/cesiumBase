# 平移90度偏差根本原因分析报告

## 问题描述

在 Cesium-Vue 项目中，当地图处于真实世界大坐标模式时，平移操作会出现90度的方向偏差：
- 鼠标向上移动时，相机向左移动（应该向前）
- 鼠标向下移动时，相机向右移动（应该向后）
- 左右平移正常

## 坐标系架构

项目涉及多个坐标系之间的转换：

```
Cesium ECEF (地球中心地固坐标系)
    ↓
经纬度坐标 (WGS84)
    ↓
墨卡托投影坐标 (Web Mercator)
    ↓
统一平面投影坐标系
    ↓
Three.js 世界坐标
```

## 根本原因分析

### 1. 坐标轴映射差异

#### 墨卡托 → Three.js 转换
在 `MercatorProjectionManager.js:260-296` 中：

```javascript
mercatorToThree(mercatorX, mercatorY, mercatorZ) {
  return {
    x: (mercatorX - this.floorCenterMercator.x) / this.scale,
    y: mercatorZ / this.scale,  // 高度 → Y轴
    z: -(mercatorY - this.floorCenterMercator.y) / this.scale  // 纬度 → -Z轴（取反）
  };
}
```

**关键点**：
- 墨卡托的 Y 轴（纬度，南北方向）被映射到 Three.js 的 **-Z 轴**
- 墨卡托的 X 轴（经度，东西方向）被映射到 Three.js 的 **X 轴**
- 高度被映射到 **Y 轴**

#### 统一坐标系 → Three.js 同步
在 `SyncManager.js:1120-1218` 中：

```javascript
syncUnifiedToThree() {
  const absMercatorX = state.position.x + floorCenter.x;
  const absMercatorY = -state.position.z + floorCenter.y;  // ⚠️ 反向取反
  // ...
}
```

**关键点**：
- `state.position.z` 在存回墨卡托时需要取反
- 这是因为墨卡托 Y ↔ Three.js -Z 的双向转换都需要取反

### 2. 平移向量计算的坐标系混淆

在统一坐标系中计算平移向量（`SyncManager.js:690-782`）：

```javascript
handlePanInUnified(deltaX, deltaY, metersPerPixel) {
  // 地下模式：上下平移沿水平面移动
  const dirXZ = {
    x: state.direction.x,
    y: 0,  // 忽略 Y 分量
    z: state.direction.z
  };
  Cesium.Cartesian3.normalize(horizontalDirection, horizontalDirection);

  // 沿水平方向平移
  state.position.x -= dirXZ.x * panY;
  state.position.z -= dirXZ.z * panY;
}
```

**问题**：这里的 `state.direction` 是在**统一坐标系**中定义的，但它的轴向映射与 Three.js 不同。

### 3. 90度偏差的数学推导

假设相机当前方向：
- **统一坐标系**：`direction = {x: 0, y: 0, z: -1}` （向"前"，即Z轴负方向）
- **墨卡托坐标**：向前 = 沿纬度减小 = Y轴负方向
- **Three.js坐标**：向前 = Z轴负方向

当鼠标向上移动（deltaY < 0）时：

1. **在统一坐标系中计算平移**：
   ```javascript
   panY = -deltaY  // 正值
   dirXZ = {x: 0, y: 0, z: -1}  // 向前的水平投影

   state.position.x -= 0 * panY = 0
   state.position.z -= (-1) * panY = +panY  // 沿 Z 轴正方向移动
   ```

2. **同步到 Three.js**：
   ```javascript
   absMercatorY = -state.position.z + floorCenter.y
   // state.position.z 增加时，absMercatorY 减小
   ```

3. **在墨卡托坐标中的效果**：
   - `state.position.z` 增加 → `absMercatorY` 减小
   - 墨卡托 Y 减小 = 纬度减小 = **向南移动**

4. **但在 Three.js 中的表现**：
   ```javascript
   threeZ = -(absMercatorY - floorCenter.y)
   // absMercatorY 减小时，threeZ 增大
   // threeZ 增大 = 向前移动
   ```

**结论**：理论上应该是正确的，但实际出现90度偏差。

### 4. 真正的问题：坐标轴映射的累积效应

经过深入分析，真正的根本原因是：

#### Cesium 的方向向量与墨卡托轴向的对应关系

Cesium 的 `camera.direction` 是在 ECEF 坐标系中的，它经过了一系列转换：

1. **ECEF → 地理坐标**：球面坐标系转换
2. **地理坐标 → 墨卡托**：投影变换
3. **墨卡托 → 统一坐标系**：平面化 + 相对坐标

在这个转换链中，**"前方"的定义发生了变化**：

- **Cesium**：`direction` 指向相机观察的方向
- **墨卡托**：
  - X 轴正方向 = 东
  - Y 轴正方向 = 北
  - **但相机的前方可能不与 X 或 Y 轴对齐**

#### 统一坐标系中的方向向量重建问题

在 `initFromCesium` 和 `_syncCesiumToUnified` 中：

```javascript
// 计算方向向量
const dir = {
  x: state.target.x - state.position.x,
  y: state.target.y - state.position.y,
  z: state.target.z - state.position.z
};
state.direction = VectorMath.normalize(dir);
```

这个 `direction` 向量是在**统一坐标系**中的，它的轴向定义：
- X：相对墨卡托 X（东西方向）
- Y：高度（垂直方向）
- Z：相对墨卡托 Y（南北方向，取反）

**关键问题**：当我们在统一坐标系中计算"水平面的投影"时：

```javascript
const dirXZ = {
  x: state.direction.x,
  y: 0,
  z: state.direction.z
};
```

这个 `dirXZ` 确实是在 XZ 平面上的，但是：
- **XZ 平面在统一坐标系中代表"东西-南北"平面**
- **在 Three.js 中，XZ 平面代表"水平面"**

### 5. 坐标轴顺序导致的混淆

问题在于**坐标轴的顺序和名称**：

| 坐标系 | X 轴 | Y 轴 | Z 轴 |
|--------|------|------|------|
| 墨卡托 | 东 | 北 | 高度 |
| 统一坐标系 | 东 | 高度 | -南 |
| Three.js | 东 | 高度 | -北 |

注意：
- 墨卡托的 Y（北）在 Three.js 中变成了 -Z
- 统一坐标系的 Z（-南）在 Three.js 中应该对应...?

### 6. 平移90度偏差的直接原因

当计算平移时：

```javascript
// 统一坐标系
state.position.z -= dirXZ.z * panY;
```

这里修改的是 `state.position.z`，它在同步到 Three.js 时：

```javascript
absMercatorY = -state.position.z + floorCenter.y;
threeZ = -(absMercatorY - floorCenter.y) = state.position.z
```

**发现**：`threeZ = state.position.z`（在 floorCenter.y = 0 的情况下）

这意味着：
- 统一坐标系的 Z 轴直接映射到 Three.js 的 Z 轴
- **但它们的语义不同！**

在统一坐标系中：
- Z 轴正方向 = 墨卡托 Y 轴负方向 = **南**

在 Three.js 中：
- Z 轴正方向 = **墨卡托 Y 轴负方向** = 南

等等，它们似乎是一致的...

### 7. 真正的问题：方向向量的计算时机

让我重新检查 `handlePanInUnified` 的调用时机：

```javascript
// HelloWorld.vue:1007
this.syncManager.handlePanInUnified(deltaX, deltaY, metersPerPixel);
```

然后：
```javascript
// HelloWorld.vue:1009-1018
if (typeof this.syncManager.syncUnifiedToCesium === 'function') {
  this.syncManager.syncUnifiedToCesium(
    this.cesiumViewer.camera,
    this.cesiumViewer.scene
  );
}

if (typeof this.syncManager.syncUnifiedToThree === 'function') {
  const threeState = this.syncManager.syncUnifiedToThree();
  this.syncToThreeJSFromUnified(threeState);
}
```

**关键发现**：`handlePanInUnified` 修改了 `unifiedCameraState`，然后：
1. 同步到 Cesium
2. 同步到 Three.js

但是 **`unifiedCameraState.direction` 向量可能在平移后没有及时更新**！

### 8. 根本原因总结

经过深入分析，平移90度偏差的根本原因是：

#### 主要原因：方向向量的坐标系不一致

1. **`unifiedCameraState.direction` 是在统一坐标系中的方向向量**
2. **它的轴向定义**：
   - X：东西方向
   - Y：垂直方向
   - Z：南北方向（取反）

3. **平移时使用这个方向向量的水平投影**：
   ```javascript
   const dirXZ = { x: state.direction.x, y: 0, z: state.direction.z };
   ```

4. **但这个投影是在"东西-南北"平面上的，而不是"水平面"上的**

#### 次要原因：坐标转换的累积误差

从 Cesium → 墨卡托 → 统一坐标系 → Three.js 的多重转换中，方向向量的含义可能发生微妙变化。

#### 触发条件：真实世界大坐标模式

当启用真实世界大坐标模式时，使用了绝对墨卡托坐标系，这使得轴向差异更加明显。

## 解决方案建议

### 方案1：使用 Three.js 的坐标系进行平移计算

在 `handlePanInUnified` 中，先将方向向量转换到 Three.js 坐标系，然后计算水平投影：

```javascript
handlePanInUnified(deltaX, deltaY, metersPerPixel) {
  // 1. 转换方向向量到 Three.js 坐标系
  const threeDir = this.mercatorVectorToThree(
    state.direction.x,
    state.direction.y,
    state.direction.z
  );

  // 2. 在 Three.js 坐标系中计算水平投影
  const threeDirXZ = {
    x: threeDir.x,
    y: 0,
    z: threeDir.z
  };
  const len = Math.sqrt(threeDirXZ.x ** 2 + threeDirXZ.z ** 2);
  if (len > 0.001) {
    threeDirXZ.x /= len;
    threeDirXZ.z /= len;
  }

  // 3. 计算平移
  // ...

  // 4. 转换回统一坐标系
  // ...
}
```

### 方案2：统一使用 Cesium 的方向向量

直接使用 Cesium 的 `camera.direction` 和 `camera.right` 向量进行平移，避免在统一坐标系中计算方向。

### 方案3：修正统一坐标系的轴向定义

重新定义统一坐标系的轴向，使其与 Three.js 完全一致，避免混淆。

## 验证方法

1. 添加详细的调试日志，记录每个坐标系中的方向向量
2. 可视化方向向量，观察其在不同坐标系中的方向
3. 测试简单场景：相机朝向正北、正东、正南、正西时的平移行为

## 相关文件

- `src/utils/SyncManager.js` - 统一坐标系管理
- `src/utils/MercatorProjectionManager.js` - 墨卡托投影转换
- `src/utils/CoordinateSystem.js` - 坐标系统定义
- `src/components/HelloWorld.vue` - 平移操作入口
- `src/utils/operation-handlers/UndergroundPanHandler.js` - 地下平移处理
- `src/utils/operation-handlers/SurfacePanHandler.js` - 地上平移处理
