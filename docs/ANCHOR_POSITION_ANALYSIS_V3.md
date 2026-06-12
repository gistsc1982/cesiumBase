# 模型局部墨卡托坐标系方案

## 📋 核心思想

### 传统方案的问题
```
模型 Three.js 坐标固定 → 相机翻转 → 模型位置错误
```

### 新方案：双向坐标同步
```
模型局部墨卡托坐标（固定） ↔ Three.js 坐标（动态）
                    ↓
              相机翻转时重新转换
```

---

## 🎯 设计原则

### 1. 坐标系定义

**模型局部墨卡托坐标（Model Local Mercator, MLM）：**
- 固定不变
- 表示模型在世界中的真实位置
- 单位：米
- 格式：`{ mercatorX, mercatorY, mercatorZ }`
  - mercatorX: 经度方向（东为正）
  - mercatorY: 纬度方向（南为正，取反）
  - mercatorZ: 高度方向（上为正）

**Three.js 世界坐标：**
- 动态变化
- 随相机翻转而更新
- 相对于当前视图位置
- 格式：`{ x, y, z }`
  - x: 东方向
  - y: 高度方向
  - z: 北方向（与墨卡托 Y 相反）

### 2. 坐标转换关系

```
┌─────────────────────────────────────────────┐
│  模型局部墨卡托坐标（固定）                    │
│         model.userData.mercatorCoord         │
└──────────────┬──────────────────────────────┘
               │ 转换
               ↓
┌─────────────────────────────────────────────┐
│  Three.js 世界坐标（动态）                    │
│         model.position                       │
└─────────────────────────────────────────────┘

转换公式：
  threePos = mercatorToThree(modelMLM) - floorCenterThree
  modelMLM = threeToMercator(threePos) + floorCenterMercator
```

---

## 🏗️ 架构设计

### 核心组件

```
┌─────────────────────────────────────────────────────────┐
│                    ModelTransformManager                │
│  管理所有模型的坐标转换和同步                            │
├─────────────────────────────────────────────────────────┤
│  - modelMercatorRegistry: Map<modelId, MercatorCoord>  │
│  - transformOrigin: { mercatorX, mercatorY, mercatorZ } │
│  - syncAllModels()                                     │
│  - updateModelPosition(model)                          │
│  - onCameraRotate()                                    │
└─────────────────────────────────────────────────────────┘
```

---

## 📐 详细实现

### 1. 模型加载时保存墨卡托坐标

```javascript
/**
 * 加载模型并保存其墨卡托坐标
 */
async function loadModelWithMercatorCoord(file) {
  // 1. 加载模型
  const gltf = await loader.loadAsync(file);
  const model = gltf.scene;

  // 2. 获取模型的原始墨卡托坐标
  const originalMercator = getModelOriginalMercatorCoord(model);
  // 例如：
  // {
  //   mercatorX: 12345678.9,  // 经度方向
  //   mercatorY: 3456789.1,   // 纬度方向
  //   mercatorZ: 50.0         // 高度
  // }

  // 3. 转换到当前 Three.js 坐标系
  const threePos = mercatorToThree(
    originalMercator.mercatorX,
    originalMercator.mercatorY,
    originalMercator.mercatorZ
  );

  // 4. 设置模型位置
  model.position.copy(threePos);

  // ⭐ 5. 保存原始墨卡托坐标到 userData
  model.userData.mercatorCoord = {
    mercatorX: originalMercator.mercatorX,
    mercatorY: originalMercator.mercatorY,
    mercatorZ: originalMercator.mercatorZ
  };

  // ⭐ 6. 注册到坐标管理器
  ModelTransformManager.registerModel(model);

  return model;
}
```

### 2. ModelTransformManager 核心实现

