# Face Liveness Detection

基于 MediaPipe Face Mesh 的纯前端人脸活体检测库。

## 安装

```bash
npm install face-liveness-detection
```

## 快速开始

```javascript
import { checkSupport, checkCameraPermission, createLivenessDetector } from 'face-liveness-detection';

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
    onComplete: (base64Image) => {
        console.log('检测完成', base64Image.length);
    },
    onActionComplete: (action, current, total) => {
        console.log(`完成 ${action} (${current}/${total})`);
    },
    onError: (error) => {
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

## 配置

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
        threshold: 0.6
    },
    
    // 张嘴检测
    mouth: {
        threshold: 0.07
    },
    
    // 转头/点头阈值
    head: {
        turnLeft: 0.05,
        turnRight: 0.015,
        nod: 0.03
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

## 可用动作

| 动作 | 标识 | 说明 |
|------|------|------|
| 眨眼 | `blink` | 闭眼达到阈值 |
| 张嘴 | `openMouth` | 张嘴达到阈值 |
| 左转头 | `turnLeft` | 左转达到阈值 |
| 右转头 | `turnRight` | 右转达到阈值 |
| 点头 | `nod` | 低头达到阈值 |

## API

### checkSupport()

检测当前环境是否支持活体检测。

```javascript
const { supported, reasons } = checkSupport();
// supported: boolean - 是否支持
// reasons: string[] - 不支持的原因列表
```

检测项：
- 浏览器环境
- 摄像头访问 (getUserMedia)
- WebAssembly 支持
- HTTPS 或 localhost
- Canvas 2D 支持

### checkCameraPermission()

检测摄像头权限（异步）。

```javascript
const { granted, error, message } = await checkCameraPermission();
if (!granted) {
    console.error(message); // "摄像头权限被拒绝..."
}
```

错误类型：
- `NotAllowedError` - 权限被拒绝
- `NotFoundError` - 无摄像头设备
- `NotReadableError` - 摄像头被占用

### createLivenessDetector(options)

创建检测器实例。

**参数:**
- `videoElement` - 视频元素
- `canvasElement` - Canvas 元素
- `statusElements` - 状态显示元素
- `captureBtn` - 拍照按钮
- `resultContainer` - 结果容器
- `capturedImage` - 采集图片元素
- `onComplete(base64)` - 完成回调
- `onActionComplete(action, current, total)` - 动作完成回调
- `onError(error)` - 错误回调
- `config` - 配置项

### detector.start()

开始活体检测。

### detector.stop()

终止检测。

### detector.reset()

重置检测状态。

### detector.getBase64Image()

获取采集的 Base64 图片。

## 开发

```bash
# 启动 demo
npm run dev

# 构建 npm 包
npm run build
```

## License

MIT
