// ═══════════════════════════════════════════════════════════════════
// 完全内联版本：初始化多场景管理器 + 修复透视反转
// ═══════════════════════════════════════════════════════════════════
// 使用方法：在浏览器控制台直接复制粘贴此脚本执行
// 此版本不依赖外部文件，完全内联实现
// ═══════════════════════════════════════════════════════════════════

(async function() {
  'use strict';

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  🚀 完整内联版：初始化 + 修复透视反转                     ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // ═══════════════════════════════════════════════════════════════════
  // 配置
  // ═══════════════════════════════════════════════════════════════════
  const CONFIG = {
    LARGE_COORD_THRESHOLD: 10000,
    LARGE_SCENE_NEAR: 0.1,
    LARGE_SCENE_FAR: 15000000,
    SMALL_SCENE_NEAR: 36,
    SMALL_SCENE_FAR: 1802
  };

  // ═══════════════════════════════════════════════════════════════════
  // 步骤1：检查 DualCanvasViewer
  // ═══════════════════════════════════════════════════════════════════
  console.log('🔍 [步骤1/6] 检查 DualCanvasViewer...');

  const dualViewer = window.__dualCanvasViewer;
  if (!dualViewer) {
    console.error('❌ DualCanvasViewer 未找到');
    console.error('   请确保页面已加载 DualCanvasViewer');
    console.error('   尝试检查 window.__dualCanvasViewer');
    return;
  }

  console.log('  ✅ DualCanvasViewer 已找到');

  // ═══════════════════════════════════════════════════════════════════
  // 步骤2：显示当前状态
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n📊 [步骤2/6] 当前场景状态...');

  const models1 = dualViewer.modelGroup1?.children.filter(m => !m.userData.isBox3Helper) || [];
  const models2 = dualViewer.modelGroup2?.children.filter(m => !m.userData.isBox3Helper) || [];

  console.log(`  原始层模型: ${models1.length} 个`);
  console.log(`  BIM层模型: ${models2.length} 个`);

  // 显示模型坐标
  if (models1.length > 0) {
    console.log('\n  原始层模型坐标:');
    models1.slice(0, 3).forEach((model, i) => {
      const pos = model.position;
      const type = Math.abs(pos.x) > CONFIG.LARGE_COORD_THRESHOLD || Math.abs(pos.z) > CONFIG.LARGE_COORD_THRESHOLD ? '🔴 大坐标' : '🟢 小坐标';
      console.log(`    模型 ${i + 1}: ${type} (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // 步骤3：创建多场景架构（内联实现）
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n🏗️ [步骤3/6] 创建多场景架构...');

  // 保存原始场景和相机
  const originalScene1 = dualViewer.scene1;
  const originalScene2 = dualViewer.scene2;
  const originalCamera1 = dualViewer.camera1;

  // 创建4个新场景
  const scenes = {
    layer1Large: new THREE.Scene(),
    layer1Small: new THREE.Scene(),
    layer2Large: new THREE.Scene(),
    layer2Small: new THREE.Scene()
  };

  // 复制场景属性
  scenes.layer1Large.background = originalScene1.background;
  scenes.layer1Small.background = originalScene1.background;
  scenes.layer2Large.background = originalScene2.background;
  scenes.layer2Small.background = originalScene2.background;

  // 创建4个新相机
  const fov = originalCamera1.fov * (180 / Math.PI);
  const aspect = originalCamera1.aspect;

  const cameras = {
    layer1Large: new THREE.PerspectiveCamera(fov, aspect, CONFIG.LARGE_SCENE_NEAR, CONFIG.LARGE_SCENE_FAR),
    layer1Small: new THREE.PerspectiveCamera(fov, aspect, CONFIG.SMALL_SCENE_NEAR, CONFIG.SMALL_SCENE_FAR),
    layer2Large: new THREE.PerspectiveCamera(fov, aspect, CONFIG.LARGE_SCENE_NEAR, CONFIG.LARGE_SCENE_FAR),
    layer2Small: new THREE.PerspectiveCamera(fov, aspect, CONFIG.SMALL_SCENE_NEAR, CONFIG.SMALL_SCENE_FAR)
  };

  console.log('  ✅ 4个场景和4个相机已创建');
  console.log(`    原始层-大: near=${CONFIG.LARGE_SCENE_NEAR}, far=${CONFIG.LARGE_SCENE_FAR.toLocaleString()}`);
  console.log(`    原始层-小: near=${CONFIG.SMALL_SCENE_NEAR}, far=${CONFIG.SMALL_SCENE_FAR}`);
  console.log(`    BIM层-大: near=${CONFIG.LARGE_SCENE_NEAR}, far=${CONFIG.LARGE_SCENE_FAR.toLocaleString()}`);
  console.log(`    BIM层-小: near=${CONFIG.SMALL_SCENE_NEAR}, far=${CONFIG.SMALL_SCENE_FAR}`);

  // ═══════════════════════════════════════════════════════════════════
  // 步骤4：分类并移动模型
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n🔄 [步骤4/6] 分类并移动模型...');

  const referencePoints = { layer1: null, layer2: null };

  // 处理原始层模型
  const layer1LargeModels = [];
  const layer1SmallModels = [];

  models1.forEach(model => {
    const pos = model.position;
    const isLarge = Math.abs(pos.x) > CONFIG.LARGE_COORD_THRESHOLD ||
                   Math.abs(pos.z) > CONFIG.LARGE_COORD_THRESHOLD;
    if (isLarge) {
      layer1LargeModels.push(model);
    } else {
      layer1SmallModels.push(model);
    }
  });

  if (layer1LargeModels.length > 0) {
    const refModel = layer1LargeModels[0];
    referencePoints.layer1 = refModel.position.clone();
    console.log(`  📍 原始层参考点: (${referencePoints.layer1.x.toFixed(2)}, ${referencePoints.layer1.y.toFixed(2)}, ${referencePoints.layer1.z.toFixed(2)})`);

    layer1LargeModels.forEach(model => {
      scenes.layer1Large.add(model);
    });

    layer1SmallModels.forEach(model => {
      const relativePos = model.position.clone().sub(referencePoints.layer1);
      model.position.copy(relativePos);
      scenes.layer1Small.add(model);
    });
  } else {
    layer1SmallModels.forEach(model => {
      scenes.layer1Small.add(model);
    });
  }

  // 处理BIM层模型
  const layer2LargeModels = [];
  const layer2SmallModels = [];

  models2.forEach(model => {
    const pos = model.position;
    const isLarge = Math.abs(pos.x) > CONFIG.LARGE_COORD_THRESHOLD ||
                   Math.abs(pos.z) > CONFIG.LARGE_COORD_THRESHOLD;
    if (isLarge) {
      layer2LargeModels.push(model);
    } else {
      layer2SmallModels.push(model);
    }
  });

  if (layer2LargeModels.length > 0) {
    const refModel = layer2LargeModels[0];
    referencePoints.layer2 = refModel.position.clone();
    console.log(`  📍 BIM层参考点: (${referencePoints.layer2.x.toFixed(2)}, ${referencePoints.layer2.y.toFixed(2)}, ${referencePoints.layer2.z.toFixed(2)})`);

    layer2LargeModels.forEach(model => {
      scenes.layer2Large.add(model);
    });

    layer2SmallModels.forEach(model => {
      const relativePos = model.position.clone().sub(referencePoints.layer2);
      model.position.copy(relativePos);
      scenes.layer2Small.add(model);
    });
  } else {
    layer2SmallModels.forEach(model => {
      scenes.layer2Small.add(model);
    });
  }

  // 清空原始模型组
  if (dualViewer.modelGroup1) dualViewer.modelGroup1.clear();
  if (dualViewer.modelGroup2) dualViewer.modelGroup2.clear();

  console.log(`  ✅ 模型已分类并移动`);
  console.log(`    原始层-大: ${layer1LargeModels.length} 个`);
  console.log(`    原始层-小: ${layer1SmallModels.length} 个`);
  console.log(`    BIM层-大: ${layer2LargeModels.length} 个`);
  console.log(`    BIM层-小: ${layer2SmallModels.length} 个`);

  // ═══════════════════════════════════════════════════════════════════
  // 步骤5：创建管理器对象并设置渲染
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n🎨 [步骤5/6] 设置渲染和相机同步...');

  // 创建管理器对象
  const manager = {
    dualViewer: dualViewer,
    scenes: scenes,
    cameras: cameras,
    referencePoints: referencePoints,

    // 渲染原始层（先小后大）
    renderLayer1: function() {
      const renderer = this.dualViewer.renderer1;
      if (!renderer) return;

      renderer.clear(true, true, false);

      // ✅ 先渲染小坐标（近）
      if (this.scenes.layer1Small.children.length > 0) {
        renderer.render(this.scenes.layer1Small, this.cameras.layer1Small);
      }

      // ✅ 再渲染大坐标（远）
      if (this.scenes.layer1Large.children.length > 0) {
        renderer.clearDepth();
        renderer.render(this.scenes.layer1Large, this.cameras.layer1Large);
      }
    },

    // 渲染BIM层（先小后大）
    renderLayer2: function() {
      const renderer = this.dualViewer.renderer2;
      if (!renderer) return;

      renderer.clear(true, true, false);

      // ✅ 先渲染小坐标（近）
      if (this.scenes.layer2Small.children.length > 0) {
        renderer.render(this.scenes.layer2Small, this.cameras.layer2Small);
      }

      // ✅ 再渲染大坐标（远）
      if (this.scenes.layer2Large.children.length > 0) {
        renderer.clearDepth();
        renderer.render(this.scenes.layer2Large, this.cameras.layer2Large);
      }
    },

    // 同步相机
    syncCameras: function() {
      const baseCamera = this.dualViewer.camera1 || this.cameras.layer1Large;

      // 同步所有相机
      this.syncCamera(baseCamera, this.cameras.layer1Large, this.referencePoints.layer1, true);
      this.syncCamera(baseCamera, this.cameras.layer1Small, this.referencePoints.layer1, false);
      this.syncCamera(baseCamera, this.cameras.layer2Large, this.referencePoints.layer2, true);
      this.syncCamera(baseCamera, this.cameras.layer2Small, this.referencePoints.layer2, false);
    },

    // 同步单个相机
    syncCamera: function(baseCamera, targetCamera, referencePoint, isLargeScene) {
      if (isLargeScene || !referencePoint) {
        targetCamera.position.copy(baseCamera.position);
      } else {
        const relativePos = baseCamera.position.clone().sub(referencePoint);
        targetCamera.position.copy(relativePos);
      }

      targetCamera.quaternion.copy(baseCamera.quaternion);
      targetCamera.zoom = baseCamera.zoom;
      targetCamera.aspect = baseCamera.aspect;

      // ✅ 强制更新投影矩阵
      targetCamera.updateProjectionMatrix();
      targetCamera.updateMatrixWorld();
    },

    // 动态调整 near/far
    adjustCameraNearFar: function() {
      const baseCamera = this.dualViewer.camera1;
      if (!baseCamera) return;

      const distances = [];

      // 收集所有模型的距离
      ['layer1Large', 'layer1Small', 'layer2Large', 'layer2Small'].forEach(sceneKey => {
        const scene = this.scenes[sceneKey];
        let refPoint = null;
        if (sceneKey === 'layer1Small') refPoint = this.referencePoints.layer1;
        else if (sceneKey === 'layer2Small') refPoint = this.referencePoints.layer2;

        scene.traverse(obj => {
          if (obj.isMesh) {
            let worldPos = obj.position.clone();
            if (refPoint) worldPos.add(refPoint);
            const dist = baseCamera.position.distanceTo(worldPos);
            distances.push(dist);
          }
        });
      });

      if (distances.length === 0) return;

      const minDist = Math.min(...distances);
      const maxDist = Math.max(...distances);

      const newNear = Math.max(1, minDist * 0.1);
      const newFar = Math.max(newNear * 2, maxDist * 1.5, 1802);
      const clampedFar = Math.min(newFar, 10000);

      this.cameras.layer1Small.near = newNear;
      this.cameras.layer1Small.far = clampedFar;
      this.cameras.layer1Small.updateProjectionMatrix();

      this.cameras.layer2Small.near = newNear;
      this.cameras.layer2Small.far = clampedFar;
      this.cameras.layer2Small.updateProjectionMatrix();
    },

    // 获取调试信息
    getDebugInfo: function() {
      return {
        scenes: {
          layer1Large: this.scenes.layer1Large.children.length,
          layer1Small: this.scenes.layer1Small.children.length,
          layer2Large: this.scenes.layer2Large.children.length,
          layer2Small: this.scenes.layer2Small.children.length
        },
        cameras: {
          layer1Large: { near: this.cameras.layer1Large.near, far: this.cameras.layer1Large.far },
          layer1Small: { near: this.cameras.layer1Small.near, far: this.cameras.layer1Small.far },
          layer2Large: { near: this.cameras.layer2Large.near, far: this.cameras.layer2Large.far },
          layer2Small: { near: this.cameras.layer2Small.near, far: this.cameras.layer2Small.far }
        },
        referencePoints: this.referencePoints
      };
    }
  };

  // 设置渲染器
  if (dualViewer.renderer1) {
    dualViewer.renderer1.autoClear = false;
  }
  if (dualViewer.renderer2) {
    dualViewer.renderer2.autoClear = false;
  }

  // 替换渲染循环
  if (dualViewer.animationFrame1) {
    cancelAnimationFrame(dualViewer.animationFrame1);
  }
  if (dualViewer.animationFrame2) {
    cancelAnimationFrame(dualViewer.animationFrame2);
  }

  // 原始层渲染循环
  const animate1 = () => {
    dualViewer.animationFrame1 = requestAnimationFrame(animate1);
    if (dualViewer.controls1) dualViewer.controls1.update();
    manager.syncCameras();
    manager.renderLayer1();
  };

  // BIM层渲染循环
  const animate2 = () => {
    dualViewer.animationFrame2 = requestAnimationFrame(animate2);
    if (dualViewer.controls2) dualViewer.controls2.update();
    manager.renderLayer2();
  };

  animate1();
  animate2();

  // 同步相机
  manager.syncCameras();
  manager.adjustCameraNearFar();

  // 启用自动调整
  let adjustTimer = null;
  const onCameraChange = () => {
    if (adjustTimer) return;
    adjustTimer = setTimeout(() => {
      manager.adjustCameraNearFar();
      adjustTimer = null;
    }, 100);
  };

  if (dualViewer.controls1) {
    dualViewer.controls1.addEventListener('change', onCameraChange);
  }
  if (dualViewer.controls2) {
    dualViewer.controls2.addEventListener('change', onCameraChange);
  }

  console.log('  ✅ 渲染和相机同步已设置');
  console.log('    ✅ 渲染顺序: 先小(近) → 后大(远)');
  console.log('    ✅ 自动调整: 已启用');

  // 保存到全局
  window.__multiSceneManager = manager;

  // ═══════════════════════════════════════════════════════════════════
  // 步骤6：完成
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  ✅ 全部完成！                                              ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const debugInfo = manager.getDebugInfo();

  console.log('📊 完成摘要:');
  console.log('  ✅ 多场景架构已创建（4个场景 + 4个相机）');
  console.log('  ✅ 模型已分类并移动到对应场景');
  console.log('  ✅ 渲染顺序已修复（先近后远）');
  console.log('  ✅ 相机同步已设置');
  console.log('  ✅ 动态 near/far 已启用\n');

  console.log('📊 当前状态:');
  console.log(`  原始层-大坐标: ${debugInfo.scenes.layer1Large} 个模型`);
  console.log(`  原始层-小坐标: ${debugInfo.scenes.layer1Small} 个模型`);
  console.log(`  BIM层-大坐标: ${debugInfo.scenes.layer2Large} 个模型`);
  console.log(`  BIM层-小坐标: ${debugInfo.scenes.layer2Small} 个模型\n`);

  console.log('📌 可用命令:');
  console.log('   window.__multiSceneManager.getDebugInfo()         - 查看状态');
  console.log('   window.__multiSceneManager.syncCameras()          - 同步相机');
  console.log('   window.__multiSceneManager.adjustCameraNearFar()  - 调整 near/far');
  console.log('   window.__multiSceneManager.renderLayer1()         - 渲染原始层');
  console.log('   window.__multiSceneManager.renderLayer2()         - 渲染BIM层\n');

  console.log('🎉 现在应该能看到正确的"近大远小"效果！');
  console.log('💡 尝试缩放和旋转相机，效果应该始终保持正确。\n');

})();
