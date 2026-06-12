// B3DM 转 GLB - 批量层级转换工具
// 功能：
// 1. 列出 tileset 中所有可用层级
// 2. 按指定层级批量转换所有 B3DM 文件
// 3. 自动识别 ECEF 坐标类型
//
// 使用方式：
//   # 列出所有可用层级
//   node convert-b3dm-batch.js <tileset_url> --list-levels
//
//   # 转换指定层级的所有文件
//   node convert-b3dm-batch.js <tileset_url> --level L21
//
//   # 转换多个层级
//   node convert-b3dm-batch.js <tileset_url> --level L21,L22
//
//   # 转换所有层级
//   node convert-b3dm-batch.js <tileset_url> --all
//
//   # 转换时禁用地面对齐旋转（适用于桥梁等架空结构）
//   node convert-b3dm-batch.js <tileset_url> --level L21 --no-rotation
//
// 示例：
//   node convert-b3dm-batch.js https://.../tileset.json --list-levels
//   node convert-b3dm-batch.js https://.../tileset.json --level L21
//   node convert-b3dm-batch.js https://.../JiAn1_merge.json --all
//   node convert-b3dm-batch.js https://.../bridge3D/tileset.json --level L18 --no-rotation

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const url = require('url');

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
// 2. ECEF 到 ENU 基向量计算（用于ENU补偿信息记录）
// ============================================

/**
 * 计算 ECEF 到 ENU 的变换基向量
 * @param {number} lon - 经度（弧度）
 * @param {number} lat - 纬度（弧度）
 * @returns {Object} ENU基向量
 */
function buildENUBasis(lon, lat) {
  const sinLon = Math.sin(lon);
  const cosLon = Math.cos(lon);
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);

  // ENU 基向量
  return {
    east: [-sinLon, cosLon, 0],
    north: [-sinLat * cosLon, -sinLat * sinLon, cosLat],
    up: [cosLat * cosLon, cosLat * sinLon, sinLat]
  };
}

/**
 * 生成ENU补偿信息（只记录贴地旋转方向，不包括UP方向）
 * @param {Array} ecefPosition - ECEF位置 [x, y, z]
 * @param {Object} geolocation - 地理位置信息
 * @returns {Object} ENU补偿信息
 */
function generateENUCompensationInfo(ecefPosition, geolocation) {
  const lon = geolocation.longitude * Math.PI / 180;
  const lat = geolocation.latitude * Math.PI / 180;
  
  const enuBasis = buildENUBasis(lon, lat);
  
  return {
    ecefPosition: ecefPosition,
    enuOrigin: ecefPosition,
    compensationMatrix: {
      ecefToENU: [enuBasis.east, enuBasis.north, enuBasis.up],  // ⭐ 修复：转换为数组格式
      // ⭐ 关键说明：这个矩阵用于消除从ECEF到ENU转换时的旋转偏差
      // 在局部坐标系模式下，模型已经通过取反轴等方式解决了UP方向的贴地问题
      // 因此只需要应用水平面（垂直于UP方向）的补偿即可
      // 加载时可以根据需要选择性地使用这个补偿信息
      useOnlyHorizontal: true  // 标记只使用水平面补偿
    },
    notes: 'ENU补偿信息仅用于贴地旋转方向对齐，UP方向已通过转换过程处理'
  };
}

// ============================================
// 2. HTTPS GET 包装器
// ============================================

function httpsGet(urlStr) {
  return new Promise((resolve, reject) => {
    const protocol = urlStr.startsWith('https') ? https : http;
    protocol.get(urlStr, (res) => {
      let data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(Buffer.concat(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
      });
    }).on('error', reject);
  });
}

// ============================================
// 3. 解析 B3DM
// ============================================

function parseB3DM(filePath) {
  const buffer = fs.readFileSync(filePath);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  const magic = buffer.slice(0, 4).toString('ascii');
  const version = view.getUint32(4, true);
  const byteLength = view.getUint32(8, true);
  const featureTableJSONByteLength = view.getUint32(12, true);
  const batchTableJSONByteLength = view.getUint32(20, true);

  const featureTableOffset = 28;
  const featureTableJSON = buffer.slice(
    featureTableOffset,
    featureTableOffset + featureTableJSONByteLength
  ).toString('utf8');
  const featureTable = JSON.parse(featureTableJSON);

  const glbOffset = 28 +
    Math.ceil(featureTableJSONByteLength / 4) * 4 +
    view.getUint32(16, true) +
    Math.ceil(batchTableJSONByteLength / 4) * 4 +
    view.getUint32(24, true);

  return {
    featureTable,
    glbData: buffer.slice(glbOffset),
    fullBuffer: buffer
  };
}

