/**
 * 坐标空间统一补丁 - 整合到进入真实世界模式的逻辑中
 *
 * 这个脚本会修改 DualCanvasViewer.vue 源代码，在进入真实世界模式时自动统一坐标空间
 *
 * 使用方法：
 * 1. 运行此脚本创建补丁文件
 * 2. 手动应用补丁到源代码
 * 3. 重新编译项目
 */

console.log('='.repeat(70));
console.log('坐标空间统一补丁生成器');
console.log('='.repeat(70));

// ============================================
// 第一部分：添加坐标空间统一方法
// ============================================

const unifyCoordinateSpaceMethod = `
    /**
     * 统一坐标空间 - 将所有小坐标模型移动到大坐标空间
     * 在进入真实世界模式时调用，解决跨坐标空间导致的透视翻转问题
     *
     * @returns {Object} { movedCount, offset, largeCoordCenter, smallCoordCenter }
     */
    unifyCoordinateSpaces() {
      const LARGE_COORD_THRESHOLD = 10000;

      console.log('[DualCanvasViewer] 开始统一坐标空间...');

      // 收集所有模型信息
      function scanModels(group, layerName) {
        if (!group || group.children.length === 0) return { largeCoord: [], smallCoord: [] };

        const models = { largeCoord: [], smallCoord: [] };

        group.children.forEach((model, idx) => {
          const pos = model.position;
          const isLarge = Math.abs(pos.x) > LARGE_COORD_THRESHOLD || Math.abs(pos.z) > LARGE_COORD_THRESHOLD;

          const modelInfo = {
            index: idx,
            name: model.name || \`\模型\${idx}\`,
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

      const layer1Models = scanModels(this.modelGroup1, '层1');
      const layer2Models = scanModels(this.modelGroup2, '层2');

      const allLargeCoord = [...layer1Models.largeCoord, ...layer2Models.largeCoord];
      const allSmallCoord = [...layer1Models.smallCoord, ...layer2Models.smallCoord];

      console.log(\`[DualCanvasViewer] 扫描结果: 大坐标\${allLargeCoord.length}个, 小坐标\${allSmallCoord.length}个\`);

      if (allSmallCoord.length === 0) {
        console.log('[DualCanvasViewer] 所有模型已在大坐标空间，无需统一');
        return { movedCount: 0 };
      }

      // 计算大坐标模型的中心
      if (allLargeCoord.length === 0) {
        console.warn('[DualCanvasViewer] 没有大坐标模型作为参考');
        return { movedCount: 0 };
      }

      const largeCoordCenter = new THREE.Vector3();
      allLargeCoord.forEach(m => largeCoordCenter.add(m.originalPosition));
      largeCoordCenter.divideScalar(allLargeCoord.length);

      // 计算小坐标模型的中心
      const smallCoordCenter = new THREE.Vector3();
      allSmallCoord.forEach(m => smallCoordCenter.add(m.originalPosition));
      smallCoordCenter.divideScalar(allSmallCoord.length);

      // 计算偏移量
      const offset = new THREE.Vector3().subVectors(largeCoordCenter, smallCoordCenter);

      console.log('[DualCanvasViewer] 坐标空间偏移量:', {
        largeCoordCenter: \`(\${largeCoordCenter.x.toFixed(2)}, \${largeCoordCenter.y.toFixed(2)}, \${largeCoordCenter.z.toFixed(2)})\`,
        smallCoordCenter: \`(\${smallCoordCenter.x.toFixed(2)}, \${smallCoordCenter.y.toFixed(2)}, \${smallCoordCenter.z.toFixed(2)})\`,
        offset: \`(\${offset.x.toFixed(2)}, \${offset.y.toFixed(2)}, \${offset.z.toFixed(2)})\`
      });

      // 移动小坐标模型
      let movedCount = 0;
      allSmallCoord.forEach(m => {
        // 保存原始位置（用于退出时恢复）
        if (!m.model.userData.originalPositions) {
          m.model.userData.originalPositions = [];
        }
        m.model.userData.originalPositions.push(m.originalPosition.clone());

        // 移动模型
        m.model.position.add(offset);
        m.model.updateMatrixWorld();
        movedCount++;

        console.log(\`[DualCanvasViewer] 已移动: \${m.name} (\${m.layer})\`);
      });

      console.log(\`[DualCanvasViewer] 坐标空间统一完成，移动了 \${movedCount} 个模型\`);

      return {
        movedCount,
        offset,
        largeCoordCenter,
        smallCoordCenter
      };
    },

    /**
     * 恢复坐标空间 - 将模型恢复到统一前的位置
     * 在退出真实世界模式时调用
     */
    restoreCoordinateSpaces() {
      console.log('[DualCanvasViewer] 开始恢复坐标空间...');

      let restoredCount = 0;

      function restoreModels(group, layerName) {
        if (!group || group.children.length === 0) return;

        group.children.forEach((model, idx) => {
          if (model.userData && model.userData.originalPositions && model.userData.originalPositions.length > 0) {
            const originalPos = model.userData.originalPositions.pop();
            model.position.copy(originalPos);
            model.updateMatrixWorld();
            restoredCount++;

            console.log(\`[DualCanvasViewer] 已恢复: \${model.name || layerName + '模型' + idx}\`);
          }
        });
      }

      restoreModels(this.modelGroup1, '层1');
      restoreModels(this.modelGroup2, '层2');

      console.log(\`[DualCanvasViewer] 坐标空间恢复完成，恢复了 \${restoredCount} 个模型\`);

      return { restoredCount };
    },
`;

// ============================================
// 第二部分：修改 calculateModelDistances 方法
// ============================================

