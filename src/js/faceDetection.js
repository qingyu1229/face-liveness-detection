import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

let faceMesh = null;
let camera = null;
let onResultsCallback = null;

// 初始化 MediaPipe Face Mesh
export async function initializeFaceDetection() {
    faceMesh = new FaceMesh({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        }
    });

    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,  // 启用精细关键点（包括眼睛虹膜）
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    faceMesh.onResults(handleResults);

    console.log('Face Mesh 初始化完成');
    return true;
}

function handleResults(results) {
    if (onResultsCallback) {
        onResultsCallback(results);
    }
}

// 设置结果回调
export function setOnResults(callback) {
    onResultsCallback = callback;
}

// 启动摄像头
export async function startCamera(videoElement) {
    camera = new Camera(videoElement, {
        onFrame: async () => {
            await faceMesh.send({ image: videoElement });
        },
        width: 640,
        height: 480
    });
    await camera.start();
    console.log('摄像头启动成功');
}

// 停止摄像头
export function stopCamera() {
    if (camera) {
        camera.stop();
    }
}
