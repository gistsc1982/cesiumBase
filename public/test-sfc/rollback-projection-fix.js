/**
 * 紧急回滚：恢复投影矩阵原始状态
 */

(function() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║          紧急回滚：停止修复并恢复原始状态                                   ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log('');

  // 1. 停止守护任务
  if (window._stopProjFix) {
    window._stopProjFix();
    console.log('✅ 已停止守护任务');
  }

  // 2. 删除锁定
  const viewer = window.__dualCanvasViewer ||
    (window.$vueApp && window.$vueApp.$refs && window.$vueApp.$refs.dualCanvasViewer);

  if (viewer && viewer.camera1 && viewer.camera2) {
    // 恢复层1的原始投影矩阵（使用负的 [14,10]）
    console.log('🔄 恢复层1投影矩阵...');
    viewer.camera1.projectionMatrix.elements[14] = -243.666302;  // 恢复为负值
    viewer.camera1.projectionMatrixInverse.copy(viewer.camera1.projectionMatrix).invert();
    console.log('✅ 层1已恢复（[14,10] = -243.666302）');

    // 保持层2的修复（因为层2正常显示）
    console.log('✅ 层2保持修复状态（[14,10] = 正值）');
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ 回滚完成');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('💡 状态:');
  console.log('   - 层1: 已恢复原始投影矩阵（应该能看到模型了）');
  console.log('   - 层2: 保持修复状态');
  console.log('');
})();
