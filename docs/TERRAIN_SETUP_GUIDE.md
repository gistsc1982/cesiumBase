# Cesium 离线地形部署指南（江西吉安）

## 🎯 推荐方案对比

| 方案 | 难度 | 时间 | 成本 | 推荐度 |
|------|------|------|------|--------|
| **方案 A: MapTiler 免费** | ⭐ | 5分钟 | 免费 | ⭐⭐⭐⭐⭐ |
| **方案 B: 地理空间数据云 + CTB** | ⭐⭐⭐ | 2小时 | 免费 | ⭐⭐⭐ |
| **方案 C: CesiumLab 离线** | ⭐⭐⭐⭐ | 4小时 | 免费 | ⭐⭐ |

---

## 📋 方案 A: MapTiler 免费地形（最简单）

### 步骤

1. **注册 MapTiler**
   - 网址: https://www.maptiler.com/
   - 注册免费账户

2. **获取 API Key**
   - 登录后进入 Account 页面
   - 复制 Access Token

3. **配置 LayerControl.vue**
   ```javascript
   // 替换 YOUR_MAPTILER_KEY
   const maptilerTerrain = new Cesium.CesiumTerrainProvider({
     url: 'https://api.maptiler.com/tiles/terrain-rgb?v2',
     apiKey: 'YOUR_MAPTILER_KEY',
     requestWaterMask: true,
     requestVertexNormals: true
   });
   ```

### 优势
- ✅ 全球高精度地形
- ✅ 国内可访问
- ✅ 免费额度：100,000 次/月
- ✅ 无需部署和维护

---

## 📋 方案 B: 地理空间数据云 + CTB 工具

### 1. 下载江西吉安 DEM 数据

**数据源**: 地理空间数据云 (https://www.gscloud.cn/)

**步骤**:
1. 注册并登录地理空间数据云
2. 使用矩形框选工具选择江西吉安地区
   - 经纬度范围: 约 114°~115.5°E, 26.5°~27.5°N
3. 选择数据集: ASTER GDEM 30m 或 SRTM 90m
4. 下载为 TIF 格式

### 2. 安装 CTB 工具

**Ubuntu 安装**:
```bash
# 安装依赖
sudo apt update
sudo apt install -y build-essential git cmake libgdal-dev

# 克隆 CTB 项目
cd /opt
sudo git clone https://github.com/geo-data/cesium-terrain-builder.git
cd cesium-terrain-builder

# 编译安装
mkdir build && cd build
cmake ..
make -j$(nproc)
sudo make install
```

### 3. 转换地形数据

```bash
# 使用 CTB 切片 DEM 数据
ctb-tile -f dem.tif -o output_dir/ \
  --zoom 0-14 \
  --forceresepect \
  --overwrite
```

### 4. 部署到 Nginx

```nginx
server {
    listen 80;
    server_name localhost;

    location /terrain/ {
        alias /path/to/output_dir/;
        add_header Access-Control-Allow-Origin *;
        autoindex on;
    }
}
```

### 5. 在 Cesium 中加载

```javascript
const terrainProvider = new Cesium.CesiumTerrainProvider({
  url: 'http://localhost/terrain/'
});

viewer.terrainProvider = terrainProvider;
```

---

## 📋 方案 C: 使用 CesiumLab（Windows/Linux）

### 1. 下载 CesiumLab

**官方下载**: http://m.cesiumlab.com/downcenter.html
- 支持 Linux AMD64 (tar.gz + start.sh)
- 支持 Windows (exe 安装包)

### 2. 下载江西吉安 DEM

从以下平台下载：
- 地理空间数据云: https://www.gscloud.cn/
- 地理监测云: http://www.dsac.cn/

### 3. 使用 CesiumLab 处理

1. **启动 CesiumLab**
2. **导入 DEM 数据** (TIF 格式)
3. **设置输出范围** (江西吉安)
4. **切片处理** → 生成 .terrain 文件
5. **发布服务** → 内置 HTTP 服务器

### 4. 在 Cesium 中加载

```javascript
const terrainProvider = new Cesium.CesiumTerrainProvider({
  url: 'http://localhost:8183/api/terrain/'
});
```

---

## 🎯 针对江西吉安的建议

### 数据范围
- **经度**: 114.0° ~ 115.5° E
- **纬度**: 26.5° ~ 27.5° N
- **面积**: 约 10,000 平方公里

### 推荐数据精度
- **测试用**: SRTM 90m (数据量小)
- **生产用**: SRTM 30m (精度高)
- **高精度**: ASTER GDEM 30m

---

## ⚡ 快速开始

如果你想要**最快的方式**看到地形效果：

**使用 MapTiler 免费方案**：
1. 访问 https://www.maptiler.com/
2. 注册获取免费 API Key
3. 修改 LayerControl.vue 中的 `YOUR_MAPTILER_KEY`

这样**5分钟**内就能看到地形效果！

---

## 📚 参考资源

- [MapTiler 文档](https://www.maptiler.com/)
- [地理空间数据云](https://www.gscloud.cn/)
- [CesiumLab 官网](http://m.cesiumlab.com/)
- [CTB GitHub](https://github.com/geo-data/cesium-terrain-builder)
- [Cesium 地形教程](https://cesium.com/learn/cesiumjs-learn/cesiumjs-terrain/)

---

## 🔧 在本项目中使用

已添加 `tryMapTilerTerrain()` 方法到 LayerControl.vue。

**配置步骤**:
1. 注册 MapTiler 获取 API Key
2. 替换代码中的 `YOUR_MAPTILER_KEY`
3. 点击"三维地形(多源)"测试

**注意**: ArcGIS 和柏林地形已测试无法正常显示，建议使用 MapTiler 或天地图代理。