// ============================================
// 4. 修复 B3DM RTC_CENTER
// ============================================

function patchB3DMRTC(buffer, ecefPosition) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const featureTableJSONByteLength = view.getUint32(12, true);
  const featureTableOffset = 28;
  const featureTableJSON = buffer.slice(featureTableOffset, featureTableOffset + featureTableJSONByteLength).toString('utf8');
  let featureTable = JSON.parse(featureTableJSON);

  const originalRTC = featureTable.RTC_CENTER;
  featureTable.RTC_CENTER = ecefPosition;

  const newFeatureTableJSON = JSON.stringify(featureTable);
  const jsonLength = newFeatureTableJSON.length;

  let finalJSON = newFeatureTableJSON;
  if (jsonLength < featureTableJSONByteLength) {
    const paddingNeeded = featureTableJSONByteLength - jsonLength;
    const lastBraceIndex = newFeatureTableJSON.lastIndexOf('}');
    finalJSON = newFeatureTableJSON.slice(0, lastBraceIndex) +
                ' '.repeat(paddingNeeded) +
                newFeatureTableJSON.slice(lastBraceIndex);
  }

  const newBuffer = Buffer.from(buffer);
  Buffer.from(finalJSON).copy(newBuffer, featureTableOffset);

  return { buffer: newBuffer, originalRTC };
}

// ============================================
// 5. 遍历 tileset 树，收集所有 B3DM 文件（支持嵌套 tileset）
// ============================================

async function collectB3DMFiles(node, baseUrl = '', result = { levels: {}, totalCount: 0 }, visited = new Set(), targetLevels = null) {
  if (!node) return result;

  // 如果指定了目标层级，计算最大层级数字用于过滤
  let maxTargetLevelNum = null;
  if (targetLevels && targetLevels.length > 0) {
    maxTargetLevelNum = Math.max(...targetLevels.map(l => parseInt(l.replace('L', ''))));
  }

  // 检查当前节点是否有内容
  if (node.content && node.content.uri) {
    const uri = node.content.uri;

    // 如果是 .json 文件（嵌套 tileset），检查是否需要加载
    if (uri.endsWith('.json')) {
      // 从文件名中提取层级信息
      const levelMatch = uri.match(/L(\d+)/);
      const fileLevel = levelMatch ? parseInt(levelMatch[1]) : null;

      // 如果指定了目标层级，且文件层级高于目标层级最大值，跳过加载
      if (maxTargetLevelNum && fileLevel && fileLevel > maxTargetLevelNum) {
        console.log(`  ⏭️  跳过高层级 tileset: ${uri} (L${fileLevel} > L${maxTargetLevelNum})`);
        return result;
      }

      // 处理 URL 编码：将 + 替换为 %2B
      const encodedUri = uri.replace(/\+/g, '%2B');
      const fullPath = baseUrl + encodedUri;
      // 避免重复加载
      if (visited.has(fullPath)) {
        console.log(`  ⏭️  跳过已加载: ${uri}`);
      } else {
        visited.add(fullPath);
        try {
          console.log(`  📂 加载子 tileset: ${uri}`);
          const subTilesetData = await httpsGet(fullPath);
          const subTileset = JSON.parse(subTilesetData.toString());
          // 递归处理子 tileset
          const subBaseUrl = fullPath.replace(/[^/]*$/, '');
          await collectB3DMFiles(subTileset.root, subBaseUrl, result, visited, targetLevels);
        } catch (error) {
          console.warn(`  ⚠️  无法加载子 tileset: ${uri} - ${error.message}`);
        }
      }
    }
    // 如果是 .b3dm 文件，添加到结果
    else if (uri.endsWith('.b3dm')) {
      // 从文件名中提取层级信息
      const levelMatch = uri.match(/L(\d+)/);
      const level = levelMatch ? `L${levelMatch[1]}` : 'Unknown';

      // 如果指定了目标层级，只收集目标层级（继续处理，不要返回）
      if (targetLevels && targetLevels.length > 0 && !targetLevels.includes(level)) {
        // 跳过非目标层级的文件，但继续处理其他节点
      } else {
        if (!result.levels[level]) {
          result.levels[level] = [];
        }

        // 处理 URL 编码：将 + 替换为 %2B
        const encodedUri = uri.replace(/\+/g, '%2B');
        const fullPath = baseUrl + encodedUri;
        result.levels[level].push({
          uri: uri,
          url: fullPath,
          geometricError: node.geometricError || 0
        });
        result.totalCount++;
      }
    }
  }

  // 递归处理子节点
  if (node.children) {
    for (const child of node.children) {
      await collectB3DMFiles(child, baseUrl, result, visited, targetLevels);
    }
  }

  return result;
}

