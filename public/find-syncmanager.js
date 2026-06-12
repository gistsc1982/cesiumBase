/**
 * 🔍 查找 SyncManager 的实际位置
 */

(function() {
    console.log('================================================================================================================================================');
    console.log('[查找 SyncManager] 定位缩放管理器');
    console.log('================================================================================================================================================');

    // 方法1: 检查 window 对象上的所有属性
    console.log('\n📊 window 对象属性（包含 sync/zoom/manager 关键词）:');

    const syncManagerKeys = [];
    for (let key in window) {
        if (key.toLowerCase().includes('sync') ||
            key.toLowerCase().includes('zoom') ||
            key.toLowerCase().includes('manager')) {
            syncManagerKeys.push(key);
        }
    }

    syncManagerKeys.forEach(key => {
        const obj = window[key];
        const type = typeof obj;
        const isFunc = type === 'function';
        const hasHandleZoomIn = obj && obj.handleZoomInUnified;
        const hasHandleZoomOut = obj && obj.handleZoomOutUnified;

        console.log(`   ${key}: type=${type}${isFunc ? ' (function)' : ''}${hasHandleZoomIn ? ' ✅ handleZoomInUnified' : ''}${hasHandleZoomOut ? ' ✅ handleZoomOutUnified' : ''}`);
    });

    // 方法2: 检查 dual-canvas-viewer-plugin
    console.log('\n📊 dual-canvas-viewer-plugin 相关:');

    if (window.DualCanvasViewerPlugin) {
        console.log('   window.DualCanvasViewerPlugin: ✅ 存在');
    }

    // 方法3: 检查所有可能的容器
    const containers = [
        'bimContainer',
        'cesiumContainer',
        'layer-container'
    ];

    containers.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            console.log(`\n📊 ${id}:`);
            // 检查 Vue 实例
            if (el.__vue__) {
                console.log('   __vue__: ✅ 存在');
                const vm = el.__vue__;

                // 检查是否有 syncManager
                if (vm.$syncManager) {
                    console.log('   $syncManager: ✅ 存在');
                    console.log('   类型:', typeof vm.$syncManager);
                }

                // 检查是否有其他相关属性
                for (let key in vm) {
                    if (key.includes('sync') || key.includes('zoom')) {
                        console.log(`   $${key}:`, typeof vm[key]);
                    }
                }
            }
        }
    });

    // 方法4: 从日志中查找
    console.log('\n📊 从日志分析：');
    console.log('   日志显示: [SyncManager.handleZoomInUnified]');
    console.log('   这说明 SyncManager 是某个对象的属性');

    // 尝试从 dual-canvas-viewer-plugin.iife.js 获取
    console.log('\n📊 检查插件脚本...');

    // 查找所有脚本
    const scripts = document.querySelectorAll('script');
    let foundDualCanvas = false;

    scripts.forEach(script => {
        if (script.src.includes('dual-canvas-viewer-plugin')) {
            foundDualCanvas = true;
            console.log('   ✅ 找到 dual-canvas-viewer-plugin.iife.js');
        }
    });

    if (!foundDualCanvas) {
        console.log('   ℹ️ 可能通过其他方式加载');
    }

    console.log('\n================================================================================================================================================');
    console.log('[总结] 请检查上面的输出，找到 SyncManager 的实际位置');
    console.log('================================================================================================================================================');
})();
