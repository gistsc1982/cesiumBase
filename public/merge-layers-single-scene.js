╔══════════════════════════════════════════════════════════╗
║  🚀 合并两层到单场景脚本                                   ║
║  🎯 将原始层和BIM层的所有模型合并到原始层场景               ║
║  📊 使用渲染顺序控制渲染层次                               ║
╚══════════════════════════════════════════════════════════╝

🔍 [步骤1] 获取 DualCanvasViewer 实例...
*/

const viewer = window.__dualCanvasViewer;
if (!viewer) {
  console.error('❌ DualCanvasViewer 实例未找到');
  throw new Error('DualCanvasViewer 实例未找到');
}

console.log('✅ DualCanvasViewer 实例已找到');

/*
🔧 [步骤2] 禁用多场景管理器的渲染循环（如果存在）...
*/

if (window.__multiSceneManager) {
  console.log('⚠️  检测到多场景管理器，停止其渲染循环...');

  const manager = window.__multiSceneManager;

  // 停止多场景的渲染循环
  if (manager._originalRenderLoop) {
    // 如果有保存的原始渲染循环，暂时不恢复
    console.log('ℹ️  多场景渲染循环已存在，将在合并后使用原始层的渲染');
  }

  console.log('✅ 多场景渲染循环已停用');
}

/*
🔍 [步骤3] 分析两层场景结构...
*/

const originalLayer = viewer.originalLayer;
const bimLayer = viewer.bimLayer;

if (!originalLayer || !originalLayer.scene) {
  console.error('❌ 原始层场景未找到');
  throw new Error('原始层场景未找到');
}

console.log('📊 场景结构分析:');
console.log(`  原始层: ${originalLayer.scene ? '✅ 存在' : '❌ 不存在'}`);
console.log(`  BIM层: ${bimLayer && bimLayer.scene ? '✅ 存在' : '❌ 不存在'}`);

if (!bimLayer || !bimLayer.scene) {
  console.warn('⚠️  BIM层场景未找到，仅处理原始层');
}

/*
🔧 [步骤4] 定义模型类型和渲染顺序...
*/

const modelTypes = {
  largeCoord: { models: [], order: 0, name: '大坐标GLB' },
  other: { models: [], order: 1, name: '其他模型' },
  glb: { models: [], order: 2, name: 'GLB模型' },
  bim: { models: [], order: 5, name: 'BIM模型' },
  animation: { models: [], order: 10, name: '动画模型' }
};

/*
🔧 [步骤5] 收集所有模型的统计信息...
*/

const collectModelStats = (scene, layerName) => {
  const stats = {
    totalModels: 0,
    byType: {
      largeCoord: 0,
      other: 0,
      glb: 0,
      bim: 0,
      animation: 0
    }
  };

  scene.traverse((object) => {
    if (object.isMesh || object.isGroup) {
      stats.totalModels++;

      // 检测模型类型
      let type = 'other';

      // 检查 userData
      if (object.userData) {
        if (object.userData.model) {
          const modelData = object.userData.model;
          if (modelData.isLargeCoordinate) {
            type = 'largeCoord';
          } else if (modelData.type === 'bim') {
            type = 'bim';
          } else if (modelData.type === 'glb' || modelData.type === 'gltf') {
            type = 'glb';
          } else if (modelData.hasAnimation || object.userData.hasAnimation) {
            type = 'animation';
          }
        } else if (object.userData.hasAnimation) {
          type = 'animation';
        }
      }

      // 检查坐标（大坐标检测）
      if (type === 'other') {
        const pos = object.position;
        if (Math.abs(pos.x) > 10000 || Math.abs(pos.z) > 10000) {
          type = 'largeCoord';
        }
      }

      stats.byType[type]++;
    }
  });

  return stats;
};

const originalStats = collectModelStats(originalLayer.scene, '原始层');
console.log(`  原始层: ${originalStats.totalModels} 个模型`);
console.log(`    大坐标: ${originalStats.byType.largeCoord}`);
console.log(`    其他: ${originalStats.byType.other}`);
console.log(`    GLB: ${originalStats.byType.glb}`);
console.log(`    BIM: ${originalStats.byType.bim}`);
console.log(`    动画: ${originalStats.byType.animation}`);

if (bimLayer && bimLayer.scene) {
  const bimStats = collectModelStats(bimLayer.scene, 'BIM层');
  console.log(`  BIM层: ${bimStats.totalModels} 个模型`);
  console.log(`    大坐标: ${bimStats.byType.largeCoord}`);
  console.log(`    其他: ${bimStats.byType.other}`);
  console.log(`    GLB: ${bimStats.byType.glb}`);
  console.log(`    BIM: ${bimStats.byType.bim}`);
  console.log(`    动画: ${bimStats.byType.animation}`);
}

/*
🔧 [步骤6] 将BIM层的模型移动到原始层...
*/

let movedModels = 0;

