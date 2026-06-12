/**
 * 恢复 Canvas #1 的深度函数为 LESS (513)
 * 层1可能需要 LESS 而不是 LEQUAL
 */
(function() {
    console.log('='.repeat(80));
    console.log('[恢复] Canvas #1 深度函数恢复为 LESS...');
    console.log('='.repeat(80));

    const canvas = document.querySelectorAll('canvas')[1];
    if (!canvas) {
        console.error('❌ Canvas #1 不存在');
        return;
    }

    let gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
        console.error('❌ 无法获取 WebGL 上下文');
        return;
    }

    const current = gl.getParameter(gl.DEPTH_FUNC);
    console.log(`Canvas #1 当前深度函数: ${current}`);

    // 恢复为 LESS (513)
    gl.depthFunc(513);
    gl.enable(gl.DEPTH_TEST);

    const updated = gl.getParameter(gl.DEPTH_FUNC);
    console.log(`Canvas #1 恢复后深度函数: ${updated} ${updated === 513 ? '✅' : '❌'}`);

    console.log(`\n💡 检查层1模型是否可见了`);
})();
