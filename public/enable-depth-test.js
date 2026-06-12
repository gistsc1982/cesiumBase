// 强制启用深度测试并检查相关设置

console.log('========== 强制启用深度测试 ==========');

const viewer = window.__dualCanvasViewer;
if (!viewer.renderer1) {
  console.error('❌ 渲染器未找到');
  throw new Error('渲染器未找到');
}

const renderer = viewer.renderer1;
const gl = renderer.getContext();

console.log('1. 当前 WebGL 状态:');
console.log('  depthTest enabled:', gl.isEnabled(gl.DEPTH_TEST));
console.log('  depthFunc:', gl.getParameter(gl.DEPTH_FUNC) === gl.LESS ? 'LESS' : gl.getParameter(gl.DEPTH_FUNC) === gl.LEQUAL ? 'LEQUAL' : gl.getParameter(gl.DEPTH_FUNC));
console.log('  depthMask:', gl.getParameter(gl.DEPTH_WRITEMASK));
console.log('  clearDepth:', gl.getParameter(gl.DEPTH_CLEAR_VALUE));

console.log('');
console.log('2. 强制设置正确的深度测试:');

// 启用深度测试
gl.enable(gl.DEPTH_TEST);

// 设置深度函数为 LESS
gl.depthFunc(gl.LESS);

// 设置深度写入掩码
gl.depthMask(true);

// 设置清除深度值为 1（最远）
gl.clearDepth(1);

console.log('✅ 已设置:');
console.log('  depthTest = true');
console.log('  depthFunc = LESS');
console.log('  depthMask = true');
console.log('  clearDepth = 1');

console.log('');
console.log('3. 强制设置 near/far 并锁定...');

const cam = viewer.camera1;
cam.near = 0.1;
cam.far = 10000;
cam.updateProjectionMatrix();

console.log('✅ near=0.1, far=10000');

console.log('');
console.log('4. 禁用混合（这可能影响深度测试）:');

try {
  gl.disable(gl.BLEND);
  console.log('✅ 已禁用混合');
} catch (e) {
  console.log('⚠️  无法禁用混合:', e.message);
}

console.log('');
console.log('========== 设置完成 ==========');
console.log('请检查透视是否恢复正常');

// 创建检查函数
window.__depthTestCheck = {
  check: () => {
    const gl = renderer.getContext();
    console.log('深度测试状态:');
    console.log('  enabled:', gl.isEnabled(gl.DEPTH_TEST));
    console.log('  func:', gl.getParameter(gl.DEPTH_FUNC) === gl.LESS ? 'LESS' : gl.getParameter(gl.DEPTH_FUNC));
    console.log('  mask:', gl.getParameter(gl.DEPTH_WRITEMASK));
    console.log('相机 near:', cam.near);
    console.log('相机 far:', cam.far);
  }
};
