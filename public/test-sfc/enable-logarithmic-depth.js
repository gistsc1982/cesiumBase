// ═══════════════════════════════════════════════════════════════════
// 运行时修复：强制启用对数深度缓冲区
// ═══════════════════════════════════════════════════════════════════

(function() {
  const dualViewer = window.__dualCanvasViewer;
  if (!dualViewer) {
    console.error('❌ DualCanvasViewer 未找到');
    return;
  }

  // 从 dualViewer 获取 THREE（如果有）
  const THREE = dualViewer.THREE || window.THREE;
  if (!THREE) {
    console.error('❌ THREE.js 未找到，无法创建渲染器');
    return;
  }

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  🔧 运行时修复：启用对数深度缓冲区                             ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // ⚠️ 警告：这是一个临时修复，会创建新的渲染器
  // 最好的解决方案是重新打包组件

  const forceEnableLogarithmicDepth = () => {
    if (!dualViewer.renderer1 || !dualViewer.renderer2) {
      console.error('❌ 渲染器未找到');
      return false;
    }

    // 保存当前状态
    const oldCanvas1 = dualViewer.threeCanvas1;
    const oldCanvas2 = dualViewer.bimCanvas;
    const oldRenderer1 = dualViewer.renderer1;
    const oldRenderer2 = dualViewer.renderer2;

    // 停止旧动画循环
    if (dualViewer.animationFrame1) {
      cancelAnimationFrame(dualViewer.animationFrame1);
    }
    if (dualViewer.animationFrame2) {
      cancelAnimationFrame(dualViewer.animationFrame2);
    }

    // 创建新的渲染器（启用对数深度缓冲区）
    console.log('📦 创建新的 renderer1（启用对数深度缓冲区）...');
    dualViewer.renderer1 = new THREE.WebGLRenderer({
      canvas: oldCanvas1,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true  // ✅ 启用
    });
    dualViewer.renderer1.setPixelRatio(window.devicePixelRatio);
    dualViewer.renderer1.setSize(oldCanvas1.clientWidth, oldCanvas1.clientHeight);
    dualViewer.renderer1.setClearColor(0x000000, 0);

    console.log('📦 创建新的 renderer2（启用对数深度缓冲区）...');
    dualViewer.renderer2 = new THREE.WebGLRenderer({
      canvas: oldCanvas2,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true  // ✅ 启用
    });
    dualViewer.renderer2.setPixelRatio(window.devicePixelRatio);
    dualViewer.renderer2.setSize(oldCanvas2.clientWidth, oldCanvas2.clientHeight);
    dualViewer.renderer2.setClearColor(0x000000, 0);

    // 恢复相机 near/far 值
    if (typeof dualViewer.updateCameraProjectionForLargeCoord === 'function') {
      dualViewer.updateCameraProjectionForLargeCoord();
    }

    // 重新启动动画循环
    console.log('🔄 重新启动动画循环...');
    dualViewer.startAnimationLoop1();
    dualViewer.startAnimationLoop2();

    return true;
  };

  // 执行修复
  if (forceEnableLogarithmicDepth()) {
    console.log('\n✅ 修复完成！\n');

    // 验证修复结果
    console.log('📊 验证结果:');
    console.log('  renderer1 对数深度缓冲区:', dualViewer.renderer1.capabilities.isLogarithmicDepthBuffer ? '✅ 已启用' : '❌ 未启用');
    console.log('  renderer2 对数深度缓冲区:', dualViewer.renderer2.capabilities.isLogarithmicDepthBuffer ? '✅ 已启用' : '❌ 未启用');
    console.log('\n💡 现在测试模型透视是否正常（应该是"近大远小"）');
  } else {
    console.log('\n❌ 修复失败\n');
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  ⚠️ 这是一个临时修复，刷新页面后会失效                       ║');
  console.log('║  💡 永久解决方案：重新打包组件                                  ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
})();