```javascript
/**
 * 模型坐标变换管理器
 */
class ModelTransformManager {
  constructor() {
    // 模型墨卡托坐标注册表
    this.modelMercatorRegistry = new Map();

    // 变换原点（当前相机的墨卡托坐标）
    this.transformOrigin = {
      mercatorX: 0,
      mercatorY: 0,
      mercatorZ: 0
    };

    // 监听相机变化
    this.setupCameraListener();
  }

  /**
   * 注册模型
   */
  registerModel(model) {
    if (!model.userData.mercatorCoord) {
      console.warn('[ModelTransformManager] 模型缺少墨卡托坐标');
      return;
    }

    const modelId = model.uuid;
    this.modelMercatorRegistry.set(modelId, {
      mercatorCoord: { ...model.userData.mercatorCoord },
      model: model
    });

    console.log('[ModelTransformManager] 注册模型:', {
      id: modelId,
      name: model.name,
      mercatorCoord: model.userData.mercatorCoord
    });
  }

  /**
   * 设置变换原点（相机位置）
   */
  setTransformOrigin(mercatorX, mercatorY, mercatorZ) {
    this.transformOrigin = {
      mercatorX,
      mercatorY,
      mercatorZ
    };

    console.log('[ModelTransformManager] 设置变换原点:', {
      x: mercatorX.toFixed(2),
      y: mercatorY.toFixed(2),
      z: mercatorZ.toFixed(2)
    });
  }

  /**
   * 同步所有模型的位置
   * 在相机翻转时调用
   */
  syncAllModels() {
    console.log('[ModelTransformManager] 开始同步所有模型...');
    const startTime = performance.now();

    let syncCount = 0;
    for (const [modelId, data] of this.modelMercatorRegistry) {
      this.updateModelPosition(data.model);
      syncCount++;
    }

    const elapsed = performance.now() - startTime;
    console.log(`[ModelTransformManager] 同步完成: ${syncCount} 个模型, 耗时 ${elapsed.toFixed(2)}ms`);
  }

  /**
   * 更新单个模型的位置
   */
  updateModelPosition(model) {
    const mercatorCoord = model.userData.mercatorCoord;
    if (!mercatorCoord) {
      return;
    }

    // ⭐ 核心：从墨卡托坐标重新计算 Three.js 坐标
    const threePos = SyncManager.getInstance().mercatorToThree(
      mercatorCoord.mercatorX,
      mercatorCoord.mercatorY,
      mercatorCoord.mercatorZ
    );

    // 更新模型位置
    model.position.set(threePos.x, threePos.y, threePos.z);

    // 更新模型的变换矩阵
    model.updateMatrixWorld();
  }

  /**
   * 监听相机变化
   */
  setupCameraListener() {
    // 监听 SyncManager 的旋转事件
    document.addEventListener('cameraRotateStart', () => {
      console.log('[ModelTransformManager] 相机开始旋转');
      this.saveOriginalStates();
    });

    document.addEventListener('cameraRotateEnd', () => {
      console.log('[ModelTransformManager] 相机结束旋转');
      this.syncAllModels();
    });
  }

  /**
   * 保存原始状态（用于调试）
   */
  saveOriginalStates() {
    this.originalStates = new Map();

    for (const [modelId, data] of this.modelMercatorRegistry) {
      this.originalStates.set(modelId, {
        position: data.model.position.clone(),
        mercatorCoord: { ...data.mercatorCoord }
      });
    }
  }

  /**
   * 验证模型位置是否正确（调试用）
   */
  verifyModelPositions() {
    console.log('[ModelTransformManager] 验证模型位置...');

    for (const [modelId, data] of this.modelMercatorRegistry) {
      const model = data.model;
      const mercatorCoord = data.mercatorCoord;

      // 反向转换：从 Three.js 坐标转回墨卡托
      const currentMercator = SyncManager.getInstance().threeToMercator(
        model.position.x,
        model.position.y,
        model.position.z
      );

      // 比较
      const deltaX = Math.abs(currentMercator.x - mercatorCoord.mercatorX);
      const deltaY = Math.abs(currentMercator.y - mercatorCoord.mercatorY);
      const deltaZ = Math.abs(currentMercator.z - mercatorCoord.mercatorZ);

      if (deltaX > 0.1 || deltaY > 0.1 || deltaZ > 0.1) {
        console.warn(`[ModelTransformManager] 模型 ${modelId} 位置不准确:`, {
          expected: mercatorCoord,
          current: currentMercator,
          delta: { x: deltaX, y: deltaY, z: deltaZ }
        });
      }
    }
  }
}

// 单例
const modelTransformManager = new ModelTransformManager();
```

### 3. 修改 SyncManager 的旋转逻辑

