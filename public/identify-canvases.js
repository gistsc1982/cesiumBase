/**
 * 🔍 识别每个 Canvas 的渲染管线
 */

(function() {
    'use strict';

    console.log('================================================================================================================================================');
    console.log('[Canvas 识别] 确定每个 Canvas 的渲染管线');
    console.log('================================================================================================================================================');

    const canvases = document.querySelectorAll('canvas');
    canvases.forEach((canvas, index) => {
        console.log('\n📋 Canvas #' + index + ':');
        console.log('   ID: ' + canvas.id);
        console.log('   Class: ' + canvas.className);
        console.log('   Width: ' + canvas.width + ' x ' + canvas.height);
        console.log('   Position: (' + canvas.style.left + ', ' + canvas.style.top + ')');
        console.log('   z-Index: ' + canvas.style.zIndex);
        console.log('   Pointer Events: ' + canvas.style.pointerEvents);

        // 检查父元素
        const parentId = canvas.parentElement ? canvas.parentElement.id : '';
        const parentClassName = canvas.parentElement ? canvas.parentElement.className : '';
        console.log('   Parent: ' + (parentId || parentClassName));

        // 尝试获取 WebGL 上下文信息
        try {
            const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
            if (gl) {
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    console.log('   Renderer: ' + gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
                }
            }
        } catch (e) {}
    });

    // 检查 viewer 对象
    console.log('\n📊 Viewer 对象:');
    console.log('   window.viewer: ' + !!window.viewer);
    console.log('   window.__viewer1__: ' + !!window.__viewer1__);
    console.log('   window.rendererManager: ' + !!window.rendererManager);

    // 检查 rendererManager
    if (window.rendererManager) {
        const debugInfo = window.rendererManager.getDebugInfo();
        console.log('\n📊 rendererManager 信息:');
        console.log('   sceneCount: ' + debugInfo.sceneCount);
        debugInfo.scenes.forEach((scene, idx) => {
            console.log('   场景 #' + idx + ':');
            console.log('     hasScene: ' + scene.hasScene);
            console.log('     hasCamera: ' + scene.hasCamera);
            console.log('     sceneChildren: ' + scene.sceneChildren);
            console.log('     visible: ' + scene.visible);
        });
    }

    console.log('\n================================================================================================================================================');
})();
