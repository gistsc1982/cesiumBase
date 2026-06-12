/**
 * 强制修复所有 WebGL 上下文的深度设置
 * 在浏览器控制台运行此脚本来立即修复深度测试问题
 */

console.log('🔧 开始强制修复 WebGL 深度设置...\n');

// 修复单个 WebGL 上下文
function fixWebGLContext(gl, contextName) {
    if (!gl) return false;

    console.log(`\n修复 ${contextName}:`);

    // 获取当前状态
    const currentDepthFunc = gl.getParameter(gl.DEPTH_FUNC);
    const currentDepthTest = gl.getParameter(gl.DEPTH_TEST);
    const currentDepthMask = gl.getParameter(gl.DEPTH_WRITEMASK);

    const depthFuncNames = {
        512: 'NEVER', 513: 'LESS', 514: 'LEQUAL',
        515: 'GREATER', 516: 'GEQUAL', 517: 'EQUAL',
        518: 'NOTEQUAL', 519: 'ALWAYS'
    };

    console.log(`  修复前: depthFunc=${currentDepthFunc} (${depthFuncNames[currentDepthFunc]}), depthTest=${currentDepthTest}, depthMask=${currentDepthMask}`);

    // 强制修复
    const LEQUAL = 514;
    const issuesFixed = [];

    if (!currentDepthTest) {
        gl.enable(gl.DEPTH_TEST);
        issuesFixed.push('depthTest 已启用');
    }

    if (currentDepthFunc !== LEQUAL) {
        gl.depthFunc(LEQUAL);
        issuesFixed.push(`depthFunc 已改为 ${LEQUAL} (LEQUAL)`);
    }

    if (!currentDepthMask) {
        gl.depthMask(true);
        issuesFixed.push('depthMask 已启用');
    }

    // 验证修复
    const newDepthFunc = gl.getParameter(gl.DEPTH_FUNC);
    const newDepthTest = gl.getParameter(gl.DEPTH_TEST);
    const newDepthMask = gl.getParameter(gl.DEPTH_WRITEMASK);

    console.log(`  修复后: depthFunc=${newDepthFunc} (${depthFuncNames[newDepthFunc]}), depthTest=${newDepthTest}, depthMask=${newDepthMask}`);

    if (newDepthFunc === LEQUAL && newDepthTest && newDepthMask) {
        console.log(`  ✅ ${contextName} 修复成功！ ${issuesFixed.join(', ')}`);
        return true;
    } else {
        console.log(`  ⚠️ ${contextName} 修复失败，设置被拒绝或立即被覆盖`);
        return false;
    }
}

// 1. 修复所有 canvas 的 WebGL 上下文
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('1️⃣ 修复所有 canvas 的 WebGL 上下文');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const canvases = document.querySelectorAll('canvas');
let fixedCount = 0;

canvases.forEach((canvas, index) => {
    try {
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (gl) {
            const contextName = `Canvas #${index + 1} (${canvas.className || canvas.id || 'unnamed'})`;
            if (fixWebGLContext(gl, contextName)) {
                fixedCount++;
            }
        }
    } catch (error) {
        console.error(`  ❌ Canvas #${index + 1} 修复失败:`, error.message);
    }
});

console.log(`\n✅ 成功修复 ${fixedCount}/${canvases.length} 个 canvas`);

// 2. 尝试通过 rendererManager 修复
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('2️⃣ 通过 rendererManager 修复');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (window.rendererManager) {
    console.log('✅ 找到全局 rendererManager');

    const renderer = window.rendererManager.getRenderer();
    if (renderer) {
        const gl = renderer.getContext();
        if (gl) {
            fixWebGLContext(gl, 'rendererManager 的 WebGL 上下文');

            // 强制清除深度缓冲区
            gl.clear(gl.DEPTH_BUFFER_BIT);
            console.log('  ✅ 深度缓冲区已清除');
        } else {
            console.log('  ⚠️ 无法获取 WebGL 上下文');
        }
    } else {
        console.log('  ⚠️ 无法获取 renderer');
    }
} else {
    console.log('  ⚠️ 未找到全局 rendererManager');
    console.log('  💡 尝试从 Vue 应用获取...');

    // 尝试从 Vue 应用获取
    const appElement = document.querySelector('#app');
    if (appElement && appElement.__vue_app__) {
        console.log('  ✅ 找到 Vue 应用');
        // 这里需要更深入的方式来获取 rendererManager
        // 通常它存储在组件实例中
    }
}

