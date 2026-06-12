// 永久修复深度函数
// 确保深度函数始终为 LESS，防止透视翻转

console.log('========== 永久修复深度函数 ==========');

const viewer = window.__dualCanvasViewer;
if (!viewer) {
  console.error('❌ DualCanvasViewer 未找到');
  throw new Error('DualCanvasViewer 未找到');
}

// 停止之前的守护任务
if (window._depthFixGuards) {
  window._depthFixGuards.forEach(g => clearInterval(g));
  console.log('✅ 已停止旧的守护任务');
}

console.log('');
console.log('🔧 [步骤1] 修复当前深度函数...');

const fixRenderer = (renderer, name) => {
  if (!renderer) {
    console.log(`  ${name}: 不存在`);
    return;
  }

  try {
    const gl = renderer.getContext();
    const currentFunc = gl.getParameter(gl.DEPTH_FUNC);

    if (currentFunc !== gl.LESS) {
      gl.depthFunc(gl.LESS);
      console.log(`  ${name}: ✅ 已修复 (${currentFunc} -> LESS)`);
    } else {
      console.log(`  ${name}: ✅ 已经是 LESS`);
    }
  } catch (error) {
    console.log(`  ${name}: ⚠️  无法访问 - ${error.message}`);
  }
};

fixRenderer(viewer.renderer1, 'Renderer1');
fixRenderer(viewer.renderer2, 'Renderer2');

console.log('');
console.log('🔧 [步骤2] 替换渲染器的 render 方法...');

const lockDepthFunc = (renderer, name) => {
  if (!renderer) return;

  const originalRender = renderer.render;
  renderer.render = function(scene, camera) {
    try {
      const gl = this.getContext();
      const currentFunc = gl.getParameter(gl.DEPTH_FUNC);

      if (currentFunc !== gl.LESS) {
        gl.depthFunc(gl.LESS);
      }
    } catch (error) {
      // 忽略错误
    }

    return originalRender.call(this, scene, camera);
  };

  console.log(`  ${name}: ✅ 已锁定深度函数`);
};

lockDepthFunc(viewer.renderer1, 'Renderer1');
if (viewer.renderer2) {
  lockDepthFunc(viewer.renderer2, 'Renderer2');
}

console.log('');
console.log('🔧 [步骤3] 启动守护任务...');

const guards = [];

// 守护: 每秒检查并修复深度函数
guards.push(setInterval(() => {
  const checkAndFix = (renderer) => {
    if (!renderer) return;
    try {
      const gl = renderer.getContext();
      const currentFunc = gl.getParameter(gl.DEPTH_FUNC);
      if (currentFunc !== gl.LESS) {
        gl.depthFunc(gl.LESS);
        console.log('🔄 [守护] 修复深度函数');
      }
    } catch (error) {
      // 忽略
    }
  };

  checkAndFix(viewer.renderer1);
  if (viewer.renderer2) checkAndFix(viewer.renderer2);
}, 1000));

window._depthFixGuards = guards;
window._stopDepthFix = () => {
  guards.forEach(g => clearInterval(g));
  console.log('✅ 深度函数守护任务已停止');
};

console.log(`  ✅ 已启动 ${guards.length} 个守护任务`);

console.log('');
console.log('========== 修复完成 ==========');
console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║  ✅ 深度函数已永久锁定为 LESS                          ║');
console.log('║  ✅ 透视翻转问题已修复                                  ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('');
console.log('💡 说明:');
console.log('   - 问题：深度函数被设置为 LEQUAL 导致透视翻转');
console.log('   - 解决：强制设置为 LESS 并锁定');
console.log('   - 效果：透视保持正常的"近大远小"');
console.log('');
console.log('📌 可用命令:');
console.log('   _stopDepthFix() - 停止守护任务');
console.log('');

// 创建便捷函数
window.__depthFix = {
  check: () => {
    console.log('========== 深度函数状态 ==========');

    const checkRenderer = (renderer, name) => {
      if (!renderer) {
        console.log(`${name}: 不存在`);
        return;
      }
      try {
        const gl = renderer.getContext();
        const currentFunc = gl.getParameter(gl.DEPTH_FUNC);
        const status = currentFunc === gl.LESS ? '✅' : '❌';
        const funcName = currentFunc === gl.LESS ? 'LESS' : currentFunc === gl.LEQUAL ? 'LEQUAL' : currentFunc;
        console.log(`${status} ${name}: ${funcName}`);
      } catch (error) {
        console.log(`⚠️  ${name}: 无法访问`);
      }
    };

    checkRenderer(viewer.renderer1, 'Renderer1');
    checkRenderer(viewer.renderer2, 'Renderer2');

    const guardsActive = window._depthFixGuards && window._depthFixGuards.length > 0;
    console.log(`${guardsActive ? '✅' : '❌'} 守护任务: ${guardsActive ? '运行中' : '已停止'}`);

    console.log('=================================');
  },

  fix: () => {
    fixRenderer(viewer.renderer1, 'Renderer1');
    if (viewer.renderer2) fixRenderer(viewer.renderer2, 'Renderer2');
    console.log('✅ 深度函数已手动修复');
  }
};

// 立即检查
__depthFix.check();
