const path = require("path");
const TerserPlugin = require('terser-webpack-plugin');

const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');
const cesiumSource = './src/Source'

function resolve(dir) {
    return path.join(__dirname, dir);
}

module.exports = {
    // 打包后运行环境目录
    // publicPath: process.env.NODE_ENV === "production" ? "/projectName/" : "/",
    publicPath: process.env.NODE_ENV === 'production'? './': '/',

    // 开发服务器代理配置
    devServer: {
        proxy: {
            // 代理天地图地形服务请求
            '/mapservice': {
                target: 'https://t0.tianditu.gov.cn',
                changeOrigin: true,
                secure: true,
                pathRewrite: {
                    '^/mapservice': '/mapservice/swdx'
                },
                onProxyReq: function(proxyReq, req, res) {
                    // 添加原始查询参数
                    const originalUrl = req.url;
                    if (originalUrl.includes('?')) {
                        const params = originalUrl.split('?')[1];
                        proxyReq.path += '?' + params;
                    }
                }
            },
            // 代理天地图地形服务（Nuxt 服务器在端口 3000）
            '/api/terrain': {
                target: 'http://localhost:3000',
                changeOrigin: true,
                secure: false,
                pathRewrite: {
                    '^/api/terrain': '/api/terrain'
                }
            },
            // 代理本地地形服务（Nuxt 服务器在端口 3000）
            '/api/terrain-local': {
                target: 'http://localhost:3000',
                changeOrigin: true,
                secure: false,
                pathRewrite: {
                    '^/api/terrain-local': '/api/terrain-local'
                }
            }
        }
    },

    // 禁用ESLint（版本不兼容问题）
    lintOnSave: false,

    productionSourceMap: false, // 生产环境是否生成 sourceMap 文件
    filenameHashing: true, // 文件hash
    /*
      配置vue-cli3项目，可以说是all in vue.config.js的。
      当然，封装、就一定会留个口给用户，去对底层进行自定义操作。
      vue.config.js的配置项中，有两个口，configureWebpack和chainWebpack。
      configureWebpack:
          是调整webpack配置最简单的一种方式，可以新增也可以覆盖cli中的配置。
      可以是一个对象：被 webpack-merge 合并到webpack 的设置中去
      也可以是一个函数：如果你需要基于环境有条件地配置行为，就可以进行一些逻辑处理，可以直接修改或
      新增配置，(该函数会在环境变量被设置之后懒执行)。该方法的第一个参数会收到已经解析好的配置。
      在函数内，你可以直接修改配置，或者返回一个将会被合并的对象。
      chainWebpack:
          这个库提供了一个 webpack 原始配置的上层抽象，使其可以定义具名的 loader 规则
      和具名插件，可以通过其提供的一些方法链式调用，在cli-service中就使用了这个插件
    */
    configureWebpack: {
        // ⭐ 忽略特定目录的文件变化，防止自动重启
        watchOptions: {
            ignored: '**/data/**'
        },
        output: {
            sourcePrefix: ' ' // 1 让webpack 正确处理多行字符串配置 amd参数
        },
        amd: { // 2
            toUrlUndefined: true // webpack在cesium中能友好的使用require
        },
        resolve: {
            extensions: ['.js', '.vue', '.json'],
            // ⭐ 配置模块解析字段顺序，优先使用 import 字段（指向完整版本）
            mainFields: ['browser', 'module', 'import', 'main'],
            alias: {
                // ⭐ Cesium 别名
                'cesium': path.resolve(__dirname, cesiumSource),
                // ⭐ Vue 3 兼容模式 - 指向兼容包
                'vue$': '@vue/compat'
            },
            fallback: {
                'url': require.resolve('url/'),
                'https': require.resolve('https-browserify'),
                'http': require.resolve('stream-http'),
                'zlib': false,
                'path': require.resolve('path-browserify'),
                'stream': require.resolve('stream-browserify')
            }
        },
        plugins: [ // 4、配置webpack直接复制
            new CopyWebpackPlugin({
                patterns: [
                    { from: path.join(cesiumSource, 'Workers'), to: 'Workers' },
                    { from: path.join(cesiumSource, 'Assets'), to: 'Assets' },
                    { from: path.join(cesiumSource, 'Widgets'), to: 'Widgets' },
                    { from: path.join(cesiumSource, 'ThirdParty/Workers'), to: 'ThirdParty/Workers' }
                ]
            }),
            new webpack.DefinePlugin({ // 5
                CESIUM_BASE_URL: JSON.stringify('./'),
                // Vue 3 兼容模式配置
                __VUE_OPTIONS_API__: JSON.stringify(true),
                __VUE_PROD_DEVTOOLS__: JSON.stringify(false),
                __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: JSON.stringify(false),
                // ⭐ 启用运行时编译器（解决 "runtime compilation not supported" 错误）
                __VUE_COMPILER_OPTIONS__: JSON.stringify({
                    isCustomElement: tag => false,
                    whitespace: 'condense'
                }),
                // ⭐ 启用 Vue 2 兼容模式编译
                __VUE_PROD_COMPILER_OPTIONS__: JSON.stringify({
                    isCustomElement: tag => false,
                    whitespace: 'condense'
                })
            })
        ],
        // module: {
        //   unknownContextRegExp: /^.\/.*$/,
        //   unknownContextCritical: false // 6 不让webpack打印载入特定库时候的警告
        // }
        module: {
            rules: [
                {
                    test: /\.js$/,
                    include: path.resolve(__dirname, 'node_modules/cesium/Source'),
                    use: {
                        loader: '@open-wc/webpack-import-meta-loader',
                    },
                },
            ]
        },
        optimization: {
            // 代码分割配置
            splitChunks: {
                chunks: 'all',
                cacheGroups: {
                    // 将Cesium单独打包
                    cesium: {
                        test: /[\\/]node_modules[\\/]cesium|[\\/]src[\\/]Source/,
                        name: 'cesium',
                        priority: 30,
                        reuseExistingChunk: true
                    },
                    // 将Three.js单独打包
                    three: {
                        test: /[\\/]node_modules[\\/]three/,
                        name: 'three',
                        priority: 25,
                        reuseExistingChunk: true
                    },
                    // 将其他大型库单独打包
                    vendors: {
                        test: /[\\/]node_modules[\\/](?!cesium|three)/,
                        name: 'vendors',
                        priority: 20,
                        reuseExistingChunk: true
                    },
                    // 公共代码块
                    common: {
                        name: 'common',
                        minChunks: 2,
                        priority: 10,
                        reuseExistingChunk: true,
                        enforce: true
                    }
                }
            },
            // 运行时代码单独打包
            runtimeChunk: {
                name: 'manifest'
            },
            minimizer: [
                new TerserPlugin({
                    terserOptions: {
                        ecma: undefined,
                        warnings: false,
                        parse: {},
                        compress: {
                            drop_console: true,
                            drop_debugger: false,
                            pure_funcs: ['console.log', 'console.info', 'console.debug'] // 移除console
                        }
                    },
                    parallel: true // 启用多线程压缩
                }),
            ]
        },
    },

    chainWebpack: config => {
        // ⭐ 配置文件监听忽略规则（防止 API 服务器导致的自动重启）
        config.watchOptions({
            ignored: ['**/data/**', '**/node_modules/**', '**/.git/**'],
            aggregateTimeout: 300
        });

        // ⭐ 配置 @vue/compat 使用完整版本（包含编译器）
        // 通过设置 mainFields 确保使用正确的导出
        config.resolve.mainFields.clear().add('browser').add('module').add('import').add('main');

        // 配置import 和 require 等路径别名,webpack中是通过 resolve.alias 来实现此功能的,通过set方法添加修改想要的alias 配置
        config.resolve.alias
            .set("@", resolve("src"))
            .set("spatial", resolve("public/SpatialData"))
            .set("assets", resolve("src/assets"))
            .set("components", resolve("src/components"));

        // 生产环境优化
        if (process.env.NODE_ENV === 'production') {
            // 移除prefetch和preload插件，减少不必要的请求
            config.plugins.delete('prefetch');
            config.plugins.delete('preload');
        }
    },

    // 修改浏览中的标签logo
    pwa: {
        iconPaths: {
            favicon32: "favicon.ico",
            favicon16: "favicon.ico",
            appleTouchIcon: "favicon.ico",
            maskIcon: "favicon.ico",
            msTileImage: "favicon.ico"
        }
    },

    // 多页面方式
    // pages: {
    //   index: {
    //     entry: './src/main',
    //     template: './public/index.html',
    //     fileName: 'index.html',
    //   },
    //   weui: {
    //     entry: './src/wmain',
    //     template: './public/windex.html',
    //   }
    // },

    // CSS提取和优化配置
    css: {
        extract: process.env.NODE_ENV === 'production', // 生产环境提取CSS
        loaderOptions: {
            sass: {
                // implementation: require('sass'), // This line must in sass option
                // prependData: `@import "@/assets/scss/mixin.scss";` //引入全局变量
            },
            // 生产环境CSS压缩
            css: {
                importLoaders: 1,
            }
        }
    },

};
