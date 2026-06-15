// ⭐ Three.js 全局加载脚本
// 将 Three.js 和相关的 addons 加载到全局 window 对象
// 供 vue3-sfc-loader 和 HelloWorld.vue 使用
// 使用本地资源，通过 import map 解析模块路径

(async function() {
  // 检查是否已经加载过
  if (typeof window !== 'undefined' && window.THREE) {
    console.log('[ThreeJSGlobalLoader] ℹ️ Three.js 已经加载，跳过');
    return;
  }

  console.log('[ThreeJSGlobalLoader] 🚀 开始加载 Three.js 模块到全局（使用本地资源）...');

  try {
    // ⭐ 加载 Three.js 核心库（本地，通过 import map）
    const THREE = await import('three');
    window.THREE = THREE;
    window.three = THREE;
    console.log('[ThreeJSGlobalLoader] ✅ Three.js 核心已加载');

    // ⭐ 加载 OrbitControls（本地，通过 import map）
    const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
    window.OrbitControls = OrbitControls;
    console.log('[ThreeJSGlobalLoader] ✅ OrbitControls 已加载');

    // ⭐ 加载 TransformControls（本地，通过 import map）
    const { TransformControls } = await import('three/addons/controls/TransformControls.js');
    window.TransformControls = TransformControls;
    console.log('[ThreeJSGlobalLoader] ✅ TransformControls 已加载');

    // ⭐ 加载 PLYLoader（本地，通过 import map）
    const { PLYLoader } = await import('three/addons/loaders/PLYLoader.js');
    window.PLYLoader = PLYLoader;
    console.log('[ThreeJSGlobalLoader] ✅ PLYLoader 已加载');

    // ⭐ 加载 DRACOLoader（本地，通过 import map）
    const { DRACOLoader } = await import('three/addons/loaders/DRACOLoader.js');
    window.DRACOLoader = DRACOLoader;
    console.log('[ThreeJSGlobalLoader] ✅ DRACOLoader 已加载');

    // ⭐ 加载 GLTFLoader（本地，通过 import map）
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    window.GLTFLoader = GLTFLoader;
    console.log('[ThreeJSGlobalLoader] ✅ GLTFLoader 已加载');

    console.log('[ThreeJSGlobalLoader] ✅ 所有 Three.js 模块加载完成（本地资源）');

    // 触发自定义事件通知加载完成
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('ThreeJSGlobalLoaded');
      window.dispatchEvent(event);
    }
  } catch (error) {
    console.error('[ThreeJSGlobalLoader] ❌ Three.js 模块加载失败:', error);
  }
})();
