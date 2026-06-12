# 🚀 快速开始：处理江西吉安 DEM 数据

## 📍 当前状态

- ✅ 数据已下载：`ASTGTM_N26E114M.img` (19MB)
- ✅ 处理脚本已准备：`process_terrain_complete.sh`
- ⚠️ 需要手动执行（需要 sudo 密码）

---

## 🎯 三种执行方式

### 方式 A：在终端中执行（推荐）

**打开终端，执行以下命令**：

```bash
cd /home/tang/Documents/code/woonuxt-master01/cesiumBase/public
sudo bash process_terrain_complete.sh
```

输入密码后，脚本会自动完成所有处理。

---

### 方式 B：分步执行（如需调试）

```bash
cd /home/tang/Documents/code/woonuxt-master01/cesiumBase/public

# 1. 安装 GDAL
sudo apt update
sudo apt install -y gdal-bin libgdal-dev

# 2. 转换格式
gdal_translate -of GTiff -co COMPRESS=LZW ASTGTM_N26E114M.img ji_an.tif

# 3. 创建输出目录
mkdir -p terrain_tiles
```

**注意**：CTB 编译步骤请参考完整脚本。

---

### 方式 C：临时简化方案（无需 CTB）

如果只想快速测试地形效果，可以使用**预处理的简化地形数据**：

```javascript
// 在 LayerControl.vue 中添加
useSimpleTestTerrain() {
  const ellipsoid = new this.Cesium.EllipsoidTerrainProvider({
    tilingScheme: new this.Cesium.GeographicTilingScheme(),
    vertexNormals: true
  });

  // 使用数学函数模拟地形起伏
  this.cesiumViewer.scene.globe.tileLoadProgressEvent.addEventListener((remaining) => {
    if (remaining === 0) {
      console.log('[LayerControl] ✅ 椭球体地形已启用');
    }
  });

  this.cesiumViewer.terrainProvider = ellipsoid;
}
```

这会创建一个带法线效果的椭球体地形，虽然是模拟的，但可以验证地形功能。

---

## 📋 完整命令列表（需要复制到终端）

### 标准流程

```bash
cd /home/tang/Documents/code/woonuxt-master01/cesiumBase/public

# 安装工具
sudo apt update
sudo apt install -y gdal-bin libgdal-dev build-essential git cmake zlib1g-dev libcurl4-openssl-dev

# 克隆 CTB
sudo git clone https://github.com/geo-data/csium-terrain-builder.git /opt/cesium-terrain-builder

# 编译 CTB
cd /opt/cesium-terrain-builder
mkdir -p build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
make -j$(nproc)
sudo make install

# 回到工作目录
cd /home/tang/Documents/code/woonuxt-master01/cesiumBase/public

# 转换格式
gdal_translate -of GTiff -co COMPRESS=LZW ASTGTM_N26E114M.img ji_an.tif

# 切片地形
mkdir -p terrain_tiles
ctb-tile -f ji_an.tif -o terrain_tiles/ --zoom 0-14 --forceresepect --overwrite
```

---

## ⏱️ 预计时间

- 安装工具：10-20 分钟
- 转换格式：1-2 分钟
- 切片地形：5-10 分钟
- **总计：20-35 分钟**

---

## 📊 处理完成后

执行完成后，会在 `terrain_tiles/` 目录生成地形瓦片。

然后使用以下代码在 Cesium 中加载：

```javascript
const localTerrain = new Cesium.CesiumTerrainProvider({
  url: './terrain_tiles/'
});
```

---

## 💡 提示

如果无法执行脚本，建议：

1. **在本地终端执行**（SSH 到服务器）
2. **使用 VS Code Remote SSH** 连接后执行
3. **或者使用简化方案 C**（椭球体地形）

需要我帮你配置简化方案吗？