// ============================================
// 6. 列出所有可用层级
// ============================================

function listLevels(collection) {
  console.log('\n' + '='.repeat(70));
  console.log('  可用层级统计');
  console.log('='.repeat(70));

  const sortedLevels = Object.keys(collection.levels).sort((a, b) => {
    if (a === 'Unknown') return 1;
    if (b === 'Unknown') return -1;
    const levelA = parseInt(a.replace('L', ''));
    const levelB = parseInt(b.replace('L', ''));
    return levelA - levelB;
  });

  console.log('\n📊 层级分布:');
  console.log('  层级     | 文件数 | 说明');
  console.log('  ' + '-'.repeat(50));

  let totalFiles = 0;
  for (const level of sortedLevels) {
    const files = collection.levels[level];
    const levelNum = level === 'Unknown' ? '?' : level.replace('L', '');
    const desc = level === 'Unknown' ? '未知层级' : `层级 ${levelNum}`;
    console.log(`  ${level.padEnd(8)} | ${String(files.length).padStart(6)} | ${desc}`);
    totalFiles += files.length;
  }

  console.log('  ' + '-'.repeat(50));
  console.log(`  总计     | ${String(totalFiles).padStart(6)} |`);

  console.log('\n💡 说明:');
  console.log('  • 层级数字越大，数据越精细，覆盖范围越小');
  console.log('  • L10-L14: 大范围概览数据（几公里范围）');
  console.log('  • L15-L18: 中等精度数据（几百米范围）');
  console.log('  • L19-L23: 高精度数据（几十米范围）');

  console.log('\n🎯 使用建议:');
  console.log('  node convert-b3dm-batch.js <tileset_url> --level L21');
  console.log('  node convert-b3dm-batch.js <tileset_url> --level L20,L21,L22');
}

// ============================================
// 7. PCA 主成分分析
// ============================================

function computePCA(vertices) {
  const n = vertices.length;

  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < n; i++) {
    cx += vertices[i][0];
    cy += vertices[i][1];
    cz += vertices[i][2];
  }
  cx /= n;
  cy /= n;
  cz /= n;

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
// 8. 计算贴地旋转矩阵
// ============================================

function computeGroundAlignmentRotation(pcaResult) {
  const { eigenvectors } = pcaResult;

  let normal = eigenvectors[2];
  const targetNormal = [0, 1, 0];

  if (normal[1] < 0) {
    normal = [-normal[0], -normal[1], -normal[2]];
  }

  const axis = [
    normal[1] * targetNormal[2] - normal[2] * targetNormal[1],
    normal[2] * targetNormal[0] - normal[0] * targetNormal[2],
    normal[0] * targetNormal[1] - normal[1] * targetNormal[0]
  ];

  const axisLength = Math.sqrt(axis[0] * axis[0] + axis[1] * axis[1] + axis[2] * axis[2]);

  if (axisLength < 1e-10) {
    return null;
  }

  axis[0] /= axisLength;
  axis[1] /= axisLength;
  axis[2] /= axisLength;

  const dot = normal[0] * targetNormal[0] + normal[1] * targetNormal[1] + normal[2] * targetNormal[2];
  const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;

  // 旋转矩阵：将法线旋转到 Y 轴（保证模型平行于地面）
  const rotationMatrix = [
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

  // ⭐ 添加镜面翻转：绕法线方向旋转 180°（上下翻转）
  // 这相当于对垂直于法线的平面做镜像
  // 简单实现：直接取反所有轴（相当于 180° 旋转）
  return [
    [-rotationMatrix[0][0], -rotationMatrix[0][1], -rotationMatrix[0][2]],
    [-rotationMatrix[1][0], -rotationMatrix[1][1], -rotationMatrix[1][2]],
    [-rotationMatrix[2][0], -rotationMatrix[2][1], -rotationMatrix[2][2]]
  ];
}

// ============================================
// 9. 解析 GLB 并提取顶点
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

  return {
    jsonChunk,
    binaryChunk,
    gltf,
    vertices
  };
}

