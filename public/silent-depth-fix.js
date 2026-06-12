/**
 * 静默深度诊断和修复脚本
 *
 * 运行方法: fetch('/silent-depth-fix.js').then(r=>r.text()).then(eval)
 */

(function() {
    console.log('🔍 开始静默深度诊断...');

    // 获取实例
    const viewer = window.vueApp?.$refs?.dualCanvasViewer;
    if (!viewer) {
        console.error('❌ 找不到 DualCanvasViewer');
        return;
    }

    // ========================================
    // 第一步：禁用所有频繁日志
    // ========================================
    console.log('📊 1. 禁用频繁日志...');

    // 保存原始 console.log
    const originalLog = console.log;
    const filteredPrefixes = [
        '[DualCanvasViewer] updateCameraProjectionForLargeCoord',
        '[DualCanvasViewer] 节流跳过',
        '[DualCanvasViewer] 智能计算 near/far',
        '[DualCanvasViewer] 验证层1模型可见性',
        '📍 [坐标信息面板]'
    ];

    console.log = function(...args) {
        const msg = args[0];
        if (typeof msg === 'string') {
            const shouldFilter = filteredPrefixes.some(prefix => msg.includes(prefix));
            if (shouldFilter) return;
        }
        originalLog.apply(console, args);
    };

    console.log('✅ 频繁日志已禁用');

    // ========================================
    // 第二步：深度检查投影矩阵
    // ========================================
    console.log('📊 2. 检查投影矩阵...');

    const camera = viewer.camera1;
    const proj = camera.projectionMatrix;
    const near = camera.near;
    const far = camera.far;

    // 关键元素
    const e14 = proj.elements[14];  // Z映射
    const e15 = proj.elements[15];  // W映射

    console.log('相机配置:');
    console.log(`  near: ${near.toFixed(2)}`);
    console.log(`  far: ${far.toFixed(2)}`);
    console.log(`  far/near: ${(far/near).toFixed(0)}`);
    console.log(`\n投影矩阵关键元素:`);
    console.log(`  element[14]: ${e14.toFixed(6)}`);
    console.log(`  element[15]: ${e15.toFixed(6)}`);

    // 检查是否是对数深度投影
    const isLogDepth = Math.abs(e14 + 1) < 0.001 && Math.abs(e15 + 1) < 0.001;
    console.log(`\n对数深度投影: ${isLogDepth ? '✅ 是' : '❌ 否'}`);

    // 计算标准投影的期望值
    const standardE14 = -(far + near) / (far - near);
    const standardE15 = -(2 * far * near) / (far - near);
    console.log(`\n标准投影期望值:`);
    console.log(`  e14: ${standardE14.toFixed(6)}`);
    console.log(`  e15: ${standardE15.toFixed(6)}`);

    // ========================================
    // 第三步：检查 WebGL 深度设置
    // ========================================
    console.log('\n📊 3. 检查 WebGL 深度设置...');

    const gl = viewer.renderer1?.getContext();
    if (!gl) {
        console.error('❌ 获取 WebGL 上下文失败');
        return;
    }

    const depthFunc = gl.getParameter(gl.DEPTH_FUNC);
    const depthFuncNames = { 512: 'NEVER', 513: 'LESS', 514: 'LEQUAL', 515: 'EQUAL', 516: 'GEQUAL', 517: 'GREATER', 518: 'NOTEQUAL', 519: 'ALWAYS' };
    console.log(`深度函数: ${depthFuncNames[depthFunc]} (${depthFunc})`);
    console.log(`正确值应为: LEQUAL (514)`);

    if (depthFunc !== 514) {
        console.warn('⚠️  深度函数不正确，正在修复...');
        gl.depthFunc(514);  // LEQUAL
        console.log('✅ 深度函数已修复为 LEQUAL');
    }

    // ========================================
    // 第四步：测试实际深度值
    // ========================================
    console.log('\n📊 4. 测试实际深度值...');

    const testPoints = [
        { name: '近平面', distance: near * 1.1 },
        { name: '相机前方10米', distance: 10 },
        { name: '相机前方100米', distance: 100 },
        { name: '相机前方500米', distance: 500 },
        { name: '远平面', distance: far * 0.9 }
    ];

    const results = testPoints.forEach(pt => {
        // 在相机前方创建测试点
        const testPos = camera.position.clone();
        testPos.y += pt.distance;  // 向上偏移

        // 投影到NDC
        const ndc = testPos.clone().project(camera);

        console.log(`\n${pt.name} (${pt.distance}m):`);
        console.log(`  NDC深度: ${ndc.z.toFixed(4)}`);

        if (ndc.z < 0) console.log('  ⚠️  被近平面裁剪');
        else if (ndc.z > 1) console.log('  ⚠️  被远平面裁剪');
        else console.log('  ✅ 可见');
    });

    // ========================================
    // 第五步：检查模型深度
    // ========================================
    console.log('\n📊 5. 检查模型深度...');

    if (viewer.modelGroup1 && viewer.modelGroup1.children.length > 0) {
        viewer.modelGroup1.children.forEach((model, idx) => {
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const dist = camera.position.distanceTo(center);
            const ndc = center.clone().project(camera);

            console.log(`\n模型 ${model.name || idx}:`);
            console.log(`  距离: ${dist.toFixed(2)}m`);
            console.log(`  NDC深度: ${ndc.z.toFixed(4)}`);
            console.log(`  位置: (${center.x.toFixed(1)}, ${center.y.toFixed(1)}, ${center.z.toFixed(1)})`);
        });
    }

    // ========================================
    // 第六步：检查材质深度设置
    // ========================================
    console.log('\n📊 6. 检查材质深度设置...');

    let materialCount = 0;
    let wrongDepthFunc = 0;

    function checkMaterials(obj, path = '') {
        if (obj.material) {
            const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
            materials.forEach(mat => {
                materialCount++;
                if (mat.depthFunc !== THREE.LessEqualDepth) {
                    wrongDepthFunc++;
                    if (wrongDepthFunc <= 3) {  // 只显示前3个
                        console.log(`⚠️  材质深度函数错误: ${mat.depthFunc} (应为 LessEqualDepth)`);
                    }
                }
            });
        }
        if (obj.children) {
            obj.children.forEach((child, i) => checkMaterials(child, `${path}/${i}`));
        }
    }

    if (viewer.modelGroup1) {
        viewer.modelGroup1.children.forEach(model => checkMaterials(model));
    }

    console.log(`总计 ${materialCount} 个材质，${wrongDepthFunc} 个深度函数错误`);

    // ========================================
    // 第七步：诊断结论
    // ========================================
    console.log('\n' + '='.repeat(60));
    console.log('📋 诊断结论');
    console.log('='.repeat(60));

    const issues = [];

    if (depthFunc !== 514) {
        issues.push('❌ WebGL深度函数不是LEQUAL');
    }
    if (far/near > 100000) {
        issues.push(`⚠️  far/near比例过大 (${(far/near).toFixed(0)}:1)`);
    }
    if (!isLogDepth) {
        issues.push('⚠️  未使用对数深度投影矩阵');
    }
    if (wrongDepthFunc > 0) {
        issues.push(`⚠️  ${wrongDepthFunc}个材质深度函数错误`);
    }

    if (issues.length === 0) {
        console.log('✅ 未发现配置问题');
        console.log('\n如果仍有问题，可能原因:');
        console.log('1. 对数深度缓冲区的计算精度问题');
        console.log('2. 投影矩阵构造时的精度损失');
        console.log('3. 坐标系变换矩阵问题');
    } else {
        console.log('发现的问题:');
        issues.forEach(i => console.log(i));
    }

    // ========================================
    // 第八步：尝试修复
    // ========================================
    console.log('\n🔧 尝试修复...');

    // 1. 修复材质
    if (wrongDepthFunc > 0) {
        function fixMaterials(obj) {
            if (obj.material) {
                const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
                materials.forEach(mat => {
                    mat.depthFunc = THREE.LessEqualDepth;
                    mat.depthTest = true;
                    mat.depthWrite = true;
                    mat.needsUpdate = true;
                });
            }
            if (obj.children) {
                obj.children.forEach(fixMaterials);
            }
        }
        if (viewer.modelGroup1) {
            viewer.modelGroup1.children.forEach(fixMaterials);
        }
        console.log('✅ 材质深度函数已修复');
    }

    // 2. 修复 near/far
    if (far/near > 10000) {
        const targetNear = Math.max(1, near);
        const targetFar = Math.min(far, targetNear * 1000);

        camera.near = targetNear;
        camera.far = targetFar;
        camera.updateProjectionMatrix();

        if (viewer.camera2) {
            viewer.camera2.near = targetNear;
            viewer.camera2.far = targetFar;
            viewer.camera2.updateProjectionMatrix();
        }

        console.log(`✅ near/far已优化: ${targetNear.toFixed(2)} / ${targetFar.toFixed(2)} (比例: ${(targetFar/targetNear).toFixed(0)})`);
    }

    // 3. 检查渲染器设置
    const hasLogDepthBuf = viewer.renderer1?.capabilities?.isLogarithmicDepthBuffer;
    console.log(`对数深度缓冲区: ${hasLogDepthBuf ? '✅ 已启用' : '❌ 未启用'}`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ 诊断完成');
    console.log('='.repeat(60));

    return {
        near,
        far,
        ratio: far/near,
        isLogDepth,
        depthFunc,
        hasLogDepthBuf,
        issues
    };
})();
