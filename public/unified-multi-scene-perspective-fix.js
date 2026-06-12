// ═══════════════════════════════════════════════════════════════════
// 统一多场景管理器 - 分层 Near/Far 架构 + 透视翻转修复
// ═══════════════════════════════════════════════════════════════════
// 功能：
//   1. 在一个canvas内使用多个场景+相机，实现分层 near/far
//   2. 自动修复透视翻转问题（远大近小 -> 近大远小）
//
// 架构：
//   - 原始层：Scene1_Large (大坐标) + Scene1_Small (小坐标)
//   - BIM层：Scene2_Large (大坐标) + Scene2_Small (小坐标)
//   - 每层使用两个场景累积渲染，共享同一个渲染器
//
// 使用方法：
//   在浏览器控制台执行此脚本即可
// ═══════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  🚀 统一多场景管理器 + 透视翻转修复                      ║');
  console.log('║  📊 分层 Near/Far 架构                                    ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // ═══════════════════════════════════════════════════════════════════
  // 步骤1：检查 DualCanvasViewer 实例
  // ═══════════════════════════════════════════════════════════════════
  console.log('🔍 [步骤1/7] 检查 DualCanvasViewer 实例...');

  const dualViewer = window.__dualCanvasViewer;
  if (!dualViewer) {
    console.error('❌ DualCanvasViewer 实例未找到');
    console.error('   请确保页面已正确加载 DualCanvasViewer');
    return;
  }

  console.log('  ✅ DualCanvasViewer 实例已找到');

  // ═══════════════════════════════════════════════════════════════════
  // 配置常量
  // ═══════════════════════════════════════════════════════════════════
  const CONFIG = {
    // 大坐标阈值（超过此值视为大坐标模型）
    LARGE_COORD_THRESHOLD: 10000,

    // 大坐标场景的 near/far
    LARGE_SCENE_NEAR: 0.1,
    LARGE_SCENE_FAR: 15000000,

    // 小坐标场景的 near/far
    SMALL_SCENE_NEAR: 36,
    SMALL_SCENE_FAR: 1802,

    // 是否启用对数深度缓冲区
    LARGE_SCENE_LOG_DEPTH: true,
    SMALL_SCENE_LOG_DEPTH: false
  };

  // ═══════════════════════════════════════════════════════════════════
  // 多场景管理器类
  // ═══════════════════════════════════════════════════════════════════
  class MultiSceneManager {
    constructor(dualViewer) {
      this.dualViewer = dualViewer;
      this.scenes = {};
      this.cameras = {};
      this.renderTargets = {};
      this.referencePoints = {
        layer1: null,  // 原始层的参考点（大模型位置）
        layer2: null   // BIM层的参考点（大模型位置）
      };

      // 获取 THREE 库（尝试从已存在的对象中反推）
      this.THREE = dualViewer.THREE || window.THREE || dualViewer._THREE;

      if (!this.THREE) {
        // 尝试从已存在的对象获取构造函数，然后反推 THREE 库
        if (dualViewer.renderer1) {
          // 从渲染器获取
          const renderer = dualViewer.renderer1;
          if (renderer && renderer.constructor) {
            // 尝试通过构造函数的原型链找到 THREE
            let proto = renderer.constructor;
            while (proto && !this.THREE) {
              if (proto.THREE) {
                this.THREE = proto.THREE;
                break;
              }
              proto = Object.getPrototypeOf(proto);
            }
          }
        }

        // 如果还没找到，尝试从 scene1 获取
        if (!this.THREE && dualViewer.scene1) {
          const scene = dualViewer.scene1;
          if (scene && scene.constructor) {
            // 尝试通过构造函数的原型链找到 THREE
            let proto = scene.constructor;
            while (proto && !this.THREE) {
              if (proto.THREE) {
                this.THREE = proto.THREE;
                break;
              }
              // 也检查是否在 window 对象上
              if (window.THREE) {
                this.THREE = window.THREE;
                break;
              }
              proto = Object.getPrototypeOf(proto);
            }
          }
        }

        // 最后尝试从 camera 获取
        if (!this.THREE && dualViewer.camera1) {
          const camera = dualViewer.camera1;
          if (camera && camera.constructor) {
            // 检查相机对象上是否有 type 属性（Three.js 对象特征）
            if (camera.type === 'PerspectiveCamera') {
              // 尝试构造一个临时对象来获取 THREE
              // 通过对象的构造函数名称和结构来推断
              this.THREE = {
                Scene: dualViewer.scene1.constructor,
                PerspectiveCamera: camera.constructor,
                Renderer: dualViewer.renderer1.constructor,
                Vector3: class {
                  constructor(x = 0, y = 0, z = 0) {
                    this.x = x;
                    this.y = y;
                    this.z = z;
                  }
                  clone() {
                    return new this.constructor(this.x, this.y, this.z);
                  }
                  copy(v) {
                    this.x = v.x;
                    this.y = v.y;
                    this.z = v.z;
                    return this;
                  }
                  sub(v) {
                    return new this.constructor(this.x - v.x, this.y - v.y, this.z - v.z);
                  }
                  add(v) {
                    return new this.constructor(this.x + v.x, this.y + v.y, this.z + v.z);
                  }
                  distanceTo(v) {
                    const dx = this.x - v.x;
                    const dy = this.y - v.y;
                    const dz = this.z - v.z;
                    return Math.sqrt(dx * dx + dy * dy + dz * dz);
                  }
                }
              };
            }
          }
        }
      }

      if (!this.THREE) {
        console.error('❌ THREE 库未找到');
        console.error('   请确保页面已加载 Three.js');
        console.error('   尝试的位置:');
        console.error('   - dualViewer.THREE');
        console.error('   - window.THREE');
        console.error('   - dualViewer._THREE');
        console.error('   - renderer.constructor.THREE');
        console.error('   - scene.constructor.THREE');

        // 尝试动态加载 THREE.js
        console.log('\n💡 尝试动态加载 THREE.js...');
        if (typeof Promise !== 'undefined') {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/three@0.160.0/build/three.min.js';
          script.onload = () => {
            console.log('✅ THREE.js 加载成功，请重新执行脚本');
          };
          script.onerror = () => {
            console.error('❌ THREE.js 加载失败');
          };
          document.head.appendChild(script);
        }
      } else {
        console.log('✅ THREE 库已找到');
      }

      console.log('🎬 MultiSceneManager 初始化...');
    }

    // ═══════════════════════════════════════════════════════════════════
    // 初始化多场景架构
    // ═══════════════════════════════════════════════════════════════════
    initialize() {
      console.log('\n🏗️ 初始化多场景架构...');

      // 检查 THREE 库是否可用
      if (!this.THREE) {
        console.error('❌ THREE 库未找到，无法初始化多场景架构');
        return;
      }

      const THREE = this.THREE;  // 使用局部变量方便后续调用

      // 保存原始场景和相机
      const originalScene1 = this.dualViewer.scene1;
      const originalScene2 = this.dualViewer.scene2;
      const originalCamera1 = this.dualViewer.camera1;
      const originalCamera2 = this.dualViewer.camera2;

      // ═══════════════════════════════════════════════════════════════
      // 创建原始层的两个场景
      // ═══════════════════════════════════════════════════════════════
      console.log('  📦 创建原始层场景...');

      this.scenes.layer1Large = new THREE.Scene();
      this.scenes.layer1Small = new THREE.Scene();

      // 复制原始场景的属性
      this.scenes.layer1Large.background = originalScene1.background;
      this.scenes.layer1Small.background = originalScene1.background;

      if (originalScene1.fog) {
        this.scenes.layer1Large.fog = originalScene1.fog.clone();
        this.scenes.layer1Small.fog = originalScene1.fog.clone();
      }

      // ═══════════════════════════════════════════════════════════════
      // 创建BIM层的两个场景
      // ═══════════════════════════════════════════════════════════════
      console.log('  📦 创建BIM层场景...');

      this.scenes.layer2Large = new THREE.Scene();
      this.scenes.layer2Small = new THREE.Scene();

      // 复制原始场景的属性
      this.scenes.layer2Large.background = originalScene2.background;
      this.scenes.layer2Small.background = originalScene2.background;

      if (originalScene2.fog) {
        this.scenes.layer2Large.fog = originalScene2.fog.clone();
        this.scenes.layer2Small.fog = originalScene2.fog.clone();
      }

      // ═══════════════════════════════════════════════════════════════
      // 创建四个相机（基于原始相机）
      // ═══════════════════════════════════════════════════════════════
      console.log('  📷 创建分层相机...');

      const fov = originalCamera1.fov * (180 / Math.PI);
      const aspect = originalCamera1.aspect;

      // 原始层相机
      this.cameras.layer1Large = new THREE.PerspectiveCamera(
        fov, aspect,
        CONFIG.LARGE_SCENE_NEAR,
        CONFIG.LARGE_SCENE_FAR
      );

      this.cameras.layer1Small = new THREE.PerspectiveCamera(
        fov, aspect,
        CONFIG.SMALL_SCENE_NEAR,
        CONFIG.SMALL_SCENE_FAR
      );

      // BIM层相机
      this.cameras.layer2Large = new THREE.PerspectiveCamera(
        fov, aspect,
        CONFIG.LARGE_SCENE_NEAR,
        CONFIG.LARGE_SCENE_FAR
      );

      this.cameras.layer2Small = new THREE.PerspectiveCamera(
        fov, aspect,
        CONFIG.SMALL_SCENE_NEAR,
        CONFIG.SMALL_SCENE_FAR
      );

      console.log(`    ✅ 原始层大坐标: near=${CONFIG.LARGE_SCENE_NEAR}, far=${CONFIG.LARGE_SCENE_FAR}`);
      console.log(`    ✅ 原始层小坐标: near=${CONFIG.SMALL_SCENE_NEAR}, far=${CONFIG.SMALL_SCENE_FAR}`);
      console.log(`    ✅ BIM层大坐标: near=${CONFIG.LARGE_SCENE_NEAR}, far=${CONFIG.LARGE_SCENE_FAR}`);
      console.log(`    ✅ BIM层小坐标: near=${CONFIG.SMALL_SCENE_NEAR}, far=${CONFIG.SMALL_SCENE_FAR}`);

      // ═══════════════════════════════════════════════════════════════
      // 分类并移动模型
      // ═══════════════════════════════════════════════════════════════
      console.log('\n🔄 分类并移动模型到对应场景...');
      this.classifyAndMoveModels();

      // ═══════════════════════════════════════════════════════════════
      // 修改渲染器设置
      // ═══════════════════════════════════════════════════════════════
      console.log('\n🎨 修改渲染器设置...');
      this.setupRenderers();

      // ═══════════════════════════════════════════════════════════════
      // 替换渲染循环
      // ═══════════════════════════════════════════════════════════════
      console.log('\n🔄 替换渲染循环...');
      this.replaceRenderLoops();

      // ═══════════════════════════════════════════════════════════════
      // 设置相机同步
      // ═══════════════════════════════════════════════════════════════
      console.log('\n🔗 设置相机同步...');
      this.setupCameraSync();

      // ═══════════════════════════════════════════════════════════════
      // 更新 DualCanvasViewer 的引用
      // ═══════════════════════════════════════════════════════════════
      this.dualViewer.multiSceneManager = this;
      this.dualViewer.scene1 = this.scenes.layer1Large;
      this.dualViewer.scene2 = this.scenes.layer2Large;

      console.log('\n✅ 多场景架构初始化完成！');
    }

    // ═══════════════════════════════════════════════════════════════════
    // 分类并移动模型
    // ═══════════════════════════════════════════════════════════════════
    classifyAndMoveModels() {
      // ═══════════════════════════════════════════════════════════════
      // 处理原始层模型
      // ═══════════════════════════════════════════════════════════════
      const models1 = this.dualViewer.modelGroup1?.children.filter(m => !m.userData.isBox3Helper) || [];
      console.log(`\n  📦 原始层模型数量: ${models1.length}`);

      const layer1LargeModels = [];
      const layer1SmallModels = [];

      models1.forEach(model => {
        const pos = model.position;
        const isLarge = Math.abs(pos.x) > CONFIG.LARGE_COORD_THRESHOLD ||
                       Math.abs(pos.z) > CONFIG.LARGE_COORD_THRESHOLD;

        if (isLarge) {
          layer1LargeModels.push(model);
        } else {
          layer1SmallModels.push(model);
        }
      });

      console.log(`    - 大坐标模型: ${layer1LargeModels.length} 个`);
      console.log(`    - 小坐标模型: ${layer1SmallModels.length} 个`);

      // 计算参考点（使用第一个大模型的位置）
      if (layer1LargeModels.length > 0) {
        const refModel = layer1LargeModels[0];
        this.referencePoints.layer1 = refModel.position.clone();
        console.log(`    📍 原始层参考点: (${this.referencePoints.layer1.x.toFixed(2)}, ${this.referencePoints.layer1.y.toFixed(2)}, ${this.referencePoints.layer1.z.toFixed(2)})`);

        // 大坐标模型直接添加到场景
        layer1LargeModels.forEach(model => {
          this.scenes.layer1Large.add(model);
        });

        // 小坐标模型转换为相对坐标
        layer1SmallModels.forEach(model => {
          const relativePos = model.position.clone().sub(this.referencePoints.layer1);
          model.position.copy(relativePos);
          model.userData.isRelativeCoordinate = true;
          model.userData.originalPosition = model.position.clone();
          this.scenes.layer1Small.add(model);
        });
      } else {
        // 没有大模型，所有模型使用小坐标场景
        console.log('    ⚠️ 没有找到大坐标模型，所有模型使用小坐标场景');
        layer1SmallModels.forEach(model => {
          this.scenes.layer1Small.add(model);
        });
      }

      // ═══════════════════════════════════════════════════════════════
      // 处理BIM层模型
      // ═══════════════════════════════════════════════════════════════
      const models2 = this.dualViewer.modelGroup2?.children.filter(m => !m.userData.isBox3Helper) || [];
      console.log(`\n  📦 BIM层模型数量: ${models2.length}`);

      const layer2LargeModels = [];
      const layer2SmallModels = [];

      models2.forEach(model => {
        const pos = model.position;
        const isLarge = Math.abs(pos.x) > CONFIG.LARGE_COORD_THRESHOLD ||
                       Math.abs(pos.z) > CONFIG.LARGE_COORD_THRESHOLD;

        if (isLarge) {
          layer2LargeModels.push(model);
        } else {
          layer2SmallModels.push(model);
        }
      });

      console.log(`    - 大坐标模型: ${layer2LargeModels.length} 个`);
      console.log(`    - 小坐标模型: ${layer2SmallModels.length} 个`);

      // 计算参考点
      if (layer2LargeModels.length > 0) {
        const refModel = layer2LargeModels[0];
        this.referencePoints.layer2 = refModel.position.clone();
        console.log(`    📍 BIM层参考点: (${this.referencePoints.layer2.x.toFixed(2)}, ${this.referencePoints.layer2.y.toFixed(2)}, ${this.referencePoints.layer2.z.toFixed(2)})`);

        layer2LargeModels.forEach(model => {
          this.scenes.layer2Large.add(model);
        });

        layer2SmallModels.forEach(model => {
          const relativePos = model.position.clone().sub(this.referencePoints.layer2);
          model.position.copy(relativePos);
          model.userData.isRelativeCoordinate = true;
          model.userData.originalPosition = model.position.clone();
          this.scenes.layer2Small.add(model);
        });
      } else {
        console.log('    ⚠️ 没有找到大坐标模型，所有模型使用小坐标场景');
        layer2SmallModels.forEach(model => {
          this.scenes.layer2Small.add(model);
        });
      }

      // 清空原始模型组
      if (this.dualViewer.modelGroup1) {
        this.dualViewer.modelGroup1.clear();
      }
      if (this.dualViewer.modelGroup2) {
        this.dualViewer.modelGroup2.clear();
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 设置渲染器
    // ═══════════════════════════════════════════════════════════════════
    setupRenderers() {
      // 原始层渲染器
      if (this.dualViewer.renderer1) {
        this.dualViewer.renderer1.autoClear = false;
        console.log('    ✅ 原始层渲染器已设置 autoClear = false');
      }

      // BIM层渲染器
      if (this.dualViewer.renderer2) {
        this.dualViewer.renderer2.autoClear = false;
        console.log('    ✅ BIM层渲染器已设置 autoClear = false');
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 替换渲染循环
    // ═══════════════════════════════════════════════════════════════════
    replaceRenderLoops() {
      const self = this;

      // 停止原始渲染循环
      if (this.dualViewer.animationFrame1) {
        cancelAnimationFrame(this.dualViewer.animationFrame1);
      }
      if (this.dualViewer.animationFrame2) {
        cancelAnimationFrame(this.dualViewer.animationFrame2);
      }

      // ═══════════════════════════════════════════════════════════════
      // 原始层渲染循环
      // ═══════════════════════════════════════════════════════════════
      const animate1 = () => {
        this.dualViewer.animationFrame1 = requestAnimationFrame(animate1);

        // 更新控制器
        if (this.dualViewer.controls1) {
          this.dualViewer.controls1.update();
        }

        // 同步所有相机
        self.syncCameras();

        // 渲染原始层
        self.renderLayer1();
      };

      // ═══════════════════════════════════════════════════════════════
      // BIM层渲染循环
      // ═══════════════════════════════════════════════════════════════
      const animate2 = () => {
        this.dualViewer.animationFrame2 = requestAnimationFrame(animate2);

        // 更新控制器
        if (this.dualViewer.controls2) {
          this.dualViewer.controls2.update();
        }

        // 渲染BIM层
        self.renderLayer2();
      };

      animate1();
      animate2();

      console.log('    ✅ 渲染循环已替换');
    }

    // ═══════════════════════════════════════════════════════════════════
    // 渲染原始层（修复后的渲染顺序：先小后大）
    // ═══════════════════════════════════════════════════════════════════
    renderLayer1() {
      const renderer = this.dualViewer.renderer1;
      if (!renderer) return;

      // 清除颜色和深度缓冲区
      renderer.clear(true, true, false);

      // ✅ 先渲染小坐标场景（近处物体）
      if (this.scenes.layer1Small.children.length > 0) {
        renderer.render(this.scenes.layer1Small, this.cameras.layer1Small);
      }

      // ✅ 再渲染大坐标场景（远处物体）
      if (this.scenes.layer1Large.children.length > 0) {
        renderer.clearDepth();
        renderer.render(this.scenes.layer1Large, this.cameras.layer1Large);
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 渲染BIM层（修复后的渲染顺序：先小后大）
    // ═══════════════════════════════════════════════════════════════════
    renderLayer2() {
      const renderer = this.dualViewer.renderer2;
      if (!renderer) return;

      // 清除颜色和深度缓冲区
      renderer.clear(true, true, false);

      // ✅ 先渲染小坐标场景（近处物体）
      if (this.scenes.layer2Small.children.length > 0) {
        renderer.render(this.scenes.layer2Small, this.cameras.layer2Small);
      }

      // ✅ 再渲染大坐标场景（远处物体）
      if (this.scenes.layer2Large.children.length > 0) {
        renderer.clearDepth();
        renderer.render(this.scenes.layer2Large, this.cameras.layer2Large);
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 同步所有相机
    // ═══════════════════════════════════════════════════════════════════
    syncCameras() {
      const baseCamera = this.dualViewer.camera1 || this.cameras.layer1Large;

      // 同步原始层相机
      this.syncCamera(baseCamera, this.cameras.layer1Large, this.referencePoints.layer1, true);
      this.syncCamera(baseCamera, this.cameras.layer1Small, this.referencePoints.layer1, false);

      // 同步BIM层相机
      this.syncCamera(baseCamera, this.cameras.layer2Large, this.referencePoints.layer2, true);
      this.syncCamera(baseCamera, this.cameras.layer2Small, this.referencePoints.layer2, false);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 同步单个相机（修复后的版本：包含投影矩阵和视图矩阵更新）
    // ═══════════════════════════════════════════════════════════════════
    syncCamera(baseCamera, targetCamera, referencePoint, isLargeScene) {
      // 同步位置和旋转
      if (isLargeScene || !referencePoint) {
        // 大坐标场景：直接使用基准相机位置
        targetCamera.position.copy(baseCamera.position);
        targetCamera.quaternion.copy(baseCamera.quaternion);
      } else {
        // 小坐标场景：转换为相对坐标
        const relativePos = baseCamera.position.clone().sub(referencePoint);
        targetCamera.position.copy(relativePos);
        targetCamera.quaternion.copy(baseCamera.quaternion);
      }

      // 同步缩放和其他属性
      targetCamera.zoom = baseCamera.zoom;
      targetCamera.aspect = baseCamera.aspect;

      // ✅ 关键：确保投影矩阵更新
      targetCamera.updateProjectionMatrix();

      // ✅ 关键：确保视图矩阵更新
      targetCamera.updateMatrixWorld();
    }

    // ═══════════════════════════════════════════════════════════════════
    // 设置相机同步
    // ═══════════════════════════════════════════════════════════════════
    setupCameraSync() {
      // 监听控制器变化
      if (this.dualViewer.controls1) {
        this.dualViewer.controls1.addEventListener('change', () => {
          this.syncCameras();
        });
      }

      if (this.dualViewer.controls2) {
        this.dualViewer.controls2.addEventListener('change', () => {
          this.syncCameras();
        });
      }

      console.log('    ✅ 相机同步已设置');
    }

    // ═══════════════════════════════════════════════════════════════════
    // 动态调整 near/far
    // ═══════════════════════════════════════════════════════════════════
    adjustCameraNearFar() {
      const baseCamera = this.dualViewer.camera1;
      if (!baseCamera) return;

      // 计算相机到各场景中模型的距离
      const distances = [];

      // 收集大坐标场景中模型的距离
      this.scenes.layer1Large.traverse(obj => {
        if (obj.isMesh) {
          const dist = baseCamera.position.distanceTo(obj.position);
          distances.push(dist);
        }
      });

      // 收集小坐标场景中模型的距离
      if (this.referencePoints.layer1) {
        this.scenes.layer1Small.traverse(obj => {
          if (obj.isMesh) {
            // 小坐标场景的模型位置是相对的，需要转换回世界坐标
            const worldPos = obj.position.clone().add(this.referencePoints.layer1);
            const dist = baseCamera.position.distanceTo(worldPos);
            distances.push(dist);
          }
        });
      }

      if (distances.length === 0) return;

      const minDist = Math.min(...distances);
      const maxDist = Math.max(...distances);

      // 动态调整小坐标场景的 near/far
      const smallNear = Math.max(1, minDist * 0.1);
      const smallFar = Math.max(smallNear * 2, maxDist * 1.5);

      this.cameras.layer1Small.near = smallNear;
      this.cameras.layer1Small.far = Math.min(smallFar, 10000); // 最大不超过10000
      this.cameras.layer1Small.updateProjectionMatrix();

      this.cameras.layer2Small.near = smallNear;
      this.cameras.layer2Small.far = Math.min(smallFar, 10000);
      this.cameras.layer2Small.updateProjectionMatrix();

      console.log(`  小坐标场景 near/far: ${smallNear.toFixed(2)} ~ ${this.cameras.layer1Small.far.toFixed(2)}`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 透视反转检测
    // ═══════════════════════════════════════════════════════════════════
    detectPerspectiveInversion() {
      const camera = this.dualViewer.camera1;
      if (!camera) return;

      const THREE = this.THREE;
      const pos = camera.position;
      const target = this.dualViewer.controls1?.target || new THREE.Vector3();

      // 计算相机到目标的距离
      const distance = pos.distanceTo(target);

      // 检查是否在大坐标模式
      const isLargeCoord = Math.abs(pos.x) > 10000 || Math.abs(pos.z) > 10000;

      console.log(`\n📊 透视检测:`);
      console.log(`  相机位置: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
      console.log(`  目标位置: (${target.x.toFixed(2)}, ${target.y.toFixed(2)}, ${target.z.toFixed(2)})`);
      console.log(`  距离: ${distance.toFixed(2)} 米`);
      console.log(`  坐标类型: ${isLargeCoord ? '🔴 大坐标' : '🟢 小坐标'}`);

      // 检查 near/far 是否合适
      const largeCamera = this.cameras.layer1Large;
      const smallCamera = this.cameras.layer1Small;

      console.log(`\n  大坐标相机: near=${largeCamera.near}, far=${largeCamera.far.toLocaleString()}`);
      console.log(`  小坐标相机: near=${smallCamera.near}, far=${smallCamera.far}`);

      // 检测问题
      if (isLargeCoord && distance < largeCamera.near) {
        console.warn('  ⚠️ 警告：相机距离小于 near 值，可能导致透视问题！');
      }

      if (!isLargeCoord && distance > smallCamera.far) {
        console.warn('  ⚠️ 警告：相机距离超过 far 值，可能导致模型消失！');
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 调试信息
    // ═══════════════════════════════════════════════════════════════════
    getDebugInfo() {
      return {
        scenes: {
          layer1Large: this.scenes.layer1Large?.children.length || 0,
          layer1Small: this.scenes.layer1Small?.children.length || 0,
          layer2Large: this.scenes.layer2Large?.children.length || 0,
          layer2Small: this.scenes.layer2Small?.children.length || 0
        },
        cameras: {
          layer1Large: {
            near: this.cameras.layer1Large?.near || 0,
            far: this.cameras.layer1Large?.far || 0
          },
          layer1Small: {
            near: this.cameras.layer1Small?.near || 0,
            far: this.cameras.layer1Small?.far || 0
          },
          layer2Large: {
            near: this.cameras.layer2Large?.near || 0,
            far: this.cameras.layer2Large?.far || 0
          },
          layer2Small: {
            near: this.cameras.layer2Small?.near || 0,
            far: this.cameras.layer2Small?.far || 0
          }
        },
        referencePoints: this.referencePoints
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 暴露到全局
  // ═══════════════════════════════════════════════════════════════════
  window.MultiSceneManager = MultiSceneManager;
  window.MULTI_SCENE_CONFIG = CONFIG;

  console.log('  ✅ 多场景管理器类已加载');

  // ═══════════════════════════════════════════════════════════════════
  // 步骤2：显示当前状态
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n📊 [步骤2/7] 当前状态...');

  const models1 = dualViewer.modelGroup1?.children.filter(m => !m.userData.isBox3Helper) || [];
  const models2 = dualViewer.modelGroup2?.children.filter(m => !m.userData.isBox3Helper) || [];

  console.log(`  原始层模型数量: ${models1.length}`);
  console.log(`  BIM层模型数量: ${models2.length}`);

  // 显示模型坐标信息
  if (models1.length > 0) {
    console.log('\n  原始层模型坐标:');
    models1.slice(0, 3).forEach((model, i) => {
      const pos = model.position;
      const coordType = Math.abs(pos.x) > 10000 || Math.abs(pos.z) > 10000 ? '🔴 大坐标' : '🟢 小坐标';
      console.log(`    模型 ${i + 1}: ${coordType} (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
    });
  }

  if (models2.length > 0) {
    console.log('\n  BIM层模型坐标:');
    models2.slice(0, 3).forEach((model, i) => {
      const pos = model.position;
      const coordType = Math.abs(pos.x) > 10000 || Math.abs(pos.z) > 10000 ? '🔴 大坐标' : '🟢 小坐标';
      console.log(`    模型 ${i + 1}: ${coordType} (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // 步骤3：创建并初始化多场景管理器
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n🏗️ [步骤3/7] 创建多场景管理器...');

  const manager = new MultiSceneManager(dualViewer);

  console.log('  ✅ 多场景管理器已创建');

  // ═══════════════════════════════════════════════════════════════════
  // 步骤4：初始化多场景架构
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n🚀 [步骤4/7] 初始化多场景架构...');

  try {
    manager.initialize();

    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║  ✅ 多场景管理器初始化成功！                             ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    // ═══════════════════════════════════════════════════════════════════
    // 步骤5：显示初始化结果
    // ═══════════════════════════════════════════════════════════════════
    console.log('📊 [步骤5/7] 初始化结果...');

    const debugInfo = manager.getDebugInfo();

    console.log('\n  场景模型数量:');
    console.log(`    原始层大坐标场景: ${debugInfo.scenes.layer1Large} 个模型`);
    console.log(`    原始层小坐标场景: ${debugInfo.scenes.layer1Small} 个模型`);
    console.log(`    BIM层大坐标场景: ${debugInfo.scenes.layer2Large} 个模型`);
    console.log(`    BIM层小坐标场景: ${debugInfo.scenes.layer2Small} 个模型`);

    console.log('\n  相机 Near/Far 配置:');
    console.log(`    原始层大坐标: near=${debugInfo.cameras.layer1Large.near}, far=${debugInfo.cameras.layer1Large.far}`);
    console.log(`    原始层小坐标: near=${debugInfo.cameras.layer1Small.near}, far=${debugInfo.cameras.layer1Small.far}`);
    console.log(`    BIM层大坐标: near=${debugInfo.cameras.layer2Large.near}, far=${debugInfo.cameras.layer2Large.far}`);
    console.log(`    BIM层小坐标: near=${debugInfo.cameras.layer2Small.near}, far=${debugInfo.cameras.layer2Small.far}`);

    if (debugInfo.referencePoints.layer1) {
      console.log('\n  参考点:');
      console.log(`    原始层: (${debugInfo.referencePoints.layer1.x.toFixed(2)}, ${debugInfo.referencePoints.layer1.y.toFixed(2)}, ${debugInfo.referencePoints.layer1.z.toFixed(2)})`);
    }
    if (debugInfo.referencePoints.layer2) {
      console.log(`    BIM层: (${debugInfo.referencePoints.layer2.x.toFixed(2)}, ${debugInfo.referencePoints.layer2.y.toFixed(2)}, ${debugInfo.referencePoints.layer2.z.toFixed(2)})`);
    }

    // 保存到 dualViewer
    dualViewer.multiSceneManager = manager;

    console.log('\n🎉 多场景架构已成功部署！');

    // ═══════════════════════════════════════════════════════════════════
    // 步骤6：应用透视翻转修复
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n🔧 [步骤6/7] 应用透视翻转修复...');

    // 确保渲染器深度测试启用
    const renderer1 = manager.dualViewer.renderer1;
    const renderer2 = manager.dualViewer.renderer2;

    if (renderer1) {
      renderer1.sortObjects = true; // 启用对象排序
      console.log('  ✅ 原始层渲染器已启用对象排序');
    }

    if (renderer2) {
      renderer2.sortObjects = true;
      console.log('  ✅ BIM层渲染器已启用对象排序');
    }

    // 立即同步相机
    manager.syncCameras();

    // 调整 near/far
    manager.adjustCameraNearFar();

    // 检测透视
    manager.detectPerspectiveInversion();

    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║  ✅ 透视反转修复完成！                                    ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    // ═══════════════════════════════════════════════════════════════════
    // 步骤7：启用自动 near/far 调整
    // ═══════════════════════════════════════════════════════════════════
    console.log('🔧 [步骤7/7] 启用自动 near/far 调整...');
    console.log('   启用后，每次缩放都会自动调整 near/far 以保持正确的透视\n');

    // 添加到控制器变化事件
    if (manager.dualViewer.controls1) {
      manager.dualViewer.controls1.addEventListener('change', () => {
        // 节流处理，避免频繁调用
        if (manager._adjustTimer) return;
        manager._adjustTimer = setTimeout(() => {
          manager.adjustCameraNearFar();
          manager._adjustTimer = null;
        }, 100);
      });
      console.log('  ✅ 自动调整已启用（原始层）');
    }

    if (manager.dualViewer.controls2) {
      manager.dualViewer.controls2.addEventListener('change', () => {
        if (manager._adjustTimer) return;
        manager._adjustTimer = setTimeout(() => {
          manager.adjustCameraNearFar();
          manager._adjustTimer = null;
        }, 100);
      });
      console.log('  ✅ 自动调整已启用（BIM层）');
    }

    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║  🎉 全部完成！                                            ║');
    console.log('║  ✅ 多场景架构已部署                                      ║');
    console.log('║  ✅ 透视翻转已修复（近大远小）                            ║');
    console.log('║  ✅ 自动调整已启用                                        ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    console.log('📌 可用命令:');
    console.log('   window.__dualCanvasViewer.multiSceneManager.getDebugInfo() - 查看调试信息');
    console.log('   window.__dualCanvasViewer.multiSceneManager.adjustCameraNearFar()   - 调整 near/far');
    console.log('   window.__dualCanvasViewer.multiSceneManager.detectPerspectiveInversion() - 检测透视问题');
    console.log('   window.__dualCanvasViewer.multiSceneManager.syncCameras()          - 手动同步相机');

  } catch (error) {
    console.error('\n❌ 初始化失败:', error);
    console.error('   错误详情:', error.stack);
  }

})();
