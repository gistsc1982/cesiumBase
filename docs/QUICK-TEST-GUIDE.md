# 🚀 多场景管理器 - 快速测试指南

## 📋 前提条件

1. ✅ 确保你的 Vue 开发服务器正在运行
2. ✅ 页面已加载 DualCanvasViewer 实例
3. ✅ 浏览器控制台已打开

## 🔧 测试步骤

### 步骤1：启动开发服务器（如果未启动）

```bash
npm run serve
```

### 步骤2：打开浏览器并加载页面

在浏览器中打开你的应用页面（通常是 `http://localhost:8080` 或类似地址）

### 步骤3：打开浏览器控制台

按 `F12` 或右键点击页面选择"检查" → "Console"

### 步骤4：执行测试脚本

在控制台中复制粘贴以下代码并按回车：

```javascript
// ═══════════════════════════════════════════════════════════════════
// 多场景管理器 - 快速测试（内联版本）
// ═══════════════════════════════════════════════════════════════════

(async function() {
  'use strict';

  console.log('\n🚀 开始测试多场景管理器...\n');

  // 检查 DualCanvasViewer
  const dualViewer = window.__dualCanvasViewer;
  if (!dualViewer) {
    console.error('❌ DualCanvasViewer 未找到');
    console.error('   请确保页面已正确加载 DualCanvasViewer');
    return;
  }
  console.log('✅ DualCanvasViewer 已找到');

  // 显示当前状态
  const models1 = dualViewer.modelGroup1?.children.filter(m => !m.userData.isBox3Helper) || [];
  const models2 = dualViewer.modelGroup2?.children.filter(m => !m.userData.isBox3Helper) || [];

  console.log(`\n📊 当前场景:`);
  console.log(`  原始层模型: ${models1.length} 个`);
  console.log(`  BIM层模型: ${models2.length} 个`);

  // 显示前3个模型的坐标
  if (models1.length > 0) {
    console.log(`\n  原始层模型坐标:`);
    models1.slice(0, 3).forEach((model, i) => {
      const pos = model.position;
      const type = Math.abs(pos.x) > 10000 || Math.abs(pos.z) > 10000 ? '🔴 大坐标' : '🟢 小坐标';
      console.log(`    模型 ${i + 1}: ${type} (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
    });
  }

  // 配置参数
  const CONFIG = {
    LARGE_COORD_THRESHOLD: 10000,
    LARGE_SCENE_NEAR: 0.1,
    LARGE_SCENE_FAR: 15000000,
    SMALL_SCENE_NEAR: 36,
    SMALL_SCENE_FAR: 1802
  };

  console.log(`\n⚙️  配置参数:`);
  console.log(`  大坐标阈值: ${CONFIG.LARGE_COORD_THRESHOLD}`);
  console.log(`  大场景 near/far: ${CONFIG.LARGE_SCENE_NEAR} ~ ${CONFIG.LARGE_SCENE_FAR.toLocaleString()}`);
  console.log(`  小场景 near/far: ${CONFIG.SMALL_SCENE_NEAR} ~ ${CONFIG.SMALL_SCENE_FAR}`);

  console.log(`\n✅ 测试完成！`);
  console.log(`\n💡 提示: 如果看到此消息，说明 DualCanvasViewer 运行正常`);
  console.log(`   下一步: 加载完整的多场景管理器进行测试`);

})();
```

### 步骤5：加载完整的多场景管理器

如果上述测试成功，继续执行以下代码加载完整的多场景管理器：

```javascript
// ═══════════════════════════════════════════════════════════════════
// 加载多场景管理器（从文件）
// ═══════════════════════════════════════════════════════════════════

(async function() {
  'use strict';

  console.log('\n🚀 加载多场景管理器...\n');

  // 加载核心管理器
  const script1 = document.createElement('script');
  script1.src = '/multi-scene-manager.js';
  document.head.appendChild(script1);

  // 等待加载
  await new Promise(resolve => {
    script1.onload = resolve;
    setTimeout(resolve, 2000); // 最多等待2秒
  });

  // 检查是否加载成功
  if (typeof window.MultiSceneManager === 'undefined') {
    console.error('❌ 多场景管理器加载失败');
    console.error('   请确保 multi-scene-manager.js 在 public 目录下');
    console.error('   或者直接复制代码到控制台执行');
    return;
  }

  console.log('✅ 多场景管理器已加载');

  // 初始化
  console.log('\n🏗️  初始化多场景架构...\n');
  const manager = new window.MultiSceneManager(window.__dualCanvasViewer);
  manager.initialize();

  // 保存到全局
  window.__multiSceneManager = manager;

  // 显示结果
  const info = manager.getDebugInfo();
  console.log('\n📊 初始化结果:');
  console.log('  场景分布:', info.scenes);
  console.log('  相机配置:', info.cameras);
  console.log('  参考点:', info.referencePoints);

  console.log('\n✅ 多场景架构部署完成！');
  console.log('\n💡 可用命令:');
  console.log('   window.__multiSceneManager.getDebugInfo()');
  console.log('   window.__multiSceneManager.syncCameras()');

})();
```

## 🎯 预期结果

成功执行后，你应该看到：

### 1. 控制台输出
```
✅ DualCanvasViewer 已找到

📊 当前场景:
  原始层模型: X 个
  BIM层模型: Y 个

  原始层模型坐标:
    模型 1: 🔴 大坐标 (12793352.71, 70.36, 3134460.35)
    模型 2: 🔴 大坐标 (12793352.71, 0.21, 3134510.35)
    ...
```

### 2. 多场景架构初始化成功
```
🏗️  初始化多场景架构...
  ✅ 多场景架构初始化成功

📊 初始化结果:
  场景分布: {
    layer1Large: X,
    layer1Small: Y,
    layer2Large: Z,
    layer2Small: W
  }
  ...
```

## 🐛 故障排查

### 问题1: DualCanvasViewer 未找到

**原因**: 页面尚未完全加载

**解决**:
- 等待页面完全加载后再执行
- 检查页面是否有 `window.__dualCanvasViewer` 对象

### 问题2: 脚本加载失败

**原因**: 文件路径不正确

**解决**:
- 确保 `multi-scene-manager.js` 在 `public` 目录下
- 或者直接复制文件内容到控制台执行

### 问题3: 模型显示异常

**原因**: 参考点或 near/far 设置不当

**解决**:
```javascript
// 查看调试信息
const info = window.__multiSceneManager.getDebugInfo();
console.log(info);

// 重新分类模型
window.__multiSceneManager.classifyAndMoveModels();

// 手动同步相机
window.__multiSceneManager.syncCameras();
```

## 📞 获取帮助

如果遇到问题：
1. 查看浏览器控制台的错误信息
2. 检查 `MULTI-SCENE-GUIDE.md` 文档
3. 使用调试工具查看实时状态

## 🎉 成功标志

当你看到以下情况时，说明多场景管理器已成功部署：

1. ✅ 控制台显示"多场景架构部署完成"
2. ✅ 模型正常显示，没有深度排序问题
3. ✅ 可以使用 `window.__multiSceneManager.getDebugInfo()` 查看状态
4. ✅ 相机移动时，所有场景保持同步

祝你测试顺利！🚀
