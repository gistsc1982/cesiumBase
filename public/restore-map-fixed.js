/**
 * 诊断并恢复地图显示（修复版）
 */

console.log('='.repeat(80));
console.log('🔍 诊断地图显示问题');
console.log('='.repeat(80));

// 检查 Cesium Viewer（正确的位置）
const cesiumViewer = window.__cesiumViewer__;

if (!cesiumViewer) {
  console.error('❌ 无法找到 Cesium Viewer');
  console.log('   尝试查找其他可能的位置...');

  // 检查 Vue 实例
  const vueInstances = document.querySelectorAll('#app');
  if (vueInstances.length > 0) {
    console.log('   找到了 #app 元素');
  }
} else {
  console.log('✅ 找到 Cesium Viewer\n');

  // 检查 Cesium 容器
  const cesiumContainer = document.getElementById('cesiumContainer');
  console.log('📍 Cesium 容器:', cesiumContainer ? '存在' : '不存在');

  if (cesiumContainer) {
    const style = window.getComputedStyle(cesiumContainer);
    console.log('   - display:', style.display);
    console.log('   - visibility:', style.visibility);
    console.log('   - opacity:', style.opacity);
    console.log('   - z-index:', style.zIndex);
    console.log('   - position:', style.position);
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

  // 检查 Cesium 场景
  console.log('\n📍 Cesium 场景:', cesiumViewer.scene ? '存在' : '不存在');
  if (cesiumViewer.scene) {
    console.log('   - globe:', cesiumViewer.scene.globe ? '存在' : '不存在');
    console.log('   - globe.show:', cesiumViewer.scene.globe ? cesiumViewer.scene.globe.show : 'N/A');
  }

  // 尝试恢复地图显示
  console.log('\n' + '='.repeat(80));
  console.log('🔧 尝试恢复地图显示');
  console.log('='.repeat(80));

  if (cesiumContainer) {
    // 确保容器可见
    cesiumContainer.style.display = 'block';
    cesiumContainer.style.visibility = 'visible';
    cesiumContainer.style.opacity = '1';
    cesiumContainer.style.position = 'absolute';
    cesiumContainer.style.top = '0';
    cesiumContainer.style.left = '0';
    cesiumContainer.style.width = '100%';
    cesiumContainer.style.height = '100%';
    cesiumContainer.style.zIndex = '0';
    console.log('✅ 已恢复 Cesium 容器样式');
  }

  if (cesiumCanvas) {
    // 确保 Canvas 可见
    cesiumCanvas.style.display = 'block';
    cesiumCanvas.style.visibility = 'visible';
    cesiumCanvas.style.opacity = '1';
    console.log('✅ 已恢复 Cesium Canvas 样式');
  }

  // 确保 globe 显示
  if (cesiumViewer.scene && cesiumViewer.scene.globe) {
    cesiumViewer.scene.globe.show = true;
    console.log('✅ 已启用 globe.show');
  }

  // 强制重新渲染
  console.log('\n📍 强制重新渲染...');
  cesiumViewer.scene.requestRender();
  console.log('✅ 已请求 Cesium 重新渲染');

  console.log('\n' + '='.repeat(80));
  console.log('✅ 恢复完成');
  console.log('='.repeat(80));
  console.log('\n📝 请检查地图是否重新显示');
  console.log('   如果仍然没有显示，可能需要刷新页面\n');
}

console.log('\n');
