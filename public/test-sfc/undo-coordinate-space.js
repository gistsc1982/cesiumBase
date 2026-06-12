/**
 * 撤销坐标空间统一 - 恢复模型到原始位置
 */

(function() {
    console.log('🔄 撤销坐标空间统一...');

    const viewer = window.__dualCanvasViewerInstances?.[0];
    if (!viewer) {
        console.error('未找到 DualCanvasViewer');
        return;
    }

    let restoredCount = 0;

    function restoreModels(group, layerName) {
        if (!group || group.children.length === 0) return;

        group.children.forEach((model, idx) => {
            if (model.userData && model.userData.originalPositions && model.userData.originalPositions.length > 0) {
                // 恢复到最后一个保存的位置
                const originalPos = model.userData.originalPositions.pop();
                model.position.copy(originalPos);
                model.updateMatrixWorld();
                restoredCount++;

                console.log(`✅ 已恢复: ${model.name || layerName + '模型' + idx} (${layerName})`);
            }
        });
    }

    restoreModels(viewer.modelGroup1, '层1');
    restoreModels(viewer.modelGroup2, '层2');

    console.log('\n📊 恢复统计:');
    console.log(`  恢复模型数: ${restoredCount} 个`);

    if (restoredCount > 0) {
        console.log('\n📷 更新相机状态...');
        viewer._lastProjectionUpdate = 0;
        viewer.updateCameraProjectionForLargeCoord();
    } else {
        console.log('\n⚠️  没有找到需要恢复的模型');
    }

    console.log('\n✅ 撤销完成');

    return { restoredCount };
})();