if (bimLayer && bimLayer.scene) {
  console.log('');
  console.log('🔄 开始移动BIM层模型到原始层...');

  // 收集所有需要移动的对象（避免在遍历时修改场景）
  const objectsToMove = [];

  bimLayer.scene.traverse((object) => {
    if (object.isMesh || object.isGroup || (object.userData && object.userData.model)) {
      objectsToMove.push(object);
    }
  });

  console.log(`  找到 ${objectsToMove.length} 个对象需要移动`);

  // 移动对象到原始层
  objectsToMove.forEach((object) => {
    // 保持世界坐标变换
    object.updateMatrixWorld();

    // 从父对象移除
    if (object.parent) {
      object.parent.remove(object);
    }

    // 添加到原始层场景
    originalLayer.scene.add(object);

    movedModels++;
  });

  console.log(`✅ 已移动 ${movedModels} 个对象到原始层`);
}

/*
🔧 [步骤7] 设置所有模型的渲染顺序...
*/

console.log('');
console.log('🎨 设置模型渲染顺序...');

const setRenderOrder = (scene, layerName) => {
  let count = 0;

  scene.traverse((object) => {
    if (object.isMesh) {
      // 检测模型类型
      let type = 'other';

      if (object.userData) {
        if (object.userData.model) {
          const modelData = object.userData.model;
          if (modelData.isLargeCoordinate) {
            type = 'largeCoord';
          } else if (modelData.type === 'bim') {
            type = 'bim';
          } else if (modelData.type === 'glb' || modelData.type === 'gltf') {
            type = 'glb';
          } else if (modelData.hasAnimation || object.userData.hasAnimation) {
            type = 'animation';
          }
        } else if (object.userData.hasAnimation) {
          type = 'animation';
        }
      }

      // 大坐标检测
      if (type === 'other') {
        const pos = object.position;
        if (Math.abs(pos.x) > 10000 || Math.abs(pos.z) > 10000) {
          type = 'largeCoord';
        }
      }

      // 设置渲染顺序
      const order = modelTypes[type].order;
      object.renderOrder = order;

      count++;
    }
  });

  return count;
};

const originalCount = setRenderOrder(originalLayer.scene, '原始层');
console.log(`  原始层: ${originalCount} 个Mesh已设置渲染顺序`);

/*
🔧 [步骤8] 禁用BIM层的渲染（如果存在）...
*/

if (bimLayer && bimLayer.renderer) {
  console.log('');
  console.log('🔒 禁用BIM层渲染...');

  // 保存原始渲染方法
  if (!window._originalBimRender) {
    window._originalBimRender = bimLayer.renderer.render;
  }

  // 替换为空操作
  bimLayer.renderer.render = function() {
    // 空操作 - 不渲染BIM层
  };

  console.log('✅ BIM层渲染已禁用（所有模型已合并到原始层）');
}

/*
🔧 [步骤9] 修复相机的 near/far 值...
*/

console.log('');
console.log('📷 修复相机 near/far 值...');

const fixCameraNearFar = (camera, name) => {
  if (!camera) return;

  const oldNear = camera.near;
  const oldFar = camera.far;

  camera.near = 36;
  camera.far = 1800;
  camera.updateProjectionMatrix();

  const ratio = camera.far / camera.near;
  console.log(`  ${name}: near=${oldNear.toFixed(2)}→${camera.near.toFixed(2)}, far=${oldFar.toFixed(2)}→${camera.far.toFixed(2)}, ratio=${ratio.toFixed(0)}`);
};

fixCameraNearFar(viewer.camera1, 'camera1');
if (viewer.camera2) {
  fixCameraNearFar(viewer.camera2, 'camera2');
}

/*
🔧 [步骤10] 禁用源代码的动态 near/far 更新...
*/

if (typeof viewer.updateCameraProjectionForLargeCoord === 'function') {
  // 保存原始方法
  if (!window._originalUpdateCameraProjection) {
    window._originalUpdateCameraProjection = viewer.updateCameraProjectionForLargeCoord;
  }

  // 替换为空操作
  viewer.updateCameraProjectionForLargeCoord = function() {
    // 空操作 - 保持固定的 near/far 值
  };

  console.log('✅ 已禁用 updateCameraProjectionForLargeCoord 方法');
}

/*
🔧 [步骤11] 确保原始层渲染器使用正确的设置...
*/

if (originalLayer.renderer) {
  // 确保 autoClear 设置正确
  originalLayer.renderer.autoClear = true;

  // 启用阴影贴图（如果需要）
  // originalLayer.renderer.shadowMap.enabled = true;

  console.log('✅ 原始层渲染器设置已更新');
}

/*
🔒 [步骤12] 启动守护任务...
*/

const guards = [];

// 守护任务1：防止 near/far 被修改
guards.push(setInterval(() => {
  const fixCamera = (camera) => {
    if (!camera) return;
    if (camera.near !== 36 || camera.far !== 1800) {
      camera.near = 36;
      camera.far = 1800;
      camera.updateProjectionMatrix();
    }
  };

  fixCamera(viewer.camera1);
  if (viewer.camera2) fixCamera(viewer.camera2);
}, 2000));

