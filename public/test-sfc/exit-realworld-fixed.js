// ═══════════════════════════════════════════════════════════════════
// 最终版本：退出真实世界模式并保持模型相对位置
// ═══════════════════════════════════════════════════════════════════
// 改进：
// 1. 增加延迟确保相机设置不被覆盖
// 2. 使用 requestAnimationFrame 确保在渲染循环中应用
// 3. 多次验证相机位置
//
// 使用方法：在真实世界模式下，在浏览器控制台执行此脚本
// ═══════════════════════════════════════════════════════════════════

(async function() {
  const dualViewer = window.__dualCanvasViewer;
  if (!dualViewer) {
    console.error('❌ DualCanvasViewer 实例未找到');
    return;
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  🚀 退出真实世界模式并保持模型相对位置（最终版本）          ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // ═══════════════════════════════════════════════════════════════════
  // 步骤1：分析模型位置
  // ═══════════════════════════════════════════════════════════════════
  console.log('📍 [步骤1] 分析模型位置...');

  const currentFloorCenter = dualViewer.mouseCoords?.mercator?.floorCenter;
  if (!currentFloorCenter || (currentFloorCenter.x === 0 && currentFloorCenter.y === 0)) {
    console.error('❌ 地板中心未初始化或为原点，无法继续');
    return;
  }

  console.log('  当前地板中心 (墨卡托):', `(${currentFloorCenter.x.toFixed(2)}, ${currentFloorCenter.y.toFixed(2)}, ${currentFloorCenter.z.toFixed(2)})`);

  const allModels = dualViewer.modelGroup1?.children.filter(m => !m.userData.isBox3Helper) || [];
  if (allModels.length === 0) {
    console.error('❌ 没有找到模型');
    return;
  }

  // 分类模型
  const largeCoordModels = [];
  const smallCoordModels = [];

  allModels.forEach(model => {
    const pos = model.position;
    const name = model.userData.filePath || model.userData.fileName || model.name;
    const isLargeCoord = Math.abs(pos.x) > 10000 || Math.abs(pos.z) > 10000;

    console.log(`  • ${name}`);
    console.log(`    位置: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
    console.log(`    类型: ${isLargeCoord ? '大坐标（需要转换）' : '小坐标（保持不变）'}`);

    if (isLargeCoord) {
      largeCoordModels.push({ model, name, pos });
    } else {
      smallCoordModels.push({ model, name, pos });
    }
  });

  console.log(`\n  统计: ${largeCoordModels.length} 个大坐标模型, ${smallCoordModels.length} 个小坐标模型`);

  // ═══════════════════════════════════════════════════════════════════
  // 步骤2：计算大坐标模型的局部位置
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n📐 [步骤2] 计算大坐标模型的局部位置...');

  const modelLocalPositions = [];

  largeCoordModels.forEach(item => {
    const { model, name, pos } = item;
    const localPos = {
      x: pos.x - currentFloorCenter.x,
      y: pos.y,
      z: pos.z - currentFloorCenter.y
    };

    modelLocalPositions.push({
      model: model,
      name: name,
      localPos: localPos
    });

    console.log(`  • ${name}`);
    console.log(`    局部位置: (${localPos.x.toFixed(2)}, ${localPos.y.toFixed(2)}, ${localPos.z.toFixed(2)})`);
  });

  smallCoordModels.forEach(item => {
    const { model, name, pos } = item;
    modelLocalPositions.push({
      model: model,
      name: name,
      localPos: { x: pos.x, y: pos.y, z: pos.z }
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 步骤3：重置真实世界模式
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n🔄 [步骤3] 重置真实世界模式...');

  const originalCallback = dualViewer.syncManager?.onFloorCenterUpdate;
  if (dualViewer.syncManager) {
    dualViewer.syncManager.onFloorCenterUpdate = null;
  }

  dualViewer.isInRealWorldMode = false;
  dualViewer.isInRealWorldCoordinates = false;

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

  if (dualViewer.controls1) {
    dualViewer.controls1.enablePan = true;
    dualViewer.controls1.minPolarAngle = 0;
    dualViewer.controls1.maxPolarAngle = Math.PI / 2;
  }
  if (dualViewer.controls2) {
    dualViewer.controls2.enablePan = true;
    dualViewer.controls2.minPolarAngle = 0;
    dualViewer.controls2.maxPolarAngle = Math.PI / 2;
  }

  console.log('  ✅ 已重置真实世界模式');

  // ═══════════════════════════════════════════════════════════════════
  // 步骤4：调整模型位置
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n📦 [步骤4] 调整模型位置...');

  modelLocalPositions.forEach(item => {
    const { model, localPos } = item;
    model.position.set(localPos.x, localPos.y, localPos.z);
    model.updateMatrixWorld();
  });

  console.log('  ✅ 所有模型位置已调整');

  // ═══════════════════════════════════════════════════════════════════
  // 步骤5：启用混合模式
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n🌍 [步骤5] 启用混合模式...');

  if (dualViewer.syncManager) {
    const earthRadius = dualViewer.syncManager.earthRadius || 6378137.0;
    const longitude = (currentFloorCenter.x / earthRadius) * 180 / Math.PI;
    const latitude = dualViewer.syncManager.surfaceHandler.mercatorToLatitude(currentFloorCenter.y) * 180 / Math.PI;

    dualViewer.mouseCoords.geoOffset = {
      x: currentFloorCenter.x,
      y: currentFloorCenter.y,
      z: currentFloorCenter.z,
      longitude: longitude,
      latitude: latitude,
      enabled: true
    };

    console.log('  ✅ 地理偏移已设置');
  }

  // ═══════════════════════════════════════════════════════════════════
  // 步骤6：计算相机位置
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n📷 [步骤6] 计算相机位置...');

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  modelLocalPositions.forEach(item => {
    minX = Math.min(minX, item.localPos.x);
    maxX = Math.max(maxX, item.localPos.x);
    minY = Math.min(minY, item.localPos.y);
    maxY = Math.max(maxY, item.localPos.y);
    minZ = Math.min(minZ, item.localPos.z);
    maxZ = Math.max(maxZ, item.localPos.z);
  });

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;

  const sizeX = maxX - minX;
  const sizeY = maxY - minY;
  const sizeZ = maxZ - minZ;
  const maxSize = Math.max(sizeX, sizeY, sizeZ);

  console.log(`  模型中心: (${centerX.toFixed(2)}, ${centerY.toFixed(2)}, ${centerZ.toFixed(2)})`);
  console.log(`  模型范围: ${sizeX.toFixed(2)} x ${sizeY.toFixed(2)} x ${sizeZ.toFixed(2)}`);

  const cameraHeight = centerY + Math.max(100, maxSize * 0.8);
  const cameraDistance = Math.max(150, maxSize * 0.8);

  console.log(`  相机位置: (${centerX.toFixed(2)}, ${cameraHeight.toFixed(2)}, ${(centerZ + cameraDistance).toFixed(2)})`);

  // ═══════════════════════════════════════════════════════════════════
  // 步骤7：⭐ 使用多次 requestAnimationFrame 确保相机设置生效
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n📷 [步骤7] 设置相机位置（多次验证）...');

  const setCameraPosition = () => {
    if (dualViewer.camera1 && dualViewer.controls1) {
      // 禁用控制器
      dualViewer.controls1.enabled = false;
      dualViewer.controls2.enabled = false;

      // 设置相机
      dualViewer.controls1.target.set(centerX, centerY, centerZ);
      dualViewer.camera1.position.set(centerX, cameraHeight, centerZ + cameraDistance);
      dualViewer.camera1.lookAt(centerX, centerY, centerZ);
      dualViewer.camera1.updateMatrixWorld();
      dualViewer.camera1.updateProjectionMatrix();

      // 同步相机2
      if (dualViewer.camera2 && dualViewer.controls2) {
        dualViewer.controls2.target.set(centerX, centerY, centerZ);
        dualViewer.camera2.position.set(centerX, cameraHeight, centerZ + cameraDistance);
        dualViewer.camera2.lookAt(centerX, centerY, centerZ);
        dualViewer.camera2.updateMatrixWorld();
        dualViewer.camera2.updateProjectionMatrix();
      }

      // 启用控制器
      dualViewer.controls1.enabled = true;
      dualViewer.controls2.enabled = true;

      dualViewer.controls1.update();
      dualViewer.controls2.update();

      console.log('  ✅ 相机位置已设置');
    }
  };

  // 第一次设置
  setCameraPosition();

  // 等待一帧后再次设置
  await new Promise(resolve => requestAnimationFrame(() => {
    setCameraPosition();
    requestAnimationFrame(resolve);
  }));

  // 再等待一帧后第三次设置
  await new Promise(resolve => requestAnimationFrame(() => {
    setCameraPosition();
    requestAnimationFrame(resolve);
  }));

  // 最终验证
  await new Promise(resolve => setTimeout(resolve, 100));
  setCameraPosition();

  // ═══════════════════════════════════════════════════════════════════
  // 完成
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  🎉 完成！                                                  ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // 验证最终状态
  console.log('📊 最终状态验证:');
  console.log(`  相机位置: (${dualViewer.camera1.position.x.toFixed(2)}, ${dualViewer.camera1.position.y.toFixed(2)}, ${dualViewer.camera1.position.z.toFixed(2)})`);
  console.log(`  控制器目标: (${dualViewer.controls1.target.x.toFixed(2)}, ${dualViewer.controls1.target.y.toFixed(2)}, ${dualViewer.controls1.target.z.toFixed(2)})`);
  console.log(`  模型数量: ${allModels.length}`);

  allModels.forEach(model => {
    const pos = model.position;
    const name = model.userData.filePath || model.userData.fileName || model.name;
    console.log(`  • ${name}: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
  });

  console.log('\n✅ 已完成：');
  console.log('   1. 退出真实世界模式');
  console.log('   2. 模型位置已调整');
  console.log('   3. 相机已设置（多次验证）');
  console.log('   4. 混合模式已启用');
  console.log('\n💡 如果仍然看不到模型，请尝试：');
  console.log('   1. 使用鼠标滚轮缩小（可能相机太远）');
  console.log('   2. 使用鼠标拖动旋转视角');
  console.log('   3. 检查控制台是否有错误信息');
})();
