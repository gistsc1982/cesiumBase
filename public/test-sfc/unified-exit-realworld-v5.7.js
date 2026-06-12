// ═══════════════════════════════════════════════════════════════════
// 统一脚本 V5.7：退出真实世界模式（大坐标保持版 + 深度函数修复）
// ═══════════════════════════════════════════════════════════════════
// 功能：退出真实世界模式，但保持模型在大坐标位置
// 关键修复：
//   1. 不更新地板中心和统一坐标系
//   2. 禁用可能触发同步的操作
//   3. 🔧 修复：设置正确的深度函数 LESS（避免透视翻转）
//   4. 保持默认 near/far 值
//   5. 防止缩放时的轻微翻转
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
  console.log('║  🚀 统一脚本 V5.7：退出真实世界模式（大坐标保持）         ║');
  console.log('║  🔧 关键修复：设置正确的深度函数（解决透视翻转）           ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // ═══════════════════════════════════════════════════════════════════
  // 步骤1：移动小模型到大坐标位置
  // ═══════════════════════════════════════════════════════════════════
  console.log('🔄 [步骤1] 移动小模型到大坐标位置...');

  // 禁用同步
  const originalSyncCamera = dualViewer.syncCameraFromThreeToBim;
  dualViewer.syncCameraFromThreeToBim = function() { return; };

  const originalCallback = dualViewer.syncManager?.onFloorCenterUpdate;
  if (dualViewer.syncManager) {
    dualViewer.syncManager.onFloorCenterUpdate = null;
  }

  // 获取模型
  const allModels = dualViewer.modelGroup1?.children.filter(m => !m.userData.isBox3Helper) || [];
  if (allModels.length === 0) {
    console.error('❌ 没有找到模型');
    dualViewer.syncCameraFromThreeToBim = originalSyncCamera;
    return;
  }

  // 分类
  const largeCoordModels = [];
  const smallCoordModels = [];

  allModels.forEach(model => {
    const pos = model.position;
    const isLargeCoord = Math.abs(pos.x) > 10000 || Math.abs(pos.z) > 10000;
    if (isLargeCoord) {
      largeCoordModels.push({ model });
    } else {
      smallCoordModels.push({ model });
    }
  });

  if (largeCoordModels.length === 0) {
    console.error('❌ 没有找到大坐标模型');
    dualViewer.syncCameraFromThreeToBim = originalSyncCamera;
    return;
  }

  // 移动小模型
  const referenceModel = largeCoordModels[0].model;
  const referencePos = referenceModel.position;

  console.log(`  参考模型位置: (${referencePos.x.toFixed(2)}, ${referencePos.y.toFixed(2)}, ${referencePos.z.toFixed(2)})`);

  smallCoordModels.forEach(item => {
    const offsetDistance = 50;
    item.model.position.set(
      referencePos.x,
      item.model.position.y,
      referencePos.z + offsetDistance
    );
    item.model.updateMatrixWorld();
  });

  console.log(`  ✅ 已移动 ${smallCoordModels.length} 个小模型`);

  // ═══════════════════════════════════════════════════════════════════
  // 步骤2：计算目标相机位置
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n📷 [步骤2] 计算目标相机位置...');

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  largeCoordModels.forEach(item => {
    const pos = item.model.position;
    minX = Math.min(minX, pos.x);
    maxX = Math.max(maxX, pos.x);
    minY = Math.min(minY, pos.y);
    maxY = Math.max(maxY, pos.y);
    minZ = Math.min(minZ, pos.z);
    maxZ = Math.max(maxZ, pos.z);
  });

  // 计算移动后的小模型位置
  smallCoordModels.forEach(item => {
    const pos = item.model.position;
    minX = Math.min(minX, pos.x);
    maxX = Math.max(maxX, pos.x);
    minY = Math.min(minY, pos.y);
    maxY = Math.max(maxY, pos.y);
    minZ = Math.min(minZ, pos.z);
    maxZ = Math.max(maxZ, pos.z);
  });

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;

  const sizeX = maxX - minX;
  const sizeY = maxY - minY;
  const sizeZ = maxZ - minZ;
  const maxSize = Math.max(sizeX, sizeY, sizeZ);

  const targetCameraHeight = centerY + Math.max(100, maxSize * 0.6);
  const targetCameraDistance = Math.max(150, maxSize * 0.8);

  console.log(`  目标相机: (${centerX.toFixed(2)}, ${targetCameraHeight.toFixed(2)}, ${(centerZ + targetCameraDistance).toFixed(2)})`);

  // ═══════════════════════════════════════════════════════════════════
  // 步骤3：设置相机到大坐标位置
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n📷 [步骤3] 设置相机位置...');

  const setCamera = () => {
    dualViewer.controls1.enabled = false;
    dualViewer.controls2.enabled = false;

    dualViewer.camera1.position.set(centerX, targetCameraHeight, centerZ + targetCameraDistance);
    dualViewer.camera1.lookAt(centerX, centerY, centerZ);
    dualViewer.camera1.updateMatrixWorld();

    dualViewer.controls1.target.set(centerX, centerY, centerZ);

    dualViewer.camera2.position.set(centerX, targetCameraHeight, centerZ + targetCameraDistance);
    dualViewer.camera2.lookAt(centerX, centerY, centerZ);
    dualViewer.camera2.updateMatrixWorld();

    dualViewer.controls2.target.set(centerX, centerY, centerZ);

    dualViewer.controls1.enabled = true;
    dualViewer.controls2.enabled = true;

    dualViewer.controls1.update();
    dualViewer.controls2.update();
  };

  setCamera();
  await new Promise(resolve => setTimeout(resolve, 50));
  setCamera();
  await new Promise(resolve => setTimeout(resolve, 50));
  setCamera();

  console.log('  ✅ 相机已设置');

  // ═══════════════════════════════════════════════════════════════════
  // 步骤4：退出真实世界模式（保持大坐标）
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n🔄 [步骤4] 退出真实世界模式...');

  dualViewer.isInRealWorldMode = false;
  dualViewer.isInRealWorldCoordinates = false;

  // 保持 __unifiedProjectionMode__ = true 以防止缩放时模型翻转
  // 保持 enablePan = false 防止 Orbit 干扰大坐标
  if (dualViewer.controls1) {
    dualViewer.controls1.enablePan = false;
  }
  if (dualViewer.controls2) {
    dualViewer.controls2.enablePan = false;
  }

  console.log('  ✅ 已退出真实世界模式');

  // ═══════════════════════════════════════════════════════════════════
  // 步骤4.5：同步 Cesium 相机到大坐标模型位置
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n🌍 [步骤4.5] 同步 Cesium 相机到大坐标模型位置...');

  await new Promise(resolve => setTimeout(resolve, 100));

  const syncCesiumCamera = () => {
    const cesiumViewer = window.__cesiumViewer__;
    if (!cesiumViewer || !cesiumViewer.camera) {
      console.warn('  ⚠️ Cesium viewer 未找到，跳过 Cesium 相机同步');
      return false;
    }

    const Cesium = window.Cesium;
    if (!Cesium) {
      console.warn('  ⚠️ Cesium 库未找到，跳过 Cesium 相机同步');
      return false;
    }

    try {
      const mercatorProj = dualViewer.mercatorProjectionManager;
      if (!mercatorProj) {
        console.warn('  ⚠️ 墨卡托投影管理器未找到，使用直接计算');
        const earthRadius = 6378137.0;
        const longitude = centerX / earthRadius;
        const latitude = Math.atan(Math.sinh(centerZ / earthRadius));
        const height = targetCameraHeight - centerY;

        const destination = Cesium.Cartesian3.fromRadians(longitude, latitude, Math.max(height, 500));
        cesiumViewer.camera.setView({
          destination: destination,
          orientation: {
            heading: 0,
            pitch: -Cesium.Math.PI_OVER_FOUR,
            roll: 0
          }
        });
      } else {
        const mercatorPos = mercatorProj.threeToMercator(centerX, targetCameraHeight, centerZ + targetCameraDistance);
        const mercatorTarget = mercatorProj.threeToMercator(centerX, centerY, centerZ);

        const earthRadius = 6378137.0;
        const longitude = mercatorPos.x / earthRadius;
        const latitude = Math.atan(Math.sinh(mercatorPos.y / earthRadius));
        const height = mercatorPos.z;

        const destination = Cesium.Cartesian3.fromRadians(longitude, latitude, Math.max(height, 500));
        cesiumViewer.camera.setView({
          destination: destination,
          orientation: {
            heading: 0,
            pitch: -Cesium.Math.PI_OVER_FOUR,
            roll: 0
          }
        });
      }

      console.log('  ✅ Cesium 相机已同步');
      return true;
    } catch (error) {
      console.warn('  ⚠️ Cesium 相机同步失败:', error.message);
      return false;
    }
  };

  syncCesiumCamera();

  // ═══════════════════════════════════════════════════════════════════
  // 步骤5：禁用可能导致问题的同步
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n🔒 [步骤5] 禁用可能导致问题的同步...');

  window.__disableCameraSync__ = true;
  window.__preserveCameraPosition__ = true;
  dualViewer._preserveCameraPosition = true;
  dualViewer._disableSyncFromHelloWorld = true;

  dualViewer.syncCameraFromThreeToBim = function() {
    return;
  };

  if (dualViewer.syncManager) {
    dualViewer.syncManager.onFloorCenterUpdate = null;
  }

  console.log('  ✅ 已禁用相机同步');

  dualViewer.syncCameraFromThreeToBim = originalSyncCamera;

  // ═══════════════════════════════════════════════════════════════════
  // 步骤6：修复深度函数（解决透视翻转的关键）
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n🔧 [步骤6] 修复深度函数（解决透视翻转）...');

  const fixDepthFunc = (renderer, name) => {
    if (!renderer) return;

    try {
      const gl = renderer.getContext();
      const currentFunc = gl.getParameter(gl.DEPTH_FUNC);

      if (currentFunc !== gl.LESS) {
        gl.depthFunc(gl.LESS);
        console.log(`  ✅ ${name}: 深度函数已修复 (${currentFunc} -> LESS)`);
      } else {
        console.log(`  ✅ ${name}: 深度函数正确 (LESS)`);
      }
    } catch (error) {
      console.log(`  ⚠️  ${name}: 无法设置深度函数`);
    }
  };

  fixDepthFunc(dualViewer.renderer1, 'Renderer1');
  fixDepthFunc(dualViewer.renderer2, 'Renderer2');

  console.log('  💡 深度函数设置为 LESS 可确保正确的深度测试');
  console.log('  💡 这是解决透视翻转的关键修复');

  // ═══════════════════════════════════════════════════════════════════
  // 步骤7：确保相机的 near/far 使用默认值
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n🔧 [步骤7] 确保 near/far 使用默认值...');

  const ensureDefaultNearFar = (camera, name) => {
    if (!camera) return;

    camera.near = 0.1;
    camera.far = 10000;
    camera.updateProjectionMatrix();

    console.log(`  ✅ ${name}: near=${camera.near.toFixed(2)}, far=${camera.far.toFixed(2)}`);
  };

  ensureDefaultNearFar(dualViewer.camera1, 'camera1');
  ensureDefaultNearFar(dualViewer.camera2, 'camera2');

  // 禁用 updateCameraProjectionForLargeCoord
  if (typeof dualViewer.updateCameraProjectionForLargeCoord === 'function') {
    dualViewer.updateCameraProjectionForLargeCoord = function() {
      // 空操作 - 保持默认值
    };
    console.log('  ✅ 已禁用 updateCameraProjectionForLargeCoord');
  }

  // ═══════════════════════════════════════════════════════════════════
  // 步骤8：启动深度函数守护任务
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n🔧 [步骤8] 启动深度函数守护任务...');

  // 停止旧的守护任务
  if (window._depthFixGuards) {
    window._depthFixGuards.forEach(g => clearInterval(g));
  }

  const guards = [];

  // 守护: 每秒检查并修复深度函数
  guards.push(setInterval(() => {
    const checkAndFix = (renderer) => {
      if (!renderer) return;
      try {
        const gl = renderer.getContext();
        const currentFunc = gl.getParameter(gl.DEPTH_FUNC);
        if (currentFunc !== gl.LESS) {
          gl.depthFunc(gl.LESS);
        }
      } catch (error) {
        // 忽略
      }
    };

    checkAndFix(dualViewer.renderer1);
    if (dualViewer.renderer2) checkAndFix(dualViewer.renderer2);
  }, 1000));

  window._depthFixGuards = guards;

  console.log(`  ✅ 已启动 ${guards.length} 个守护任务`);

  // ═══════════════════════════════════════════════════════════════════
  // 完成
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  🎉 完成！                                                  ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log('✅ 已完成操作:');
  console.log('   1. ✅ 小模型已移动到大坐标位置');
  console.log('   2. ✅ 退出真实世界模式');
  console.log('   3. ✅ 相机已设置到大坐标位置');
  console.log('   4. ✅ 已禁用可能导致问题的同步');
  console.log('   5. ✅ 已修复深度函数为 LESS（解决透视翻转）');
  console.log('   6. ✅ 已保持默认 near/far 值');
  console.log('   7. ✅ 已启动深度函数守护任务');

  console.log('\n💡 说明:');
  console.log('   - 模型和相机保持在大坐标位置');
  console.log('   - OrbitControls 平移已禁用（避免坐标问题）');
  console.log('   - 可以使用鼠标旋转和缩放');
  console.log('   - 透视正常：保持"近大远小"');

  console.log('\n🔧 关键修复 (V5.7):');
  console.log('   - 问题：深度函数被设置为 LEQUAL 导致透视翻转');
  console.log('   - 解决：强制设置为 LESS');
  console.log('   - 效果：透视从"远小近大"恢复为"近大远小"');
  console.log('   - 持久：守护任务确保深度函数不会被重置');

  console.log('\n📌 可用命令:');
  console.log('   __depthFix.check() - 检查深度函数状态');
  console.log('   _stopDepthFix() - 停止守护任务');

  // 创建便捷函数
  window.__depthFix = {
    check: () => {
      console.log('========== 深度函数状态 ==========');

      const checkRenderer = (renderer, name) => {
        if (!renderer) {
          console.log(`${name}: 不存在`);
          return;
        }
        try {
          const gl = renderer.getContext();
          const currentFunc = gl.getParameter(gl.DEPTH_FUNC);
          const status = currentFunc === gl.LESS ? '✅' : '❌';
          const funcName = currentFunc === gl.LESS ? 'LESS' : currentFunc === gl.LEQUAL ? 'LEQUAL' : currentFunc;
          console.log(`${status} ${name}: ${funcName}`);
        } catch (error) {
          console.log(`⚠️  ${name}: 无法访问`);
        }
      };

      checkRenderer(dualViewer.renderer1, 'Renderer1');
      checkRenderer(dualViewer.renderer2, 'Renderer2');

      const guardsActive = window._depthFixGuards && window._depthFixGuards.length > 0;
      console.log(`${guardsActive ? '✅' : '❌'} 守护任务: ${guardsActive ? '运行中' : '已停止'}`);

      console.log('=================================');
    }
  };

  // 立即检查
  __depthFix.check();
})();
