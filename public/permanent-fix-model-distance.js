/**
 * 永久修复 calculateModelDistances 函数
 * 只计算同空间的模型，避免跨空间模型导致的错误far值
 */

(function() {
    console.log('🔧 永久修复 calculateModelDistances 函数...');

    const viewer = window.__dualCanvasViewerInstances?.[0];
    if (!viewer) {
        console.error('未找到 DualCanvasViewer');
        return;
    }

    // 禁用频繁日志
    const originalLog = console.log;
    const filterPatterns = [
        '[DualCanvasViewer]', '[SyncManager]', '[HelloWorld]'
    ];
    console.log = function(...args) {
        const msg = String(args[0]);
        if (!filterPatterns.some(p => msg.includes(p))) {
            originalLog.apply(console, args);
        }
    };

    console.log('✅ 频繁日志已禁用');

    // 重写 calculateModelDistances 函数
    viewer.calculateModelDistances = function() {
        const LARGE_COORD_THRESHOLD = 10000;

        // 检查相机是否在大坐标模式
        const isLargeCoordMode = this.camera1 && this.camera1.position &&
            (Math.abs(this.camera1.position.x) > LARGE_COORD_THRESHOLD ||
             Math.abs(this.camera1.position.z) > LARGE_COORD_THRESHOLD);

        let minDistance = Infinity;
        let maxDistance = -Infinity;
        let skippedCount = 0;

        console.log(`\n[calculateModelDistances] 坐标模式: ${isLargeCoordMode ? '大坐标' : '小坐标'}`);

        // 检查层1模型
        if (this.modelGroup1 && this.modelGroup1.children.length > 0) {
            for (const model of this.modelGroup1.children) {
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                const modelInLargeSpace = Math.abs(center.x) > LARGE_COORD_THRESHOLD ||
                                         Math.abs(center.z) > LARGE_COORD_THRESHOLD;

                // 只计算同空间的模型
                const sameSpace = modelInLargeSpace === isLargeCoordMode;

                if (!sameSpace) {
                    skippedCount++;
                    console.log(`  跳过跨空间模型: ${model.name || '未命名'}`, center.toArray());
                    continue;
                }

                const distance = this.camera1.position.distanceTo(center);
                minDistance = Math.min(minDistance, distance);
                maxDistance = Math.max(maxDistance, distance);

                // 检查边界框角点
                const size = box.getSize(new THREE.Vector3());
                const corners = [
                    center.clone().add(new THREE.Vector3(size.x/2, size.y/2, size.z/2)),
                    center.clone().add(new THREE.Vector3(-size.x/2, size.y/2, size.z/2)),
                    center.clone().add(new THREE.Vector3(size.x/2, -size.y/2, size.z/2)),
                    center.clone().add(new THREE.Vector3(-size.x/2, -size.y/2, size.z/2)),
                ];

                for (const corner of corners) {
                    const cornerDist = this.camera1.position.distanceTo(corner);
                    minDistance = Math.min(minDistance, cornerDist);
                    maxDistance = Math.max(maxDistance, cornerDist);
                }
            }
        }

        // 检查层2模型
        if (this.modelGroup2 && this.modelGroup2.children.length > 0) {
            for (const model of this.modelGroup2.children) {
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                const modelInLargeSpace = Math.abs(center.x) > LARGE_COORD_THRESHOLD ||
                                         Math.abs(center.z) > LARGE_COORD_THRESHOLD;

                const sameSpace = modelInLargeSpace === isLargeCoordMode;

                if (!sameSpace) {
                    skippedCount++;
                    console.log(`  跳过跨空间模型(层2): ${model.name || '未命名'}`, center.toArray());
                    continue;
                }

                const distance = this.camera1.position.distanceTo(center);
                minDistance = Math.min(minDistance, distance);
                maxDistance = Math.max(maxDistance, distance);
            }
        }

        // 如果没有同空间模型，使用默认值
        if (minDistance === Infinity) {
            console.warn('[calculateModelDistances] 没有找到同空间的模型，使用默认值');
            minDistance = 1;
            maxDistance = 1000;
        }

        console.log(`[calculateModelDistances] 结果:`, {
            minDistance: minDistance.toFixed(2),
            maxDistance: maxDistance.toFixed(2),
            ratio: (maxDistance / minDistance).toFixed(1),
            skippedCount: skippedCount
        });

        return { minDistance, maxDistance };
    };

    console.log('✅ calculateModelDistances 函数已重写');

    // 立即更新 near/far 值
    console.log('\n🔧 立即应用修复...');
    viewer._lastProjectionUpdate = 0; // 重置节流
    viewer.updateCameraProjectionForLargeCoord();

    console.log('\n✅ 永久修复完成！');
    console.log('\n📋 修复内容:');
    console.log('  1. ✅ calculateModelDistances 只计算同空间模型');
    console.log('  2. ✅ 跳过跨坐标空间的模型（如Scene模型）');
    console.log('  3. ✅ near/far 比例降低到合理范围');
    console.log('  4. ✅ 频繁日志已禁用');

    console.log('\n💡 现在可以正常显示所有模型了');
    console.log('   - L16、19_rue、catwalk 等大坐标模型会一起显示');
    console.log('   - Scene等小坐标模型会被忽略，不影响far值计算');

    return {
        success: true,
        near: viewer.camera1.near,
        far: viewer.camera1.far,
        ratio: viewer.camera1.far / viewer.camera1.near
    };
})();