```javascript
/**
 * 在统一坐标系中处理旋转（修改版）
 */
handleRotateInUnified(deltaX, deltaY) {
  const params = this.mouseOperationParams;
  const state = this.unifiedCameraState;

  const originalDirection = { ...state.direction };
  const originalPosition = { ...state.position };
  const originalTarget = { ...state.target };

  // ⭐ 新增：保存原始相机墨卡托坐标
  const originalCameraMercator = this.getCurrentCameraMercator();

  // ... 现有的旋转逻辑 ...

  // 执行方向向量旋转
  let newDirection = { ...originalDirection };
  // ... 旋转计算 ...

  // 更新状态
  state.direction = newDirection;

  // 根据新的方向和高度计算相机位置
  state.position = {
    x: state.target.x - state.direction.x * originalHeight,
    y: state.target.y - state.direction.y * originalHeight,
    z: state.target.z - state.direction.z * originalHeight
  };

  // ⭐ 关键新增：计算相机墨卡托坐标的变化
  const newCameraMercator = this.getCurrentCameraMercator();
  const mercatorDelta = {
    x: newCameraMercator.x - originalCameraMercator.x,
    y: newCameraMercator.y - originalCameraMercator.y,
    z: newCameraMercator.z - originalCameraMercator.z
  };

  // ⭐ 触发模型同步
  if (Math.abs(mercatorDelta.x) > 0.1 ||
      Math.abs(mercatorDelta.y) > 0.1 ||
      Math.abs(mercatorDelta.z) > 0.1) {

    console.log('[SyncManager] 相机墨卡托坐标变化，同步模型:', {
      delta: mercatorDelta
    });

    // 更新 ModelTransformManager 的变换原点
    ModelTransformManager.setTransformOrigin(
      newCameraMercator.x,
      newCameraMercator.y,
      newCameraMercator.z
    );

    // 同步所有模型
    ModelTransformManager.syncAllModels();
  }

  // ... 其余逻辑 ...
}

/**
 * 获取当前相机的墨卡托坐标
 */
getCurrentCameraMercator() {
  if (!this.cesiumViewer || !this.cesiumViewer.camera) {
    return { x: 0, y: 0, z: 0 };
  }

  const camera = this.cesiumViewer.camera;
  const ellipsoid = this.cesiumViewer.scene.globe.ellipsoid;
  const cartographic = ellipsoid.cartesianToCartographic(camera.position);

  const earthRadius = 6378137.0;
  return {
    x: cartographic.longitude * earthRadius,
    y: this.surfaceHandler.latitudeToMercator(cartographic.latitude),
    z: cartographic.height
  };
}
```

### 4. 使用视线交点作为锚点

```javascript
/**
 * 选中模型（使用视线交点锚点 + 墨卡托坐标同步）
 */
selectModelGeneric(model, layerConfig) {
  // 1. 取消之前的选择
  this.deselectModelGeneric(layerConfig);

  // 2. 获取相机视线与地面的交点
  const viewGroundPoint = this.getCameraViewGroundPoint();
  if (!viewGroundPoint) {
    console.warn('[selectModel] 无法获取视线交点，使用降级方案');
    // 降级方案：使用模型底部
    const bottom = this.computeModelBottom(model);
    this.selectWithModelBottomAnchor(model, layerConfig, bottom);
    return;
  }

  // 3. 转换到 Three.js 坐标系
  const anchorThree = this.mercatorToThree(
    viewGroundPoint.mercatorX,
    viewGroundPoint.mercatorY,
    viewGroundPoint.mercatorZ
  );

  // 4. 创建锚点（在视线交点）
  const anchor = new THREE.Object3D();
  anchor.position.copy(anchorThree);
  scene.add(anchor);

  // 5. 保存锚点信息到模型
  model.userData._transformAnchor = anchor;
  model.userData._viewGroundPoint = viewGroundPoint;

  // ⭐ 6. 关键：保存模型相对于锚点的偏移量（Three.js 坐标）
  model.userData._anchorOffset = {
    x: model.position.x - anchor.position.x,
    y: model.position.y - anchor.position.y,
    z: model.position.z - anchor.position.z
  };

  // ⭐ 7. 同时保存墨卡托坐标偏移（用于同步）
  const modelMercator = model.userData.mercatorCoord;
  model.userData._mercatorOffset = {
    x: modelMercator.mercatorX - viewGroundPoint.mercatorX,
    y: modelMercator.mercatorY - viewGroundPoint.mercatorY,
    z: modelMercator.mercatorZ - viewGroundPoint.mercatorZ
  };

  // 8. 选中模型并附加 TransformControls
  layerConfig.setSelectedModel(model);
  transformControls.attach(anchor);

  // 9. 更新 controls.target
  const controls = layerId === 'three' ? this.controls1 : this.controls2;
  if (controls) {
    controls.target.copy(anchorThree);
  }

  // 10. 视觉反馈
  this.highlightModelGeneric(model, true);

  // 11. 更新大坐标模型选中状态
  this.updateLargeCoordModelSelectedState();

  console.log('[selectModel] 使用视线交点锚点:', {
    anchorPosition: anchorThree,
    modelPosition: model.position,
    offset: model.userData._anchorOffset,
    mercatorOffset: model.userData._mercatorOffset
  });
}

/**
 * 获取相机视线与地面的交点
 */
getCameraViewGroundPoint() {
  const Cesium = this.getCesium();
  if (!Cesium || !this.cesiumViewer) {
    return null;
  }

  const camera = this.cesiumViewer.camera;
  const scene = this.cesiumViewer.scene;

  // 使用射线检测
  const ray = new Cesium.Ray(camera.position, camera.direction);
  const intersection = scene.globe.pick(ray, scene);

  if (!intersection) {
    // 视线指向天空
    return null;
  }

  // 转换为地理坐标
  const ellipsoid = scene.globe.ellipsoid;
  const cartographic = ellipsoid.cartesianToCartographic(intersection);

  const earthRadius = 6378137.0;
  return {
    mercatorX: cartographic.longitude * earthRadius,
    mercatorY: this.surfaceHandler.latitudeToMercator(cartographic.latitude),
    mercatorZ: 0  // 地面高度
  };
}
```

