// 尝试翻转投影矩阵深度值符号来修复透视翻转

console.log('========== 尝试翻转投影矩阵深度值符号 ==========');

const viewer = window.__dualCanvasViewer;
if (!viewer.camera1) {
  console.error('❌ 相机未找到');
  throw new Error('相机未找到');
}

const cam = viewer.camera1;
const renderer = viewer.renderer1;

console.log('当前状态:');
console.log('  near:', cam.near.toFixed(2));
console.log('  far:', cam.far.toFixed(2));
console.log('  [14,10]:', cam.projectionMatrix.elements[14].toFixed(2));

// 方案1: 翻转 [14,10] 的符号
console.log('');
console.log('🔧 方案1: 翻转 [14,10] 符号...');

const originalValue = cam.projectionMatrix.elements[14];
cam.projectionMatrix.elements[14] = -originalValue;
cam.updateProjectionMatrix();

console.log('已将 [14,10] 从', originalValue.toFixed(2), '改为', cam.projectionMatrix.elements[14].toFixed(2));
console.log('请观察5秒...');

setTimeout(() => {
  // 恢复
  cam.projectionMatrix.elements[14] = originalValue;
  cam.updateProjectionMatrix();

  console.log('');
  console.log('🔧 方案2: 翻转 [10,10] 符号...');

  const originalValue2 = cam.projectionMatrix.elements[10];
  cam.projectionMatrix.elements[10] = -originalValue2;
  cam.updateProjectionMatrix();

  console.log('已将 [10,10] 从', originalValue2.toFixed(2), '改为', cam.projectionMatrix.elements[10].toFixed(2));
  console.log('请观察5秒...');

  setTimeout(() => {
    // 恢复
    cam.projectionMatrix.elements[10] = originalValue2;
    cam.updateProjectionMatrix();

    console.log('');
    console.log('🔧 方案3: 同时翻转 [10,10] 和 [14,10]...');

    cam.projectionMatrix.elements[10] = -originalValue2;
    cam.projectionMatrix.elements[14] = -originalValue;
    cam.updateProjectionMatrix();

    console.log('已同时翻转两个元素');
    console.log('请观察5秒...');

    setTimeout(() => {
      // 恢复
      cam.projectionMatrix.elements[10] = originalValue2;
      cam.projectionMatrix.elements[14] = originalValue;
      cam.updateProjectionMatrix();

      console.log('');
      console.log('========== 测试完成 ==========');
      console.log('请告诉哪个方案（如果有）让透视恢复正常？');
    }, 5000);
  }, 5000);
}, 5000);
