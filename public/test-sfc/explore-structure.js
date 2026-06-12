// 探索 DualCanvasViewer 的实际结构

console.log('========== 探索 DualCanvasViewer 结构 ==========');

const viewer = window.__dualCanvasViewer;
if (!viewer) {
  console.error('❌ DualCanvasViewer 未找到');
  throw new Error('DualCanvasViewer 未找到');
}

console.log('1. 顶层属性:');
Object.keys(viewer).forEach(key => {
  if (key.includes('renderer') || key.includes('Renderer') || key.includes('scene') || key.includes('Scene')) {
    console.log(`  ${key}:`, typeof viewer[key]);
  }
});

console.log('');
console.log('2. originalLayer 结构:');
if (viewer.originalLayer) {
  console.log('  originalLayer 存在');
  Object.keys(viewer.originalLayer).forEach(key => {
    if (key.includes('renderer') || key.includes('Renderer') || key.includes('scene') || key.includes('Scene')) {
      console.log(`    ${key}:`, typeof viewer.originalLayer[key]);
    }
  });
}

console.log('');
console.log('3. bimLayer 结构:');
if (viewer.bimLayer) {
  console.log('  bimLayer 存在');
  Object.keys(viewer.bimLayer).forEach(key => {
    if (key.includes('renderer') || key.includes('Renderer') || key.includes('scene') || key.includes('Scene')) {
      console.log(`    ${key}:`, typeof viewer.bimLayer[key]);
    }
  });
}

console.log('');
console.log('4. 查找 rendererManager:');
if (viewer.rendererManager) {
  console.log('  ✅ rendererManager 存在');
  console.log('  类型:', typeof viewer.rendererManager);

  if (typeof viewer.rendererManager === 'object') {
    console.log('  属性:');
    Object.keys(viewer.rendererManager).forEach(key => {
      console.log(`    ${key}:`, typeof viewer.rendererManager[key]);
    });
  }
}

console.log('');
console.log('5. 查找 three 相关对象:');
Object.keys(viewer).forEach(key => {
  if (key.toLowerCase().includes('three')) {
    console.log(`  ${key}:`, typeof viewer[key]);
  }
});

console.log('');
console.log('========== 完成 ==========');
