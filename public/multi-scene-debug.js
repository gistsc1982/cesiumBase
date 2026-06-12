// ═══════════════════════════════════════════════════════════════════
// 多场景调试工具
// ═══════════════════════════════════════════════════════════════════
// 功能：实时监控多场景渲染状态
// ═══════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  class MultiSceneDebugPanel {
    constructor(manager) {
      this.manager = manager;
      this.panel = null;
      this.updateInterval = null;
      this.isVisible = false;
    }

    // 创建调试面板
    create() {
      if (this.panel) {
        this.show();
        return;
      }

      const panel = document.createElement('div');
      panel.id = 'multi-scene-debug-panel';
      panel.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        width: 320px;
        background: rgba(0, 0, 0, 0.85);
        color: #0f0;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        padding: 15px;
        border-radius: 5px;
        z-index: 10000;
        box-shadow: 0 0 10px rgba(0, 255, 0, 0.3);
        display: none;
      `;

      panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <strong style="color: #0f0;">🎬 多场景调试面板</strong>
          <button id="close-debug-btn" style="background: #f00; color: #fff; border: none; padding: 2px 8px; cursor: pointer; border-radius: 3px;">✕</button>
        </div>
        <div id="debug-content">
          <div style="color: #ff0;">加载中...</div>
        </div>
      `;

      document.body.appendChild(panel);

      // 关闭按钮事件
      document.getElementById('close-debug-btn').addEventListener('click', () => {
        this.hide();
      });

      this.panel = panel;
    }

    // 显示面板
    show() {
      if (!this.panel) {
        this.create();
      }
      this.panel.style.display = 'block';
      this.isVisible = true;
      this.startUpdate();
    }

    // 隐藏面板
    hide() {
      if (this.panel) {
        this.panel.style.display = 'none';
      }
      this.isVisible = false;
      this.stopUpdate();
    }

    // 开始更新
    startUpdate() {
      this.update();
      this.updateInterval = setInterval(() => this.update(), 500);
    }

    // 停止更新
    stopUpdate() {
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }
    }

    // 更新调试信息
    update() {
      if (!this.isVisible || !this.panel) return;

      const debugInfo = this.manager.getDebugInfo();
      const dualViewer = this.manager.dualViewer;

      // 计算相机到模型的距离
      const camera1 = dualViewer.camera1;
      const distanceInfo = this.calculateDistances(camera1);

      const content = `
        <div style="border-bottom: 1px solid #0f0; padding-bottom: 8px; margin-bottom: 8px;">
          <strong style="color: #ff0;">📊 场景统计</strong><br>
          <span style="color: #0ff;">原始层大坐标:</span> ${debugInfo.scenes.layer1Large} 个模型<br>
          <span style="color: #0ff;">原始层小坐标:</span> ${debugInfo.scenes.layer1Small} 个模型<br>
          <span style="color: #0ff;">BIM层大坐标:</span> ${debugInfo.scenes.layer2Large} 个模型<br>
          <span style="color: #0ff;">BIM层小坐标:</span> ${debugInfo.scenes.layer2Small} 个模型
        </div>

        <div style="border-bottom: 1px solid #0f0; padding-bottom: 8px; margin-bottom: 8px;">
          <strong style="color: #ff0;">📷 相机 Near/Far</strong><br>
          <span style="color: #0ff;">原始层大:</span> ${debugInfo.cameras.layer1Large.near} ~ ${debugInfo.cameras.layer1Large.far}<br>
          <span style="color: #0ff;">原始层小:</span> ${debugInfo.cameras.layer1Small.near} ~ ${debugInfo.cameras.layer1Small.far}<br>
          <span style="color: #0ff;">BIM层大:</span> ${debugInfo.cameras.layer2Large.near} ~ ${debugInfo.cameras.layer2Large.far}<br>
          <span style="color: #0ff;">BIM层小:</span> ${debugInfo.cameras.layer2Small.near} ~ ${debugInfo.cameras.layer2Small.far}
        </div>

        <div style="border-bottom: 1px solid #0f0; padding-bottom: 8px; margin-bottom: 8px;">
          <strong style="color: #ff0;">📍 相机位置</strong><br>
          <span style="color: #0ff;">X:</span> ${camera1.position.x.toFixed(2)}<br>
          <span style="color: #0ff;">Y:</span> ${camera1.position.y.toFixed(2)}<br>
          <span style="color: #0ff;">Z:</span> ${camera1.position.z.toFixed(2)}<br>
          <span style="color: #0ff;">坐标类型:</span> ${Math.abs(camera1.position.x) > 10000 ? '🔴 大坐标' : '🟢 小坐标'}
        </div>

        <div>
          <strong style="color: #ff0;">📏 距离信息</strong><br>
          <span style="color: #0ff;">最近模型:</span> ${distanceInfo.min.toFixed(2)} 米<br>
          <span style="color: #0ff;">最远模型:</span> ${distanceInfo.max.toFixed(2)} 米<br>
          <span style="color: #0ff;">深度范围:</span> ${distanceInfo.max - distanceInfo.min > 1800 ? '⚠️ 超出小far范围' : '✅ 在小far范围内'}
        </div>
      `;

      document.getElementById('debug-content').innerHTML = content;
    }

    // 计算相机到模型的距离
    calculateDistances(camera) {
      const distances = [];

      // 遍历所有场景的模型
      ['layer1Large', 'layer1Small', 'layer2Large', 'layer2Small'].forEach(sceneKey => {
        const scene = this.manager.scenes[sceneKey];
        if (!scene) return;

        scene.traverse(obj => {
          if (obj.isMesh) {
            const distance = camera.position.distanceTo(obj.position);
            distances.push(distance);
          }
        });
      });

      if (distances.length === 0) {
        return { min: 0, max: 0 };
      }

      return {
        min: Math.min(...distances),
        max: Math.max(...distances)
      };
    }

    // 销毁面板
    destroy() {
      this.stopUpdate();
      if (this.panel) {
        this.panel.remove();
        this.panel = null;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 快捷命令函数
  // ═══════════════════════════════════════════════════════════════════
  function showDebugPanel() {
    const manager = window.__multiSceneManager;
    if (!manager) {
      console.error('❌ 多场景管理器未初始化');
      return;
    }

    if (!manager.debugPanel) {
      manager.debugPanel = new MultiSceneDebugPanel(manager);
    }

    manager.debugPanel.show();
  }

  function hideDebugPanel() {
    const manager = window.__multiSceneManager;
    if (!manager || !manager.debugPanel) return;

    manager.debugPanel.hide();
  }

  function printDebugInfo() {
    const manager = window.__multiSceneManager;
    if (!manager) {
      console.error('❌ 多场景管理器未初始化');
      return;
    }

    const debugInfo = manager.getDebugInfo();

    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║  🎬 多场景调试信息                                        ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    console.log('📊 场景统计:');
    console.log(`  原始层大坐标场景: ${debugInfo.scenes.layer1Large} 个模型`);
    console.log(`  原始层小坐标场景: ${debugInfo.scenes.layer1Small} 个模型`);
    console.log(`  BIM层大坐标场景: ${debugInfo.scenes.layer2Large} 个模型`);
    console.log(`  BIM层小坐标场景: ${debugInfo.scenes.layer2Small} 个模型`);

    console.log('\n📷 相机 Near/Far 配置:');
    console.log(`  原始层大坐标: near=${debugInfo.cameras.layer1Large.near}, far=${debugInfo.cameras.layer1Large.far}`);
    console.log(`  原始层小坐标: near=${debugInfo.cameras.layer1Small.near}, far=${debugInfo.cameras.layer1Small.far}`);
    console.log(`  BIM层大坐标: near=${debugInfo.cameras.layer2Large.near}, far=${debugInfo.cameras.layer2Large.far}`);
    console.log(`  BIM层小坐标: near=${debugInfo.cameras.layer2Small.near}, far=${debugInfo.cameras.layer2Small.far}`);

    if (debugInfo.referencePoints.layer1) {
      console.log('\n📍 参考点:');
      console.log(`  原始层: (${debugInfo.referencePoints.layer1.x.toFixed(2)}, ${debugInfo.referencePoints.layer1.y.toFixed(2)}, ${debugInfo.referencePoints.layer1.z.toFixed(2)})`);
    }
    if (debugInfo.referencePoints.layer2) {
      console.log(`  BIM层: (${debugInfo.referencePoints.layer2.x.toFixed(2)}, ${debugInfo.referencePoints.layer2.y.toFixed(2)}, ${debugInfo.referencePoints.layer2.z.toFixed(2)})`);
    }

    console.log('');
  }

  // ═══════════════════════════════════════════════════════════════════
  // 暴露到全局
  // ═══════════════════════════════════════════════════════════════════
  window.showMultiSceneDebug = showDebugPanel;
  window.hideMultiSceneDebug = hideDebugPanel;
  window.printMultiSceneDebug = printDebugInfo;
  window.MultiSceneDebugPanel = MultiSceneDebugPanel;

  console.log('\n✅ 多场景调试工具已加载');
  console.log('📌 可用命令:');
  console.log('   showMultiSceneDebug()     - 显示调试面板');
  console.log('   hideMultiSceneDebug()     - 隐藏调试面板');
  console.log('   printMultiSceneDebug()    - 打印调试信息到控制台');

})();
