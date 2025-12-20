# Face Liveness Detection

基于 MediaPipe Face Mesh 的纯前端人脸活体检测库。

## ✨ 特性

-   🎯 **纯前端检测** - 无需后端，数据不上传，保护隐私
-   🎭 **多动作验证** - 支持眨眼、张嘴、左右转头、点头 5 种动作
-   🎨 **人脸区域引导** - 彩色圆形区域，覆盖层颜色闪动效果
-   🛡️ **防摄像头移动** - 三重防护机制，防止晃动摄像头触发误判
-   🔊 **语音提示** - 自动播报动作指令，用户体验友好
-   📸 **自动拍照** - 完成所有动作后自动采集人脸照片
-   🎲 **随机顺序** - 支持随机或固定动作顺序
-   ⚙️ **高度可配置** - 阈值、UI、语音等全部可定制

## 🚀 安装

```bash
npm install face-liveness-detection
```

## 快速开始

```javascript
import {
    checkSupport,
    checkCameraPermission,
    createLivenessDetector
} from 'face-liveness-detection';

// 检测环境支持
const support = checkSupport();
if (!support.supported) {
    console.error('不支持活体检测:', support.reasons);
    return;
}

// 检测摄像头权限
const permission = await checkCameraPermission();
if (!permission.granted) {
    console.error(permission.message);
    return;
}

const detector = createLivenessDetector({
    videoElement: document.getElementById('video'),
    canvasElement: document.getElementById('canvas'),
    statusElements: {
        faceDetected: document.getElementById('faceDetected'),
        blink: document.getElementById('blink'),
        openMouth: document.getElementById('openMouth'),
        turnLeft: document.getElementById('turnLeft'),
        turnRight: document.getElementById('turnRight'),
        nod: document.getElementById('nod')
    },
    captureBtn: document.getElementById('captureBtn'),
    resultContainer: document.getElementById('resultContainer'),
    capturedImage: document.getElementById('capturedImage'),

    // 事件回调
    onComplete: base64Image => {
        console.log('检测完成', base64Image.length);
    },
    onActionComplete: (action, current, total) => {
        console.log(`完成 ${action} (${current}/${total})`);
    },
    onError: error => {
        console.error('检测出错', error);
    },

    // 配置
    config: {
        actions: ['blink', 'openMouth', 'turnLeft'],
        actionOrder: 'random'
    }
});

await detector.start();

// 终止检测
detector.stop();

// 重置检测
detector.reset();
await detector.start();

// 获取采集的 Base64 图片
const base64 = detector.getBase64Image();
```

## 📚 配置

```javascript
const config = {
    // 语音提示
    voice: {
        enabled: true,
        lang: 'zh-CN',
        rate: 1.0,
        prompts: {
            faceDetected: '检测到人脸',
            blink: '请眨眼',
            blinkComplete: '眨眼完成',
            openMouth: '请张嘴',
            openMouthComplete: '张嘴完成',
            turnLeft: '请向左转头',
            turnLeftComplete: '左转头完成',
            turnRight: '请向右转头',
            turnRightComplete: '右转头完成',
            nod: '请点头',
            nodComplete: '点头完成',
            allComplete: '所有动作已完成',
            capturing: '请保持不动，正在比对'
        }
    },

    // 眨眼检测
    blink: {
        threshold: 0.6 // 闭眼比例阈值
    },

    // 张嘴检测
    mouth: {
        threshold: 0.07 // 张嘴阈值
    },

    // 人脸区域检测
    faceArea: {
        enabled: true, // 是否启用区域检测
        circleRatio: 0.6, // 圆形直径占画面宽度比例（0.6 = 60%）
        stayDuration: 1000, // 初始停留时间（毫秒）
        strictMode: false, // 严格模式（true: 整个人脸必须在圆内，false: 大部分关键点在圆内即可）
        borderWidth: 4, // 边框宽度
        borderColors: ['#00FF00', '#00FFFF', '#0080FF', '#FF00FF'], // 覆盖层颜色循环（绿、青、蓝、紫）
        colorChangeInterval: 500, // 颜色变化间隔（毫秒）
        maskOpacity: 0.8, // 遮罩透明度
        promptText: '请将人脸移入检测区域' // 提示文字
    },

    // 动作列表
    actions: ['blink', 'openMouth', 'turnLeft', 'turnRight', 'nod'],

    // 动作顺序: 'random' 随机 | 'fixed' 固定
    actionOrder: 'random',

    // 调试模式
    debug: false,

    // 显示面部关键点
    showLandmarks: false
};
```

