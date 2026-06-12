// ═══════════════════════════════════════════════════════════════════
// 综合修复脚本 V5 - 重建渲染器版（终极解决方案）
// ═══════════════════════════════════════════════════════════════════
// 功能：
//   1. 🔥 重新创建渲染器并启用对数深度缓冲区
//   2. 🔄 完整恢复场景、相机、控制器
//   3. 📊 智能深度管理
//   4. ⚠️ 警告：会重建渲染器，可能需要几秒钟
// ═══════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  🚀 综合修复脚本 V5 - 重建渲染器版                      ║');
  console.log('║  🔥 对数深度 + 🔄 重建渲染器 + 💾 完整恢复              ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log('⚠️  警告：此脚本将重建渲染器，可能会有短暂闪烁');
  console.log('📋 过程：保存状态 → 销毁旧渲染器 → 创建新渲染器 → 恢复状态\n');

  // ═══════════════════════════════════════════════════════════════════
  // 步骤1：检查依赖
  // ═══════════════════════════════════════════════════════════════════
  console.log('🔍 [步骤1/7] 检查依赖...');

  const dualViewer = window.__dualCanvasViewer;
  const cesiumViewer = window.__cesiumViewer__;
  const Cesium = window.Cesium;

  if (!dualViewer) {
    console.error('❌ DualCanvasViewer 未找到');
    return;
  }

  console.log('  ✅ DualCanvasViewer 已找到');

  // ═══════════════════════════════════════════════════════════════════
  // 步骤2：保存当前状态
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n💾 [步骤2/7] 保存当前状态...');

  const savedState = {
    layer1: {
      renderer: dualViewer.renderer1,
      camera: dualViewer.camera1,
      scene: dualViewer.scene1,
      controls: dualViewer.controls1,
      canvas: dualViewer.canvas1,
      canvasContainer: dualViewer.canvas1?.parentNode,
      size: dualViewer.canvas1 ? {
        width: dualViewer.canvas1.width,
        height: dualViewer.canvas1.height,
        clientWidth: dualViewer.canvas1.clientWidth,
        clientHeight: dualViewer.canvas1.clientHeight
      } : null,
      pixelRatio: window.devicePixelRatio,
      cameraState: {
        position: dualViewer.camera1?.position.clone(),
        quaternion: dualViewer.camera1?.quaternion.clone(),
        near: dualViewer.camera1?.near,
        far: dualViewer.camera1?.far,
        fov: dualViewer.camera1?.fov,
        aspect: dualViewer.camera1?.aspect,
        zoom: dualViewer.camera1?.zoom
      },
      controlsState: dualViewer.controls1 ? {
        target: dualViewer.controls1.target.clone(),
        enableDamping: dualViewer.controls1.enableDamping,
        dampingFactor: dualViewer.controls1.dampingFactor,
        rotateSpeed: dualViewer.controls1.rotateSpeed,
        enableZoom: dualViewer.controls1.enableZoom,
        zoomSpeed: dualViewer.controls1.zoomSpeed
      } : null,
      rendererState: {
        autoClear: dualViewer.renderer1?.autoClear,
        autoClearColor: dualViewer.renderer1?.autoClearColor,
        autoClearDepth: dualViewer.renderer1?.autoClearDepth,
        autoClearStencil: dualViewer.renderer1?.autoClearStencil,
        outputColorSpace: dualViewer.renderer1?.outputColorSpace,
        toneMapping: dualViewer.renderer1?.toneMapping,
        toneMappingExposure: dualViewer.renderer1?.toneMappingExposure,
        sortObjects: dualViewer.renderer1?.sortObjects,
        depthBuffer: dualViewer.renderer1?.depthBuffer,
        stencilBuffer: dualViewer.renderer1?.stencilBuffer
      }
    },
    layer2: null
  };

  // 保存 BIM 层状态（如果存在）
  if (dualViewer.renderer2) {
    savedState.layer2 = {
      renderer: dualViewer.renderer2,
      camera: dualViewer.camera2,
      scene: dualViewer.scene2,
      controls: dualViewer.controls2,
      canvas: dualViewer.canvas2,
      canvasContainer: dualViewer.canvas2?.parentNode,
      size: dualViewer.canvas2 ? {
        width: dualViewer.canvas2.width,
        height: dualViewer.canvas2.height,
        clientWidth: dualViewer.canvas2.clientWidth,
        clientHeight: dualViewer.canvas2.clientHeight
      } : null,
      cameraState: dualViewer.camera2 ? {
        position: dualViewer.camera2.position.clone(),
        quaternion: dualViewer.camera2.quaternion.clone(),
        near: dualViewer.camera2.near,
        far: dualViewer.camera2.far,
        fov: dualViewer.camera2.fov,
        aspect: dualViewer.camera2.aspect,
        zoom: dualViewer.camera2.zoom
      } : null,
      controlsState: dualViewer.controls2 ? {
        target: dualViewer.controls2.target.clone(),
        enableDamping: dualViewer.controls2.enableDamping,
        dampingFactor: dualViewer.controls2.dampingFactor,
        rotateSpeed: dualViewer.controls2.rotateSpeed,
        enableZoom: dualViewer.controls2.enableZoom,
        zoomSpeed: dualViewer.controls2.zoomSpeed
      } : null,
      rendererState: {
        autoClear: dualViewer.renderer2.autoClear,
        autoClearColor: dualViewer.renderer2.autoClearColor,
        autoClearDepth: dualViewer.renderer2.autoClearDepth,
        autoClearStencil: dualViewer.renderer2.autoClearStencil,
        outputColorSpace: dualViewer.renderer2.outputColorSpace,
        toneMapping: dualViewer.renderer2.toneMapping,
        toneMappingExposure: dualViewer.renderer2.toneMappingExposure,
        sortObjects: dualViewer.renderer2.sortObjects,
        depthBuffer: dualViewer.renderer2.depthBuffer,
        stencilBuffer: dualViewer.renderer2.stencilBuffer
      }
    };
  }

  // 保存渲染循环引用
  const animationFrame1 = dualViewer.animationFrame1;
  const animationFrame2 = dualViewer.animationFrame2;

  console.log('  ✅ 状态已保存');
  console.log(`    Canvas 1: ${savedState.layer1.size?.clientWidth}x${savedState.layer1.size?.clientHeight}`);
  if (savedState.layer2) {
    console.log(`    Canvas 2: ${savedState.layer2.size.clientWidth}x${savedState.layer2.size.clientHeight}`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 步骤3：停止动画循环
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n⏸️  [步骤3/7] 停止动画循环...');

  if (animationFrame1) {
    cancelAnimationFrame(animationFrame1);
    dualViewer.animationFrame1 = null;
  }
  if (animationFrame2) {
    cancelAnimationFrame(animationFrame2);
    dualViewer.animationFrame2 = null;
  }

  console.log('  ✅ 动画循环已停止');

  // ═══════════════════════════════════════════════════════════════════
  // 步骤4：查找 THREE 构造函数
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n🔍 [步骤4/7] 查找 THREE 构造函数...');

  let WebGLRenderer = null;

  // 尝试从全局获取
  if (window.THREE && window.THREE.WebGLRenderer) {
    WebGLRenderer = window.THREE.WebGLRenderer;
    console.log('  ✅ 从 window.THREE 获取');
  }
  // 尝试从相机构造函数获取
  else if (dualViewer.camera1 && dualViewer.camera1.constructor) {
    const CameraConstructor = dualViewer.camera1.constructor;

    // 检查是否有 THREE 引用
    if (CameraConstructor.THREE && CameraConstructor.THREE.WebGLRenderer) {
      WebGLRenderer = CameraConstructor.THREE.WebGLRenderer;
      console.log('  ✅ 从相机构造函数获取');
    }
    // 尝试从渲染器获取
    else if (dualViewer.renderer1 && dualViewer.renderer1.constructor) {
      WebGLRenderer = dualViewer.renderer1.constructor;
      console.log('  ✅ 从现有渲染器获取');
    }
  }

  if (!WebGLRenderer) {
    console.error('❌ 无法找到 WebGLRenderer 构造函数');
    console.log('💡 尝试直接使用现有渲染器的构造函数...');
    WebGLRenderer = dualViewer.renderer1?.constructor;
  }

  if (!WebGLRenderer) {
    console.error('❌ 无法找到 THREE.WebGLRenderer');
    return;
  }

  console.log('  ✅ WebGLRenderer 构造函数已找到');

  // ═══════════════════════════════════════════════════════════════════
  // 步骤5：重建渲染器（启用对数深度）
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n🔨 [步骤5/7] 重建渲染器（启用对数深度）...');

  function createRenderer(canvas, oldRenderer) {
    const size = canvas ?
      { width: canvas.clientWidth, height: canvas.clientHeight } :
      { width: 800, height: 600 };

    console.log(`  创建渲染器: ${size.width}x${size.height}`);

    const renderer = new WebGLRenderer({
      canvas: canvas || undefined,
      antialias: true,
      alpha: true,
      logarithmicDepthBuffer: true,  // 🔥 关键：启用对数深度！
      depth: true,
      stencil: true
    });

    renderer.setSize(size.width, size.height);
    renderer.setPixelRatio(window.devicePixelRatio);

    // 恢复渲染器状态
    if (oldRenderer) {
      renderer.autoClear = oldRenderer.autoClear !== undefined ? oldRenderer.autoClear : true;
      renderer.autoClearColor = oldRenderer.autoClearColor !== undefined ? oldRenderer.autoClearColor : true;
      renderer.autoClearDepth = oldRenderer.autoClearDepth !== undefined ? oldRenderer.autoClearDepth : true;
      renderer.autoClearStencil = oldRenderer.autoClearStencil !== undefined ? oldRenderer.autoClearStencil : true;
      if (oldRenderer.outputColorSpace) renderer.outputColorSpace = oldRenderer.outputColorSpace;
      if (oldRenderer.toneMapping) renderer.toneMapping = oldRenderer.toneMapping;
      if (oldRenderer.toneMappingExposure !== undefined) renderer.toneMappingExposure = oldRenderer.toneMappingExposure;
      if (oldRenderer.sortObjects !== undefined) renderer.sortObjects = oldRenderer.sortObjects;
    }

    console.log(`  ✅ 渲染器已创建，对数深度: ${renderer.capabilities?.logarithmicDepthBuffer ? '✅ 已启用' : '❌ 未启用'}`);

    return renderer;
  }

  // 重建第一层渲染器
  const oldRenderer1 = savedState.layer1.renderer;
  const newRenderer1 = createRenderer(savedState.layer1.canvas, oldRenderer1);

  // 重建第二层渲染器（如果存在）
  let newRenderer2 = null;
  if (savedState.layer2) {
    const oldRenderer2 = savedState.layer2.renderer;
    newRenderer2 = createRenderer(savedState.layer2.canvas, oldRenderer2);
  }

  // 更新 DualCanvasViewer 的引用
  dualViewer.renderer1 = newRenderer1;
  if (newRenderer2) {
    dualViewer.renderer2 = newRenderer2;
  }

  // 销毁旧渲染器
  console.log('\n🗑️  销毁旧渲染器...');

  function disposeRenderer(renderer) {
    if (!renderer) return;

    try {
      renderer.dispose();
      // 清理渲染上下文
      const gl = renderer.getContext();
      if (gl && gl.getExtension('WEBGL_lose_context')) {
        gl.getExtension('WEBGL_lose_context').loseContext();
      }
    } catch (e) {
      console.warn(`  ⚠️ 销毁渲染器时出错: ${e.message}`);
    }
  }

  disposeRenderer(oldRenderer1);
  if (savedState.layer2) {
    disposeRenderer(savedState.layer2.renderer);
  }

  console.log('  ✅ 旧渲染器已销毁');

  // ═══════════════════════════════════════════════════════════════════
  // 步骤6：恢复相机状态
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n🔄 [步骤6/7] 恢复相机状态...');

  function restoreCamera(camera, cameraState) {
    if (!camera || !cameraState) return;

    camera.position.copy(cameraState.position);
    camera.quaternion.copy(cameraState.quaternion);
    camera.near = cameraState.near;
    camera.far = cameraState.far;
    camera.fov = cameraState.fov;
    camera.aspect = cameraState.aspect;
    camera.zoom = cameraState.zoom;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    console.log(`    相机位置: (${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)})`);
    console.log(`    near/far: ${camera.near} / ${camera.far.toFixed(0)}`);
  }

  restoreCamera(dualViewer.camera1, savedState.layer1.cameraState);
  if (dualViewer.camera2 && savedState.layer2) {
    restoreCamera(dualViewer.camera2, savedState.layer2.cameraState);
  }

  // 恢复控制器状态
  function restoreControls(controls, controlsState) {
    if (!controls || !controlsState) return;

    controls.target.copy(controlsState.target);
    controls.enableDamping = controlsState.enableDamping;
    controls.dampingFactor = controlsState.dampingFactor;
    controls.rotateSpeed = controlsState.rotateSpeed;
    controls.enableZoom = controlsState.enableZoom;
    controls.zoomSpeed = controlsState.zoomSpeed;
    controls.update();

    console.log(`    控制器目标: (${controls.target.x.toFixed(2)}, ${controls.target.y.toFixed(2)}, ${controls.target.z.toFixed(2)})`);
  }

  restoreControls(dualViewer.controls1, savedState.layer1.controlsState);
  if (dualViewer.controls2 && savedState.layer2) {
    restoreControls(dualViewer.controls2, savedState.layer2.controlsState);
  }

  console.log('  ✅ 相机和控制器状态已恢复');

  // ═══════════════════════════════════════════════════════════════════
  // 步骤7：重新启动渲染循环
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n▶️  [步骤7/7] 重新启动渲染循环...');

  // 获取 DualCanvasViewer 的渲染方法
  const originalRender1 = dualViewer.render1;
  const originalRender2 = dualViewer.render2;

  function createAnimateFunction(layerIndex) {
    const renderer = layerIndex === 1 ? newRenderer1 : newRenderer2;
    const scene = layerIndex === 1 ? dualViewer.scene1 : dualViewer.scene2;
    const camera = layerIndex === 1 ? dualViewer.camera1 : dualViewer.camera2;
    const controls = layerIndex === 1 ? dualViewer.controls1 : dualViewer.controls2;
    const animationFrameProp = layerIndex === 1 ? 'animationFrame1' : 'animationFrame2';

    if (!renderer || !scene || !camera) {
      console.warn(`  ⚠️ 第${layerIndex}层缺少必要对象，跳过`);
      return null;
    }

    const animate = () => {
      dualViewer[animationFrameProp] = requestAnimationFrame(animate);

      if (controls && controls.update) {
        controls.update();
      }

      renderer.render(scene, camera);
    };

    return animate;
  }

  const animate1 = createAnimateFunction(1);
  const animate2 = createAnimateFunction(2);

  if (animate1) {
    animate1();
    console.log('  ✅ 第1层渲染循环已启动');
  }

  if (animate2) {
    animate2();
    console.log('  ✅ 第2层渲染循环已启动');
  }

  console.log('  ✅ 渲染循环已恢复');

  // ═══════════════════════════════════════════════════════════════════
  // 完成
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  ✅ 渲染器重建完成！                                     ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log('📊 渲染器信息:');
  console.log(`  WebGL 版本: ${newRenderer1.capabilities?.isWebGL2 ? 'WebGL 2.0' : 'WebGL 1.0'}`);
  console.log(`  对数深度缓冲区: ${newRenderer1.capabilities?.logarithmicDepthBuffer ? '✅ 已启用' : '❌ 未启用'}`);
  console.log(`  像素比: ${window.devicePixelRatio}`);
  console.log(`  画布大小: ${savedState.layer1.size?.clientWidth}x${savedState.layer1.size?.clientHeight}`);

  // ═══════════════════════════════════════════════════════════════════
  // 诊断工具
  // ═══════════════════════════════════════════════════════════════════
  dualViewer.checkLogDepthV5 = function() {
    console.log('\n📊 V5 对数深度检查:');
    console.log(`  渲染器1 对数深度: ${newRenderer1.capabilities?.logarithmicDepthBuffer ? '✅ 已启用' : '❌ 未启用'}`);
    console.log(`  渲染器1 WebGL: ${newRenderer1.capabilities?.isWebGL2 ? 'WebGL 2.0' : 'WebGL 1.0'}`);

    if (newRenderer2) {
      console.log(`  渲染器2 对数深度: ${newRenderer2.capabilities?.logarithmicDepthBuffer ? '✅ 已启用' : '❌ 未启用'}`);
      console.log(`  渲染器2 WebGL: ${newRenderer2.capabilities?.isWebGL2 ? 'WebGL 2.0' : 'WebGL 1.0'}`);
    }

    console.log('\n相机配置:');
    console.log(`  相机1 near: ${dualViewer.camera1.near}`);
    console.log(`  相机1 far: ${dualViewer.camera1.far}`);
    console.log(`  相机1 位置: (${dualViewer.camera1.position.x.toFixed(2)}, ${dualViewer.camera1.position.y.toFixed(2)}, ${dualViewer.camera1.position.z.toFixed(2)})`);

    if (dualViewer.camera2) {
      console.log(`  相机2 near: ${dualViewer.camera2.near}`);
      console.log(`  相机2 far: ${dualViewer.camera2.far}`);
    }

    return {
      logDepthEnabled: newRenderer1.capabilities?.logarithmicDepthBuffer,
      isWebGL2: newRenderer1.capabilities?.isWebGL2
    };
  };

  dualViewer._rebuildInfo = {
    oldRenderer1: oldRenderer1,
    newRenderer1: newRenderer1,
    oldRenderer2: savedState.layer2?.renderer,
    newRenderer2: newRenderer2,
    timestamp: Date.now()
  };

  console.log('\n📌 可用命令:');
  console.log('   window.__dualCanvasViewer.checkLogDepthV5() - 检查对数深度状态');

  // 立即检查
  const checkResult = dualViewer.checkLogDepthV5();

  if (checkResult.logDepthEnabled) {
    console.log('\n✅ 对数深度缓冲区已成功启用！');
    console.log('💡 这应该能解决透视翻转问题');
  } else {
    console.log('\n⚠️ 对数深度缓冲区未启用');
    console.log('💡 可能是浏览器不支持，或者 THREE.js 版本过旧');
  }

  console.log('\n🎉 V5 修复完成！');

})();
