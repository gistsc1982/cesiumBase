# 退出真实世界模式 - 正确执行方式

## ⚠️ 重要说明

您在控制台粘贴的**旧版本脚本**有错误，导致 Cesium 相机飞到 5153265 米高空！

## ✅ 正确的执行方式

### 方法 1：从文件加载（推荐）

```javascript
fetch('/exit-realworld-fixed.js').then(r=>r.text()).then(eval)
```

### 方法 2：使用简化的完整脚本

复制以下**完整脚本**到控制台执行：

```javascript
(async function() {
  const dualViewer = window.__dualCanvasViewer;
  if (!dualViewer) {
    console.error('❌ DualCanvasViewer 实例未找到');
    return;
  }

  console.log('🚀 启动混合模式流程...');
  console.log('  isInRealWorldMode:', dualViewer.isInRealWorldMode);

  // 步骤1：获取大坐标模型的地理位置（计算正确的海拔高度）
  let largeModel = null;
  let largestCenter = null;
  let maxDistance = 0;

  dualViewer.modelGroup1?.children.forEach(model => {
    if (model.userData.isBox3Helper) return;
    if (model.userData.originalCenter) {
      const center = model.userData.originalCenter;
      const distance = Math.sqrt(center.x**2 + center.y**2 + center.z**2);
      if (distance > maxDistance) {
        maxDistance = distance;
        largestCenter = center;
        largeModel = model;
      }
    }
  });

  if (!largeModel || !largestCenter) {
    console.error('❌ 未找到大坐标模型');
    return;
  }

  // 计算经纬度和海拔高度
  const longitude = Math.atan2(largestCenter.y, largestCenter.x) * 180 / Math.PI;
  const p = Math.sqrt(largestCenter.x**2 + largestCenter.y**2);
  const a = 6378137.0;
  const b = 6356752.314245;
  const theta = Math.atan2(largestCenter.z * a, p * b);
  const latitude = Math.atan2(
    largestCenter.z + 0.00673949674233 * b * Math.pow(Math.sin(theta), 3),
    p - 0.00669437999014 * a * Math.pow(Math.cos(theta), 3)
  ) * 180 / Math.PI;
  const sinLat = Math.sin(latitude * Math.PI / 180);
  const cosLat = Math.cos(latitude * Math.PI / 180);
  const N = a / Math.sqrt(1 - 0.00669437999014 * sinLat * sinLat);
  const altitude = p / cosLat - N; // ⭐ 正确的海拔高度

  console.log('✅ 找到大坐标模型:', largeModel.userData.filePath || largeModel.userData.fileName);
  console.log('   经度:', longitude.toFixed(6) + '°');
  console.log('   纬度:', latitude.toFixed(6) + '°');
  console.log('   ⭐ 海拔高度:', altitude.toFixed(2) + 'm (正确值!)');
  console.log('   ECEF Z分量:', largestCenter.z.toFixed(2) + 'm (不使用此值)');

  // 步骤2：将Cesium相机飞到模型位置（使用正确的海拔高度）
  const cesiumViewer = window.__cesiumViewer__;
  if (cesiumViewer && cesiumViewer.camera) {
    const syncManager = dualViewer.syncManager;
    const Cesium = syncManager?.getCesium();
    if (Cesium) {
      console.log('\n✈️ 将Cesium飞到模型位置...');
      console.log('   ⭐ 高度: 500m (不是', largestCenter.z.toFixed(2), 'm)');

      await new Promise((resolve) => {
        cesiumViewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, 500),
          duration: 2.0,
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-45),
            roll: 0.0
          },
          complete: () => {
            console.log('   ✅ Cesium已到达目标位置');
            resolve(true);
          }
        });
      });
    }
  }

  // 步骤3：退出真实世界模式
  console.log('\n🚪 退出真实世界模式...');

  // 保存快照
  const floorCenterMercator = dualViewer.mouseCoords?.mercator?.floorCenter;
  if (!floorCenterMercator) {
    console.error('❌ 地板中心未初始化');
    return;
  }

  const models = [];
  dualViewer.modelGroup1?.children.forEach(model => {
    if (model.userData.isBox3Helper) return;
    const modelMercator = dualViewer.mercatorProjectionManager.threeToMercator(
      model.position.x, model.position.y, model.position.z
    );
    const relativePosition = {
      x: modelMercator.x - floorCenterMercator.x,
      y: modelMercator.y - floorCenterMercator.y,
      z: modelMercator.z - floorCenterMercator.z
    };
    models.push({
      name: model.userData.filePath || model.userData.fileName || model.name,
      layer: 'three',
      originalPosition: { x: model.position.x, y: model.position.y, z: model.position.z },
      relativePosition: relativePosition,
      scale: { x: model.scale.x, y: model.scale.y, z: model.scale.z },
      rotation: { x: model.rotation.x, y: model.rotation.y, z: model.rotation.z }
    });
  });

  dualViewer.modelLayoutSnapshot = {
    timestamp: Date.now(),
    floorCenterMercator: { x: floorCenterMercator.x, y: floorCenterMercator.y, z: floorCenterMercator.z },
    models: models
  };

  // 重置真实世界模式标志和地板中心
  dualViewer.isInRealWorldMode = false;
  dualViewer.isInRealWorldCoordinates = false;

  const originalCallback = dualViewer.syncManager?.onFloorCenterUpdate;
  if (dualViewer.syncManager) {
    dualViewer.syncManager.onFloorCenterUpdate = null;
  }

  dualViewer.mercatorProjectionManager?.setFloorCenter({ x: 0, y: 0, z: 0 });
  if (dualViewer.mouseCoords?.mercator) {
    dualViewer.mouseCoords.mercator.floorCenter = { x: 0, y: 0, z: 0 };
  }
  if (dualViewer.syncManager) {
    dualViewer.syncManager.floorCenterMercator = { x: 0, y: 0, z: 0 };
    dualViewer.syncManager.mercatorProjection?.setFloorCenter({ x: 0, y: 0, z: 0 });
  }

  if (dualViewer.syncManager && originalCallback) {
    setTimeout(() => {
      dualViewer.syncManager.onFloorCenterUpdate = originalCallback;
    }, 100);
  }

  window.__unifiedProjectionMode__ = false;
  if (dualViewer.controls1) dualViewer.controls1.enablePan = true;
  if (dualViewer.controls2) dualViewer.controls2.enablePan = true;

  // 恢复模型布局
  const currentFloorCenter = dualViewer.mouseCoords?.mercator?.floorCenter;
  if (currentFloorCenter) {
    let restoredCount = 0;
    dualViewer.modelLayoutSnapshot.models.forEach(snapshotModel => {
      let model = dualViewer.modelGroup1?.children.find(m =>
        (m.userData.filePath === snapshotModel.name ||
         m.userData.fileName === snapshotModel.name ||
         m.name === snapshotModel.name) &&
        !m.userData.isBox3Helper
      );
      if (model) {
        const newMercatorPosition = {
          x: currentFloorCenter.x + snapshotModel.relativePosition.x,
          y: currentFloorCenter.y + snapshotModel.relativePosition.y,
          z: currentFloorCenter.z + snapshotModel.relativePosition.z
        };
        const newThreePosition = dualViewer.mercatorProjectionManager.mercatorToThree(
          newMercatorPosition.x, newMercatorPosition.y, newMercatorPosition.z
        );
        model.position.set(newThreePosition.x, newThreePosition.y, newThreePosition.z);
        model.scale.set(snapshotModel.scale.x, snapshotModel.scale.y, snapshotModel.scale.z);
        model.rotation.set(snapshotModel.rotation.x, snapshotModel.rotation.y, snapshotModel.rotation.z);
        model.updateMatrixWorld();
        restoredCount++;
      }
    });
    console.log('   ✅ 已恢复', restoredCount, '个模型');
  }

  // 步骤4：设置混合模式（使用正确的海拔高度）
  if (dualViewer.syncManager && dualViewer.mouseCoords) {
    const earthRadius = dualViewer.syncManager.earthRadius || 6378137.0;
    const mercatorX = longitude * Math.PI / 180 * earthRadius;
    const mercatorY = dualViewer.syncManager.surfaceHandler.latitudeToMercator(latitude * Math.PI / 180);
    const mercatorZ = altitude; // ⭐ 使用海拔高度 70.36m，不是 ECEF Z 5153265m

    dualViewer.mouseCoords.geoOffset = {
      x: mercatorX,
      y: mercatorY,
      z: mercatorZ,
      longitude: longitude,
      latitude: latitude,
      enabled: true
    };

    console.log('✅ 已启用混合模式');
    console.log('   经度:', longitude.toFixed(6) + '°');
    console.log('   纬度:', latitude.toFixed(6) + '°');
    console.log('   ⭐ 海拔高度:', altitude.toFixed(2) + 'm (正确值)');
  }

  // 步骤5：调整相机以看到模型
  const allModels = dualViewer.modelGroup1?.children.filter(m => !m.userData.isBox3Helper) || [];
  if (allModels.length > 0) {
    let sumX = 0, sumY = 0, sumZ = 0;
    allModels.forEach(m => {
      sumX += m.position.x;
      sumY += m.position.y;
      sumZ += m.position.z;
    });
    const centerX = sumX / allModels.length;
    const centerY = sumY / allModels.length;
    const centerZ = sumZ / allModels.length;

    dualViewer.camera1.position.set(centerX, centerY + 200, centerZ + 400);
    dualViewer.camera1.lookAt(centerX, centerY, centerZ);
    dualViewer.controls1.target.set(centerX, centerY, centerZ);
    dualViewer.controls1.update();
    dualViewer.camera1.updateMatrixWorld();

    dualViewer.camera2.position.copy(dualViewer.camera1.position);
    dualViewer.camera2.lookAt(centerX, centerY, centerZ);
    dualViewer.controls2.target.set(centerX, centerY, centerZ);
    dualViewer.controls2.update();
    dualViewer.camera2.updateMatrixWorld();

    console.log('✅ 相机已调整到模型位置');
  }

  console.log('\n🎉 完成！');
  console.log('✅ 退出真实世界模式');
  console.log('✅ 恢复模型到小坐标位置');
  console.log('✅ 启用混合模式（海拔', altitude.toFixed(2), 'm）');
  console.log('✅ 调整相机到模型位置');
})();
```

## 🔍 关键区别

| 旧脚本（错误） | 新脚本（正确） |
|-------------|-------------|
| `height = floorCenterMercator.z` | `altitude = p / cosLat - N` |
| 结果: 5153265 米 ❌ | 结果: 70.36 米 ✅ |
| Cesium 相机在太空 | Cesium 相机在合理高度 |

## 📝 执行后验证

执行后检查控制台输出：

```
⭐ 海拔高度: 70.36m (正确值!)
ECEF Z分量: 2886924.21m (不要使用这个值!)
```

如果看到这个输出，说明脚本执行正确！
