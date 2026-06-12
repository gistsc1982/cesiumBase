/**
 * Cesium 与 DualCanvasViewer 双向同步脚本 V2 - 整合版
 * 完整移植自 cesiumBase-ok-rotation 子项目 + 主项目 SyncManager.js 的同步架构
 *
 * 主要特性：
 * - 左键翻转保护：永久停止 Dual → Cesium 同步循环
 * - 右键平移保护：使用 preserveRotation 模式保持旋转角度
 * - 精细的同步控制：支持启动/停止同步循环
 * - 整合主项目同步架构：ENU检测、背面检测、大坐标场景检测等
 *
 * @version 2.0
 * @author Claude
 */

(function() {
  'use strict';

  console.log('[CesiumDualSyncV2] 同步脚本已加载（整合主项目同步架构）');

  // ==================== 同步状态管理 ====================
  const syncState = {
    isSyncing: false,
    syncDepth: 0,
    cesiumViewer: null,
    dualCanvasViewer: null,
    lastSyncTime: 0,
    syncThrottle: 0, // 移除节流，实现完全实时同步
    isEnabled: true,
    isUserDragging: false, // 标记用户是否正在拖动（避免反向同步冲突）
    skipAutoSync: false, // 跳过自动同步（用于滚轮缩放等场景）
    preserveRotation: false, // 保护旋转角度，避免被 Cesium → Dual 同步覆盖
    preserveRotationEndTime: 0, // 记录 preserveRotation 同步的结束时间
    dualToCesiumSyncPermanentlyDisabled: false, // ⭐ 已废弃：左键翻转不再永久禁用同步循环（需要支持大坐标模型锚定）
    blockDualToCesiumSyncUntil: 0, // 阻止 Dual → Cesium 同步的时间戳（用于防止平移后跳变）

    // ⭐ 整合自主项目：同步操作计数器（防止 DualCanvasViewer 正在设置相机时干扰）
    syncOperationCount: 0,

    // ⭐ 整合自主项目：跳过同步标志（用于 handleRotateInUnified 中已同步的情况）
    skipNextCesiumSync: false,

    // ⭐ 整合自主项目：同步冷却计时器（防止立即触发反向同步）
    syncCooldownTimer: null,

    // ⭐ 整合自主项目：同步源标记
    isSyncingFromDual: false,

    // ⭐ 整合自主项目：节流计时器
    throttleTimer: null,
    throttleDelay: 50
  };

  // ==================== 工具函数 ====================

  /**
   * 向量归一化
   */
  function normalize(v) {
    if (!v || typeof v.x !== 'number' || typeof v.y !== 'number' || typeof v.z !== 'number') {
      return { x: 0, y: 1, z: 0 };
    }

    if (!isFinite(v.x) || !isFinite(v.y) || !isFinite(v.z)) {
      return { x: 0, y: 1, z: 0 };
    }

    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (len < 0.0001) return { x: 0, y: 1, z: 0 };
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }

  /**
   * 向量点积
   */
  function dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  /**
   * ⭐ 整合自主项目：纬度转墨卡托 Y 坐标
   */
  function latitudeToMercator(latitude) {
    const earthRadius = 6378137.0;
    return Math.log(Math.tan(Math.PI / 4 + latitude / 2)) * earthRadius;
  }

  /**
   * ⭐ 整合自主项目：墨卡托 Y 坐标转纬度
   */
  function mercatorToLatitude(mercatorY) {
    const earthRadius = 6378137.0;
    return 2 * Math.atan(Math.exp(mercatorY / earthRadius)) - Math.PI / 2;
  }

  /**
   * ⭐ 整合自主项目：检测是否使用 ENU 坐标系
   */
  function isUsingENUCoordinateSystem() {
    const enuManager = typeof window !== 'undefined' && window.__enuCoordinateManager__;
    return enuManager && enuManager.isInitialized();
  }

  /**
   * ⭐ 整合自主项目：检测是否使用局部坐标系
   */
  function isUsingLocalCoordinateSystem() {
    const syncManager = typeof window !== 'undefined' && window.__syncManager__;
    if (syncManager && syncManager.mercatorProjection) {
      const isUsing = syncManager.mercatorProjection.isUsingLocalCoordinateSystem;
      if (typeof isUsing === 'function') {
        return isUsing.call(syncManager.mercatorProjection);
      }
    }
    return false;
  }

  /**
   * ⭐ 整合自主项目：检测是否在大坐标场景
   */
  function isInLargeCoordinateScene() {
    const LARGE_COORD_THRESHOLD = 1000;

    if (window.__dualCanvasViewerInstances && window.__dualCanvasViewerInstances.length > 0) {
      const dualViewer = window.__dualCanvasViewerInstances[0];

      // 检查真实世界模式
      if (dualViewer.isInRealWorldMode) {
        return true;
      }

      // 检查相机在大坐标位置
      if (dualViewer.camera1 && dualViewer.camera1.position) {
        const isCameraInLargeCoord =
          Math.abs(dualViewer.camera1.position.x) > LARGE_COORD_THRESHOLD ||
          Math.abs(dualViewer.camera1.position.z) > LARGE_COORD_THRESHOLD;

        if (isCameraInLargeCoord) {
          return true;
        }
      }
    }

    return false;
  }

  // ==================== 等待组件就绪 ====================

  function waitForComponents(callback) {
    const checkReady = () => {
      const hasCesium = typeof window.Cesium !== 'undefined';
      const hasViewer = typeof window.__cesiumViewer__ !== 'undefined';
      // ⭐ 修复：更安全的检查，避免访问 undefined 的 length 属性
      const dualInstances = window.__dualCanvasViewerInstances__;
      const hasDualInstances = dualInstances && Array.isArray(dualInstances) && dualInstances.length > 0;
      const hasSyncManager = typeof window.__syncManager__ !== 'undefined';

      if (!hasCesium || !hasViewer || !hasDualInstances || !hasSyncManager) {
        setTimeout(checkReady, 100);
        return;
      }

      callback();
    };
    checkReady();
  }

  // ==================== 同步系统初始化 ====================

  function initSync() {
    console.log('[CesiumDualSyncV2] 开始初始化同步系统（整合主项目同步架构）');

    // 获取 Cesium Viewer
    syncState.cesiumViewer = window.__cesiumViewer__;
    if (!syncState.cesiumViewer) {
      console.error('[CesiumDualSyncV2] Cesium Viewer 不可用');
      return;
    }

    // 获取 DualCanvasViewer 实例
    if (window.__dualCanvasViewerInstances && window.__dualCanvasViewerInstances__.length > 0) {
      syncState.dualCanvasViewer = window.__dualCanvasViewerInstances__[0];
      console.log('[CesiumDualSyncV2] DualCanvasViewer 实例已获取');
    } else {
      console.error('[CesiumDualSyncV2] DualCanvasViewer 实例不可用');
      return;
    }

    // 设置双向同步监听
    setupCesiumToDualSync();
    setupDualToCesiumSync();

    // 执行初始同步
    setTimeout(() => {
      performInitialSync();
    }, 500);

    console.log('[CesiumDualSyncV2] ✅ 同步系统初始化完成');
  }

  /**
   * 执行初始同步（从 Cesium 到 Dual）
   */
  function performInitialSync() {
    console.log('[CesiumDualSyncV2] 执行初始同步...');
    syncCesiumToDual();
  }

  // ==================== Cesium → Dual 同步 ====================

  /**
   * 设置 Cesium 到 Dual 的同步监听
   */
  function setupCesiumToDualSync() {
    const camera = syncState.cesiumViewer.camera;

    // 只监听 moveEnd 事件（拖动结束后再同步）
    camera.moveEnd.addEventListener(() => {
      setTimeout(() => {
        if (syncState.isEnabled && syncState.syncDepth === 0 && !syncState.isUserDragging) {
          // ⭐ 关键修复：检查是否在 preserveRotation 同步的时间窗口内（500ms）
          const timeSincePreserveRotation = Date.now() - syncState.preserveRotationEndTime;
          if (timeSincePreserveRotation < 500) {
            console.log('[CesiumDualSyncV2] 跳过 moveEnd 同步（在 preserveRotation 时间窗口内）');
            return;
          }

          // ⭐ 关键修复：检查是否在阻止同步的时间窗口内（右键平移结束后）
          const now = Date.now();
          if (now < syncState.blockDualToCesiumSyncUntil) {
            const remainingMs = syncState.blockDualToCesiumSyncUntil - now;
            console.log('[CesiumDualSyncV2] moveEnd: 在阻止同步窗口内，跳过 Cesium → Dual 同步，剩余:', remainingMs, 'ms');
            return;
          }

          // ⭐ 整合自主项目：检查是否在左键翻转保护期
          if (syncState.disableReverseSync) {
            console.log('[CesiumDualSyncV2] 左键翻转保护期，跳过 Cesium → Dual 同步');
            return;
          }

          syncCesiumToDual();
        }
      }, 100);
    });

    console.log('[CesiumDualSyncV2] Cesium → Dual 同步监听已设置（仅 moveEnd）');
  }

  /**
   * 从 Cesium 同步到 DualCanvasViewer
   * ⭐ 整合自主项目的背面检测、ENU检测、大坐标检测逻辑
   */
  function syncCesiumToDual() {
    // ⭐ 左键翻转期间禁用 Cesium → Dual 同步
    if (syncState.disableReverseSync) {
      console.log('[CesiumDualSyncV2] 左键翻转中，跳过 Cesium → Dual 同步');
      return;
    }

    // ⭐ 检查是否在阻止同步的时间窗口内
    const now = Date.now();
    if (now < syncState.blockDualToCesiumSyncUntil) {
      const remainingMs = syncState.blockDualToCesiumSyncUntil - now;
      console.log('[CesiumDualSyncV2] 在阻止同步窗口内，跳过 Cesium → Dual 同步，剩余:', remainingMs, 'ms');
      return;
    }

    // 防止循环同步
    syncState.syncDepth++;
    if (syncState.syncDepth > 1) {
      syncState.syncDepth--;
      return;
    }

    try {
      console.log('[CesiumDualSyncV2] Cesium → Dual 开始同步');

      const Cesium = window.Cesium;
      const camera = syncState.cesiumViewer.camera;
      const scene = syncState.cesiumViewer.scene;
      const syncManager = window.__syncManager__;

      if (!Cesium || !camera || !syncManager) {
        console.warn('[CesiumDualSyncV2] 同步失败：缺少必要组件');
        return;
      }

      // ⭐ 整合自主项目：ENU 坐标系检测
      if (isUsingENUCoordinateSystem()) {
        console.log('[CesiumDualSyncV2] ENU坐标系模式：跳过 Cesium → Dual 同步（ENU是本地坐标系）');
        return;
      }

      // ⭐ 整合自主项目：大坐标场景检测
      if (isInLargeCoordinateScene()) {
        console.log('[CesiumDualSyncV2] 大坐标场景：跳过 Cesium → Dual 同步');
        return;
      }

      // ⭐ 整合自主项目：局部坐标系检测
      const isLocalCoord = isUsingLocalCoordinateSystem();
      if (isLocalCoord) {
        console.log('[CesiumDualSyncV2] 局部坐标系模式：跳过 Cesium → Dual 同步');
        return;
      }

      // 获取相机位置（笛卡尔坐标）
      const cameraPosition = camera.position;
      const ellipsoid = scene.globe.ellipsoid;

      // 转换为地理坐标
      const cartographic = ellipsoid.cartesianToCartographic(cameraPosition);

      // 转换为墨卡托坐标
      const earthRadius = ellipsoid.maximumRadius || 6378137.0;
      const mercatorPosition = {
        x: cartographic.longitude * earthRadius,
        y: latitudeToMercator(cartographic.latitude),
        z: cartographic.height
      };

      // 获取目标点（相机看向的点）
      let targetCartographic = null;
      try {
        const direction = camera.direction;
        const position = camera.position;

        const directionMagnitude = Math.sqrt(
          direction.x * direction.x +
          direction.y * direction.y +
          direction.z * direction.z
        );

        const isValidDirection = direction &&
          Cesium.defined(direction) &&
          isFinite(direction.x) && isFinite(direction.y) && isFinite(direction.z) &&
          !isNaN(direction.x) && !isNaN(direction.y) && !isNaN(direction.z) &&
          directionMagnitude > 0.001 && directionMagnitude < 1000;

        const isValidPosition = position &&
          Cesium.defined(position) &&
          isFinite(position.x) && isFinite(position.y) && isFinite(position.z) &&
          !isNaN(position.x) && !isNaN(position.y) && !isNaN(position.z);

        const mayIntersect = isValidDirection && isValidPosition &&
          Math.abs(direction.z) < 0.99;

        if (mayIntersect) {
          const ray = new Cesium.Ray(camera.position, camera.direction);
          const targetPosition = Cesium.IntersectionTests.rayEllipsoid(ray, ellipsoid);
          if (Cesium.defined(targetPosition)) {
            targetCartographic = ellipsoid.cartesianToCartographic(targetPosition);
          }
        }
      } catch (error) {
        // 静默忽略
      }

      // 如果射线求交失败，使用相机正下方的地面点
      if (!targetCartographic) {
        targetCartographic = Cesium.Cartographic.fromRadians(
          cartographic.longitude,
          cartographic.latitude,
          0
        );
      }

      const targetMercator = {
        x: targetCartographic.longitude * earthRadius,
        y: latitudeToMercator(targetCartographic.latitude),
        z: 0
      };

      // ⭐ 整合自主项目：使用 SyncManager 的坐标转换方法
      const threeCameraPosition = syncManager.mercatorToThree(
        mercatorPosition.x,
        mercatorPosition.y,
        mercatorPosition.z
      );

      const threeTargetPosition = syncManager.mercatorToThree(
        targetMercator.x,
        targetMercator.y,
        targetMercator.z
      );

      console.log('[CesiumDualSyncV2] Three.js 坐标:', {
        camera: threeCameraPosition,
        target: threeTargetPosition
      });

      // ⭐ 整合自主项目：背面检测
      let isCameraOnBackSide = false;
      try {
        const cameraCartesian = camera.position;

        // 使用 SyncManager 的地板中心进行背面检测
        if (cameraCartesian && syncManager.floorCenterMercator) {
          // 保存初始法向量
          if (!syncState._initialFloorCenterNormal) {
            const floorCenterCartographic = Cesium.Cartographic.fromRadians(
              syncManager.floorCenterMercator.x / earthRadius,
              mercatorToLatitude(syncManager.floorCenterMercator.y),
              0
            );
            const floorCenterCartesian = ellipsoid.cartographicToCartesian(floorCenterCartographic);

            if (floorCenterCartesian) {
              syncState._initialFloorCenterNormal = Cesium.Cartesian3.normalize(floorCenterCartesian, new Cesium.Cartesian3());
            }
          }

          if (syncState._initialFloorCenterNormal) {
            const cameraNormal = Cesium.Cartesian3.normalize(cameraCartesian, new Cesium.Cartesian3());
            const dotProduct = Cesium.Cartesian3.dot(cameraNormal, syncState._initialFloorCenterNormal);
            isCameraOnBackSide = dotProduct < 0;
          }
        }
      } catch (error) {
        // 忽略背面检测错误
      }

      // 更新 DualCanvasViewer 的相机
      updateDualCamera(threeCameraPosition, threeTargetPosition, {
        targetCartographic,
        isCameraOnBackSide
      });

    } catch (error) {
      console.error('[CesiumDualSyncV2] Cesium → Dual 同步错误:', error);
    } finally {
      syncState.syncDepth--;
    }
  }

  // ==================== Dual → Cesium 同步 ====================

  /**
   * 设置 Dual 到 Cesium 的同步监听
   */
  function setupDualToCesiumSync() {
    const dualViewer = syncState.dualCanvasViewer;

    // 存储初始相机状态
    let lastCameraState = null;
    let rafId = null;
    let isRunning = true;

    // 使用 requestAnimationFrame 实现与浏览器渲染同步的检测
    const checkCameraChange = () => {
      if (!isRunning) {
        return;
      }

      if (!syncState.isEnabled || !dualViewer || !dualViewer.camera1 || !dualViewer.controls1) {
        rafId = requestAnimationFrame(checkCameraChange);
        return;
      }

      // 获取当前相机状态
      const currentCameraState = {
        position: {
          x: dualViewer.camera1.position.x,
          y: dualViewer.camera1.position.y,
          z: dualViewer.camera1.position.z
        },
        target: {
          x: dualViewer.controls1.target.x,
          y: dualViewer.controls1.target.y,
          z: dualViewer.controls1.target.z
        }
      };

      // 检查是否有变化
      if (lastCameraState) {
        const positionChanged =
          Math.abs(currentCameraState.position.x - lastCameraState.position.x) > 0.01 ||
          Math.abs(currentCameraState.position.y - lastCameraState.position.y) > 0.01 ||
          Math.abs(currentCameraState.position.z - lastCameraState.position.z) > 0.01;

        const targetChanged =
          Math.abs(currentCameraState.target.x - lastCameraState.target.x) > 0.01 ||
          Math.abs(currentCameraState.target.y - lastCameraState.target.y) > 0.01 ||
          Math.abs(currentCameraState.target.z - lastCameraState.target.z) > 0.01;

        if ((positionChanged || targetChanged) &&
            syncState.syncDepth === 0 &&
            !syncState.isUserDragging &&
            !syncState.dualToCesiumSyncPermanentlyDisabled &&
            Date.now() >= syncState.blockDualToCesiumSyncUntil) {
          syncDualToCesium();
        }
      }

      // 更新上一次的状态
      lastCameraState = currentCameraState;

      // 继续下一帧检测
      rafId = requestAnimationFrame(checkCameraChange);
    };

    // 启动检测
    rafId = requestAnimationFrame(checkCameraChange);

    // 暴露停止和启动方法
    syncState.stopDualToCesiumSync = () => {
      isRunning = false;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      console.log('[CesiumDualSyncV2] Dual → Cesium 同步循环已停止');
    };

    syncState.startDualToCesiumSync = () => {
      if (!isRunning) {
        isRunning = true;
        lastCameraState = null;
        checkCameraChange();
        console.log('[CesiumDualSyncV2] Dual → Cesium 同步循环已启动');
      }
    };

    // 监听自定义事件（作为备用机制）
    document.addEventListener('DualCameraChanged', () => {
      if (syncState.isEnabled && syncState.syncDepth === 0 && !syncState.isUserDragging) {
        syncDualToCesium();
      }
    });

    console.log('[CesiumDualSyncV2] Dual → Cesium 同步监听已设置（requestAnimationFrame 模式）');
  }

  /**
   * 从 DualCanvasViewer 同步到 Cesium
   * ⭐ 整合自主项目的 ENU 检测、大坐标检测逻辑
   */
  function syncDualToCesium() {
    // 防止循环同步
    syncState.syncDepth++;
    if (syncState.syncDepth > 1) {
      syncState.syncDepth--;
      return;
    }

    try {
      const dualViewer = syncState.dualCanvasViewer;
      const syncManager = window.__syncManager__;

      if (!dualViewer || !syncManager) {
        console.warn('[CesiumDualSyncV2] 同步失败：缺少必要组件');
        return;
      }

      // 验证相机对象存在
      if (!dualViewer.camera1 || !dualViewer.controls1) {
        console.warn('[CesiumDualSyncV2] 同步失败：Dual 相机未就绪');
        return;
      }

      // ⭐ 整合自主项目：检测是否使用局部坐标系
      const isUsingLocalCoord = isUsingLocalCoordinateSystem();
      const mercatorProjection = syncManager?.mercatorProjection;

      // ⭐ 关键修改：局部坐标系模式下，使用 MercatorProjectionManager 进行坐标转换
      if (isUsingLocalCoord) {
        if (!mercatorProjection) {
          console.warn('[CesiumDualSyncV2] 局部坐标系模式但缺少 MercatorProjectionManager');
          return;
        }

        // ⚠️ 检查是否正在用户操作（避免冲突）
        if (syncState.isUserDragging) {
          return;
        }

        // 获取 Three.js 相机位置
        const threeCameraPosition = {
          x: dualViewer.camera1.position.x,
          y: dualViewer.camera1.position.y,
          z: dualViewer.camera1.position.z
        };

        const threeTargetPosition = {
          x: dualViewer.controls1.target.x,
          y: dualViewer.controls1.target.y,
          z: dualViewer.controls1.target.z
        };

        // 验证 Three.js 坐标有效性
        const isValidCoord = (coord) => {
          return typeof coord.x === 'number' && isFinite(coord.x) && !isNaN(coord.x) &&
                 typeof coord.y === 'number' && isFinite(coord.y) && !isNaN(coord.y) &&
                 typeof coord.z === 'number' && isFinite(coord.z) && !isNaN(coord.z);
        };

        if (!isValidCoord(threeCameraPosition) || !isValidCoord(threeTargetPosition)) {
          return;
        }

        // ⭐ 局部坐标系模式：使用 SyncManager 的统一状态进行同步
        // 直接使用 syncUnifiedToCesium，它会处理局部坐标系的转换
        if (syncManager.syncUnifiedToCesium) {
          const cesiumViewer = syncState.cesiumViewer;
          if (cesiumViewer?.camera && cesiumViewer?.scene) {
            // 跳过常规的坐标转换，直接调用 SyncManager 的同步方法
            syncManager.syncUnifiedToCesium(cesiumViewer.camera, cesiumViewer.scene);
            console.log('[CesiumDualSyncV2] ⭐ 局部坐标系模式：锚定同步到 Cesium');
          }
        }
        return;
      }

      // ⚠️ ENU 坐标系（不同于局部坐标系）仍然跳过同步
      if (isUsingENUCoordinateSystem()) {
        console.log('[CesiumDualSyncV2] ENU坐标系模式：跳过 Dual → Cesium 同步（ENU是本地坐标系）');
        return;
      }

      // 获取 Three.js 相机位置
      const threeCameraPosition = {
        x: dualViewer.camera1.position.x,
        y: dualViewer.camera1.position.y,
        z: dualViewer.camera1.position.z
      };

      const threeTargetPosition = {
        x: dualViewer.controls1.target.x,
        y: dualViewer.controls1.target.y,
        z: dualViewer.controls1.target.z
      };

      // 验证 Three.js 坐标有效性
      const isValidCoord = (coord) => {
        return typeof coord.x === 'number' && isFinite(coord.x) && !isNaN(coord.x) &&
               typeof coord.y === 'number' && isFinite(coord.y) && !isNaN(coord.y) &&
               typeof coord.z === 'number' && isFinite(coord.z) && !isNaN(coord.z);
      };

      if (!isValidCoord(threeCameraPosition)) {
        console.warn('[CesiumDualSyncV2] Three.js 相机位置无效:', threeCameraPosition);
        return;
      }

      if (!isValidCoord(threeTargetPosition)) {
        console.warn('[CesiumDualSyncV2] Three.js 目标位置无效:', threeTargetPosition);
        return;
      }

      // ⭐ 整合自主项目：大坐标场景检测
      const LARGE_COORD_THRESHOLD = 1000;
      const isLargeCoordinateScene =
        Math.abs(threeCameraPosition.x) > LARGE_COORD_THRESHOLD ||
        Math.abs(threeCameraPosition.z) > LARGE_COORD_THRESHOLD;

      if (isLargeCoordinateScene) {
        console.log('[CesiumDualSyncV2] 大坐标场景：跳过 Dual → Cesium 同步');
        return;
      }

      // ⭐ 整合自主项目：使用 SyncManager 的坐标转换方法
      const mercatorCamera = syncManager.threeToMercator(
        threeCameraPosition.x,
        threeCameraPosition.y,
        threeCameraPosition.z
      );

      const mercatorTarget = syncManager.threeToMercator(
        threeTargetPosition.x,
        threeTargetPosition.y,
        threeTargetPosition.z
      );

      // 验证墨卡托坐标有效性
      if (!isValidCoord(mercatorCamera)) {
        console.warn('[CesiumDualSyncV2] 墨卡托相机坐标无效:', mercatorCamera);
        return;
      }

      if (!isValidCoord(mercatorTarget)) {
        console.warn('[CesiumDualSyncV2] 墨卡托目标坐标无效:', mercatorTarget);
        return;
      }

      console.log('[CesiumDualSyncV2] Dual → Cesium 同步:', {
        threeCamera: threeCameraPosition,
        threeTarget: threeTargetPosition,
        mercatorCamera: {
          x: mercatorCamera.x.toFixed(2),
          y: mercatorCamera.y.toFixed(2),
          z: mercatorCamera.z.toFixed(2)
        }
      });

      // 更新 Cesium 相机
      updateCesiumCamera(mercatorCamera, mercatorTarget);

    } catch (error) {
      console.error('[CesiumDualSyncV2] Dual → Cesium 同步错误:', error);
    } finally {
      syncState.syncDepth--;
    }
  }

  // ==================== 更新相机方法 ====================

  /**
   * 更新 DualCanvasViewer 的相机
   * ⭐ 整合自主项目的 preserveRotation 模式
   */
  function updateDualCamera(cameraPosition, targetPosition, options = {}) {
    const dualViewer = syncState.dualCanvasViewer;

    // 验证坐标有效性
    const isValidCoord = (coord) => {
      return typeof coord === 'number' && isFinite(coord) && !isNaN(coord);
    };

    const isCameraValid = isValidCoord(cameraPosition.x) && isValidCoord(cameraPosition.y) && isValidCoord(cameraPosition.z);
    const isTargetValid = isValidCoord(targetPosition.x) && isValidCoord(targetPosition.y) && isValidCoord(targetPosition.z);

    if (!isCameraValid) {
      console.error('[CesiumDualSyncV2] updateDualCamera: 相机位置无效，跳过更新:', cameraPosition);
      return;
    }

    if (!isTargetValid) {
      console.error('[CesiumDualSyncV2] updateDualCamera: 目标位置无效，跳过更新:', targetPosition);
      return;
    }

    // 更新层1相机
    if (dualViewer.camera1 && dualViewer.controls1) {
      // ⭐ 检查是否需要使用 preserveRotation 模式（用于右键平移）
      const PRESERVE_WINDOW = 1000; // 1秒保护窗口
      const isWithinPreserveWindow = syncState.preserveRotationEndTime &&
        (Date.now() - syncState.preserveRotationEndTime) < PRESERVE_WINDOW;
      const shouldPreserveRotation = syncState.preserveRotation || isWithinPreserveWindow;

      if (shouldPreserveRotation) {
        console.log('[CesiumDualSyncV2] 使用 preserveRotation 模式（右键平移）');

        // 保护旋转模式：需要保持旋转角度不变，只更新位置
        const originalQuaternion = dualViewer.camera1.quaternion.clone();
        const originalOffset = new dualViewer.camera1.position.constructor();
        originalOffset.copy(dualViewer.camera1.position).sub(dualViewer.controls1.target);
        const originalDistance = originalOffset.length();

        // 1. 更新相机位置
        dualViewer.camera1.position.set(
          cameraPosition.x,
          cameraPosition.y,
          cameraPosition.z
        );

        // 2. 恢复 quaternion
        dualViewer.camera1.quaternion.copy(originalQuaternion);

        // 3. 使用原始 quaternion 计算 camera.up
        const Vec3 = dualViewer.camera1.up.constructor;
        const tempUp = new Vec3(0, 1, 0);
        tempUp.applyQuaternion(originalQuaternion);
        dualViewer.camera1.up.copy(tempUp);

        // 4. 直接使用传入的 targetPosition
        dualViewer.controls1.target.set(
          targetPosition.x,
          targetPosition.y,
          targetPosition.z
        );

        // 5. 手动同步 OrbitControls 的球坐标状态
        dualViewer.controls1.object = dualViewer.camera1;
      } else {
        // 正常模式：直接更新 position 和 target，然后调用 controls.update()
        dualViewer.camera1.position.set(
          cameraPosition.x,
          cameraPosition.y,
          cameraPosition.z
        );
        dualViewer.controls1.target.set(
          targetPosition.x,
          targetPosition.y,
          targetPosition.z
        );
        dualViewer.controls1.update();
      }

      dualViewer.camera1.updateMatrixWorld();
    }

    // 更新层2相机
    if (dualViewer.camera2 && dualViewer.controls2) {
      const shouldPreserveRotation = syncState.preserveRotation;

      if (shouldPreserveRotation) {
        // 保护旋转模式：完全复制层1的状态
        dualViewer.camera2.position.copy(dualViewer.camera1.position);
        dualViewer.camera2.quaternion.copy(dualViewer.camera1.quaternion);
        dualViewer.camera2.up.copy(dualViewer.camera1.up);
        dualViewer.controls2.target.copy(dualViewer.controls1.target);
        dualViewer.controls2.object = dualViewer.camera2;
      } else {
        // 正常模式：层2独立更新
        dualViewer.camera2.position.set(
          cameraPosition.x,
          cameraPosition.y,
          cameraPosition.z
        );
        dualViewer.controls2.target.set(
          targetPosition.x,
          targetPosition.y,
          targetPosition.z
        );
        dualViewer.controls2.update();
      }

      dualViewer.camera2.updateMatrixWorld();

      // 同步相机参数
      dualViewer.camera2.fov = dualViewer.camera1.fov;
      dualViewer.camera2.near = dualViewer.camera1.near;
      dualViewer.camera2.far = dualViewer.camera1.far;
      dualViewer.camera2.zoom = dualViewer.camera1.zoom;
      dualViewer.camera2.updateProjectionMatrix();
    }

    // ⭐ 整合自主项目：通知回调函数（如果设置了）
    const syncManager = window.__syncManager__;
    if (syncManager && syncManager.onCesiumToThreeSync && options.targetCartographic) {
      syncManager.onCesiumToThreeSync(
        cameraPosition,
        targetPosition,
        options.targetCartographic,
        options.isCameraOnBackSide || false
      );
    }

    console.log('[CesiumDualSyncV2] Dual 相机已更新');
  }

  /**
   * 更新 Cesium 相机
   * ⭐ 整合自主项目的完整实现
   */
  function updateCesiumCamera(mercatorCamera, mercatorTarget) {
    const Cesium = window.Cesium;
    const cesiumViewer = syncState.cesiumViewer;

    if (!Cesium || !cesiumViewer) {
      return;
    }

    const ellipsoid = cesiumViewer.scene.globe.ellipsoid;

    // 获取安全的地球半径
    const earthRadius = ellipsoid.maximumRadius || ellipsoid.radiusX || 6378137.0;

    // 安全的墨卡托反投影
    const safeMercatorToLatitude = (mercatorY) => {
      if (!isFinite(mercatorY) || isNaN(mercatorY)) {
        return 0;
      }

      const maxMercatorY = earthRadius * Math.log(Math.tan(Math.PI / 4 + Math.PI * 85.05 / 180 / 2));
      const clampedMercatorY = Math.max(-maxMercatorY, Math.min(maxMercatorY, mercatorY));

      const yRatio = clampedMercatorY / earthRadius;
      const clampedY = Math.max(-709, Math.min(709, yRatio));

      try {
        const expValue = Math.exp(clampedY);
        const latitude = 2 * Math.atan(expValue) - Math.PI / 2;

        if (!isFinite(latitude) || isNaN(latitude)) {
          return 0;
        }

        return latitude;
      } catch (error) {
        return 0;
      }
    };

    // 转换为经纬度
    const longitude = mercatorCamera.x / earthRadius;
    const latitude = safeMercatorToLatitude(mercatorCamera.y);
    const height = mercatorCamera.z || 0;

    // 验证经纬度是否有效
    if (!isFinite(longitude) || !isFinite(latitude) || !isFinite(height) ||
        isNaN(longitude) || isNaN(latitude) || isNaN(height)) {
      console.error('[CesiumDualSyncV2] 经纬度转换失败，结果无效:', {
        mercatorCamera,
        longitude,
        latitude,
        height
      });
      return;
    }

    // 限制纬度范围（Cesium 的有效范围）
    const clampedLatitude = Math.max(-Math.PI * 85.05 / 180, Math.min(Math.PI * 85.05 / 180, latitude));

    try {
      // 创建相机位置
      const cameraCartesian = Cesium.Cartesian3.fromRadians(
        longitude,
        clampedLatitude,
        height
      );

      // 验证 Cartesian3 是否有效
      if (!cameraCartesian || !Cesium.defined(cameraCartesian) ||
          isNaN(cameraCartesian.x) || isNaN(cameraCartesian.y) || isNaN(cameraCartesian.z)) {
        console.error('[CesiumDualSyncV2] Cartesian3 创建失败:', {
          longitude,
          clampedLatitude,
          height,
          cameraCartesian
        });
        return;
      }

      console.log('[CesiumDualSyncV2] Cesium 相机位置:', {
        longitude: Cesium.Math.toDegrees(longitude).toFixed(6),
        latitude: Cesium.Math.toDegrees(clampedLatitude).toFixed(6),
        height: height.toFixed(2)
      });

      // ⭐ 更新朝向，使用 mercatorTarget 计算方向向量
      if (mercatorTarget && isFinite(mercatorTarget.x) && isFinite(mercatorTarget.y)) {
        const targetLongitude = mercatorTarget.x / earthRadius;
        const targetLatitude = safeMercatorToLatitude(mercatorTarget.y);
        const targetHeight = mercatorTarget.z || 0;

        const targetCartesian = Cesium.Cartesian3.fromRadians(
          targetLongitude,
          targetLatitude,
          targetHeight
        );

        if (targetCartesian && Cesium.defined(targetCartesian)) {
          // 计算方向向量
          const direction = Cesium.Cartesian3.subtract(
            targetCartesian,
            cameraCartesian,
            new Cesium.Cartesian3()
          );
          Cesium.Cartesian3.normalize(direction, direction);

          // 设置相机位置和方向
          cesiumViewer.camera.position = cameraCartesian;
          cesiumViewer.camera.direction = direction;

          // 让 Cesium 重建 up 和 right
          const up = ellipsoid.geodeticSurfaceNormal(cameraCartesian, new Cesium.Cartesian3());
          cesiumViewer.camera.up = up;
          cesiumViewer.camera.right = Cesium.Cartesian3.cross(
            cesiumViewer.camera.direction,
            cesiumViewer.camera.up,
            new Cesium.Cartesian3()
          );
          Cesium.Cartesian3.normalize(cesiumViewer.camera.right, cesiumViewer.camera.right);

          console.log('[CesiumDualSyncV2] Cesium 相机已更新（位置和朝向）');
        } else {
          cesiumViewer.camera.position = cameraCartesian;
          console.log('[CesiumDualSyncV2] Cesium 相机已更新（仅位置，target 无效）');
        }
      } else {
        cesiumViewer.camera.position = cameraCartesian;
        console.log('[CesiumDualSyncV2] Cesium 相机已更新（仅位置，无 target）');
      }
    } catch (error) {
      console.error('[CesiumDualSyncV2] 更新 Cesium 相机时出错:', error);
    }
  }

  // ==================== 控制接口 ====================

  /**
   * 启用/禁用同步
   */
  function setSyncEnabled(enabled) {
    syncState.isEnabled = enabled;
    console.log('[CesiumDualSyncV2] 同步', enabled ? '已启用' : '已禁用');
  }

  /**
   * 手动触发同步
   */
  function triggerSync(direction) {
    if (direction === 'toDual') {
      syncCesiumToDual();
    } else if (direction === 'toCesium') {
      syncDualToCesium();
    }
  }

  /**
   * ⭐ 关键方法：设置用户拖动状态（用于防止反向同步冲突）
   *
   * 参数说明：
   * @param {boolean} isDragging - 是否正在拖动
   * @param {boolean} skipAutoSync - 是否跳过自动同步（默认 false）
   * @param {boolean} preserveRotation - 是否保护旋转角度（默认 false，用于右键平移后保持旋转）
   * @param {boolean} disableReverseSync - ⭐ 是否禁用反向同步（默认 false，用于左键翻转）
   *
   * 使用示例：
   * - 左键翻转：setUserDragging(true, false, false, true) -> setUserDragging(false)
   * - 右键平移：setUserDragging(true, false, true, false) -> setUserDragging(false)
   * - 滚轮缩放：setUserDragging(true, true, false, false) -> setUserDragging(false)
   */
  function setUserDragging(isDragging, skipAutoSync = false, preserveRotation = false, disableReverseSync = false) {
    console.log('[CesiumDualSyncV2] 用户拖动状态:', isDragging ? '开始拖动，禁用反向同步' : '拖动结束，恢复反向同步',
      skipAutoSync ? '(跳过自动同步)' : '',
      preserveRotation ? '(保护旋转角度)' : '',
      disableReverseSync ? '(⭐ 左键翻转-禁用反向同步)' : '');

    if (isDragging) {
      // 拖动开始：设置标志并停止 Dual → Cesium 的同步循环
      syncState.isUserDragging = true;
      syncState.skipAutoSync = skipAutoSync;
      syncState.preserveRotation = preserveRotation;
      syncState.disableReverseSync = disableReverseSync;

      // ⭐ 如果不是左键翻转（disableReverseSync = false），重新启用 Dual → Cesium 同步
      if (!disableReverseSync && syncState.dualToCesiumSyncPermanentlyDisabled) {
        syncState.dualToCesiumSyncPermanentlyDisabled = false;
        if (syncState.startDualToCesiumSync) {
          syncState.startDualToCesiumSync();
        }
        console.log('[CesiumDualSyncV2] 右键平移/滚轮操作：重新启用 Dual → Cesium 同步循环');
      }

      if (syncState.stopDualToCesiumSync) {
        syncState.stopDualToCesiumSync();
      }
    } else {
      // 拖动结束
      if (disableReverseSync) {
        // ⭐ 左键翻转：延迟后恢复同步循环（不再永久停止）
        // 这样可以保持大坐标模型锚定在 Cesium 的固定经纬度
        setTimeout(() => {
          syncState.preserveRotation = false;
          syncState.disableReverseSync = false;
          syncState.isUserDragging = false;

          // 恢复同步循环以支持大坐标模型锚定
          if (syncState.startDualToCesiumSync) {
            syncState.startDualToCesiumSync();
          }

          console.log('[CesiumDualSyncV2] ⭐ 左键翻转保护窗口结束（650ms），同步循环已恢复（支持大坐标模型锚定）');
        }, 650);
      } else if (!skipAutoSync) {
        // 右键平移等其他操作：延迟后恢复同步循环和拖动状态
        syncState.skipAutoSync = skipAutoSync;
        syncState.preserveRotation = preserveRotation;

        setTimeout(() => {
          if (syncState.startDualToCesiumSync) {
            syncState.startDualToCesiumSync();
          }

          syncState.isUserDragging = false;

          if (preserveRotation) {
            setTimeout(() => {
              syncState.preserveRotation = false;
              syncState.preserveRotationEndTime = Date.now();
              console.log('[CesiumDualSyncV2] 右键平移保护窗口结束');
            }, 500);
          }

          console.log('[CesiumDualSyncV2] 右键平移结束：已恢复同步循环和拖动状态');
        }, 150);
      } else {
        // 跳过自动同步：立即设置标志，延迟后恢复同步循环
        syncState.isUserDragging = false;
        syncState.skipAutoSync = skipAutoSync;

        setTimeout(() => {
          if (syncState.startDualToCesiumSync) {
            syncState.startDualToCesiumSync();
          }
          console.log('[CesiumDualSyncV2] 恢复同步循环（跳过自动同步）');
        }, 150);
      }
    }
  }

  // ==================== 初始化 ====================

  // 等待组件就绪后初始化
  waitForComponents(initSync);

  // ⭐ 将控制接口暴露到全局（使用 cesiumDualSyncV2 避免与旧版本冲突）
  window.cesiumDualSyncV2 = {
    setEnabled: setSyncEnabled,
    trigger: triggerSync,
    setUserDragging: setUserDragging,
    getState: () => syncState,
    setBlockSyncUntil: (timestamp) => {
      const now = Date.now();
      syncState.blockDualToCesiumSyncUntil = timestamp;
      const duration = timestamp - now;
      console.log('[CesiumDualSyncV2] 设置阻止 Dual → Cesium 同步窗口:', duration, 'ms, 直到:', new Date(timestamp).toLocaleTimeString());
    },
    restartDualToCesiumSync: () => {
      syncState.dualToCesiumSyncPermanentlyDisabled = false;
      if (syncState.startDualToCesiumSync) {
        syncState.startDualToCesiumSync();
      }
      console.log('[CesiumDualSyncV2] ⭐ 手动重启 Dual → Cesium 同步循环');
    },

    // ⭐ 整合自主项目：额外暴露的状态和方法
    get syncOperationCount() {
      return syncState.syncOperationCount;
    },
    set syncOperationCount(value) {
      syncState.syncOperationCount = value;
    },
    get skipNextCesiumSync() {
      return syncState.skipNextCesiumSync;
    },
    set skipNextCesiumSync(value) {
      syncState.skipNextCesiumSync = value;
    }
  };

  console.log('[CesiumDualSyncV2] ✅ 控制接口已暴露到 window.cesiumDualSyncV2');
  console.log('[CesiumDualSyncV2] ✅ 整合主项目同步架构完成（ENU检测、背面检测、大坐标检测）');
})();
