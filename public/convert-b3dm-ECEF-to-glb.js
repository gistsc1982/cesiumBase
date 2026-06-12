// B3DM 转 GLB - ECEF 到 Three.js 坐标系完整转换
// 功能：
// 1. 保留原始 B3DM 中的 RTC_CENTER（ECEF 坐标）
// 2. 使用 PCA 自动计算模型主平面方向并贴地对齐
// 3. 重新计算法线和边界框
// 4. 保留地理位置信息
//
// 使用方式：
//   node convert-b3dm-ECEF-to-glb.js <input.b3dm> [output.glb]
//
// 示例：
//   node convert-b3dm-ECEF-to-glb.js L16_10302.b3dm
//   node convert-b3dm-ECEF-to-glb.js L15_12345.b3dm custom_output.glb

const fs = require('fs');
const path = require('path');

// ============================================
// 1. ECEF 到经纬度转换
// ============================================

function convertCartesianToCartographic(x, y, z) {
  const a = 6378137.0;
  const b = 6356752.314245;
  const e2 = 0.00669437999014;
  const ep2 = 0.00673949674233;

  const longitude = Math.atan2(y, x);
  const p = Math.sqrt(x * x + y * y);
  const theta = Math.atan2(z * a, p * b);

  const latitude = Math.atan2(
    z + ep2 * b * Math.pow(Math.sin(theta), 3),
    p - e2 * a * Math.pow(Math.cos(theta), 3)
  );

  const sinLat = Math.sin(latitude);
  const cosLat = Math.cos(latitude);
  const N = a / Math.sqrt(1 - e2 * sinLat * sinLat);

  const altitude = p / cosLat - N;

  return {
    longitude: longitude * 180 / Math.PI,
    latitude: latitude * 180 / Math.PI,
    altitude: altitude
  };
}

// ============================================
// 2. 主成分分析 (PCA) - 找到模型的主要方向
// ============================================

function computePCA(vertices) {
  const n = vertices.length;

  // 计算质心
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < n; i++) {
    cx += vertices[i][0];
    cy += vertices[i][1];
    cz += vertices[i][2];
  }
  cx /= n;
  cy /= n;
  cz /= n;

  // 计算协方差矩阵
  let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
  for (let i = 0; i < n; i++) {
    const dx = vertices[i][0] - cx;
    const dy = vertices[i][1] - cy;
    const dz = vertices[i][2] - cz;
    xx += dx * dx;
    xy += dx * dy;
    xz += dx * dz;
    yy += dy * dy;
    yz += dy * dz;
    zz += dz * dz;
  }

  xx /= n;
  xy /= n;
  xz /= n;
  yy /= n;
  yz /= n;
  zz /= n;

  // 使用雅可比迭代法计算特征值和特征向量
  const a = [[xx, xy, xz], [xy, yy, yz], [xz, yz, zz]];
  let v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

  for (let iter = 0; iter < 100; iter++) {
    let maxVal = 0;
    let maxI = 0, maxJ = 1;

    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        if (Math.abs(a[i][j]) > maxVal) {
          maxVal = Math.abs(a[i][j]);
          maxI = i;
          maxJ = j;
        }
      }
    }

    if (maxVal < 1e-10) break;

    const theta = 0.5 * Math.atan2(2 * a[maxI][maxJ], a[maxJ][maxJ] - a[maxI][maxI]);
    const c = Math.cos(theta);
    const s = Math.sin(theta);

    for (let k = 0; k < 3; k++) {
      const tmpI = a[maxI][k];
      const tmpJ = a[maxJ][k];
      a[maxI][k] = c * tmpI - s * tmpJ;
      a[maxJ][k] = s * tmpI + c * tmpJ;
    }
    for (let k = 0; k < 3; k++) {
      const tmpI = a[k][maxI];
      const tmpJ = a[k][maxJ];
      a[k][maxI] = c * tmpI - s * tmpJ;
      a[k][maxJ] = s * tmpI + c * tmpJ;
    }
    for (let k = 0; k < 3; k++) {
      const tmpI = v[maxI][k];
      const tmpJ = v[maxJ][k];
      v[maxI][k] = c * tmpI - s * tmpJ;
      v[maxJ][k] = s * tmpI + c * tmpJ;
    }
  }

  const eigenvalues = [a[0][0], a[1][1], a[2][2]];
  const eigenvectors = [
    [v[0][0], v[0][1], v[0][2]],
    [v[1][0], v[1][1], v[1][2]],
    [v[2][0], v[2][1], v[2][2]]
  ];

  const indices = [0, 1, 2].sort((i, j) => eigenvalues[j] - eigenvalues[i]);

  return {
    eigenvalues: [eigenvalues[indices[0]], eigenvalues[indices[1]], eigenvalues[indices[2]]],
    eigenvectors: [
      eigenvectors[indices[0]],
      eigenvectors[indices[1]],
      eigenvectors[indices[2]]
    ],
    centroid: [cx, cy, cz]
  };
}

