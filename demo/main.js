/**
 * Face Liveness Detection Demo
 * 演示如何使用 face-liveness-detection 包
 */

// 从本地包导入（发布后改为 'face-liveness-detection'）
import {
    createLivenessDetector,
    updateConfig,
    checkSupport,
    checkCameraPermission
} from '../src/js/index.js';

// DOM 元素
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
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

// 获取用户配置的动作列表
function getSelectedActions() {
    const actions = [];
    if (actionCheckboxes.blink.checked) actions.push('blink');
    if (actionCheckboxes.openMouth.checked) actions.push('openMouth');
    if (actionCheckboxes.turnLeft.checked) actions.push('turnLeft');
    if (actionCheckboxes.turnRight.checked) actions.push('turnRight');
    if (actionCheckboxes.nod.checked) actions.push('nod');
    return actions;
}

// 获取用户配置
function getUserConfig() {
    return {
        actions: getSelectedActions(),
        actionOrder: actionOrderSelect.value,
        voice: {
            enabled: enableVoiceCheckbox.checked
        },
        debug: true
    };
}

// 重置状态显示
function resetStatus() {
    Object.values(statusElements).forEach(el => {
        el.classList.remove('current', 'completed', 'visible');
    });
    statusElements.faceDetected.classList.add('visible');
    resultContainer.style.display = 'none';
}

// 禁用/启用配置
function setConfigEnabled(enabled) {
    Object.values(actionCheckboxes).forEach(cb => (cb.disabled = !enabled));
    actionOrderSelect.disabled = !enabled;
    enableVoiceCheckbox.disabled = !enabled;
}

// 添加日志以测量每个步骤的耗时
async function startDetection() {
    console.time('startDetection');

    // 检测环境支持
    console.time('checkSupport');
    const support = checkSupport();
    console.timeEnd('checkSupport');
    if (!support.supported) {
        alert('当前环境不支持: ' + support.reasons.join(', '));
        console.timeEnd('startDetection');
        return;
    }

    // 检测摄像头权限
    console.time('checkCameraPermission');
    const permission = await checkCameraPermission();
    console.timeEnd('checkCameraPermission');
    if (!permission.granted) {
        alert(permission.message);
        console.timeEnd('startDetection');
        return;
    }

    const actions = getSelectedActions();
    if (actions.length === 0) {
        alert('请至少选择一个检测动作');
        console.timeEnd('startDetection');
        return;
    }

    resetStatus();
    setConfigEnabled(false);
    startBtn.disabled = true;
    startBtn.textContent = '检测中...';
    retryBtn.style.display = 'none';

    try {
        // 获取用户配置
        console.time('getUserConfig');
        const userConfig = getUserConfig();
        console.timeEnd('getUserConfig');

        // 创建检测器（传入配置）
        console.time('createLivenessDetector');
        detector = createLivenessDetector({
            videoElement: video,
            canvasElement: canvas,
            statusElements: statusElements,
            captureBtn: startBtn,
            resultContainer: resultContainer,
            capturedImage: capturedImage,
            config: userConfig, // 传入用户配置
            onComplete: base64 => {
                console.log('检测完成，Base64 长度:', base64.length);
                startBtn.style.display = 'none';
                retryBtn.style.display = 'inline-block';
            },
            onActionComplete: (action, current, total) => {
                console.log(`完成动作: ${action} (${current}/${total})`);
            },
            onError: error => {
                console.error('检测错误:', error);
                alert('检测错误: ' + error.message);
            }
        });
        console.timeEnd('createLivenessDetector');

        // 开始检测
        console.time('detector.start');
        await detector.start();
        console.timeEnd('detector.start');
    } catch (error) {
        console.error('启动失败:', error);
        alert('启动失败: ' + error.message);
        startBtn.disabled = false;
        startBtn.textContent = '开始检测';
        setConfigEnabled(true);
    }

    console.timeEnd('startDetection');
}

// 重新检测
function retryDetection() {
    location.reload();
}

// 初始化
function init() {
    startBtn.addEventListener('click', startDetection);
    retryBtn.addEventListener('click', retryDetection);
}

init();