// ============================================
// 10. 应用旋转
// ============================================

function applyRotation(matrix, x, y, z) {
  if (!matrix) return { x, y, z };
  return {
    x: matrix[0][0] * x + matrix[0][1] * y + matrix[0][2] * z,
    y: matrix[1][0] * x + matrix[1][1] * y + matrix[1][2] * z,
    z: matrix[2][0] * x + matrix[2][1] * y + matrix[2][2] * z
  };
}

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

      positionAccessor.min = [minX, minY, minZ];
      positionAccessor.max = [maxX, maxY, maxZ];

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

          const { x: nx2, y: ny2, z: nz2 } = applyRotation(rotationMatrix, nx, ny, nz);

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
// 11. 构建 GLB
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

  newBuffer.write('glTF', 0);
  view.setUint32(4, 2, true);
  view.setUint32(8, newTotalLength, true);

  view.setUint32(12, jsonLength + jsonPadding, true);
  newBuffer.write('JSON', 16);
  jsonBuffer.copy(newBuffer, 20);
  for (let i = 0; i < jsonPadding; i++) {
    newBuffer.write(' ', 20 + jsonLength + i);
  }

  const binOffset = 12 + 8 + jsonLength + jsonPadding;
  view.setUint32(binOffset, binaryLength + binaryPadding, true);
  newBuffer.write('BIN', binOffset + 4);
  binaryBuffer.copy(newBuffer, binOffset + 8);
  for (let i = 0; i < binaryPadding; i++) {
    newBuffer.write('\x00', binOffset + 8 + binaryLength + i);
  }

  fs.writeFileSync(outputPath, newBuffer);
}

// ============================================
// 12. 转换单个 B3DM 文件
// ============================================

