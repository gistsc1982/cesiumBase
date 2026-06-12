/**
 * 统一坐标空间脚本
 * 将所有小坐标模型移动到大坐标空间，解决跨空间显示问题
 */

(function() {
    console.log('='.repeat(70));
    console.log('统一坐标空间 - 将小坐标模型移动到大坐标空间');
    console.log('='.repeat(70));

    const viewer = window.__dualCanvasViewerInstances?.[0];
    if (!viewer) {
        console.error('未找到 DualCanvasViewer');
        return;
    }

    const LARGE_COORD_THRESHOLD = 10000;
    const camera = viewer.camera1;

    // 判断当前坐标模式
    const isLargeCoordMode = Math.abs(camera.position.x) > LARGE_COORD_THRESHOLD ||
                            Math.abs(camera.position.z) > LARGE_COORD_THRESHOLD;

    console.log('\n📊 当前状态:');
    console.log('  相机坐标模式:', isLargeCoordMode ? '大坐标' : '小坐标');
    console.log('  相机位置:', `(${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)})`);

    // 收集所有模型信息
    console.log('\n📊 扫描所有模型...');

    function scanModels(group, layerName) {
        if (!group || group.children.length === 0) return [];

        const models = {
            largeCoord: [],
            smallCoord: []
        };

        group.children.forEach((model, idx) => {
            const pos = model.position;
            const isLarge = Math.abs(pos.x) > LARGE_COORD_THRESHOLD ||
                           Math.abs(pos.z) > LARGE_COORD_THRESHOLD;

            const modelInfo = {
                index: idx,
                name: model.name || `模型${idx}`,
                model: model,
                originalPosition: pos.clone(),
                isLarge: isLarge,
                layer: layerName
            };

            if (isLarge) {
                models.largeCoord.push(modelInfo);
            } else {
                models.smallCoord.push(modelInfo);
            }
        });

        return models;
    }

    const layer1Models = scanModels(viewer.modelGroup1, '层1');
    const layer2Models = scanModels(viewer.modelGroup2, '层2');

    const allLargeCoord = [...layer1Models.largeCoord, ...layer2Models.largeCoord];
    const allSmallCoord = [...layer1Models.smallCoord, ...layer2Models.smallCoord];

    console.log('\n📊 扫描结果:');
    console.log(`  大坐标模型: ${allLargeCoord.length} 个`);
    console.log(`  小坐标模型: ${allSmallCoord.length} 个`);

    if (allSmallCoord.length === 0) {
        console.log('\n✅ 所有模型已经在大坐标空间，无需移动');
        return;
    }

    // 列出小坐标模型
    console.log('\n📋 需要移动的小坐标模型:');
    allSmallCoord.forEach((m, idx) => {
        console.log(`  ${idx + 1}. ${m.name} (${m.layer})`);
        console.log(`     位置: (${m.originalPosition.x.toFixed(2)}, ${m.originalPosition.y.toFixed(2)}, ${m.originalPosition.z.toFixed(2)})`);
    });

    // 计算大坐标模型的中心
    if (allLargeCoord.length === 0) {
        console.log('\n⚠️  没有大坐标模型作为参考，无法移动小坐标模型');
        console.log('   请先加载至少一个大坐标模型');
        return;
    }

    // 手动计算中心（不依赖 THREE.Vector3）
    const largeCoordCenter = { x: 0, y: 0, z: 0 };
    allLargeCoord.forEach(m => {
        largeCoordCenter.x += m.originalPosition.x;
        largeCoordCenter.y += m.originalPosition.y;
        largeCoordCenter.z += m.originalPosition.z;
    });
    largeCoordCenter.x /= allLargeCoord.length;
    largeCoordCenter.y /= allLargeCoord.length;
    largeCoordCenter.z /= allLargeCoord.length;

    console.log('\n📍 大坐标模型中心位置:');
    console.log(`  (${largeCoordCenter.x.toFixed(2)}, ${largeCoordCenter.y.toFixed(2)}, ${largeCoordCenter.z.toFixed(2)})`);

    // 计算小坐标模型的中心
    const smallCoordCenter = { x: 0, y: 0, z: 0 };
    allSmallCoord.forEach(m => {
        smallCoordCenter.x += m.originalPosition.x;
        smallCoordCenter.y += m.originalPosition.y;
        smallCoordCenter.z += m.originalPosition.z;
    });
    smallCoordCenter.x /= allSmallCoord.length;
    smallCoordCenter.y /= allSmallCoord.length;
    smallCoordCenter.z /= allSmallCoord.length;

    console.log('\n📍 小坐标模型中心位置:');
    console.log(`  (${smallCoordCenter.x.toFixed(2)}, ${smallCoordCenter.y.toFixed(2)}, ${smallCoordCenter.z.toFixed(2)})`);

    // 计算偏移量
    const offset = {
        x: largeCoordCenter.x - smallCoordCenter.x,
        y: largeCoordCenter.y - smallCoordCenter.y,
        z: largeCoordCenter.z - smallCoordCenter.z
    };

    console.log('\n🔄 计算的偏移量:');
    console.log(`  (${offset.x.toFixed(2)}, ${offset.y.toFixed(2)}, ${offset.z.toFixed(2)})`);

    // 确认移动
    console.log('\n' + '='.repeat(70));
    console.log('⚠️  即将移动以下模型到与大坐标模型相同的空间:');
    console.log('='.repeat(70));
    allSmallCoord.forEach((m, idx) => {
        const newPos = {
            x: m.originalPosition.x + offset.x,
            y: m.originalPosition.y + offset.y,
            z: m.originalPosition.z + offset.z
        };
        console.log(`\n${idx + 1}. ${m.name} (${m.layer}):`);
        console.log(`   从: (${m.originalPosition.x.toFixed(2)}, ${m.originalPosition.y.toFixed(2)}, ${m.originalPosition.z.toFixed(2)})`);
        console.log(`   到: (${newPos.x.toFixed(2)}, ${newPos.y.toFixed(2)}, ${newPos.z.toFixed(2)})`);
    });

    // 执行移动
    console.log('\n🚀 开始移动模型...');

    allSmallCoord.forEach(m => {
        // 保存原始位置（用于撤销）
        if (!m.model.userData.originalPositions) {
            m.model.userData.originalPositions = [];
        }
        // 保存原始位置的副本
        m.model.userData.originalPositions.push({
            x: m.originalPosition.x,
            y: m.originalPosition.y,
            z: m.originalPosition.z
        });

        // 移动模型
        m.model.position.x += offset.x;
        m.model.position.y += offset.y;
        m.model.position.z += offset.z;

        // 更新矩阵
        m.model.updateMatrixWorld();

        console.log(`✅ 已移动: ${m.name}`);
    });

    // 更新相机和控制器
    console.log('\n📷 更新相机状态...');
    viewer._lastProjectionUpdate = 0;
    viewer.updateCameraProjectionForLargeCoord();

    console.log('\n' + '='.repeat(70));
    console.log('✅ 坐标空间统一完成！');
    console.log('='.repeat(70));

    console.log('\n📊 移动统计:');
    console.log(`  移动模型数: ${allSmallCoord.length} 个`);
    console.log(`  偏移量: (${offset.x.toFixed(2)}, ${offset.y.toFixed(2)}, ${offset.z.toFixed(2)})`);

    console.log('\n💡 现在所有模型都在同一坐标空间:');
    console.log('  ✅ L16、19_rue、catwalk、Scene 等所有模型都会一起显示');
    console.log('  ✅ 不再有跨坐标空间的距离计算问题');
    console.log('  ✅ near/far 比例会降到合理范围');

    console.log('\n🔄 如需撤销移动，运行:');
    console.log('   fetch("/undo-coordinate-space.js").then(r=>r.text()).then(eval)');

    return {
        success: true,
        movedCount: allSmallCoord.length,
        offset: offset,
        largeCoordCenter: largeCoordCenter,
        smallCoordCenter: smallCoordCenter
    };
})();
