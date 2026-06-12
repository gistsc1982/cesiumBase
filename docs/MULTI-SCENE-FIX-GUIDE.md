// ═══════════════════════════════════════════════════════════════════
// 完整的多场景修复流程
// ═══════════════════════════════════════════════════════════════════
// 说明：
//   如果之前执行过其他修复脚本（如 V5），多场景架构可能被破坏
//   需要按顺序重新初始化整个多场景架构
// ═══════════════════════════════════════════════════════════════════

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  📋 多场景修复完整流程                                    ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

console.log('📌 请按以下顺序执行（复制粘贴到控制台）：\n');

console.log('═══════════════════════════════════════════════════════════');
console.log('步骤 1: 加载多场景管理器');
console.log('═══════════════════════════════════════════════════════════');
console.log("fetch('/multi-scene-manager.js').then(r=>r.text()).then(eval);");

console.log('\n═══════════════════════════════════════════════════════════');
console.log('步骤 2: 初始化多场景架构');
console.log('═══════════════════════════════════════════════════════════');
console.log("fetch('/init-multi-scene.js').then(r=>r.text()).then(eval);");

console.log('\n═══════════════════════════════════════════════════════════');
console.log('步骤 3: 修复透视反转问题');
console.log('═══════════════════════════════════════════════════════════');
console.log("fetch('/fix-perspective-inversion.js').then(r=>r.text()).then(eval);");

console.log('\n═══════════════════════════════════════════════════════════');
console.log('步骤 4: 为原始层启用对数深度（可选，如果需要）');
console.log('═══════════════════════════════════════════════════════════');
console.log("fetch('/fix-layer1-logdepth.js').then(r=>r.text()).then(eval);");

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  💡 快捷命令（一键执行所有步骤）                          ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

console.log('复制以下命令到控制台，一键执行所有步骤：\n');

console.log(`
(async function() {
  console.log('\\n🚀 开始完整的多场景修复流程...\\n');

  const steps = [
    { name: '加载多场景管理器', url: '/multi-scene-manager.js' },
    { name: '初始化多场景架构', url: '/init-multi-scene.js' },
    { name: '修复透视反转问题', url: '/fix-perspective-inversion.js' },
    { name: '启用原始层对数深度', url: '/fix-layer1-logdepth.js' }
  ];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(\`[步骤 \${i + 1}/\${steps.length}] \${step.name}...\`);

    try {
      const response = await fetch(step.url);
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      const code = await response.text();
      eval(code);
      console.log(\`  ✅ \${step.name} 完成\`);
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(\`  ❌ \${step.name} 失败:\`, error);
    }
  }

  console.log('\\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  ✅ 所有步骤已完成！                                      ║');
  console.log('╚══════════════════════════════════════════════════════════╝\\n');

  // 显示最终状态
  if (window.__dualCanvasViewer?.multiSceneManager) {
    const info = window.__dualCanvasViewer.multiSceneManager.getDebugInfo();
    console.log('📊 最终状态:');
    console.log(\`  原始层大坐标: \${info.scenes.layer1Large} 个模型\`);
    console.log(\`  原始层小坐标: \${info.scenes.layer1Small} 个模型\`);
    console.log(\`  BIM层大坐标: \${info.scenes.layer2Large} 个模型\`);
    console.log(\`  BIM层小坐标: \${info.scenes.layer2Small} 个模型\`);
  }
})();
`);