// ============================================
// 3. 计算让模型贴地的旋转矩阵（基于 PCA）
// ============================================

function computeGroundAlignmentRotation(pcaResult) {
  const { eigenvectors, eigenvalues } = pcaResult;

  console.log('\n📊 PCA 分析结果:');
  console.log('  特征值:', eigenvalues.map(v => v.toFixed(2)));
  console.log('  主方向 1 (最大延展):', eigenvectors[0].map(v => v.toFixed(4)));
  console.log('  主方向 2 (中等延展):', eigenvectors[1].map(v => v.toFixed(4)));
  console.log('  主方向 3 (最小延展，法线):', eigenvectors[2].map(v => v.toFixed(4)));

  // 最小特征值对应的特征向量是"最平坦"的方向，即平面的法线
  // 我们要让这个法线指向 Y 轴正方向 (0, 1, 0)
  let normal = eigenvectors[2];
  const targetNormal = [0, 1, 0];

  // 检查法线方向，如果 Y 分量为负，说明面朝下，需要翻转
  if (normal[1] < 0) {
    console.log('\n⚠️ 检测到模型面朝下，将翻转 180°');
    normal = [-normal[0], -normal[1], -normal[2]];
  }

  // 计算旋转轴和角度
  const axis = [
    normal[1] * targetNormal[2] - normal[2] * targetNormal[1],
    normal[2] * targetNormal[0] - normal[0] * targetNormal[2],
    normal[0] * targetNormal[1] - normal[1] * targetNormal[0]
  ];

  const axisLength = Math.sqrt(axis[0] * axis[0] + axis[1] * axis[1] + axis[2] * axis[2]);

  if (axisLength < 1e-10) {
    console.log('\n✅ 模型已经对齐，不需要旋转');
    return null;
  }

  axis[0] /= axisLength;
  axis[1] /= axisLength;
  axis[2] /= axisLength;

  const dot = normal[0] * targetNormal[0] + normal[1] * targetNormal[1] + normal[2] * targetNormal[2];
  const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

  console.log('\n🔄 计算贴地旋转矩阵:');
  console.log('  当前法线方向:', normal.map(v => v.toFixed(4)));
  console.log('  目标法线方向:', targetNormal);
  console.log('  旋转轴:', axis.map(v => v.toFixed(4)));
  console.log('  旋转角度:', (angle * 180 / Math.PI).toFixed(2), '度');

  // 构建旋转矩阵 (Rodrigues 旋转公式)
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;

  return [
    [
      t * axis[0] * axis[0] + c,
      t * axis[0] * axis[1] - s * axis[2],
      t * axis[0] * axis[2] + s * axis[1]
    ],
    [
      t * axis[0] * axis[1] + s * axis[2],
      t * axis[1] * axis[1] + c,
      t * axis[1] * axis[2] - s * axis[0]
    ],
    [
      t * axis[0] * axis[2] - s * axis[1],
      t * axis[1] * axis[2] + s * axis[0],
      t * axis[2] * axis[2] + c
    ]
  ];
}

// ============================================
// 4. 解析 B3DM
// ============================================

