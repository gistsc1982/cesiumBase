/**
 * Cesium 与 DualCanvasViewer 双向同步脚本
 * 负责 Cesium 地图层和 DualCanvasViewer 双层组件的相机和坐标同步
 * 清理版本：优化同步逻辑，与重构后的 SyncManager 协调工作
 */

(function() {
  'use strict';

  // 同步状态管理
  const syncState = {
    isSyncing: false,
    syncDepth: 0,
    cesiumViewer: null,
    dualCanvasViewer: null,
    lastSyncTime: 0,
    isEnabled: true,
    isUserDragging: false,
    skipAutoSync: false,
    preserveRotation: false,
    preserveRotationEndTime: 0,
    dualToCesiumSyncPermanentlyDisabled: false,
    blockDualToCesiumSyncUntil: 0,
    pendingDualToCesiumSync: false,
    // 操作锁机制 - 用于控制鼠标操作期间的监听状态
    operationLock: {
      locked: false,
      operationType: null, // 'rotate' | 'pan' | 'zoom'
      mode: null,          // 'surface' | 'underground'
      lockStartTime: 0,
      lockTimeout: 3000
    }
  };

  /**
   * 等待必要组件就绪
   */
  function waitForComponents(callback) {
    const checkReady = () => {
      const hasCesium = typeof window.Cesium !== 'undefined';
      const hasViewer = typeof window.__cesiumViewer__ !== 'undefined';
      const hasDualInstances = window.__dualCanvasViewerInstances &&
                               window.__dualCanvasViewerInstances.length > 0;
      const hasSyncManager = typeof window.__syncManager__ !== 'undefined';

      if (hasCesium && hasViewer && hasDualInstances && hasSyncManager) {
        callback();
      } else {
        setTimeout(checkReady, 100);
      }
    };
    checkReady();
  }

  /**
   * 初始化同步系统
   */
  function initSync() {
    syncState.cesiumViewer = window.__cesiumViewer__;
    if (!syncState.cesiumViewer) {
      console.error('[CesiumDualSync] Cesium Viewer 不可用');
      return;
    }

    if (window.__dualCanvasViewerInstances && window.__dualCanvasViewerInstances.length > 0) {
      syncState.dualCanvasViewer = window.__dualCanvasViewerInstances[0];
    } else {
      console.error('[CesiumDualSync] DualCanvasViewer 实例不可用');
      return;
    }

    setupCesiumToDualSync();
    setupDualToCesiumSync();

    setTimeout(() => {
      performInitialSync();
    }, 500);

    console.log('[CesiumDualSync] 同步系统初始化完成');
  }

  /**
   * 执行初始同步
   */
  function performInitialSync() {
    syncCesiumToDual();
  }

  /**
   * 设置 Cesium 到 Dual 的同步监听
   */
  function setupCesiumToDualSync() {
    const camera = syncState.cesiumViewer.camera;

    camera.moveEnd.addEventListener(() => {
      if (syncState.pendingDualToCesiumSync && syncState.syncDepth > 0) {
        syncState.syncDepth--;
        syncState.pendingDualToCesiumSync = false;
        return;
      }

      setTimeout(() => {
        if (syncState.isEnabled && syncState.syncDepth === 0 && !syncState.isUserDragging) {
          const timeSincePreserveRotation = Date.now() - syncState.preserveRotationEndTime;
          if (timeSincePreserveRotation < 500) {
            return;
          }

          const now = Date.now();
          if (now < syncState.blockDualToCesiumSyncUntil) {
            return;
          }

          syncCesiumToDual();
        }
      }, 100);
    });
  }

  /**
   * 设置 Dual 到 Cesium 的同步监听
   */
  function setupDualToCesiumSync() {
    const dualViewer = syncState.dualCanvasViewer;

    let lastCameraState = null;
    let rafId = null;
    let isRunning = true;

    const checkCameraChange = () => {
      if (!isRunning) return;

      if (!syncState.isEnabled || !dualViewer || !dualViewer.camera1 || !dualViewer.controls1) {
        rafId = requestAnimationFrame(checkCameraChange);
        return;
      }

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

      lastCameraState = currentCameraState;
      rafId = requestAnimationFrame(checkCameraChange);
    };

    rafId = requestAnimationFrame(checkCameraChange);

    syncState.stopDualToCesiumSync = () => {
      isRunning = false;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    syncState.startDualToCesiumSync = () => {
      if (!isRunning) {
        isRunning = true;
        lastCameraState = null;
        checkCameraChange();
      }
    };

    document.addEventListener('DualCameraChanged', () => {
      if (syncState.isEnabled && syncState.syncDepth === 0 && !syncState.isUserDragging) {
        syncDualToCesium();
      }
    });
  }

  /**
   * 在大坐标模式下从 Cesium 同步到 DualCanvasViewer
   * 直接使用墨卡托坐标作为 Three.js 坐标，保持在大坐标系统
   */
  function syncCesiumToDualInLargeCoordMode() {
    syncState.syncDepth++;
    if (syncState.syncDepth > 1) {
      syncState.syncDepth--;
      return;
    }

    try {
      const Cesium = window.Cesium;
      const camera = syncState.cesiumViewer.camera;
      const scene = syncState.cesiumViewer.scene;
      const dualViewer = syncState.dualCanvasViewer;

      if (!Cesium || !camera || !dualViewer) {
        syncState.syncDepth--;
        return;
      }

      if (!dualViewer.camera1 || !dualViewer.controls1) {
        syncState.syncDepth--;
        return;
      }

      const ellipsoid = scene.globe.ellipsoid;
      const earthRadius = ellipsoid.maximumRadius || 6378137.0;

      // 获取 Cesium 相机的墨卡托坐标
      const cameraCartographic = ellipsoid.cartesianToCartographic(camera.position);
      const mercatorPosition = {
        x: cameraCartographic.longitude * earthRadius,
        y: Math.log(Math.tan(Math.PI / 4 + cameraCartographic.latitude / 2)) * earthRadius,
        z: cameraCartographic.height
      };

      // 直接使用墨卡托坐标作为 Three.js 坐标（不经过地板中心偏移）
      const threeCameraPosition = {
        x: mercatorPosition.x,
        y: mercatorPosition.z,  // 高度作为 Y
        z: -mercatorPosition.y   // 纬度取反作为 Z
      };

      // 计算目标点（地面）
      const threeTargetPosition = {
        x: mercatorPosition.x,
        y: 0,  // 地面高度为 0
        z: -mercatorPosition.y
      };

      console.log('[CesiumDualSync] 大坐标模式：Cesium → Dual 同步', {
        cesiumHeight: cameraCartographic.height.toFixed(2),
        mercatorPosition: `(${mercatorPosition.x.toFixed(2)}, ${mercatorPosition.y.toFixed(2)}, ${mercatorPosition.z.toFixed(2)})`,
        threePosition: `(${threeCameraPosition.x.toFixed(2)}, ${threeCameraPosition.y.toFixed(2)}, ${threeCameraPosition.z.toFixed(2)})`
      });

      updateDualCamera(threeCameraPosition, threeTargetPosition);

    } catch (error) {
      console.error('[CesiumDualSync] 大坐标模式 Cesium → Dual 同步错误:', error);
    } finally {
      syncState.syncDepth--;
    }
  }

  /**
   * 从 Cesium 同步到 DualCanvasViewer
   */
  function syncCesiumToDual() {
    if (syncState.isUserDragging) return;
    if (syncState.disableReverseSync) return;

    // 在统一坐标系模式下，跳过 Cesium 到 Dual 的同步
    // 因为统一坐标系模式会通过 handleWheel/handleMouseOperation 直接同步
    if (window.__unifiedProjectionMode__) {
      return;
    }

    const now = Date.now();
    if (now < syncState.blockDualToCesiumSyncUntil) return;

    // ⚠️ 关键修复：在大坐标模式下完全禁用 Cesium 到 Dual 的同步
    // 因为 Cesium 缩放只用于视觉效果，不应该影响 Three.js 相机位置
    const LARGE_COORD_THRESHOLD = 10000;
    const dualViewer = syncState.dualCanvasViewer;
    const isDualInLargeCoord = dualViewer &&
      dualViewer.camera1 &&
      dualViewer.camera1.position &&
      (Math.abs(dualViewer.camera1.position.x) > LARGE_COORD_THRESHOLD ||
       Math.abs(dualViewer.camera1.position.z) > LARGE_COORD_THRESHOLD);

    if (isDualInLargeCoord) {
      console.log('[CesiumDualSync] 大坐标模式：跳过 Cesium → Dual 同步，保持 Three.js 相机位置不变');
      return;
    }

    syncState.syncDepth++;
    if (syncState.syncDepth > 1) {
      syncState.syncDepth--;
      return;
    }

    try {
      const Cesium = window.Cesium;
      const camera = syncState.cesiumViewer.camera;
      const scene = syncState.cesiumViewer.scene;
      const syncManager = window.__syncManager__;

      if (!Cesium || !camera || !syncManager) return;

      const ellipsoid = scene.globe.ellipsoid;
      const cameraPosition = camera.position;
      const cartographic = ellipsoid.cartesianToCartographic(cameraPosition);
      const earthRadius = ellipsoid.maximumRadius || 6378137.0;

      const mercatorPosition = {
        x: cartographic.longitude * earthRadius,
        y: Math.log(Math.tan(Math.PI / 4 + cartographic.latitude / 2)) * earthRadius,
        z: cartographic.height
      };

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

        const mayIntersect = isValidDirection && isValidPosition && Math.abs(direction.z) < 0.99;

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

      if (!targetCartographic) {
        targetCartographic = Cesium.Cartographic.fromRadians(
          cartographic.longitude,
          cartographic.latitude,
          0
        );
      }

      const targetMercator = {
        x: targetCartographic.longitude * earthRadius,
        y: Math.log(Math.tan(Math.PI / 4 + targetCartographic.latitude / 2)) * earthRadius,
        z: 0
      };

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

      updateDualCamera(threeCameraPosition, threeTargetPosition);

    } catch (error) {
      console.error('[CesiumDualSync] Cesium → Dual 同步错误:', error);
    } finally {
      syncState.syncDepth--;
    }
  }

  /**
   * 从 DualCanvasViewer 同步到 Cesium
   */
  function syncDualToCesium() {
    syncState.syncDepth++;
    if (syncState.syncDepth > 1) {
      syncState.syncDepth--;
      return;
    }

    syncState.pendingDualToCesiumSync = true;

    try {
      const dualViewer = syncState.dualCanvasViewer;
      const syncManager = window.__syncManager__;

      if (!dualViewer || !syncManager) {
        syncState.syncDepth--;
        syncState.pendingDualToCesiumSync = false;
        return;
      }

      if (!dualViewer.camera1 || !dualViewer.controls1) {
        syncState.syncDepth--;
        syncState.pendingDualToCesiumSync = false;
        return;
      }

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

      const isValidCoord = (coord) => {
        return typeof coord.x === 'number' && isFinite(coord.x) && !isNaN(coord.x) &&
               typeof coord.y === 'number' && isFinite(coord.y) && !isNaN(coord.y) &&
               typeof coord.z === 'number' && isFinite(coord.z) && !isNaN(coord.z);
      };

      if (!isValidCoord(threeCameraPosition) || !isValidCoord(threeTargetPosition)) {
        syncState.syncDepth--;
        syncState.pendingDualToCesiumSync = false;
        return;
      }

      // ⚠️ 关键修复：在大坐标模式下跳过同步到 Cesium
      // 大坐标模式包括：
      // 1. 真实世界模式 (isInRealWorldMode = true)
      // 2. 混合模式 (geoOffset.enabled = true)
      // 3. ENU坐标系模式 (usingENU = true)
      // 4. 相机在大坐标位置 (超过阈值)
      const LARGE_COORD_THRESHOLD = 10000;
      const isInLargeCoordMode =
        Math.abs(threeCameraPosition.x) > LARGE_COORD_THRESHOLD ||
        Math.abs(threeCameraPosition.z) > LARGE_COORD_THRESHOLD ||
        (dualViewer.isInRealWorldMode) ||
        (dualViewer.mouseCoords && dualViewer.mouseCoords.geoOffset && dualViewer.mouseCoords.geoOffset.enabled) ||
        (dualViewer.usingENU);  // ⭐ 添加ENU模式检测

      if (isInLargeCoordMode) {
        console.log('[CesiumDualSync] 大坐标模式：跳过同步到 Cesium', {
          cameraPosition: `(${threeCameraPosition.x.toFixed(2)}, ${threeCameraPosition.y.toFixed(2)}, ${threeCameraPosition.z.toFixed(2)})`,
          isInRealWorldMode: dualViewer.isInRealWorldMode,
          usingENU: dualViewer.usingENU,
          hasGeoOffset: !!(dualViewer.mouseCoords && dualViewer.mouseCoords.geoOffset && dualViewer.mouseCoords.geoOffset.enabled)
        });
        syncState.syncDepth--;
        syncState.pendingDualToCesiumSync = false;
        return;
      }

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

      if (!isValidCoord(mercatorCamera) || !isValidCoord(mercatorTarget)) {
        syncState.syncDepth--;
        syncState.pendingDualToCesiumSync = false;
        return;
      }

      updateCesiumCamera(mercatorCamera, mercatorTarget);

      setTimeout(() => {
        if (syncState.pendingDualToCesiumSync && syncState.syncDepth > 0) {
          syncState.syncDepth--;
          syncState.pendingDualToCesiumSync = false;
        }
      }, 2000);

    } catch (error) {
      syncState.syncDepth--;
      syncState.pendingDualToCesiumSync = false;
      console.error('[CesiumDualSync] Dual → Cesium 同步错误:', error);
    }
  }

  /**
   * 更新 DualCanvasViewer 的相机
   */
  function updateDualCamera(cameraPosition, targetPosition) {
    const dualViewer = syncState.dualCanvasViewer;

    const isValidCoord = (coord) => {
      return typeof coord === 'number' && isFinite(coord) && !isNaN(coord);
    };

    const isCameraValid = isValidCoord(cameraPosition.x) && isValidCoord(cameraPosition.y) && isValidCoord(cameraPosition.z);
    const isTargetValid = isValidCoord(targetPosition.x) && isValidCoord(targetPosition.y) && isValidCoord(targetPosition.z);

    if (!isCameraValid || !isTargetValid) return;

    if (dualViewer.camera1 && dualViewer.controls1) {
      const PRESERVE_WINDOW = 1000;
      const isWithinPreserveWindow = syncState.preserveRotationEndTime &&
        (Date.now() - syncState.preserveRotationEndTime) < PRESERVE_WINDOW;
      const shouldPreserveRotation = syncState.preserveRotation || isWithinPreserveWindow;

      if (shouldPreserveRotation) {
        const originalQuaternion = dualViewer.camera1.quaternion.clone();
        const originalOffset = new dualViewer.camera1.position.constructor();
        originalOffset.copy(dualViewer.camera1.position).sub(dualViewer.controls1.target);
        const originalDistance = originalOffset.length();

        dualViewer.camera1.position.set(
          cameraPosition.x,
          cameraPosition.y,
          cameraPosition.z
        );

        dualViewer.camera1.quaternion.copy(originalQuaternion);

        dualViewer.controls1.target.set(
          targetPosition.x,
          targetPosition.y,
          targetPosition.z
        );

        dualViewer.controls1.object = dualViewer.camera1;
      } else {
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

    if (dualViewer.camera2 && dualViewer.controls2) {
      const shouldPreserveRotation = syncState.preserveRotation;

      if (shouldPreserveRotation) {
        dualViewer.camera2.position.copy(dualViewer.camera1.position);
        dualViewer.camera2.quaternion.copy(dualViewer.camera1.quaternion);
        dualViewer.camera2.up.copy(dualViewer.camera1.up);
        dualViewer.controls2.target.copy(dualViewer.controls1.target);
        dualViewer.controls2.object = dualViewer.camera2;
      } else {
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

      dualViewer.camera2.fov = dualViewer.camera1.fov;
      dualViewer.camera2.near = dualViewer.camera1.near;
      dualViewer.camera2.far = dualViewer.camera1.far;
      dualViewer.camera2.zoom = dualViewer.camera1.zoom;
      dualViewer.camera2.updateProjectionMatrix();
    }
  }

  /**
   * 更新 Cesium 相机
   */
  function updateCesiumCamera(mercatorCamera, mercatorTarget) {
    const Cesium = window.Cesium;
    const cesiumViewer = syncState.cesiumViewer;

    if (!Cesium || !cesiumViewer) return;

    const ellipsoid = cesiumViewer.scene.globe.ellipsoid;
    const earthRadius = ellipsoid.maximumRadius || ellipsoid.radiusX || 6378137.0;

    const safeMercatorToLatitude = (mercatorY) => {
      if (!isFinite(mercatorY) || isNaN(mercatorY)) {
        return 0;
      }

      const MAX_MERCATOR_Y = earthRadius * Math.log(Math.tan(Math.PI / 4 + Math.PI * 85.05 / 180 / 2));
      const clampedMercatorY = Math.max(-MAX_MERCATOR_Y, Math.min(MAX_MERCATOR_Y, mercatorY));

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

    const longitude = mercatorCamera.x / earthRadius;
    const latitude = safeMercatorToLatitude(mercatorCamera.y);
    const height = mercatorCamera.z || 0;

    if (!isFinite(longitude) || !isFinite(latitude) || !isFinite(height) ||
        isNaN(longitude) || isNaN(latitude) || isNaN(height)) {
      return;
    }

    const clampedLatitude = Math.max(-Math.PI * 85.05 / 180, Math.min(Math.PI * 85.05 / 180, latitude));

    try {
      const cameraCartesian = Cesium.Cartesian3.fromRadians(
        longitude,
        clampedLatitude,
        height
      );

      if (!cameraCartesian || !Cesium.defined(cameraCartesian) ||
          isNaN(cameraCartesian.x) || isNaN(cameraCartesian.y) || isNaN(cameraCartesian.z)) {
        return;
      }

      if (mercatorTarget && isFinite(mercatorTarget.x) && isFinite(mercatorTarget.y)) {
        const targetLongitude = mercatorTarget.x / earthRadius;
        const targetLatitude = safeMercatorToLatitude(mercatorTarget.y);
        const targetHeight = mercatorTarget.z || 0;

        const targetCartesian = Cesium.Cartesian3.fromRadians(
          targetLongitude,
          targetLatitude,
          targetHeight
        );

        // ⚠️ 修复：验证 targetCartesian 的有效性
        if (!targetCartesian || !Cesium.defined(targetCartesian) ||
            isNaN(targetCartesian.x) || isNaN(targetCartesian.y) || isNaN(targetCartesian.z)) {
          console.warn('[CesiumDualSync] targetCartesian 无效，只设置相机位置');
          cesiumViewer.camera.position = cameraCartesian;
          return;
        }

        // 计算方向向量
        const direction = Cesium.Cartesian3.subtract(
          targetCartesian,
          cameraCartesian,
          new Cesium.Cartesian3()
        );

        // ⚠️ 修复：验证 direction 向量的有效性
        const directionLength = Cesium.Cartesian3.magnitude(direction);
        if (!isFinite(directionLength) || directionLength < 0.001) {
          console.warn('[CesiumDualSync] direction 向量无效或过小，使用默认方向:', {
            length: directionLength,
            camera: cameraCartesian,
            target: targetCartesian
          });
          cesiumViewer.camera.position = cameraCartesian;
          return;
        }

        // 归一化方向向量
        Cesium.Cartesian3.normalize(direction, direction);

        cesiumViewer.camera.position = cameraCartesian;
        cesiumViewer.camera.direction = direction;

        const up = ellipsoid.geodeticSurfaceNormal(cameraCartesian, new Cesium.Cartesian3());
        cesiumViewer.camera.up = up;
        cesiumViewer.camera.right = Cesium.Cartesian3.cross(
          cesiumViewer.camera.direction,
          cesiumViewer.camera.up,
          new Cesium.Cartesian3()
        );
        Cesium.Cartesian3.normalize(cesiumViewer.camera.right, cesiumViewer.camera.right);
      } else {
        cesiumViewer.camera.position = cameraCartesian;
      }
    } catch (error) {
      console.error('[CesiumDualSync] 更新 Cesium 相机时出错:', error);
    }
  }

  /**
   * 启用/禁用同步
   */
  function setSyncEnabled(enabled) {
    syncState.isEnabled = enabled;
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
   * 设置操作锁
   * 用于控制鼠标操作期间的监听状态
   * @param {string} operationType - 操作类型 'rotate' | 'pan' | 'zoom'
   * @param {string} mode - 模式 'surface' | 'underground'
   */
  function setOperationLock(operationType, mode) {
    syncState.operationLock.locked = true;
    syncState.operationLock.operationType = operationType;
    syncState.operationLock.mode = mode;
    syncState.operationLock.lockStartTime = Date.now();

    // 禁用鼠标监听
    if (syncState.stopDualToCesiumSync) {
      syncState.stopDualToCesiumSync();
    }

    console.log(`[CesiumDualSync] 操作锁已设置: ${operationType} / ${mode}`);
  }

  /**
   * 释放操作锁
   * 恢复鼠标监听
   * @param {string} operationType - 操作类型
   * @param {string} mode - 模式
   */
  function releaseOperationLock(operationType, mode) {
    if (syncState.operationLock.locked) {
      // 验证操作类型和模式是否匹配
      if (syncState.operationLock.operationType === operationType &&
          syncState.operationLock.mode === mode) {
        syncState.operationLock.locked = false;
        syncState.operationLock.operationType = null;
        syncState.operationLock.mode = null;
        syncState.operationLock.lockStartTime = 0;

        // 恢复鼠标监听
        if (syncState.startDualToCesiumSync) {
          syncState.startDualToCesiumSync();
        }

        console.log(`[CesiumDualSync] 操作锁已释放: ${operationType} / ${mode}`);
      } else {
        console.warn(`[CesiumDualSync] 操作锁不匹配，无法释放:`, {
          expected: `${syncState.operationLock.operationType} / ${syncState.operationLock.mode}`,
          provided: `${operationType} / ${mode}`
        });
      }
    }
  }

  /**
   * 获取操作锁状态
   * @returns {Object} 操作锁状态
   */
  function getOperationLock() {
    return { ...syncState.operationLock };
  }

  /**
   * 检查操作锁是否超时
   * @returns {boolean} true 表示已超时
   */
  function isOperationLockExpired() {
    if (!syncState.operationLock.locked) {
      return false;
    }

    const elapsed = Date.now() - syncState.operationLock.lockStartTime;
    return elapsed > syncState.operationLock.lockTimeout;
  }

  /**
   * 设置用户拖动状态
   */
  function setUserDragging(isDragging, skipAutoSync = false, preserveRotation = false, disableReverseSync = false) {
    if (isDragging) {
      syncState.isUserDragging = true;
      syncState.skipAutoSync = skipAutoSync;
      syncState.preserveRotation = preserveRotation;
      syncState.disableReverseSync = disableReverseSync;

      if (!disableReverseSync && syncState.dualToCesiumSyncPermanentlyDisabled) {
        syncState.dualToCesiumSyncPermanentlyDisabled = false;
        if (syncState.startDualToCesiumSync) {
          syncState.startDualToCesiumSync();
        }
      }

      if (syncState.stopDualToCesiumSync) {
        syncState.stopDualToCesiumSync();
      }
    } else {
      if (disableReverseSync) {
        syncState.dualToCesiumSyncPermanentlyDisabled = true;
        setTimeout(() => {
          syncState.preserveRotation = false;
          syncState.disableReverseSync = false;
          syncState.isUserDragging = false;
        }, 650);
      } else if (!skipAutoSync) {
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
            }, 500);
          }
        }, 150);
      } else {
        syncState.isUserDragging = false;
        syncState.skipAutoSync = skipAutoSync;

        setTimeout(() => {
          if (syncState.startDualToCesiumSync) {
            syncState.startDualToCesiumSync();
          }
        }, 150);
      }
    }
  }

  // 等待组件就绪后初始化
  waitForComponents(initSync);

  // 将控制接口暴露到全局
  window.cesiumDualSync = {
    setEnabled: setSyncEnabled,
    trigger: triggerSync,
    setUserDragging: setUserDragging,
    getState: () => syncState,
    setBlockSyncUntil: (timestamp) => {
      syncState.blockDualToCesiumSyncUntil = timestamp;
    },
    // 操作锁接口
    setOperationLock: setOperationLock,
    releaseOperationLock: releaseOperationLock,
    getOperationLock: getOperationLock,
    isOperationLockExpired: isOperationLockExpired
  };

  console.log('[CesiumDualSync] 控制接口已暴露到 window.cesiumDualSync');
})();
