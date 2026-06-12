/**
 * 鼠标操作协调器
 * 路由不同类型的鼠标操作到相应的处理器
 */

import { ThreeJSPanHandler } from './operation-handlers/ThreeJSPanHandler.js';
import { ThreeJSZoomHandler } from './operation-handlers/ThreeJSZoomHandler.js';
import { SurfaceModeDetector } from './operation-handlers/SurfaceModeDetector.js';

export class MouseOperationCoordinator {
  constructor(dualCanvasViewer) {
    this.viewer = dualCanvasViewer;
    this.detector = new SurfaceModeDetector();

    // 初始化处理器
    this.handlers = {
      pan: new ThreeJSPanHandler(this.viewer.syncManager),
      zoom: new ThreeJSZoomHandler(this.viewer.syncManager)
    };

    // 设置 Three.js 对象
    this.setupHandlers();
  }

  /**
   * 设置处理器的 Three.js 对象
   */
  setupHandlers() {
    const camera = this.viewer.activeLayer === 'three' ? this.viewer.camera1 : this.viewer.camera2;
    const controls = this.viewer.activeLayer === 'three' ? this.viewer.controls1 : this.viewer.controls2;

    Object.values(this.handlers).forEach(handler => {
      handler.setThreeObjects(camera, controls);
    });
  }

  /**
   * 更新处理器的 Three.js 对象（当切换活动层时调用）
   */
  updateHandlers() {
    this.setupHandlers();
  }

  /**
   * 路由平移操作
   * @param {number} deltaX - X 轴移动量
   * @param {number} deltaY - Y 轴移动量
   * @param {number} metersPerPixel - 每像素代表的米数
   * @returns {boolean} 操作是否成功
   */
  routePan(deltaX, deltaY, metersPerPixel) {
    return this.handlers.pan.execute(deltaX, deltaY, metersPerPixel);
  }

  /**
   * 路由缩放操作
   * @param {number} deltaZoom - 缩放量
   * @returns {boolean} 操作是否成功
   */
  routeZoom(deltaZoom) {
    return this.handlers.zoom.execute(deltaZoom);
  }

  /**
   * 获取当前模式
   * @returns {string} 'surface' | 'underground'
   */
  getCurrentMode() {
    const position = this.viewer.unifiedCameraState?.position || { x: 0, y: 0, z: 0 };
    return this.detector.getSurfaceMode(position);
  }

  /**
   * 获取平移处理器
   * @returns {ThreeJSPanHandler}
   */
  getPanHandler() {
    return this.handlers.pan;
  }

  /**
   * 获取缩放处理器
   * @returns {ThreeJSZoomHandler}
   */
  getZoomHandler() {
    return this.handlers.zoom;
  }
}