function parseB3DM(filePath) {
  console.log('🔍 解析 B3DM 文件:', path.basename(filePath));

  const buffer = fs.readFileSync(filePath);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  const magic = buffer.slice(0, 4).toString('ascii');
  const version = view.getUint32(4, true);
  const byteLength = view.getUint32(8, true);
  const featureTableJSONByteLength = view.getUint32(12, true);
  const featureTableBinaryByteLength = view.getUint32(16, true);
  const batchTableJSONByteLength = view.getUint32(20, true);
  const batchTableBinaryByteLength = view.getUint32(24, true);

  console.log('  Magic:', magic);
  console.log('  Version:', version);
  console.log('  总长度:', (byteLength / 1024).toFixed(2), 'KB');

  const featureTableOffset = 28;
  const featureTableJSON = buffer.slice(
    featureTableOffset,
    featureTableOffset + featureTableJSONByteLength
  ).toString('utf8');
  const featureTable = JSON.parse(featureTableJSON);

  console.log('\n📋 Feature Table:');
  console.log('  RTC_CENTER:', featureTable.RTC_CENTER);
  console.log('  BATCH_LENGTH:', featureTable.BATCH_LENGTH);

  const glbOffset = 28 +
    Math.ceil(featureTableJSONByteLength / 4) * 4 +
    featureTableBinaryByteLength +
    Math.ceil(batchTableJSONByteLength / 4) * 4 +
    batchTableBinaryByteLength;

  console.log('\n📍 GLB 数据偏移:', glbOffset);

  return {
    featureTable,
    glbData: buffer.slice(glbOffset),
    glbOffset
  };
}

// ============================================
// 5. 解析 GLB 并提取顶点
// ============================================

function parseGLBAndExtractVertices(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const totalLength = view.getUint32(8, true);

  let offset = 12;
  let jsonChunk = null;
  let binaryChunk = null;

  while (offset < totalLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = buffer.slice(offset + 4, offset + 8).toString('ascii').replace(/\0/g, '');

    if (chunkType === 'JSON') {
      jsonChunk = {
        length: chunkLength,
        data: buffer.slice(offset + 8, offset + 8 + chunkLength)
      };
    } else if (chunkType === 'BIN') {
      binaryChunk = {
        length: chunkLength,
        data: buffer.slice(offset + 8, offset + 8 + chunkLength)
      };
    }

    offset += 8 + chunkLength;
    offset = Math.ceil(offset / 4) * 4;
  }

  const gltf = JSON.parse(jsonChunk.data.toString('utf8'));

  let vertices = [];
  let totalVertexCount = 0;

  if (gltf.meshes && gltf.meshes.length > 0) {
    gltf.meshes.forEach((mesh) => {
      mesh.primitives.forEach((primitive) => {
        const positionAccessorIndex = primitive.attributes.POSITION;
        if (positionAccessorIndex === undefined) return;

        const positionAccessor = gltf.accessors[positionAccessorIndex];
        const positionBufferView = gltf.bufferViews[positionAccessor.bufferView];
        const positionDataOffset = (positionBufferView.byteOffset || 0) + (positionAccessor.byteOffset || 0);

        const vertexDataView = new DataView(
          binaryChunk.data.buffer,
          binaryChunk.data.byteOffset + positionDataOffset,
          positionAccessor.count * 12
        );

        const vertexCount = positionAccessor.count;
        totalVertexCount += vertexCount;

        // 自适应采样率：
        // - 顶点数 < 1000: 采样全部顶点
        // - 顶点数 >= 1000: 每 100 个顶点采样 1 个
        const sampleRate = vertexCount < 1000 ? 1 : 100;

        for (let i = 0; i < vertexCount; i += sampleRate) {
          const o = i * 12;
          const x = vertexDataView.getFloat32(o, true);
          const y = vertexDataView.getFloat32(o + 4, true);
          const z = vertexDataView.getFloat32(o + 8, true);
          vertices.push([x, y, z]);
        }
      });
    });
  }

  console.log('  模型总顶点数:', totalVertexCount);
  console.log('  采样顶点数:', vertices.length);

  return {
    jsonChunk,
    binaryChunk,
    gltf,
    vertices
  };
}

// ============================================
// 6. 应用旋转到顶点和法线
// ============================================

function applyRotation(matrix, x, y, z) {
  if (!matrix) return { x, y, z };
  return {
    x: matrix[0][0] * x + matrix[0][1] * y + matrix[0][2] * z,
    y: matrix[1][0] * x + matrix[1][1] * y + matrix[1][2] * z,
    z: matrix[2][0] * x + matrix[2][1] * y + matrix[2][2] * z
  };
}

function applyRotationToNormal(matrix, nx, ny, nz) {
  if (!matrix) return { x: nx, y: ny, z: nz };
  return {
    x: matrix[0][0] * nx + matrix[0][1] * ny + matrix[0][2] * nz,
    y: matrix[1][0] * nx + matrix[1][1] * ny + matrix[1][2] * nz,
    z: matrix[2][0] * nx + matrix[2][1] * ny + matrix[2][2] * nz
  };
}

