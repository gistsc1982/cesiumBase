/**
 * 查找所有 canvas 和 WebGL 上下文
 */
(function() {
    console.log('='.repeat(80));
    console.log('[诊断] 查找所有 canvas 和 WebGL 上下文...');
    console.log('='.repeat(80));

    // 查找所有 canvas 元素
    const canvases = document.querySelectorAll('canvas');
    console.log(`\n📊 找到 ${canvases.length} 个 canvas 元素:`);

    canvases.forEach((canvas, index) => {
        console.log(`\nCanvas #${index}:`);
        console.log(`  id: ${canvas.id || '(无)'}`);
        console.log(`  class: ${canvas.className || '(无)'}`);
        console.log(`  width: ${canvas.width}, height: ${canvas.height}`);
        console.log(`  clientWidth: ${canvas.clientWidth}, clientHeight: ${canvas.clientHeight}`);
        console.log(`  父元素: ${canvas.parentElement?.className || canvas.parentElement?.id || '(未知)'}`);

        // 尝试获取 WebGL 上下文
        let gl = null;
        let contextType = '';

        try {
            gl = canvas.getContext('webgl2');
            if (gl) {
                contextType = 'webgl2';
            }
        } catch (e) {}

        if (!gl) {
            try {
                gl = canvas.getContext('webgl');
                if (gl) {
                    contextType = 'webgl';
                }
            } catch (e) {}
        }

        if (gl) {
            const depthFunc = gl.getParameter(gl.DEPTH_FUNC);
            const depthFuncNames = {
                512: 'NEVER', 513: 'LESS', 514: 'LEQUAL',
                515: 'GREATER', 516: 'GEQUAL', 517: 'EQUAL',
                518: 'NOTEQUAL', 519: 'ALWAYS'
            };

            console.log(`  上下文类型: ${contextType}`);
            console.log(`  当前 depthFunc: ${depthFunc} (${depthFuncNames[depthFunc]})`);

            // 尝试修复
            console.log(`  尝试修复...`);
            gl.depthFunc(gl.LEQUAL);
            const after = gl.getParameter(gl.DEPTH_FUNC);
            console.log(`  修复后 depthFunc: ${after} (${depthFuncNames[after]})`);

            if (after === 514) {
                console.log(`  ✅ 修复成功！`);
            } else {
                console.log(`  ❌ 修复失败`);
            }
        } else {
            console.log(`  ❌ 无法获取 WebGL 上下文`);
        }
    });

    // 查找 rendererManager 中的所有 renderer
    console.log(`\n📊 检查 rendererManager...`);
    if (window.rendererManager) {
        const renderer = window.rendererManager.getRenderer();
        if (renderer) {
            console.log(`  找到 renderer: ${renderer.type || '未知类型'}`);
            console.log(`  domElement:`);
            console.log(`    id: ${renderer.domElement?.id || '(无)'}`);
            console.log(`    class: ${renderer.domElement?.className || '(无)'}`);

            // 检查是否有其他 renderer 属性
            for (let key in renderer) {
                if (key.includes('renderer') || key.includes('Renderer')) {
                    console.log(`  ${key}: ${typeof renderer[key]}`);
                }
            }
        }

        // 检查是否有多个 renderer
        const scenes = window.rendererManager.getScenes();
        if (scenes && scenes.length > 0) {
            console.log(`  找到 ${scenes.length} 个场景`);
        }
    }

    // 尝试从 window 对象中找 renderer
    console.log(`\n📊 检查 window 对象中的 renderer...`);
    for (let key in window) {
        if (key.toLowerCase().includes('renderer') && typeof window[key] === 'object') {
            console.log(`  ${key}: ${window[key]?.type || typeof window[key]}`);
        }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('[诊断完成]');
    console.log('='.repeat(80));
})();