### 5. TransformControls 变换处理

```javascript
/**
 * TransformControls 变换事件处理
 */
onTransformControlsChange() {
  const model = this.selectedModel1;
  if (!model || !model.userData._transformAnchor) {
    return;
  }

  const anchor = model.userData._transformAnchor;

  // ⭐ 方案 A：实时更新模型墨卡托坐标（推荐）
  // 这样模型的位置会"跟随"锚点移动

  // 1. 获取锚点的新墨卡托坐标
  const anchorMercator = this.threeToMercator(
    anchor.position.x,
    anchor.position.y,
    anchor.position.z
  );

  // 2. 计算模型的新墨卡托坐标
  const mercatorOffset = model.userData._mercatorOffset;
  const newModelMercator = {
    x: anchorMercator.x + mercatorOffset.x,
    y: anchorMercator.y + mercatorOffset.y,
    z: anchorMercator.z + mercatorOffset.z
  };

  // 3. 更新模型的墨卡托坐标
  model.userData.mercatorCoord = newModelMercator;

  // 4. 同步更新 Three.js 坐标
  const newModelThree = this.mercatorToThree(
    newModelMercator.x,
    newModelMercator.y,
    newModelMercator.z
  );
  model.position.set(newModelThree.x, newModelThree.y, newModelThree.z);

  // 5. 更新偏移量
  model.userData._anchorOffset = {
    x: model.position.x - anchor.position.x,
    y: model.position.y - anchor.position.y,
    z: model.position.z - anchor.position.z
  };

  console.log('[TransformChange] 模型已移动:', {
    oldMercator: mercatorOffset,
    anchorMercator: anchorMercator,
    newModelMercator: newModelMercator
  });
}

/**
 * TransformControls 拖拽结束
 */
onTransformControlsMouseUp() {
  // 拖拽结束后，验证并同步所有模型
  ModelTransformManager.verifyModelPositions();
  ModelTransformManager.syncAllModels();
}
```

---

## 🔄 完整数据流

### 场景 1：加载模型

```
1. 加载 GLB 文件
   ↓
2. 读取模型的原始墨卡托坐标
   model.userData.mercatorCoord = {
     mercatorX: 12345678.9,
     mercatorY: 3456789.1,
     mercatorZ: 50.0
   }
   ↓
3. 转换到当前 Three.js 坐标系
   threePos = mercatorToThree(mercatorCoord)
   model.position = threePos
   ↓
4. 注册到 ModelTransformManager
```

### 场景 2：选中模型

```
1. 用户点击模型
   ↓
2. 获取相机视线交点
   viewGroundPoint = getCameraViewGroundPoint()
   ↓
3. 创建锚点在视线交点
   anchor.position = mercatorToThree(viewGroundPoint)
   ↓
4. 计算偏移量
   offset = {
     three: model.position - anchor.position,
     mercator: model.mercatorCoord - viewGroundPoint
   }
   ↓
5. 附加 TransformControls 到锚点
```

### 场景 3：相机旋转