// ============================================
// 7. 处理 GLB（应用旋转，更新 min/max）
// ============================================

function processGLBWithRotation(jsonChunk, binaryChunk, rotationMatrix) {
  const gltf = JSON.parse(jsonChunk.data.toString('utf8'));

  if (!gltf.meshes || gltf.meshes.length === 0) {
    return { gltf, modifiedBinaryChunk: binaryChunk };
  }

  const modifiedBinData = new Uint8Array(binaryChunk.data);

  gltf.meshes.forEach((mesh) => {
    mesh.primitives.forEach((primitive) => {
      const positionAccessorIndex = primitive.attributes.POSITION;
      const normalAccessorIndex = primitive.attributes.NORMAL;

      if (positionAccessorIndex === undefined) return;

      const positionAccessor = gltf.accessors[positionAccessorIndex];
      const normalAccessor = normalAccessorIndex !== undefined ? gltf.accessors[normalAccessorIndex] : null;

      const positionBufferView = gltf.bufferViews[positionAccessor.bufferView];
      const positionDataOffset = (positionBufferView.byteOffset || 0) + (positionAccessor.byteOffset || 0);

      const vertexDataView = new DataView(
        modifiedBinData.buffer,
        positionDataOffset,
        positionAccessor.count * 12
      );

      const vertexCount = positionAccessor.count;

      // 转换顶点并计算新的 min/max
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;

      for (let i = 0; i < vertexCount; i++) {
        const offset = i * 12;

        const ex = vertexDataView.getFloat32(offset, true);
        const ey = vertexDataView.getFloat32(offset + 4, true);
        const ez = vertexDataView.getFloat32(offset + 8, true);

        const { x, y, z } = applyRotation(rotationMatrix, ex, ey, ez);

        vertexDataView.setFloat32(offset, x, true);
        vertexDataView.setFloat32(offset + 4, y, true);
        vertexDataView.setFloat32(offset + 8, z, true);

        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
      }

      console.log(`  原始顶点范围: X[${minX.toFixed(2)}, ${maxX.toFixed(2)}] Y[${minY.toFixed(2)}, ${maxY.toFixed(2)}] Z[${minZ.toFixed(2)}, ${maxZ.toFixed(2)}]`);

      // 更新 accessor.min/max
      positionAccessor.min = [minX, minY, minZ];
      positionAccessor.max = [maxX, maxY, maxZ];

      // 转换法线
      if (normalAccessor) {
        const normalBufferView = gltf.bufferViews[normalAccessor.bufferView];
        const normalDataOffset = (normalBufferView.byteOffset || 0) + (normalAccessor.byteOffset || 0);

        const normalDataView = new DataView(
          modifiedBinData.buffer,
          normalDataOffset,
          normalAccessor.count * 12
        );

        for (let i = 0; i < normalAccessor.count; i++) {
          const offset = i * 12;
          const nx = normalDataView.getFloat32(offset, true);
          const ny = normalDataView.getFloat32(offset + 4, true);
          const nz = normalDataView.getFloat32(offset + 8, true);

          const { x: nx2, y: ny2, z: nz2 } = applyRotationToNormal(rotationMatrix, nx, ny, nz);

          normalDataView.setFloat32(offset, nx2, true);
          normalDataView.setFloat32(offset + 4, ny2, true);
          normalDataView.setFloat32(offset + 8, nz2, true);
        }
      }
    });
  });

  return {
    gltf,
    modifiedBinaryChunk: { data: modifiedBinData }
  };
}

// ============================================
// 8. 构建 GLB
// ============================================