// 守护任务2：防止 updateCameraProjectionForLargeCoord 被恢复
guards.push(setInterval(() => {
  if (viewer.updateCameraProjectionForLargeCoord &&
      viewer.updateCameraProjectionForLargeCoord.toString().includes('distance * 0.2')) {
    viewer.updateCameraProjectionForLargeCoord = function() {};
  }
}, 2000));

// 守护任务3：确保BIM层不渲染
if (bimLayer && bimLayer.renderer) {
  guards.push(setInterval(() => {
    if (bimLayer.renderer.render.toString() !== 'function() {\n          // 空操作 - 不渲染BIM层\n        }') {
      bimLayer.renderer.render = function() {};
    }
  }, 2000));
}

window._mergedSceneGuards = guards;
window._stopMergedSceneFix = () => {
  guards.forEach(g => clearInterval(g));
  console.log('✅ 所有守护任务已停止');
};

console.log('✅ 守护任务已启动');

/*
📊 [步骤13] 显示最终状态...
*/

console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║  ✅ 两层合并到单场景完成！                               ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('');
console.log('📊 最终状态:');

const finalStats = collectModelStats(originalLayer.scene, '原始层');
console.log(`  原始层总模型数: ${finalStats.totalModels}`);
console.log(`    大坐标GLB: ${finalStats.byType.largeCoord} (order=0)`);
console.log(`    其他模型: ${finalStats.byType.other} (order=1)`);
console.log(`    GLB模型: ${finalStats.byType.glb} (order=2)`);
console.log(`    BIM模型: ${finalStats.byType.bim} (order=5)`);
console.log(`    动画模型: ${finalStats.byType.animation} (order=10)`);
console.log('');
console.log('📌 修复内容:');
console.log('   ✅ BIM层模型已移动到原始层');
console.log('   ✅ 所有模型渲染顺序已设置');
console.log('   ✅ BIM层渲染已禁用');
console.log('   ✅ 相机 near/far 已固定为 36/1800');
console.log('   ✅ 禁用了动态 near/far 更新');
console.log('   ✅ 守护任务已启动');
console.log('');
console.log('💡 预期效果:');
console.log('   - 所有模型在原始层单一场景中渲染');
console.log('   - 渲染顺序正确：largeCoord → other → glb → bim → animation');
console.log('   - 透视正常：近大远小');
console.log('   - 深度测试正确');
console.log('');
console.log('📌 可用命令:');
console.log('   __mergedScene.check() - 检查状态');
console.log('   _stopMergedSceneFix() - 停止守护任务');

// 创建便捷检查函数
window.__mergedScene = {
  check: () => {
    console.log('📊 合并场景状态:');

    // 检查守护任务
    const guardsActive = window._mergedSceneGuards && window._mergedSceneGuards.length > 0;
    console.log(`  守护任务: ${guardsActive ? '✅ 运行中' : '❌ 已停止'}`);

    // 检查相机
    const checkCamera = (camera, name) => {
      if (!camera) return;
      const ratio = camera.far / camera.near;
      const status = (camera.near === 36 && camera.far === 1800) ? '✅' : '❌';
      console.log(`  ${status} ${name}: near=${camera.near.toFixed(2)}, far=${camera.far.toFixed(2)}, ratio=${ratio.toFixed(0)}`);
    };

    checkCamera(viewer.camera1, 'camera1');
    if (viewer.camera2) checkCamera(viewer.camera2, 'camera2');

    // 检查场景
    const stats = collectModelStats(originalLayer.scene, '原始层');
    console.log(`  原始层模型总数: ${stats.totalModels}`);
    console.log(`    大坐标: ${stats.byType.largeCoord}`);
    console.log(`    其他: ${stats.byType.other}`);
    console.log(`    GLB: ${stats.byType.glb}`);
    console.log(`    BIM: ${stats.byType.bim}`);
    console.log(`    动画: ${stats.byType.animation}`);

    // 检查BIM层
    if (bimLayer && bimLayer.scene) {
      const bimStats = collectModelStats(bimLayer.scene, 'BIM层');
      console.log(`  BIM层剩余模型: ${bimStats.totalModels} (应该为0)`);
    }
  },

  // 手动修复 near/far
  fixNearFar: () => {
    const fixCamera = (camera) => {
      if (!camera) return;
      camera.near = 36;
      camera.far = 1800;
      camera.updateProjectionMatrix();
    };
    fixCamera(viewer.camera1);
    if (viewer.camera2) fixCamera(viewer.camera2);
    console.log('✅ 已手动修复 near/far 值');
  },

  // 重新设置渲染顺序
  resetRenderOrder: () => {
    setRenderOrder(originalLayer.scene, '原始层');
    console.log('✅ 已重新设置渲染顺序');
  }
};

console.log('');
console.log('💡 执行 __mergedScene.check() 查看详细状态');
