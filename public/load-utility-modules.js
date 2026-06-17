// ⭐ 工具模块全局加载脚本
// 将 DualCanvasViewer 所需的工具模块加载到全局 window 对象
// 供 vue3-sfc-loader 和 HelloWorld.vue 使用
//
// ⭐ 设计原则：
// - 单例模块：导出实例，使用小写命名（如 window.mercatorProjectionManager）
// - 多实例类：导出类定义，使用大写命名（如 window.ViewerSyncManager），不创建实例

(function() {
  // ⭐ 检查是否已经加载过
  if (typeof window !== 'undefined' && window.__utilityModulesLoaded) {
    console.log('[UtilityModulesLoader] ℹ️ 工具模块已经加载，跳过');
    return;
  }

  console.log('[UtilityModulesLoader] 📍 脚本开始执行...');

  // 模块路径映射 - 智能检测路径
  // 如果在子目录中（如 /gis/test-sfc/），自动使用父目录的 utils
  let basePath = window.location.pathname.replace(/\/[^/]*$/, '') + '/';

  // 检测是否在 test-sfc 子目录中，如果是则使用父目录
  const pathname = window.location.pathname;
  if (pathname.endsWith('/test-sfc/index.html') || pathname.endsWith('/test-sfc/')) {
    basePath = pathname.replace(/\/test-sfc\/[^/]*$/, '') + '/';
    console.log('[UtilityModulesLoader] 🔍 检测到子目录，使用父目录路径');
  }

  console.log('[UtilityModulesLoader] 🔗 基础路径:', basePath);

  // ⭐ 单例模块配置：文件名 -> 实例变量名（小写）
  // 这些模块导出预先创建的实例（如：export const mercatorProjectionManager = new ...）
  const singletonModules = {
    rendererManager: 'rendererManager',                           // 实例
    unifiedViewport: 'unifiedViewport',                           // 实例
    MercatorProjectionManager: 'mercatorProjectionManager',     // 实例
    SceneRotationManager: 'sceneRotationManager',               // 实例
    ModelMercatorMetadataManager: 'modelMercatorMetadataManager', // 实例
    SurfaceModeDetector: 'surfaceModeDetector'                    // 实例
  };

  // ⭐ 多实例类配置：文件名 -> 类名（大写）
  // 这些模块导出类定义（如：export class ViewerSyncManager）
  // 我们只导出类，不创建实例，让调用者自己管理实例
  const multiInstanceClasses = {
    ViewerSyncManager: 'ViewerSyncManager',
    PrecisionModelLoader: 'PrecisionModelLoader',
    HeightAlignmentManager: 'HeightAlignmentManager',
    ControlsRestrictionManager: 'ControlsRestrictionManager',
    MouseOperationCoordinator: 'MouseOperationCoordinator',
    ThreeJSPanHandler: 'ThreeJSPanHandler',
    ThreeJSZoomHandler: 'ThreeJSZoomHandler'
  };

  // 构建完整模块路径映射
  const modulePaths = {
    // 单例模块
    rendererManager: `${basePath}utils/rendererManager.js`,
    unifiedViewport: `${basePath}utils/CoordinateSystem.js`,
    MercatorProjectionManager: `${basePath}utils/MercatorProjectionManager.js`,
    SceneRotationManager: `${basePath}utils/SceneRotationManager.js`,
    ModelMercatorMetadataManager: `${basePath}utils/ModelMercatorMetadataManager.js`,
    SurfaceModeDetector: `${basePath}utils/operation-handlers/SurfaceModeDetector.js`,
    // 多实例类
    ViewerSyncManager: `${basePath}utils/SyncManager.js`,
    PrecisionModelLoader: `${basePath}utils/PrecisionModelLoader.js`,
    HeightAlignmentManager: `${basePath}utils/HeightAlignmentManager.js`,
    ControlsRestrictionManager: `${basePath}utils/operation-handlers/ControlsRestrictionManager.js`,
    MouseOperationCoordinator: `${basePath}utils/MouseOperationCoordinator.js`,
    ThreeJSPanHandler: `${basePath}utils/operation-handlers/ThreeJSPanHandler.js`,
    ThreeJSZoomHandler: `${basePath}utils/operation-handlers/ThreeJSZoomHandler.js`
  };

  const totalModules = Object.keys(singletonModules).length + Object.keys(multiInstanceClasses).length;
  console.log('[UtilityModulesLoader] 📦 模块配置完成:', {
    单例模块: Object.keys(singletonModules).length,
    多实例类: Object.keys(multiInstanceClasses).length,
    总计: totalModules
  });

  // 加载模块并暴露到全局
  async function loadUtilityModules() {
    const loadedModules = {};
    const errors = {};

    // ========== 加载单例模块 ==========
    console.log('[UtilityModulesLoader] ========== 开始加载单例模块 ==========');
    for (const [moduleName, globalVarName] of Object.entries(singletonModules)) {
      try {
        const modulePath = modulePaths[moduleName];
        console.log(`[UtilityModulesLoader] 📦 [单例] 加载 ${moduleName} → window.${globalVarName}`);
        console.log(`[UtilityModulesLoader] 🔗 完整路径: ${modulePath}`);

        const module = await import(modulePath);

        // 提取单例实例
        let instance = null;

        // 优先级 1: 使用命名导出（export const mercatorProjectionManager = ...）
        if (module[globalVarName] && typeof module[globalVarName] === 'object') {
          instance = module[globalVarName];
          console.log(`  ✅ 使用命名导出 '${globalVarName}'`);
        }
        // 优先级 2: 使用默认导出（export default mercatorProjectionManager）
        else if (module.default && typeof module.default === 'object') {
          instance = module.default;
          console.log(`  ✅ 使用默认导出`);
        }
        // 优先级 3: 检查 window 中是否已有实例
        else if (window[globalVarName]) {
          instance = window[globalVarName];
          console.log(`  ✅ 使用 window 中已存在的实例`);
        }

        if (instance) {
          window[globalVarName] = instance;
          loadedModules[moduleName] = instance;
          console.log(`[UtilityModulesLoader] ✅ [单例] ${moduleName} → window.${globalVarName}`);
        } else {
          console.warn(`[UtilityModulesLoader] ⚠️ [单例] ${moduleName} - 无法找到实例，模块导出:`, Object.keys(module));
          errors[moduleName] = `无法找到单例实例`;
        }
      } catch (error) {
        const errorMsg = `${error.message}`;
        console.error(`[UtilityModulesLoader] ❌ [单例] ${moduleName} 加载失败:`, errorMsg);
        console.error(`[UtilityModulesLoader] 错误详情:`, error);
        errors[moduleName] = errorMsg;
      }
    }

    // ========== 加载多实例类 ==========
    console.log('[UtilityModulesLoader] ========== 开始加载多实例类 ==========');
    for (const [moduleName, className] of Object.entries(multiInstanceClasses)) {
      try {
        const modulePath = modulePaths[moduleName];
        console.log(`[UtilityModulesLoader] 📦 [类] 加载 ${moduleName} → window.${className} (不创建实例)`);

        const module = await import(modulePath);

        // 提取类定义
        let ClassDefinition = null;

        // 优先级 1: 使用命名导出（export class ViewerSyncManager）
        if (module[className] && typeof module[className] === 'function') {
          ClassDefinition = module[className];
          console.log(`  ✅ 使用命名导出 '${className}'`);
        }
        // 优先级 2: 使用默认导出（export default ViewerSyncManager）
        else if (module.default && typeof module.default === 'function') {
          ClassDefinition = module.default;
          console.log(`  ✅ 使用默认导出`);
        }
        // 优先级 3: 检查 window 中是否已有类定义
        else if (window[className] && typeof window[className] === 'function') {
          ClassDefinition = window[className];
          console.log(`  ✅ 使用 window 中已存在的类定义`);
        }

        if (ClassDefinition && typeof ClassDefinition === 'function') {
          // ⭐ 只导出类定义，不创建实例
          window[className] = ClassDefinition;
          loadedModules[moduleName] = ClassDefinition;
          console.log(`[UtilityModulesLoader] ✅ [类] ${className} 已导出（未创建实例，调用者需自行 new）`);
        } else {
          console.warn(`[UtilityModulesLoader] ⚠️ [类] ${moduleName} - 无法找到类定义，模块导出:`, Object.keys(module));
          errors[moduleName] = `无法找到类定义`;
        }
      } catch (error) {
        const errorMsg = `${error.message}`;
        console.error(`[UtilityModulesLoader] ❌ [类] ${moduleName} 加载失败:`, errorMsg);
        errors[moduleName] = errorMsg;
      }
    }

    // ========== 错误处理 ==========
    if (Object.keys(errors).length > 0) {
      console.error('[UtilityModulesLoader] ❌ 以下模块加载失败:', errors);
      console.error('[UtilityModulesLoader] 💡 可能的原因：');
      console.error('  1. 模块文件不存在或路径错误');
      console.error('  2. 模块内部使用了不支持的 ES6 导入');
      console.error('  3. CORS 问题导致无法加载');
      console.error('  4. MIME 类型不正确（应为 application/javascript+module）');
    }

    console.log('[UtilityModulesLoader] ✅ 工具模块加载完成，成功:', Object.keys(loadedModules).length, '失败:', Object.keys(errors).length);

    // ========== 详细验证所有模块状态 ==========
    console.log('[UtilityModulesLoader] ========== 模块验证 ==========');

    // 验证单例模块
    console.log('[UtilityModulesLoader] 📦 单例模块状态:');
    for (const [moduleName, globalVarName] of Object.entries(singletonModules)) {
      const exists = typeof window[globalVarName] !== 'undefined';
      console.log(`  ${exists ? '✅' : '❌'} window.${globalVarName} ${exists ? '(' + typeof window[globalVarName] + ')' : '不存在'}`);
    }

    // 验证多实例类
    console.log('[UtilityModulesLoader] 📦 多实例类状态:');
    for (const [moduleName, className] of Object.entries(multiInstanceClasses)) {
      const exists = typeof window[className] !== 'undefined';
      const isClass = exists && typeof window[className] === 'function' && !!window[className].prototype;
      console.log(`  ${exists ? '✅' : '❌'} window.${className} ${isClass ? '(类)' : exists ? '(' + typeof window[className] + ')' : '不存在'}`);
    }

    // 检查缺失模块
    const allSingletons = Object.entries(singletonModules);
    const allClasses = Object.entries(multiInstanceClasses);

    const missingSingletons = allSingletons.filter(([name, globalName]) => typeof window[globalName] === 'undefined');
    const missingClasses = allClasses.filter(([name, className]) => typeof window[className] === 'undefined');

    if (missingSingletons.length > 0 || missingClasses.length > 0) {
      console.warn('[UtilityModulesLoader] ⚠️ 以下模块未正确加载:');
      if (missingSingletons.length > 0) {
        console.warn('  单例模块:', missingSingletons.map(([, name]) => name));
      }
      if (missingClasses.length > 0) {
        console.warn('  多实例类:', missingClasses.map(([, name]) => name));
      }
    } else {
      console.log('[UtilityModulesLoader] ✅ 所有模块已正确加载到 window 对象');
    }
    console.log('[UtilityModulesLoader] ========== 验证完成 ==========');

    return loadedModules;
  }

  // 立即执行加载
  loadUtilityModules().catch(error => {
    console.error('[UtilityModulesLoader] ❌ 工具模块加载失败:', error);
  });

  // 也可以手动触发加载（用于延迟加载）
  window.loadUtilityModules = loadUtilityModules;

  // ⭐ 标记为已加载
  window.__utilityModulesLoaded = true;
})();
