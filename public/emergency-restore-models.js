/**
 * 紧急恢复脚本 - 恢复模型可见性
 * 当所有模型都不可见时运行此脚本
 */

console.log('🚨 紧急恢复模式 - 尝试恢复模型可见性\n');

// 1. 停止所有可能正在运行的监控和修复
if (window.fixWebGLDepth && window.fixWebGLDepth.stopMonitoring) {
    console.log('⏹️ 停止深度监控...');
    window.fixWebGLDepth.stopMonitoring();
}

// 2. 检查所有 canvas 的状态
console.log('\n📊 检查所有 canvas 状态:');
const canvases = document.querySelectorAll('canvas');
canvases.forEach((canvas, index) => {
    try {
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (gl) {
            console.log(`\nCanvas #${index + 1}:`);

            // 获取当前状态
            const depthFunc = gl.getParameter(gl.DEPTH_FUNC);
            const depthTest = gl.getParameter(gl.DEPTH_TEST);
            const depthMask = gl.getParameter(gl.DEPTH_WRITEMASK);
            const clearColor = gl.getParameter(gl.COLOR_CLEAR_VALUE);

            console.log(`  当前状态:`);
            console.log(`    depthFunc: ${depthFunc}`);
            console.log(`    depthTest: ${depthTest}`);
            console.log(`    depthMask: ${depthMask}`);
            console.log(`    clearColor: [${clearColor.map(v => v.toFixed(2)).join(', ')}]`);

            // 尝试不同的深度函数
            console.log(`  尝试不同的深度函数...`);

            // 方案1: 使用 LESS (513) 而不是 LEQUAL
            console.log(`  方案1: 尝试 LESS (513)`);
            gl.enable(gl.DEPTH_TEST);
            gl.depthMask(true);
            gl.depthFunc(513); // LESS

            // 方案2: 清除所有缓冲区
            console.log(`  清除所有缓冲区...`);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        }
    } catch (error) {
        console.error(`Canvas #${index + 1} 错误:`, error.message);
    }
});

// 3. 检查 rendererManager
console.log('\n🔧 检查 rendererManager:');
if (window.rendererManager) {
    console.log('✅ 找到 rendererManager');

    const scenes = window.rendererManager.getScenes();
    console.log(`场景数量: ${scenes.length}`);

    scenes.forEach((sceneInfo, index) => {
        console.log(`\n场景 #${index + 1}:`);
        console.log(`  场景对象: ${sceneInfo.scene ? '✅' : '❌'}`);
        console.log(`  相机: ${sceneInfo.camera ? '✅' : '❌'}`);
        console.log(`  不透明度: ${sceneInfo.opacity ?? 1.0}`);

        if (sceneInfo.scene) {
            // 检查场景中的对象
            let objectCount = 0;
            let visibleCount = 0;

            sceneInfo.scene.traverse((object) => {
                if (object.isMesh) {
                    objectCount++;
                    if (object.visible) visibleCount++;

                    // 确保材质可见
                    if (object.material) {
                        const materials = Array.isArray(object.material) ? object.material : [object.material];
                        materials.forEach((material) => {
                            // 确保材质不是完全透明的
                            if (material.opacity === 0) {
                                material.opacity = 1;
                                console.warn(`  修复: ${object.name || 'unnamed'} 的材质 opacity 从 0 改为 1`);
                            }
                            material.transparent = material.opacity < 1;
                            material.depthTest = true;
                            material.depthWrite = material.opacity >= 1;
                            material.needsUpdate = true;
                        });
                    }
                }
            });

            console.log(`  对象统计: ${visibleCount}/${objectCount} 可见`);
        }
    });

    // 4. 强制重新渲染
    console.log('\n🔄 强制重新渲染...');
    const renderer = window.rendererManager.getRenderer();
    if (renderer) {
        const gl = renderer.getContext();

        // 尝试多种深度函数
        const depthFuncs = [
            { value: 513, name: 'LESS' },
            { value: 514, name: 'LEQUAL' },
            { value: 515, name: 'GREATER' }
        ];

        console.log('尝试不同的深度函数:');

        depthFuncs.forEach(({ value, name }) => {
            console.log(`  尝试 ${name} (${value})...`);

            gl.enable(gl.DEPTH_TEST);
            gl.depthMask(true);
            gl.depthFunc(value);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

            // 渲染所有场景
            scenes.forEach((sceneInfo) => {
                if (sceneInfo.scene && sceneInfo.camera) {
                    renderer.render(sceneInfo.scene, sceneInfo.camera);
                }
            });

            console.log(`    ${name} 已尝试`);
        });
    }
} else {
    console.log('❌ 未找到 rendererManager');
}

// 5. 检查 Cesium
console.log('\n🌍 检查 Cesium:');
if (window.viewer) {
    console.log('✅ 找到 Cesium Viewer');
    console.log('尝试刷新 Cesium...');
    window.viewer.scene.requestRender();
} else {
    console.log('❌ 未找到 Cesium Viewer');
}

// 6. 提供 API 供手动尝试不同的设置
window.emergencyRestore = {
    tryDepthFunc: (func) => {
        console.log(`尝试 depthFunc: ${func}`);
        canvases.forEach((canvas, index) => {
            try {
                const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
                if (gl) {
                    gl.enable(gl.DEPTH_TEST);
                    gl.depthMask(true);
                    gl.depthFunc(func);
                    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                    console.log(`  Canvas #${index + 1}: 已设置`);
                }
            } catch (error) {
                console.error(`  Canvas #${index + 1}: 错误`, error);
            }
        });

        if (window.rendererManager) {
            const renderer = window.rendererManager.getRenderer();
            const scenes = window.rendererManager.getScenes();
            scenes.forEach((sceneInfo) => {
                if (sceneInfo.scene && sceneInfo.camera) {
                    renderer.render(sceneInfo.scene, sceneInfo.camera);
                }
            });
        }
    },

    // 重置为安全设置
    resetToSafe: () => {
        console.log('重置为安全设置...');
        canvases.forEach((canvas) => {
            try {
                const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
                if (gl) {
                    gl.enable(gl.DEPTH_TEST);
                    gl.depthMask(true);
                    gl.depthFunc(514); // LEQUAL
                    gl.clearColor(0, 0, 0, 0);
                    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                }
            } catch (error) {
                // 忽略
            }
        });
    }
};

console.log('\n💡 可用的紧急恢复命令:');
console.log('  emergencyRestore.tryDepthFunc(513)  // 尝试 LESS');
console.log('  emergencyRestore.tryDepthFunc(514)  // 尝试 LEQUAL');
console.log('  emergencyRestore.tryDepthFunc(515)  // 尝试 GREATER');
console.log('  emergencyRestore.resetToSafe()      // 重置为安全设置');

console.log('\n═══════════════════════════════════════════════════════════════\n');