async function convertB3DM(b3dmInfo, ecefPosition, outputDir, quiet = false) {
  const fileName = path.basename(b3dmInfo.uri, '.b3dm');
  const outputPath = path.join(outputDir, fileName + '_ECEF_to_ThreeJS.glb');

  if (!quiet) {
    console.log(`\n🔄 转换: ${fileName}`);
  }

  try {
    // 下载 B3DM
    const b3dmData = await httpsGet(b3dmInfo.url);
    const tempB3dm = path.join(outputDir, fileName + '_temp.b3dm');
    fs.writeFileSync(tempB3dm, b3dmData);

    // 如果需要修复 RTC_CENTER
    let workingBuffer = b3dmData;
    let finalECEF = ecefPosition;

    if (ecefPosition) {
      const { buffer: patchedBuffer, originalRTC } = patchB3DMRTC(b3dmData, ecefPosition);
      workingBuffer = patchedBuffer;
      // ⭐ 关键修复：使用修复后的 buffer 重新写入临时文件，后续解析使用修复后的数据
      fs.writeFileSync(tempB3dm, workingBuffer);
      console.log(`  🔧 RTC_CENTER 已修复: [${originalRTC.map(v => v.toFixed(2)).join(', ')}] → [${ecefPosition.map(v => v.toFixed(2)).join(', ')}]`);
    } else {
      // 从 B3DM 中提取 ECEF
      const b3dm = parseB3DM(tempB3dm);
      finalECEF = b3dm.featureTable.RTC_CENTER;
      console.log(`  📍 从 B3DM 提取 RTC_CENTER: [${finalECEF.map(v => v.toFixed(2)).join(', ')}]`);
    }

    // 解析 B3DM 获取 GLB 数据
    const b3dm = parseB3DM(tempB3dm);
    const { jsonChunk, binaryChunk, gltf, vertices } = parseGLBAndExtractVertices(b3dm.glbData);

    // ⭐ 调试信息：输出顶点数据统计
    if (!quiet) {
      console.log(`  📊 顶点统计: 总数=${vertices.length}, 采样率=${vertices.length < 1000 ? 1 : 100}`);

      // 计算顶点范围
      if (vertices.length > 0) {
        const minX = Math.min(...vertices.map(v => v[0]));
        const maxX = Math.max(...vertices.map(v => v[0]));
        const minY = Math.min(...vertices.map(v => v[1]));
        const maxY = Math.max(...vertices.map(v => v[1]));
        const minZ = Math.min(...vertices.map(v => v[2]));
        const maxZ = Math.max(...vertices.map(v => v[2]));

        console.log(`  📐 顶点范围:`);
        console.log(`     X: [${minX.toFixed(2)}, ${maxX.toFixed(2)}]`);
        console.log(`     Y: [${minY.toFixed(2)}, ${maxY.toFixed(2)}]`);
        console.log(`     Z: [${minZ.toFixed(2)}, ${maxZ.toFixed(2)}]`);
      }
    }

    // PCA 分析
    const pcaResult = computePCA(vertices);

    // ⭐ 自动检测架空结构（桥梁、建筑物等）
    // 判断标准：
    // 1. Y轴范围跨越地面（minY < 0 且 maxY > 0）
    // 2. 三个特征值都比较接近（说明是3D结构而非近似平面的地形）
    const autoDetectOverhead = () => {
      if (vertices.length < 10) return false; // 顶点太少，不判断

      const minY = Math.min(...vertices.map(v => v[1]));
      const maxY = Math.max(...vertices.map(v => v[1]));
      const eigenvalues = pcaResult.eigenvalues;

      // 判断1: Y轴跨越地面
      const spansGround = minY < -2 && maxY > 2; // 至少2米的容差

      // 判断2: 特征值比值（第三个特征值不应太小）
      const ratio3to1 = eigenvalues[2] / eigenvalues[0];
      const is3DStructure = ratio3to1 > 0.1; // 第三主成分至少是第一主成分的10%

      // 判断3: Y轴跨度相对较大（架空结构在垂直方向有显著高度）
      const yRange = maxY - minY;
      const xRange = Math.max(...vertices.map(v => v[0])) - Math.min(...vertices.map(v => v[0]));
      const zRange = Math.max(...vertices.map(v => v[2])) - Math.min(...vertices.map(v => v[2]));
      const maxHorizontalRange = Math.max(xRange, zRange);
      const hasVerticalHeight = yRange > maxHorizontalRange * 0.3; // Y轴跨度至少是水平跨度的30%

      return spansGround && is3DStructure && hasVerticalHeight;
    };

    const isOverheadStructure = autoDetectOverhead();

    if (!quiet) {
      console.log(`  🎯 PCA 主成分:`);
      console.log(`     特征值: [${pcaResult.eigenvalues.map(v => v.toFixed(4)).join(', ')}]`);
      console.log(`     主方向1: [${pcaResult.eigenvectors[0].map(v => v.toFixed(4)).join(', ')}]`);
      console.log(`     主方向2: [${pcaResult.eigenvectors[1].map(v => v.toFixed(4)).join(', ')}]`);
      console.log(`     主方向3: [${pcaResult.eigenvectors[2].map(v => v.toFixed(4)).join(', ')}]`);

      // 输出检测详情
      const minY = Math.min(...vertices.map(v => v[1]));
      const maxY = Math.max(...vertices.map(v => v[1]));
      const ratio3to1 = pcaResult.eigenvalues[2] / pcaResult.eigenvalues[0];
      const yRange = maxY - minY;
      const xRange = Math.max(...vertices.map(v => v[0])) - Math.min(...vertices.map(v => v[0]));
      const zRange = Math.max(...vertices.map(v => v[2])) - Math.min(...vertices.map(v => v[2]));

      console.log(`  🔍 架空结构检测:`);
      console.log(`     Y轴跨越地面: ${minY < -2 && maxY > 2 ? '✓' : '✗'} (${minY.toFixed(2)} to ${maxY.toFixed(2)})`);
      console.log(`     3D结构: ${ratio3to1 > 0.1 ? '✓' : '✗'} (比值: ${ratio3to1.toFixed(4)})`);
      console.log(`     垂直高度显著: ${yRange > Math.max(xRange, zRange) * 0.3 ? '✓' : '✗'} (Y: ${yRange.toFixed(2)}, 水平: ${Math.max(xRange, zRange).toFixed(2)})`);
    }

    // ⭐ 根据检测结果决定是否应用旋转
    let rotationMatrix = null;
    if (isOverheadStructure) {
      if (!quiet) {
        console.log(`  ⏭️  检测到架空结构（桥梁/建筑物等），跳过地面对齐旋转`);
      }
    } else {
      rotationMatrix = computeGroundAlignmentRotation(pcaResult);
      if (!quiet) {
        if (rotationMatrix) {
          console.log(`  🔄 应用地面对齐旋转`);
        } else {
          console.log(`  ⚠️  跳过地面对齐旋转（法线已是 Y 轴方向）`);
        }
      }
    }

    // 应用旋转
    let { gltf: modifiedGLTF, modifiedBinaryChunk } = processGLBWithRotation(
      jsonChunk,
      binaryChunk,
      rotationMatrix
    );

    // 添加元数据
    if (!modifiedGLTF.asset) modifiedGLTF.asset = {};
    if (!modifiedGLTF.asset.extras) modifiedGLTF.asset.extras = {};

    const geolocation = convertCartesianToCartographic(...finalECEF);
    let finalAltitude = geolocation.altitude;
    let originalAltitude = geolocation.altitude;
    if (finalAltitude < 0) {
      finalAltitude = 0;
    }

    modifiedGLTF.asset.extras._b3dm = {
      rtcCenter: finalECEF,
      batchLength: b3dm.featureTable.BATCH_LENGTH || 0,
      geolocation: {
        longitude: geolocation.longitude,
        latitude: geolocation.latitude,
        altitude: finalAltitude,
        originalAltitude: originalAltitude,
        source: 'BATCH_CONVERT'
      },
      geometryTransformed: !!rotationMatrix
    };

    modifiedGLTF.asset.extras._geolocation = {
      longitude: geolocation.longitude,
      latitude: geolocation.latitude,
      altitude: finalAltitude,
      source: 'BATCH_CONVERT'
    };

    if (rotationMatrix) {
      modifiedGLTF.asset.extras._axisConversion = {
        method: 'PCA_Ground_Alignment',
        rotationMatrix: rotationMatrix,
        geometryTransformed: true,
        fixDate: new Date().toISOString()
      };
    }

    // ⭐ 添加ENU补偿信息（仅记录，不应用旋转）
    // 说明：模型通过取反轴转换已经贴地，UP方向无需补偿
    // 此补偿信息用于加载时的水平面旋转对齐
    const enuCompensation = generateENUCompensationInfo(finalECEF, geolocation);
    modifiedGLTF.asset.extras._enuRotationCompensation = enuCompensation;

    // 构建 GLB
    buildGLB(modifiedGLTF, modifiedBinaryChunk, outputPath);

    // 清理临时文件
    fs.unlinkSync(tempB3dm);

    if (!quiet) {
      console.log(`  ✅ 已保存: ${path.basename(outputPath)}`);
    }
    return { success: true, file: outputPath };
  } catch (error) {
    if (!quiet) {
      console.log(`  ❌ 失败: ${error.message}`);
    }
    return { success: false, error: error.message };
  }
}

