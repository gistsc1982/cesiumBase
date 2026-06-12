/*
 * @Author: Zhang Yuling
 * @Date: 2021-12-20 10:05:27
 * @LastEditors: Zhang Yuling
 * @LastEditTime: 2021-12-20 16:59:25
 * @Description: cesiumBase 子项目配置
 *
 * 集成说明：
 * - 开发环境：子项目运行在 localhost:8080，通过 Nuxt 反向代理访问 /terrain
 * - 生产环境：子项目静态文件部署到 /cesium，可直接通过相对路径访问 /terrain
 *
 * 主项目后端路由：
 * - server/routes/terrain.ts -> /terrain (地形服务)
 * - server/api/terrain.ts -> /api/terrain (地形服务备用)
 */

// 获取当前环境
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// API 基础路径配置
// 开发环境：使用 Nuxt 开发服务器地址 (通常 localhost:3000)
// 生产环境：使用当前域名
const apiBasePath = isDev
  ? window.location.origin
  : window.location.origin;

// eslint-disable-next-line no-unused-vars
const mapUrl = {
  // 影像服务地址 - 使用 HTTPS
  // 生产环境使用公开影像服务（如 OpenStreetMap、Mapbox 等）
  // 开发环境可使用内网地址（仅限 HTTP）
  imgUrl: isDev
    ? 'http://192.168.10.33:8080/geoserver/gwc/service/tms/1.0.0/DOM%3ADOM_ls@EPSG%3A4326@png'  // 开发环境
    : 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',  // 生产环境 HTTPS

  // 地形服务地址 - 使用主项目的 Nuxt 后端路由
  // server/routes/terrain.ts 处理 /terrain 请求
  // 开发环境：通过 Nuxt 反向代理访问 http://localhost:3000/terrain
  // 生产环境：直接访问 /terrain（相对路径）
  terrainUrl: `${apiBasePath}/terrain`

  // 备用地形服务地址（如需使用天地图直连）
  // terrainUrl: 'http://sziri.iok.la:36377/DEM/'
};

// 导出配置供其他模块使用
if (typeof window !== 'undefined') {
  window.CESIUM_CONFIG = {
    apiBasePath,
    isDev,
    mapUrl,
    // 可用的后端 API 端点
    endpoints: {
      terrain: '/terrain',        // server/routes/terrain.ts
      terrainApi: '/api/terrain'  // server/api/terrain.ts (备用)
    }
  };
  console.log('[Cesium Config] Environment:', isDev ? 'Development' : 'Production');
  console.log('[Cesium Config] API Base Path:', apiBasePath);
  console.log('[Cesium Config] Terrain URL:', mapUrl.terrainUrl);
  console.log('[Cesium Config] Available endpoints:', window.CESIUM_CONFIG.endpoints);
}
