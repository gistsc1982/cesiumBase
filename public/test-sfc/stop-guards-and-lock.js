// 停止所有守护任务并强制锁定 near/far

console.log('========== 停止所有守护任务 ==========');

// 停止所有可能的守护任务
if (window._fixGuards) {
  window._fixGuards.forEach(g => clearInterval(g));
  window._fixGuards = [];
  console.log('✅ 已停止 _fixGuards');
}
if (window._depthFixGuards) {
  window._depthFixGuards.forEach(g => clearInterval(g));
  window._depthFixGuards = [];
  console.log('✅ 已停止 _depthFixGuards');
}
if (window._nearFarFixGuards) {
  window._nearFarFixGuards.forEach(g => clearInterval(g));
  window._nearFarFixGuards = [];
  console.log('✅ 已停止 _nearFarFixGuards');
}

const viewer = window.__dualCanvasViewer;
if (!viewer || !viewer.camera1) {
  console.error('❌ 相机未找到');
  throw new Error('相机未找到');
}

console.log('');
console.log('🔧 强制设置 near/far 并锁定 updateProjectionMatrix...');

const cam = viewer.camera1;

// 替换 updateProjectionMatrix 方法，强制返回固定值
const updateCam = (camera) => {
  if (!camera) return;

  camera.updateProjectionMatrix = function() {
    this.near = 0.1;
    this.far = 10000;

    const aspect = this.aspect;
    const fov = this.fov * (Math.PI / 180);
    const f = 1.0 / Math.tan(fov / 2);

    this.projectionMatrix.elements[0] = f / aspect;
    this.projectionMatrix.elements[5] = f;
    this.projectionMatrix.elements[10] = (10000 + 0.1) / (0.1 - 10000);
    this.projectionMatrix.elements[11] = -1;
    this.projectionMatrix.elements[14] = (2 * 10000 * 0.1) / (0.1 - 10000);
    this.projectionMatrix.elements[15] = 0;
  };
};

updateCam(cam);
if (viewer.camera2) {
  updateCam(viewer.camera2);
}

// 强制执行一次
cam.updateProjectionMatrix();

console.log('✅ 相机的 updateProjectionMatrix 已锁定');

console.log('');
console.log('🔧 禁用 DualCanvasViewer 的更新方法...');

// 禁用 DualCanvasViewer 中的所有更新 near/far 的方法
if (typeof viewer.updateCameraProjectionForLargeCoord === 'function') {
  viewer.updateCameraProjectionForLargeCoord = function() {
    // 空操作
  };
  console.log('✅ updateCameraProjectionForLargeCoord 已禁用');
}

// 替换渲染方法，每次渲染前强制修复
if (viewer.renderer1) {
  const renderer = viewer.renderer1;
  const originalRender = renderer.render;

  renderer.render = function(scene, camera) {
    // 强制锁定 near/far
    if (camera && camera.near !== 0.1) {
      camera.near = 0.1;
      camera.far = 10000;
    }

    // 修复深度函数
    try {
      const gl = this.getContext();
      if (gl.getParameter(gl.DEPTH_FUNC) !== gl.LESS) {
        gl.depthFunc(gl.LESS);
      }
    } catch (e) {}

    return originalRender.call(this, scene, camera);
  };

  console.log('✅ 渲染方法已替换');
}

console.log('');
console.log('========== 完成 ==========');
console.log('请检查透视是否恢复正常');

console.log('');
console.log('💡 创建检查函数:');

window.__lockCheck = {
  check: () => {
    console.log('near:', cam.near, 'far:', cam.far);
    console.log('ratio:', cam.far / cam.near);

    const gl = viewer.renderer1.getContext();
    console.log('depthFunc:', gl.getParameter(gl.DEPTH_FUNC));
  }
};
