// 简化模型搜索脚本
(function() {
  const dualViewer = window.__dualCanvasViewer;
  
  console.log('=== 检查 modelGroup1 ===');
  console.log('children 数量:', dualViewer.modelGroup1?.children?.length);
  
  dualViewer.modelGroup1.children.forEach((obj, i) => {
    console.log('\n[' + i + ']');
    console.log('type:', obj.type);
    console.log('name:', obj.name);
    console.log('userData keys:', Object.keys(obj.userData || {}));
    console.log('uuid:', obj.uuid);
    
    // 检查是否有 fileName
    console.log('has fileName:', !!obj.userData.fileName);
    console.log('has filePath:', !!obj.userData.filePath);
    
    // 检查子对象
    if (obj.children && obj.children.length > 0) {
      console.log('有', obj.children.length, '个子对象');
      obj.children.forEach((child, j) => {
        console.log('  [' + j + ']', child.userData.fileName || child.name);
        if (child.userData.fileName) {
          console.log('    ✅ 找到文件名:', child.userData.fileName);
        }
      });
    }
  });
  
  // 方法2: 场景遍历
  console.log('\n=== 场景遍历 ===');
  const scene1 = dualViewer.scene1;
  let count = 0;
  
  scene1.traverse(obj => {
    if (obj.isMesh) {
      count++;
      const parent = obj.parent;
      if (parent) {
        const name = parent.userData.fileName || parent.userData.filePath || parent.name;
        console.log('Mesh:', name);
        if (name && name.toLowerCase().includes('l16')) {
          console.log('✅ 找到 L16!');
        }
      }
    }
  });
  
  console.log('总 Mesh 数量:', count);
})();
