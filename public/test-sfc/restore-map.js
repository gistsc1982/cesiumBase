/**
 * 诊断并恢复地图显示
 */

console.log('='.repeat(80));
console.log('🔍 诊断地图显示问题');
console.log('='.repeat(80));

// 检查 Cesium Viewer
const cesiumViewer = window.cesiumViewer;

if (!cesiumViewer) {
  console.error('❌ 无法找到 Cesium Viewer');
} else {
  console.log('✅ 找到 Cesium Viewer\n');

  // 检查 Cesium 容器
  const cesiumContainer = cesiumViewer.container;
  console.log('📍 Cesium 容器:', cesiumContainer ? '存在' : '不存在');

  if (cesiumContainer) {
    const style = window.getComputedStyle(cesiumContainer);
    console.log('   - display:', style.display);
    console.log('   - visibility:', style.visibility);
    console.log('   - opacity:', style.opacity);
    console.log('   - z-index:', style.zIndex);
  }

  // 检查 Cesium Canvas
  const cesiumCanvas = cesiumViewer.canvas;
  console.log('\n📍 Cesium Canvas:', cesiumCanvas ? '存在' : '不存在');

  if (cesiumCanvas) {
    const style = window.getComputedStyle(cesiumCanvas);
    console.log('   - display:', style.display);
    console.log('   - visibility:', style.visibility);
    console.log('   - opacity:', style.opacity);
    console.log('   - z-index:', style.zIndex);
    console.log('   - width:', cesiumCanvas.width);
    console.log('   - height:', cesiumCanvas.height);
  }

  // 检查是否被渲染器 canvas 覆盖
  console.log('\n📍 检查 Canvas 层级:');

  const allCanvases = document.querySelectorAll('canvas');
  console.log(`   总共找到 ${allCanvases.length} 个 canvas`);

  allCanvases.forEach((canvas, index) => {
    const style = window.getComputedStyle(canvas);
    const rect = canvas.getBoundingClientRect();

    console.log(`\n   Canvas ${index + 1}:`);
    console.log(`     - id: ${canvas.id || '(无)'}`);
    console.log(`     - class: ${canvas.className || '(无)'}`);
    console.log(`     - z-index: ${style.zIndex}`);
    console.log(`     - pointer-events: ${style.pointerEvents}`);
    console.log(`     - 位置: (${rect.left.toFixed(0)}, ${rect.top.toFixed(0)})`);
    console.log(`     - 尺寸: ${rect.width.toFixed(0)}x${rect.height.toFixed(0)}`);
  });

  // 尝试恢复地图显示
  console.log('\n' + '='.repeat(80));
  console.log('🔧 尝试恢复地图显示');
  console.log('='.repeat(80));

  if (cesiumContainer) {
    // 确保容器可见
    cesiumContainer.style.display = 'block';
    cesiumContainer.style.visibility = 'visible';
    cesiumContainer.style.opacity = '1';
    console.log('✅ 已恢复 Cesium 容器样式');
  }

  if (cesiumCanvas) {
    // 确保 Canvas 可见
    cesiumCanvas.style.display = 'block';
    cesiumCanvas.style.visibility = 'visible';
    cesiumCanvas.style.opacity = '1';
    console.log('✅ 已恢复 Cesium Canvas 样式');
  }

  // 检查 DualCanvasViewer 的状态
  const dualViewer = window.__dualCanvasViewerInstances &&
                    window.__dualCanvasViewerInstances.length > 0 &&
                    window.__dualCanvasViewerInstances[0];

  if (dualViewer) {
    console.log('\n📍 DualCanvasViewer 状态:');
    console.log('   - showCesiumLayer:', dualViewer.showCesiumLayer);
    console.log('   - showThreeLayer:', dualViewer.showThreeLayer);
    console.log('   - showBimLayer:', dualViewer.showBimLayer);

    // 确保 Cesium 层显示
    if (dualViewer.showCesiumLayer === false) {
      console.log('\n⚠️  Cesium 层被禁用，正在启用...');
      dualViewer.showCesiumLayer = true;
      console.log('✅ 已启用 Cesium 层');
    }
  }

  // 强制重新渲染
  console.log('\n📍 强制重新渲染...');
  if (cesiumViewer && cesiumViewer.scene) {
    cesiumViewer.scene.requestRender();
    console.log('✅ 已请求 Cesium 重新渲染');
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ 恢复完成');
  console.log('='.repeat(80));
  console.log('\n📝 请检查地图是否重新显示');
  console.log('   如果仍然没有显示，请尝试刷新页面\n');
}

console.log('\n');