// 3. 持续监控和修复（每秒检查一次，持续30秒）
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('3️⃣ 启动持续监控和修复（30秒）');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const LEQUAL = 514;
let fixAttempts = 0;
let successfulFixes = 0;

const monitorInterval = setInterval(() => {
    fixAttempts++;
    let neededFix = false;

    canvases.forEach((canvas, index) => {
        try {
            const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
            if (gl) {
                const depthFunc = gl.getParameter(gl.DEPTH_FUNC);
                const depthTest = gl.getParameter(gl.DEPTH_TEST);
                const depthMask = gl.getParameter(gl.DEPTH_WRITEMASK);

                if (depthFunc !== LEQUAL || !depthTest || !depthMask) {
                    neededFix = true;
                    console.log(`⚠️ 检测到 Canvas #${index + 1} 设置异常，正在修复...`);
                    if (fixWebGLContext(gl, `Canvas #${index + 1}`)) {
                        successfulFixes++;
                    }
                }
            }
        } catch (error) {
            // 忽略错误
        }
    });

    if (!neededFix) {
        console.log(`✅ 第 ${fixAttempts} 次检查：所有设置正常`);
    }

    // 30秒后停止监控
    if (fixAttempts >= 30) {
        clearInterval(monitorInterval);
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 监控结束');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`总检查次数: ${fixAttempts}`);
        console.log(`成功修复次数: ${successfulFixes}`);

        if (successfulFixes > 0) {
            console.log('\n⚠️ 警告: WebGL 设置被反复覆盖，说明有其他代码在干扰深度设置');
            console.log('💡 建议:');
            console.log('  1. 检查 Cesium 的 WebGL 初始化代码');
            console.log('  2. 检查 Three.js 的 WebGLRenderer 配置');
            console.log('  3. 在渲染循环中持续监控和修复');
            console.log('  4. 使用 proxy 模式拦截 WebGL API 调用');
        } else if (fixAttempts === 30) {
            console.log('\n✅ 所有 WebGL 设置保持正常，没有检测到异常覆盖');
        }
    }
}, 1000);

// 4. 提供 API 供外部调用
window.fixWebGLDepth = {
    // 手动触发修复
    fixAll: () => {
        console.log('🔧 手动触发修复...');
        canvases.forEach((canvas, index) => {
            try {
                const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
                if (gl) {
                    fixWebGLContext(gl, `Canvas #${index + 1}`);
                }
            } catch (error) {
                console.error(`Canvas #${index + 1} 修复失败:`, error);
            }
        });
    },

    // 停止监控
    stopMonitoring: () => {
        clearInterval(monitorInterval);
        console.log('⏹️ 监控已停止');
    },

    // 检查状态
    checkStatus: () => {
        console.log('📊 当前 WebGL 状态:');
        canvases.forEach((canvas, index) => {
            try {
                const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
                if (gl) {
                    const depthFunc = gl.getParameter(gl.DEPTH_FUNC);
                    const depthTest = gl.getParameter(gl.DEPTH_TEST);
                    const depthMask = gl.getParameter(gl.DEPTH_WRITEMASK);
                    console.log(`Canvas #${index + 1}: depthFunc=${depthFunc}, depthTest=${depthTest}, depthMask=${depthMask}`);
                }
            } catch (error) {
                // 忽略
            }
        });
    }
};

console.log('\n✅ 修复脚本已加载！');
console.log('💡 可用命令:');
console.log('  - fixWebGLDepth.fixAll()     // 手动触发修复');
console.log('  - fixWebGLDepth.checkStatus() // 检查当前状态');
console.log('  - fixWebGLDepth.stopMonitoring() // 停止监控');

console.log('\n═══════════════════════════════════════════════════════════════\n');
