/**
 * 回滚深度修复 - 只修复真正有问题的材质
 */

console.log('='.repeat(80));
console.log('🔧 回滚深度修复 - 恢复层1材质');
console.log('='.repeat(80));

const dualViewer = window.__dualCanvasViewerInstances &&
                  window.__dualCanvasViewerInstances.length > 0 &&
                  window.__dualCanvasViewerInstances[0];

if (!dualViewer) {
  console.error('❌ 无法找到 DualCanvasViewer 实例');
} else {
  console.log('✅ 找到 DualCanvasViewer 实例\n');

  // Three.js 深度函数常量
  const DEPTH_FUNCS = {
    NeverDepth: 0,
    AlwaysDepth: 1,
    LessDepth: 2,
    EqualDepth: 3,
    LessEqualDepth: 4,
    GreaterDepth: 5,
    NotEqualDepth: 6,
    GreaterEqualDepth: 7
  };

  let rollbackCount = 0;

  // 只处理层1（场景1），保持层2不变
  if (dualViewer.scene1) {
    console.log('📍 恢复场景1（层1）的材质设置...\n');

    dualViewer.scene1.traverse((object) => {
      if (object.isMesh && object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];

        materials.forEach((material) => {
          if (material && material.depthFunc === DEPTH_FUNCS.LessEqualDepth) {
            // 恢复为 EqualDepth
            material.depthFunc = DEPTH_FUNCS.EqualDepth;
            material.needsUpdate = true;
            rollbackCount++;

            if (rollbackCount <= 3) {
              console.log(`   ✅ 已恢复: LessEqualDepth → EqualDepth`);
            }
          }
        });
      }
    });

    console.log(`\n✅ 总共恢复了 ${rollbackCount} 个材质`);
  }

  // 检查层2（场景2）的状态
  console.log('\n📍 场景2（层2）状态:');
  if (dualViewer.scene2) {
    let greaterCount = 0;
    let lequalCount = 0;

    dualViewer.scene2.traverse((object) => {
      if (object.isMesh && object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];

        materials.forEach((material) => {
          if (material) {
            if (material.depthFunc === DEPTH_FUNCS.GreaterDepth) {
              greaterCount++;
            } else if (material.depthFunc === DEPTH_FUNCS.LessEqualDepth) {
              lequalCount++;
            }
          }
        });
      }
    });

    console.log(`   GreaterDepth (错误): ${greaterCount}`);
    console.log(`   LessEqualDepth (正确): ${lequalCount}`);

    // 只修复层2中真正有问题的材质（GREATER）
    if (greaterCount > 0) {
      console.log(`\n🔧 修复层2中的 ${greaterCount} 个错误材质...`);

      dualViewer.scene2.traverse((object) => {
        if (object.isMesh && object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];

          materials.forEach((material) => {
            if (material && material.depthFunc === DEPTH_FUNCS.GreaterDepth) {
              material.depthFunc = DEPTH_FUNCS.LessEqualDepth;
              material.needsUpdate = true;
            }
          });
        }
      });

      console.log('✅ 修复完成');
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ 回滚完成');
  console.log('='.repeat(80));
  console.log('\n📝 层1模型应该重新显示了');
  console.log('   层2的深度问题也已修复\n');
}

console.log('\n');
