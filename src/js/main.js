import { LivenessDetector } from './livenessDetection.js';

let livenessDetector = null;

document.addEventListener('DOMContentLoaded', async () => {
    const startBtn = document.getElementById('startBtn');
    const captureBtn = document.getElementById('captureBtn');
    const uploadBtn = document.getElementById('uploadBtn');
    
    startBtn.addEventListener('click', startLivenessDetection);
    captureBtn.addEventListener('click', captureImage);
    uploadBtn.addEventListener('click', uploadImage);
});

async function startLivenessDetection() {
    try {
        // 创建活体检测器实例
        livenessDetector = new LivenessDetector({
            videoElement: document.getElementById('video'),
            canvasElement: document.getElementById('canvas'),
            statusElements: {
                faceDetected: document.getElementById('faceDetected'),
                turnLeft: document.getElementById('turnLeft'),
                turnRight: document.getElementById('turnRight'),
                nod: document.getElementById('nod'),
                blink: document.getElementById('blink'),
                openMouth: document.getElementById('openMouth')
            },
            captureBtn: document.getElementById('captureBtn'),
            resultContainer: document.getElementById('resultContainer'),
            capturedImage: document.getElementById('capturedImage')
        });
        
        // 开始检测
        await livenessDetector.start();
        
        // 禁用开始按钮，启用拍照按钮
        document.getElementById('startBtn').disabled = true;
        document.getElementById('captureBtn').disabled = false;
        
    } catch (error) {
        console.error('启动活体检测失败:', error);
        alert('无法访问摄像头或初始化失败，请检查权限设置');
    }
}

function captureImage() {
    if (livenessDetector) {
        livenessDetector.capture();
    }
}

function uploadImage() {
    const imageData = document.getElementById('capturedImage').src;
    // 这里应该将图片数据发送到服务器
    alert('图片已准备就绪，可以上传到服务器进行比对');
    console.log('准备上传的图片数据:', imageData);
}