function buildGLB(gltf, binaryChunk, outputPath) {
  const jsonStr = JSON.stringify(gltf);
  const jsonBuffer = Buffer.from(jsonStr, 'utf8');

  const jsonLength = jsonBuffer.length;
  const jsonPadding = (4 - (jsonLength % 4)) % 4;

  const binaryBuffer = Buffer.from(binaryChunk.data);
  const binaryLength = binaryBuffer.length;
  const binaryPadding = (4 - (binaryLength % 4)) % 4;

  const newTotalLength = 12 + 8 + jsonLength + jsonPadding + 8 + binaryLength + binaryPadding;

  const newBuffer = Buffer.alloc(newTotalLength);
  const view = new DataView(newBuffer.buffer);

  // GLB header
  newBuffer.write('glTF', 0);
  view.setUint32(4, 2, true);
  view.setUint32(8, newTotalLength, true);

  // JSON chunk
  view.setUint32(12, jsonLength + jsonPadding, true);
  newBuffer.write('JSON', 16);
  jsonBuffer.copy(newBuffer, 20);
  for (let i = 0; i < jsonPadding; i++) {
    newBuffer.write(' ', 20 + jsonLength + i);
  }

  // BIN chunk
  const binOffset = 12 + 8 + jsonLength + jsonPadding;
  view.setUint32(binOffset, binaryLength + binaryPadding, true);
  newBuffer.write('BIN', binOffset + 4);
  binaryBuffer.copy(newBuffer, binOffset + 8);
  for (let i = 0; i < binaryPadding; i++) {
    newBuffer.write('\x00', binOffset + 8 + binaryLength + i);
  }

  fs.writeFileSync(outputPath, newBuffer);
  console.log('\n💾 GLB 文件已保存:', path.basename(outputPath));
  console.log('   文件大小:', (newTotalLength / 1024).toFixed(2), 'KB');
}

// ============================================
// 9. 主程序
// ============================================

