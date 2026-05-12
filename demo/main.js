/**
 * Face Liveness Detection Demo
 * 演示如何使用 face-liveness-detection 包
 */

import {
    createLivenessDetector,
    checkSupport,
    checkCameraPermission
} from '../src/js/index.js';

// DOM 元素
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const cameraWrapper = document.getElementById('cameraWrapper');

const startBtn = document.getElementById('startBtn');
const retryBtn = document.getElementById('retryBtn');
const resultContainer = document.getElementById('resultContainer');
const capturedImage = document.getElementById('capturedImage');

// 状态元素
const statusElements = {
    faceDetected: document.getElementById('faceDetected'),
    blink: document.getElementById('blink'),
    openMouth: document.getElementById('openMouth'),
    turnLeft: document.getElementById('turnLeft'),
    turnRight: document.getElementById('turnRight'),
    nod: document.getElementById('nod')
};

// 配置元素
const actionCheckboxes = {
    blink: document.getElementById('actionBlink'),
    openMouth: document.getElementById('actionMouth'),
    turnLeft: document.getElementById('actionLeft'),
    turnRight: document.getElementById('actionRight'),
    nod: document.getElementById('actionNod')
};
const actionOrderSelect = document.getElementById('actionOrder');
const enableVoiceCheckbox = document.getElementById('enableVoice');

let detector = null;

// ==================== 新增：摄像头镜像控制 ====================
function applyMirrorEffect() {
    const isFrontCamera = true; // 如果以后支持后置摄像头，可改为动态判断

    if (isFrontCamera) {
        video.style.transform = 'scaleX(-1)';   // 显示时翻转回来（用户看到正常方向）
        canvas.style.transform = 'scaleX(-1)';  // Canvas也同步
    }
}

// 获取用户配置
function getSelectedActions() {
    const actions = [];
    if (actionCheckboxes.blink.checked) actions.push('blink');
    if (actionCheckboxes.openMouth.checked) actions.push('openMouth');
    if (actionCheckboxes.turnLeft.checked) actions.push('turnLeft');
    if (actionCheckboxes.turnRight.checked) actions.push('turnRight');
    if (actionCheckboxes.nod.checked) actions.push('nod');
    return actions;
}

function getUserConfig() {
    return {
        actions: getSelectedActions(),
        actionOrder: actionOrderSelect.value,
        voice: { enabled: enableVoiceCheckbox.checked },
        debug: true
    };
}

// 同步 canvas 与 video 实际尺寸（关键修复）
function syncCanvasSize() {
    if (video.videoWidth && video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // 动态更新容器宽高比（适配手机不同分辨率）
        const ratio = video.videoWidth / video.videoHeight;
        cameraWrapper.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
    }
}

// 重置状态
function resetStatus() {
    Object.values(statusElements).forEach(el => {
        el.classList.remove('current', 'completed', 'visible');
    });
    statusElements.faceDetected.classList.add('visible');
    resultContainer.style.display = 'none';
}

function setConfigEnabled(enabled) {
    Object.values(actionCheckboxes).forEach(cb => (cb.disabled = !enabled));
    actionOrderSelect.disabled = !enabled;
    enableVoiceCheckbox.disabled = !enabled;
}

// 开始检测
async function startDetection() {
    const support = checkSupport();
    if (!support.supported) {
        alert('当前环境不支持: ' + support.reasons.join(', '));
        return;
    }

    const permission = await checkCameraPermission();
    if (!permission.granted) {
        alert(permission.message);
        return;
    }

    if (getSelectedActions().length === 0) {
        alert('请至少选择一个检测动作');
        return;
    }

    resetStatus();
    setConfigEnabled(false);
    startBtn.disabled = true;
    startBtn.textContent = '检测中...';
    retryBtn.style.display = 'none';

    try {
        detector = createLivenessDetector({
            videoElement: video,
            canvasElement: canvas,
            statusElements: statusElements,
            captureBtn: startBtn,
            resultContainer: resultContainer,
            capturedImage: capturedImage,
            config: getUserConfig(),
            onComplete: base64 => {
                startBtn.style.display = 'none';
                retryBtn.style.display = 'inline-block';
            },
            onError: error => {
                console.error('检测错误:', error);
                alert('检测错误: ' + error.message);
            }
        });

        await detector.start();
    } catch (error) {
        console.error('启动失败:', error);
        alert('启动失败: ' + error.message);
        startBtn.disabled = false;
        startBtn.textContent = '开始检测';
        setConfigEnabled(true);
    }
}

// 重新检测
function retryDetection() {
    location.reload();
}

// 初始化
function init() {
    // 关键：视频元数据加载完成后同步尺寸
      video.addEventListener('loadedmetadata', () => {
        syncCanvasSize();
        applyMirrorEffect();        // ← 新增
    });
    video.addEventListener('resize', syncCanvasSize);   // 兼容某些设备

    startBtn.addEventListener('click', startDetection);
    retryBtn.addEventListener('click', retryDetection);
}

init();