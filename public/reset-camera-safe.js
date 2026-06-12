// ============================================================================
// 🔧 重置相机到安全位置
// ============================================================================

(function() {
    'use strict';

    console.log('================================================================================');
    console.log('🔧 重置相机到安全位置');
    console.log('================================================================================');

    const dualViewer = window.__dualCanvasViewer__ ||
                      (window.__dualCanvasViewerInstances && window.__dualCanvasViewerInstances[0]);

    if (!dualViewer) {
        console.error('❌ 无法找到 DualCanvasViewer 实例');
        return;
    }

    const camera = dualViewer.camera1;
    const controls = dualViewer.controls1;
    const scene = dualViewer.scene1;

    if (!camera || !controls || !scene) {
        console.error('❌ camera1, controls1 或 scene1 不存在');
        return;
    }

    console.log('\n重置前:');
    console.log('   相机位置:', camera.position.toArray().map(v => v.toFixed(2)));
    console.log('   控制器目标点:', controls.target.toArray().map(v => v.toFixed(2)));

    // 重置相机到从上方垂直向下看的位置
    // 模型在原点附近，所以相机应该在 (0, height, 0)
    const height = 100; // 相机高度
    const distance = 100; // 到原点的距离

    camera.position.set(0, height, 0);
    controls.target.set(0, 0, 0);
    controls.update();

    console.log('\n重置后:');
    console.log('   相机位置:', camera.position.toArray().map(v => v.toFixed(2)));
    console.log('   控制器目标点:', controls.target.toArray().map(v => v.toFixed(2)));

    // 检查模型是否在相机前面
    let minDistance = Infinity;
    let maxDistance = 0;
    let modelCount = 0;

    scene.traverse((object) => {
        if (object.isMesh && object.visible) {
            const dist = camera.position.distanceTo(object.position);
            minDistance = Math.min(minDistance, dist);
            maxDistance = Math.max(maxDistance, dist);
            modelCount++;
        }
    });

    console.log('\n模型统计:');
    console.log('   模型数量:', modelCount);
    console.log('   到模型的最小距离:', minDistance.toFixed(2));
    console.log('   到模型的最大距离:', maxDistance.toFixed(2));
    console.log('   near:', camera.near.toFixed(2));
    console.log('   far:', camera.far.toFixed(2));

    if (minDistance < camera.near) {
        console.log('   ⚠️  有些模型在 near 平面后面！');
    }
    if (maxDistance > camera.far) {
        console.log('   ⚠️  有些模型在 far 平面外面！');
    }

    // 重新渲染
    if (window.rendererManager) {
        const renderer = window.rendererManager.getRenderer();
        const canvas = document.getElementById('rendererManager-canvas');

        if (renderer && canvas) {
            renderer.setScissorTest(false);
            renderer.setViewport(0, 0, canvas.width, canvas.height);
            renderer.setClearColor(0x000000, 1);
            renderer.clear();
            renderer.render(scene, camera);
            console.log('\n✅ 已重新渲染场景');
            console.log('   检查屏幕: 应该能看到模型了（从上方俯视）');
        }
    }

    // 更新 syncManager
    if (window.__syncManager__) {
        const state = window.__syncManager__.state || window.__syncManager__.unifiedCameraState;
        if (state && state.position) {
            console.log('\n🔄 更新 syncManager...');
            state.position.x = camera.position.x;
            state.position.y = camera.position.y;
            state.position.z = camera.position.z;
            state.height = height;
        }
    }

    console.log('\n================================================================================');
    console.log('✅ 相机已重置');
    console.log('================================================================================');
    console.log('\n💡 相机现在在 (0, ' + height + ', 0)，从上方垂直向下看');
    console.log('   如果仍然看不到模型，可能问题是:');
    console.log('   1. 材质问题（模型透明）');
    console.log('   2. near/far 值问题');
    console.log('   3. 渲染器问题');
    console.log('================================================================================\n');

})();