```
1. 用户拖拽鼠标旋转相机
   ↓
2. SyncManager.handleRotateInUnified()
   - 更新相机方向
   - 更新相机位置
   - 计算相机墨卡托坐标变化
   ↓
3. 触发 ModelTransformManager.syncAllModels()
   for each model:
     newThreePos = mercatorToThree(model.mercatorCoord)
     model.position = newThreePos
   ↓
4. 所有模型位置更新完成
   - 模型的墨卡托坐标不变
   - 模型的 Three.js 坐标更新
   - 视觉上：模型"随相机翻转"
```

### 场景 4：拖拽 Gizmo

```
1. 用户拖拽 TransformControls
   ↓
2. 锚点位置改变
   anchor.position += delta
   ↓
3. 计算新的墨卡托坐标
   anchorMercator = threeToMercator(anchor.position)
   modelMercator = anchorMercator + mercatorOffset
   ↓
4. 更新模型墨卡托坐标
   model.userData.mercatorCoord = modelMercator
   ↓
5. 同步 Three.js 坐标
   model.position = mercatorToThree(modelMercator)
```

---

## 🎨 可视化示例

### 坐标转换示意图

```
世界空间（墨卡托坐标，固定）：
┌─────────────────────────────────────────┐
│                                         │
│      模型 A: (1000, 2000, 50)           │
│           ●                             │
│                                         │
│                      模型 B: (3000, 4000, 60)
│                           ●             │
└─────────────────────────────────────────┘

相机视角 1（初始）：
┌─────────────────────────────────────────┐
│    相机: (1500, 2500, 500)              │
│           ↓                             │
│           ●                             │
│        ↙  ↙                             │
│     A  ●  ●  B                          │
└─────────────────────────────────────────┘
Three.js 坐标：
  A: (-500, -2450, -500)
  B: (1500, -2440, 1500)

相机旋转后（视角 2）：
┌─────────────────────────────────────────┐
│         相机: (1500, 2500, 500)          │
│               ↓                         │
│               ●                         │
│            ↙                            │
│         ●  ●                            │
│         A  B                            │
└─────────────────────────────────────────┘
重新计算 Three.js 坐标：
  A: (-500, -2450, 500)   ← Y 不变，XZ 变化
  B: (1500, -2440, -1500)  ← Y 不变，XZ 变化

关键：模型的墨卡托坐标始终不变！
```

---

## ✅ 方案优势

### 1. **彻底解决旋转问题**
```
✅ 模型绕自身旋转，不是绕视线交点
✅ 旋转后模型位置正确
✅ 不会出现"大圆弧"问题
```

### 2. **Gizmo 始终可见**
```
✅ 锚点在视线交点
✅ Gizmo 始终在视野中心
✅ 用户随时可以操作
```

### 3. **Target 计算简单**
```
✅ 直接使用视线交点
✅ 不需要复杂的距离判断
✅ 不需要 200 米阈值
```

### 4. **真实世界模式一致性**
```
✅ 操作中心 = 视觉焦点
✅ 模型位置基于墨卡托坐标（真实世界坐标）
✅ 符合"在真实世界中操作"的直觉
```

### 5. **坐标系统一**
```
✅ 所有模型共享同一个墨卡托坐标系
✅ 相机翻转自动同步所有模型
✅ 不需要单独处理每个模型
```

---

## ⚠️ 注意事项

### 1. 性能优化

```javascript
/**
 * 批量同步优化
 */
syncAllModels() {
  // 使用时间切片，避免阻塞
  const models = Array.from(this.modelMercatorRegistry.values());
  const batchSize = 50;

  for (let i = 0; i < models.length; i += batchSize) {
    const batch = models.slice(i, i + batchSize);
    requestAnimationFrame(() => {
      batch.forEach(data => this.updateModelPosition(data.model));
    });
  }
}
```

### 2. 精度控制

```javascript
/**
 * 只在相机变化超过阈值时才同步
 */
handleRotateInUnified(deltaX, deltaY) {
  // ... 旋转逻辑 ...

  // ⭐ 只在显著变化时同步
  if (Math.abs(mercatorDelta.x) > 1.0 ||
      Math.abs(mercatorDelta.y) > 1.0 ||
      Math.abs(mercatorDelta.z) > 0.5) {
    ModelTransformManager.syncAllModels();
  }
}
```

### 3. 边界情况处理