// ============================================
// 8. 批量转换指定层级
// ============================================

async function convertLevels(tilesetUrl, collection, levelsToConvert, outputDir = './output') {
  // 创建输出目录
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 获取 ECEF 位置（从 tileset transform 或第一个 B3DM）
  let ecefPosition = null;

  // 尝试从 tileset 获取 transform
  try {
    const tilesetData = await httpsGet(tilesetUrl);
    const tileset = JSON.parse(tilesetData.toString());

    if (tileset.root && tileset.root.transform) {
      ecefPosition = [
        tileset.root.transform[12],
        tileset.root.transform[13],
        tileset.root.transform[14]
      ];
    }
  } catch (error) {
    console.warn('⚠️  无法获取 tileset transform，将从 B3DM 文件中提取');
  }

  console.log('\n' + '='.repeat(70));
  console.log('  批量转换');
  console.log('='.repeat(70));
  console.log('\n📍 ECEF 位置:', ecefPosition ? ecefPosition.map(v => v.toFixed(2)).join(', ') : '待提取');
  console.log('📁 输出目录:', outputDir);
  console.log();

  // 统计
  let totalFiles = 0;
  let successCount = 0;
  let failCount = 0;

  // 按层级转换
  for (const level of levelsToConvert) {
    if (!collection.levels[level]) {
      console.log(`⚠️  警告: 层级 ${level} 不存在`);
      continue;
    }

    const files = collection.levels[level];
    console.log(`\n📦 处理层级 ${level} (${files.length} 个文件)`);
    console.log('  ' + '-'.repeat(60));

    for (const b3dmInfo of files) {
      totalFiles++;
      const result = await convertB3DM(b3dmInfo, ecefPosition, outputDir);
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    }
  }

  // 总结
  console.log('\n' + '='.repeat(70));
  console.log('  转换完成');
  console.log('='.repeat(70));
  console.log(`\n📊 统计:`);
  console.log(`  总文件数: ${totalFiles}`);
  console.log(`  成功: ${successCount}`);
  console.log(`  失败: ${failCount}`);
  console.log(`  输出目录: ${outputDir}`);
}