const calculateModelDistancesPatch = `
    /**
     * 计算场景中所有模型到相机的最小和最大距离
     * ⚠️ 修复：只计算同坐标空间的模型，避免跨空间导致的错误距离
     * 用于智能计算 near/far 值
     * @returns {Object} { minDistance, maxDistance }
     */
    calculateModelDistances() {
      const LARGE_COORD_THRESHOLD = 10000;

      // 判断相机是否在大坐标模式
      const isLargeCoordMode = this.camera1 && this.camera1.position &&
        (Math.abs(this.camera1.position.x) > LARGE_COORD_THRESHOLD ||
         Math.abs(this.camera1.position.z) > LARGE_COORD_THRESHOLD);

      let minDistance = Infinity;
      let maxDistance = -Infinity;
      let skippedCount = 0;

      // 检查层1的所有模型
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
            continue;
          }

          const distance = this.camera1.position.distanceTo(center);
          minDistance = Math.min(minDistance, distance);
          maxDistance = Math.max(maxDistance, distance);

          // 检查边界框的角点
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

      // 检查层2的所有模型
      if (this.modelGroup2 && this.modelGroup2.children.length > 0) {
        for (const model of this.modelGroup2.children) {
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          const modelInLargeSpace = Math.abs(center.x) > LARGE_COORD_THRESHOLD ||
                                   Math.abs(center.z) > LARGE_COORD_THRESHOLD;

          const sameSpace = modelInLargeSpace === isLargeCoordMode;
          if (!sameSpace) {
            skippedCount++;
            continue;
          }

          const distance = this.camera1.position.distanceTo(center);
          minDistance = Math.min(minDistance, distance);
          maxDistance = Math.max(maxDistance, distance);
        }
      }

      // 如果没有模型，使用默认值
      if (minDistance === Infinity) {
        minDistance = 1;
        maxDistance = 1000;
      }

      if (skippedCount > 0) {
        console.log(\`[calculateModelDistances] 跳过了 \${skippedCount} 个跨空间模型\`);
      }

      return { minDistance, maxDistance };
    },
`;

// ============================================
// 第三部分：修改进入真实世界模式的调用点
// ============================================

const enterRealWorldModePatch = `
      // 5. 移动已有的小坐标模型到参考位置附近
      await this.moveExistingModelsToReference();

      // ⭐ 新增：统一坐标空间，将所有小坐标模型移动到大坐标空间
      // 这解决了跨坐标空间导致的透视翻转问题
      console.log('[DualCanvasViewer] 统一坐标空间...');
      const unifyResult = this.unifyCoordinateSpaces();
      if (unifyResult.movedCount > 0) {
        console.log(\`[DualCanvasViewer] 已统一 \${unifyResult.movedCount} 个模型的坐标空间\`);
      }

      // ⚠️ 关键修复：先设置真实世界模式标志，再调用 adjustCameraForAllModels
      // 这样 adjustCameraForAllModels 才能使用大坐标设置相机位置
      this.isInRealWorldMode = true;
      console.log('[DualCanvasViewer] 已设置真实世界模式标志（在 adjustCameraForAllModels 之前）');
`;

// ============================================
// 第四部分：修改退出真实世界模式的调用点
// ============================================

const exitRealWorldModePatch = `
      // ⭐ 新增：恢复坐标空间，将模型恢复到统一前的位置
      console.log('[DualCanvasViewer] 恢复坐标空间...');
      const restoreResult = this.restoreCoordinateSpaces();
      if (restoreResult.restoredCount > 0) {
        console.log(\`[DualCanvasViewer] 已恢复 \${restoreResult.restoredCount} 个模型的坐标空间\`);
      }

      // 然后恢复模型布局
      await this.restoreModelLayoutFromSnapshot();
`;

// ============================================
// 生成补丁说明
// ============================================

console.log('\n' + '='.repeat(70));
console.log('补丁说明');
console.log('='.repeat(70));

console.log('\n📋 需要修改的文件:');
console.log('   src/components/DualCanvasViewer.vue');

console.log('\n📝 修改步骤:');
console.log('\n1️⃣  在 methods 部分添加新方法（约在 exitRealWorldMode 方法之前）:');
console.log('   - unifyCoordinateSpaces()');
console.log('   - restoreCoordinateSpaces()');

console.log('\n2️⃣  修改 calculateModelDistances() 方法:');
console.log('   - 添加同空间模型检查逻辑');
console.log('   - 跳过跨坐标空间的模型');

console.log('\n3️⃣  修改进入真实世界模式的代码（约在 13384 行后）:');
console.log('   - 在 moveExistingModelsToReference() 后添加坐标空间统一调用');

console.log('\n4️⃣  修改退出真实世界模式的代码（约在 exitRealWorldMode 方法开始处）:');
console.log('   - 在 restoreModelLayoutFromSnapshot() 前添加坐标空间恢复调用');

console.log('\n💡 完成后重新编译项目:');
console.log('   npm run build');

console.log('\n' + '='.repeat(70));

// 导出补丁内容供参考
window.coordinateSpacePatch = {
  methods: unifyCoordinateSpaceMethod,
  calculateModelDistances: calculateModelDistancesPatch,
  enterRealWorld: enterRealWorldModePatch,
  exitRealWorld: exitRealWorldModePatch
};

console.log('\n✅ 补丁内容已保存到 window.coordinateSpacePatch');
console.log('   可以访问以下属性:');
console.log('   - window.coordinateSpacePatch.methods');
console.log('   - window.coordinateSpacePatch.calculateModelDistances');
console.log('   - window.coordinateSpacePatch.enterRealWorld');
console.log('   - window.coordinateSpacePatch.exitRealWorld');
