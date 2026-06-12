// 强制修复 near/far 值并锁定

console.log('========== 强制修复 near/far ==========');

const viewer = window.__dualCanvasViewer;
if (!viewer || !viewer.camera1) {
  console.error('❌ 相机未找到');
  throw new Error('相机未找到');
}

// 停止旧的守护任务
if (window._nearFarFixGuards) {
  window._nearFarFixGuards.forEach(g => clearInterval(g));
}

console.log('');
console.log('🔧 [步骤1] 强制设置 near/far 为默认值...');

const forceFixCamera = (camera, name) => {
  if (!camera) return;

  const oldNear = camera.near;
  const oldFar = camera.far;

  camera.near = 0.1;
  camera.far = 10000;
  camera.updateProjectionMatrix();

  console.log(`  ${name}:`);
  console.log(`    修改前: near=${oldNear.toFixed(2)}, far=${oldFar.toFixed(2)}`);
  console.log(`    修改后: near=${camera.near.toFixed(2)}, far=${camera.far.toFixed(2)}`);
};

forceFixCamera(viewer.camera1, 'camera1');
if (viewer.camera2) {
  forceFixCamera(viewer.camera2, 'camera2');
}

console.log('');
console.log('🔧 [步骤2] 禁用所有可能修改 near/far 的方法...');

// 禁用 updateCameraProjectionForLargeCoord
if (typeof viewer.updateCameraProjectionForLargeCoord === 'function') {
  viewer.updateCameraProjectionForLargeCoord = function() {
    // 完全禁用
  };
  console.log('  ✅ 已禁用 updateCameraProjectionForLargeCoord');
}

// 替换相机的 updateProjectionMatrix 方法
const lockCamera = (camera, name) => {
  if (!camera) return;

  const originalUpdate = camera.updateProjectionMatrix.bind(camera);

  camera.updateProjectionMatrix = function() {
    // 先调用原始方法
    originalUpdate();

    // 然后强制锁定 near/far
    this.near = 0.1;
    this.far = 10000;

    // 重新计算投影矩阵
    const aspect = this.aspect;
    const fov = this.fov * (Math.PI / 180);
    const f = 1.0 / Math.tan(fov / 2);

    this.projectionMatrix.elements[0] = f / aspect;
    this.projectionMatrix.elements[5] = f;
    this.projectionMatrix.elements[10] = (10000 + 0.1) / (0.1 - 10000);
    this.projectionMatrix.elements[11] = -1;
    this.projectionMatrix.elements[14] = (2 * 10000 * 0.1) / (0.1 - 10000);
    this.projectionMatrix.elements[15] = 0;

    this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
  };

  console.log(`  ✅ ${name} updateProjectionMatrix 已锁定`);
};

lockCamera(viewer.camera1, 'camera1');
if (viewer.camera2) {
  lockCamera(viewer.camera2, 'camera2');
}

console.log('');
console.log('🔧 [步骤3] 替换渲染方法...');

if (viewer.renderer1) {
  const renderer = viewer.renderer1;
  const originalRender = renderer.render;

  renderer.render = function(scene, camera) {
    // 每次渲染前强制修复 near/far 和深度函数
    if (camera) {
      camera.near = 0.1;
      camera.far = 10000;
      camera.updateProjectionMatrix();
    }

    try {
      const gl = this.getContext();
      const currentFunc = gl.getParameter(gl.DEPTH_FUNC);
      if (currentFunc !== gl.LESS) {
        gl.depthFunc(gl.LESS);
      }
    } catch (error) {
      // 忽略
    }

    return originalRender.call(this, scene, camera);
  };

  console.log('  ✅ 渲染方法已替换');
}

console.log('');
console.log('🔧 [步骤4] 启动高频守护任务...');

const guards = [];

// 守护1: 每100ms强制修复 near/far
guards.push(setInterval(() => {
  const fixCamera = (camera) => {
    if (!camera) return;
    if (camera.near !== 0.1 || camera.far !== 10000) {
      camera.near = 0.1;
      camera.far = 10000;
      camera.updateProjectionMatrix();
      console.log('🔄 [守护] 修复 near/far 值');
    }
  };

  fixCamera(viewer.camera1);
  if (viewer.camera2) fixCamera(viewer.camera2);
}, 100));

// 守护2: 每500ms检查深度函数
guards.push(setInterval(() => {
  if (viewer.renderer1) {
    try {
      const gl = viewer.renderer1.getContext();
      const currentFunc = gl.getParameter(gl.DEPTH_FUNC);
      if (currentFunc !== gl.LESS) {
        gl.depthFunc(gl.LESS);
        console.log('🔄 [守护] 修复深度函数');
      }
    } catch (error) {
      // 忽略
    }
  }
}, 500));

window._nearFarFixGuards = guards;
window._stopNearFarFix = () => {
  guards.forEach(g => clearInterval(g));
  console.log('✅ 所有守护任务已停止');
};

console.log(`  ✅ 已启动 ${guards.length} 个守护任务`);

console.log('');
console.log('========== 修复完成 ==========');
console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║  ✅ near/far 已强制锁定为 0.1/10000                     ║');
console.log('║  ✅ 深度函数已锁定为 LESS                                ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('');
console.log('💡 请检查透视是否恢复正常');
console.log('');
console.log('📌 可用命令:');
console.log('   __nearFarLock.check() - 检查状态');
console.log('   _stopNearFarFix() - 停止守护任务');
console.log('');

// 创建检查函数
window.__nearFarLock = {
  check: () => {
    console.log('========== 当前状态 ==========');

    const checkCam = (cam, name) => {
      if (!cam) return;
      const ratio = cam.far / cam.near;
      const ok = (cam.near === 0.1 && cam.far === 10000);
      console.log(`  ${ok ? '✅' : '❌'} ${name}: near=${cam.near.toFixed(2)}, far=${cam.far.toFixed(2)}, ratio=${ratio.toFixed(0)}`);
    };

    checkCam(viewer.camera1, 'camera1');
    checkCam(viewer.camera2, 'camera2');

    if (viewer.renderer1) {
      try {
        const gl = viewer.renderer1.getContext();
        const currentFunc = gl.getParameter(gl.DEPTH_FUNC);
        const depthOk = currentFunc === gl.LESS;
        console.log(`  ${depthOk ? '✅' : '❌'} 深度函数: ${currentFunc === gl.LESS ? 'LESS' : currentFunc === gl.LEQUAL ? 'LEQUAL' : currentFunc}`);
      } catch (error) {
        console.log('  ⚠️  深度函数: 无法检查');
      }
    }

    const guardsActive = window._nearFarFixGuards && window._nearFarFixGuards.length > 0;
    console.log(`  ${guardsActive ? '✅' : '❌'} 守护任务: ${guardsActive ? '运行中' : '已停止'}`);

    console.log('============================');
  }
};

// 立即检查
__nearFarLock.check();