function main() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('  B3DM 转 GLB - PCA 自动贴地对齐');
    console.log('='.repeat(70));

    const inputFile = process.argv[2];
    if (!inputFile) {
      console.error('\n❌ 错误: 请指定输入的 B3DM 文件');
      console.error('\n使用方式:');
      console.error('  node convert-b3dm-ECEF-to-glb.js <input.b3dm> [output.glb]');
      console.error('\n示例:');
      console.error('  node convert-b3dm-ECEF-to-glb.js L16_10302.b3dm');
      console.error('  node convert-b3dm-ECEF-to-glb.js L15_12345.b3dm custom_output.glb');
      process.exit(1);
    }

    const inputPath = path.resolve(inputFile);
    const baseName = path.basename(inputFile, '.b3dm');
    const outputFile = process.argv[3] || path.join(path.dirname(inputPath), baseName + '_ECEF_to_ThreeJS.glb');

    console.log('\n📋 输入参数:');
    console.log('  输入文件:', inputFile);
    console.log('  输出文件:', path.basename(outputFile));

    // 步骤 1: 解析 B3DM
    console.log('\n' + '-'.repeat(70));
    console.log('步骤 1: 解析 B3DM 文件');
    console.log('-'.repeat(70));
    const b3dm = parseB3DM(inputPath);

    // 步骤 2: 提取地理位置
    console.log('\n' + '-'.repeat(70));
    console.log('步骤 2: 提取地理位置信息');
    console.log('-'.repeat(70));
    let geolocation = null;
    if (b3dm.featureTable.RTC_CENTER) {
      const rtc = b3dm.featureTable.RTC_CENTER;
      geolocation = convertCartesianToCartographic(rtc[0], rtc[1], rtc[2]);

      console.log('\n📍 RTC_CENTER (ECEF 坐标):');
      console.log(`  X: ${rtc[0].toFixed(2)} 米`);
      console.log(`  Y: ${rtc[1].toFixed(2)} 米`);
      console.log(`  Z: ${rtc[2].toFixed(2)} 米`);

      console.log('\n🌍 地理位置 (经纬度):');
      console.log(`  经度: ${geolocation.longitude.toFixed(6)}°`);
      console.log(`  纬度: ${geolocation.latitude.toFixed(6)}°`);
      console.log(`  高度: ${geolocation.altitude.toFixed(2)} 米`);
    }

    // 步骤 3: 解析 GLB 并提取顶点
    console.log('\n' + '-'.repeat(70));
    console.log('步骤 3: 分析顶点数据');
    console.log('-'.repeat(70));
    const { jsonChunk, binaryChunk, gltf, vertices } = parseGLBAndExtractVertices(b3dm.glbData);

    // 步骤 4: PCA 分析
    console.log('\n' + '-'.repeat(70));
    console.log('步骤 4: PCA 主成分分析（计算模型主方向）');
    console.log('-'.repeat(70));
    const pcaResult = computePCA(vertices);

    // 步骤 5: 计算贴地旋转矩阵
    console.log('\n' + '-'.repeat(70));
    console.log('步骤 5: 计算贴地对齐旋转矩阵');
    console.log('-'.repeat(70));
    const rotationMatrix = computeGroundAlignmentRotation(pcaResult);

    if (!rotationMatrix) {
      console.log('\n⚠️ 模型已经对齐，无需旋转');
      return;
    }

    // 步骤 6: 应用旋转到几何体
    console.log('\n' + '-'.repeat(70));
    console.log('步骤 6: 应用 PCA 旋转变换');
    console.log('-'.repeat(70));
    const { gltf: modifiedGLTF, modifiedBinaryChunk } = processGLBWithRotation(
      jsonChunk,
      binaryChunk,
      rotationMatrix
    );

    // 步骤 7: 添加元数据
    console.log('\n' + '-'.repeat(70));
    console.log('步骤 7: 添加元数据');
    console.log('-'.repeat(70));
    if (!modifiedGLTF.asset) modifiedGLTF.asset = {};
    if (!modifiedGLTF.asset.extras) modifiedGLTF.asset.extras = {};

    // B3DM 元数据（包含 RTC_CENTER 和地理位置信息）
    if (b3dm.featureTable.RTC_CENTER) {
      modifiedGLTF.asset.extras._b3dm = {
        rtcCenter: b3dm.featureTable.RTC_CENTER,
        batchLength: b3dm.featureTable.BATCH_LENGTH || 0,
        // 将地理位置信息嵌入到 _b3dm 对象内部
        // 这样 DualCanvasViewer.vue 可以直接读取 _b3dm.geolocation
        geolocation: geolocation ? {
          longitude: geolocation.longitude,
          latitude: geolocation.latitude,
          altitude: geolocation.altitude,
          source: 'B3DM_RTC_CENTER_AUTO_CONVERTED'
        } : undefined,
        geometryTransformed: true
      };
    }

    // 保留旧的 _geolocation 字段以保持向后兼容
    if (geolocation) {
      modifiedGLTF.asset.extras._geolocation = {
        longitude: geolocation.longitude,
        latitude: geolocation.latitude,
        altitude: geolocation.altitude,
        source: 'B3DM_RTC_CENTER'
      };
    }

    // 坐标转换信息
    modifiedGLTF.asset.extras._axisConversion = {
      method: 'PCA_Ground_Alignment',
      description: 'Automatic ground alignment using Principal Component Analysis',
      pcaEigenvalues: pcaResult.eigenvalues,
      pcaEigenvectors: pcaResult.eigenvectors,
      rotationMatrix: rotationMatrix,
      geometryTransformed: true,
      fixDate: new Date().toISOString()
    };

    console.log('✅ 元数据已添加:');
    console.log('  _b3dm.rtcCenter:', b3dm.featureTable.RTC_CENTER);
    if (geolocation) {
      console.log('  _b3dm.geolocation:', {
        longitude: geolocation.longitude.toFixed(6) + '°',
        latitude: geolocation.latitude.toFixed(6) + '°',
        altitude: geolocation.altitude.toFixed(2) + 'm',
        source: 'B3DM_RTC_CENTER_AUTO_CONVERTED'
      });
      console.log('  _geolocation (向后兼容):', {
        longitude: geolocation.longitude.toFixed(6) + '°',
        latitude: geolocation.latitude.toFixed(6) + '°',
        altitude: geolocation.altitude.toFixed(2) + 'm'
      });
    }

    // 步骤 8: 构建输出 GLB
    console.log('\n' + '-'.repeat(70));
    console.log('步骤 8: 构建输出文件');
    console.log('-'.repeat(70));
    buildGLB(modifiedGLTF, modifiedBinaryChunk, outputFile);

    // 完成
    console.log('\n' + '='.repeat(70));
    console.log('🎉 转换完成！');
    console.log('='.repeat(70));
    console.log('\n📄 输出文件:', path.basename(outputFile));
    console.log('\n💡 说明:');
    console.log('  ✅ 模型已通过 PCA 自动贴地对齐');
    console.log('  ✅ 法线和边界框已重新计算');
    console.log('  ✅ 保留了原始 RTC_CENTER（ECEF 坐标）');
    console.log('  ✅ 添加了地理位置信息');
    console.log('  ✅ 可以被 DualCanvasViewer 正确加载');

  } catch (error) {
    console.error('\n❌ 转换失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行主程序
if (require.main === module) {
  main();
}