// ============================================
// 9. 主程序
// ============================================

async function main() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('  B3DM 转 GLB - 批量层级转换工具');
    console.log('='.repeat(70));

    const args = process.argv.slice(2);

    if (args.length < 2) {
      console.error('\n❌ 错误: 请提供 tileset URL 和操作参数');
      console.error('\n使用方式:');
      console.error('  # 列出所有可用层级');
      console.error('  node convert-b3dm-batch.js <tileset_url> --list-levels');
      console.error('\n  # 转换指定层级的所有文件');
      console.error('  node convert-b3dm-batch.js <tileset_url> --level L21');
      console.error('\n  # 转换多个层级');
      console.error('  node convert-b3dm-batch.js <tileset_url> --level L20,L21,L22');
      console.error('\n  # 转换所有层级');
      console.error('  node convert-b3dm-batch.js <tileset_url> --all');
      console.error('\n示例:');
      console.error('  node convert-b3dm-batch.js https://.../tileset.json --list-levels');
      console.error('  node convert-b3dm-batch.js https://.../tileset.json --level L21');
      console.error('  node convert-b3dm-batch.js https://.../JiAn1_merge.json --all');
      process.exit(1);
    }

    const tilesetUrl = args[0];
    const operation = args[1];

    // 解析参数选项
    const parsedArgs = {
      levels: null,
      outputDir: './output'
    };

    for (let i = 2; i < args.length; i++) {
      if (args[i] === '--output' && i + 1 < args.length) {
        parsedArgs.outputDir = args[i + 1];
        i++; // 跳过下一个参数（输出目录）
      } else if (args[i] === '--level' && i + 1 < args.length) {
        parsedArgs.levels = args[i + 1].split(',').map(l => l.trim());
        i++; // 跳过下一个参数（层级列表）
      } else if (args[i].startsWith('--')) {
        // 其他选项
        i++;
      } else if (!parsedArgs.levels && operation === '--level') {
        // 层级参数（如果没有用 --level 指定）
        parsedArgs.levels = args[i].split(',').map(l => l.trim());
      }
    }

    // 下载并解析 tileset
    console.log('\n🌐 正在下载 tileset...');
    const tilesetData = await httpsGet(tilesetUrl);
    const tileset = JSON.parse(tilesetData.toString());
    console.log('✅ tileset 已加载');

    // 获取基础 URL（用于构建完整的 B3DM URL）
    const baseUrl = tilesetUrl.replace(/[^/]*$/, '');

    // 收集所有 B3DM 文件
    console.log('\n🔍 正在分析 tileset 结构...');
    let targetLevels = parsedArgs.levels;
    if (targetLevels) {
      console.log(`🎯 目标层级: ${targetLevels.join(', ')}`);
    }
    const collection = await collectB3DMFiles(tileset.root, baseUrl, { levels: {}, totalCount: 0 }, new Set(), targetLevels);
    console.log(`✅ 找到 ${collection.totalCount} 个 B3DM 文件`);

    // 根据操作类型执行
    if (operation === '--list-levels') {
      listLevels(collection);
    } else if (operation === '--level') {
      const levels = parsedArgs.levels;
      if (!levels || levels.length === 0 || levels[0] === '') {
        console.error('\n❌ 错误: 请指定要转换的层级');
        console.error('\n示例:');
        console.error('  node convert-b3dm-batch.js <tileset_url> --level L21');
        console.error('  node convert-b3dm-batch.js <tileset_url> --level L20,L21,L22');
        process.exit(1);
      }

      await convertLevels(tilesetUrl, collection, levels, parsedArgs.outputDir);
    } else if (operation === '--all') {
      const allLevels = Object.keys(collection.levels).filter(l => l !== 'Unknown');
      await convertLevels(tilesetUrl, collection, allLevels, parsedArgs.outputDir);
    } else {
      console.error('\n❌ 错误: 未知的操作:', operation);
      console.error('\n支持的操作:');
      console.error('  --list-levels   列出所有可用层级');
      console.error('  --level Lxx     转换指定层级');
      console.error('  --all           转换所有层级');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行主程序
if (require.main === module) {
  main();
}