```javascript
/**
 * 处理视线指向天空的情况
 */
getCameraViewGroundPoint() {
  const ray = new Cesium.Ray(camera.position, camera.direction);
  const intersection = scene.globe.pick(ray, scene);

  if (!intersection) {
    // 视线指向天空，使用地平线交点
    const ray = new Cesium.Ray(camera.position, camera.direction);
    const ellipsoid = scene.globe.ellipsoid;
    const intersection = Cesium.IntersectionTests.rayEllipsoid(
      ray,
      ellipsoid
    );

    if (intersection) {
      return this.cartesianToMercator(intersection);
    }

    // 降级：使用相机正下方
    return this.getCameraNadirPoint();
  }

  return this.cartesianToMercator(intersection);
}
```

---

## 📊 完整对比表

| 维度 | 当前方案 | 视线交点方案 | 墨卡托坐标方案 |
|------|---------|-------------|--------------|
| **Gizmo 可见性** | ⭐⭐⭐☆☆ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **旋转操作** | ⭐⭐⭐⭐⭐ | ⭐⭐☆☆☆ | ⭐⭐⭐⭐⭐ |
| **缩放操作** | ⭐⭐⭐⭐⭐ | ⭐⭐☆☆☆ | ⭐⭐⭐⭐⭐ |
| **Target 计算** | ⭐⭐⭐☆☆ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **代码复杂度** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐☆☆ | ⭐⭐⭐☆☆ |
| **维护成本** | ⭐⭐⭐⭐☆ | ⭐⭐⭐☆☆ | ⭐⭐⭐☆☆ |
| **性能影响** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐☆ | ⭐⭐⭐☆☆ |
| **真实世界一致性** | ⭐⭐⭐☆☆ | ⭐⭐⭐⭐☆ | ⭐⭐⭐⭐⭐ |
| **扩展性** | ⭐⭐⭐☆☆ | ⭐⭐⭐☆☆ | ⭐⭐⭐⭐⭐ |

**墨卡托坐标方案综合：⭐⭐⭐⭐☆ (4/5) - 强烈推荐**

---

## 🚀 实施路线图

### 阶段 1：基础设施（1-2 天）
- [ ] 实现 `ModelTransformManager` 类
- [ ] 添加模型墨卡托坐标保存逻辑
- [ ] 实现坐标转换工具函数

### 阶段 2：集成到加载流程（1 天）
- [ ] 修改 `loadModel()` 函数
- [ ] 保存模型墨卡托坐标
- [ ] 注册到 `ModelTransformManager`

### 阶段 3：修改旋转逻辑（2-3 天）
- [ ] 修改 `handleRotateInUnified()`
- [ ] 添加相机墨卡托坐标计算
- [ ] 实现模型同步逻辑

### 阶段 4：修改选中逻辑（1-2 天）
- [ ] 实现 `getCameraViewGroundPoint()`
- [ ] 修改 `selectModelGeneric()`
- [ ] 使用视线交点作为锚点

### 阶段 5：TransformControls 集成（2-3 天）
- [ ] 实现 `onTransformControlsChange()`
- [ ] 实时更新模型墨卡托坐标
- [ ] 同步 Three.js 坐标

### 阶段 6：优化和测试（2-3 天）
- [ ] 性能优化（时间切片）
- [ ] 精度控制（阈值判断）
- [ ] 边界情况处理
- [ ] 完整测试

**总计：9-14 天**

---

## 📝 总结

### 核心创新

**模型局部墨卡托坐标方案**通过维护固定的墨卡托坐标，实现了：

1. ✅ Gizmo 始终可见（视线交点锚点）
2. ✅ 模型绕自身旋转（墨卡托坐标固定）
3. ✅ 翻转后位置正确（自动同步转换）
4. ✅ 真实世界模式一致（基于墨卡托坐标）
5. ✅ Target 计算简单（直接用视线交点）

### 关键代码

```javascript
// 模型加载时
model.userData.mercatorCoord = { x, y, z };  // 固定不变

// 相机旋转时
for each model:
  model.position = mercatorToThree(model.mercatorCoord);  // 重新转换

// 拖拽 Gizmo 时
model.mercatorCoord += delta;  // 更新墨卡托坐标
model.position = mercatorToThree(model.mercatorCoord);  // 同步 Three.js
```

---

**文档版本：** 3.0（墨卡托坐标方案）
**分析日期：** 2024年
**结论：** ✅✅ 强烈推荐，这是最优方案