## 🎭 可用动作

| 动作   | 标识        | 说明                  |
| ------ | ----------- | --------------------- |
| 眨眼   | `blink`     | 闭眼达到阈值          |
| 张嘴   | `openMouth` | 张嘴达到阈值          |
| 左转头 | `turnLeft`  | 连续 3 帧鼻子向右偏移 |
| 右转头 | `turnRight` | 连续 3 帧鼻子向左偏移 |
| 点头   | `nod`       | 低头达到阈值          |

## 🛡️ 防摄像头移动机制

系统内置三重防护，防止通过摇动摄像头作弊：

### 1️⃣ 画面稳定性检测

-   跟踪人脸中心点的绝对位置变化
-   连续 2 帧移动 > 8% 画面宽度，立即阻断所有检测
-   防止摇动摄像头触发眨眼、张嘴等动作

### 2️⃣ 单帧异常检测（针对转头）

-   检测鼻子偏移单帧变化量
-   变化 > 0.15 ，判定为画面异常移动
-   重置历史，阻断转头检测

### 3️⃣ 连续帧判定（针对转头）

-   左转头：连续 3 帧鼻偏移 > 0.15
-   右转头：连续 3 帧鼻偏移 < -0.15
-   防止瞬间抖动或画面异常触发

## 🔧 API

### checkSupport()

检测当前环境是否支持活体检测。

```javascript
const { supported, reasons } = checkSupport();
// supported: boolean - 是否支持
// reasons: string[] - 不支持的原因列表
```

检测项：

-   浏览器环境
-   摄像头访问 (getUserMedia)
-   WebAssembly 支持
-   HTTPS 或 localhost
-   Canvas 2D 支持

### checkCameraPermission()

检测摄像头权限（异步）。

```javascript
const { granted, error, message } = await checkCameraPermission();
if (!granted) {
    console.error(message); // "摄像头权限被拒绝..."
}
```

错误类型：

-   `NotAllowedError` - 权限被拒绝
-   `NotFoundError` - 无摄像头设备
-   `NotReadableError` - 摄像头被占用

### createLivenessDetector(options)

创建检测器实例。

**参数:**

-   `videoElement` - 视频元素
-   `canvasElement` - Canvas 元素
-   `statusElements` - 状态显示元素
-   `captureBtn` - 拍照按钮（可选）
-   `resultContainer` - 结果容器（可选）
-   `capturedImage` - 采集图片元素（可选）
-   `onComplete(base64)` - 完成回调
-   `onActionComplete(action, current, total)` - 动作完成回调
-   `onError(error)` - 错误回调
-   `config` - 配置项（部分配置即可）

### detector.start()

开始活体检测。

```javascript
await detector.start();
```

### detector.stop()

终止检测。

```javascript
detector.stop();
```

### detector.reset()

重置检测状态。

```javascript
detector.reset();
await detector.start(); // 重新开始
```

### detector.getBase64Image()

获取采集的 Base64 图片。

```javascript
const base64 = detector.getBase64Image();
// 返回: string | null
```

## 👨‍💻 开发

```bash
# 克隆仓库
git clone https://github.com/aliujun/face-liveness-detection.git
cd face-liveness-detection

# 安装依赖
npm install

# 启动 demo
npm run dev

# 构建 npm 包
npm run build

# 构建 demo
npm run build:demo
```

## 📝 更新日志

### v1.1.0 (2025-12-20)

**新增特性**

-   ✨ 人脸区域引导：彩色圆形区域，覆盖层颜色闪动效果
-   🛡️ 防摄像头移动：三重防护机制
    -   画面稳定性检测：连续 2 帧移动 > 8% 画面宽度即阻断
    -   单帧异常检测：鼻子偏移变化 > 0.15 即阻断
    -   连续帧判定：转头动作需连续 3 帧确认

**配置优化**

-   新增 `faceArea` 配置项，支持自定义圆形区域样式
-   新增 `borderColors` 配置，支持多个颜色循环
-   新增 `colorChangeInterval` 配置，可调颜色变化速度

**性能提升**

-   优化转头检测逻辑，降低误触发率
-   优化画面渲染效果，提升流畅度

**Bug 修复**

-   修复眨眼检测的竞态条件问题
-   修复摇动摄像头可以触发转头动作的问题

### v1.0.2

-   基础功能实现
-   支持 5 种动作检测
-   语音提示功能

## 📝 License

MIT
