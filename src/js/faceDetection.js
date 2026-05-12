import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

let faceLandmarker = null;
let videoStream = null;
let animationFrameId = null;
let processingEnabled = true;
let onResultsCallback = null;

// ==================== 初始化人脸检测 ====================
export async function initializeFaceDetection() {
  console.time('initializeFaceDetection');

  try {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
        delegate: "GPU",   // 移动端可尝试 "CPU"
      },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });

    console.log("✅ Face Landmarker 初始化完成");
    console.timeEnd('initializeFaceDetection');
    return true;
  } catch (error) {
    console.error("❌ Face Landmarker 初始化失败:", error);
    return false;
  }
}

// ==================== 结果回调 ====================
export function setOnResults(callback) {
  onResultsCallback = callback;
}

// ==================== 处理单帧 ====================
async function processFrame(videoElement) {
  if (!faceLandmarker || !processingEnabled || !videoElement?.videoWidth) return;

  try {
    const results = faceLandmarker.detectForVideo(videoElement, performance.now());
    if (onResultsCallback) {
      onResultsCallback(results);
    }
  } catch (err) {
    console.warn("检测出错:", err);
  }
}

// ==================== 启动摄像头（自定义实现） ====================
export async function startCamera(videoElement) {
  if (videoStream) {
    processingEnabled = true;
    console.log("✅ 摄像头已恢复处理");
    return true;
  }

  if (!faceLandmarker) {
    console.warn("请先调用 initializeFaceDetection()");
    return false;
  }

  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: { 
        width: { ideal: 640 }, 
        height: { ideal: 480 },
        facingMode: "user"   // 前置摄像头，改 "environment" 为后置
      }
    });

    videoElement.srcObject = videoStream;
    await videoElement.play();

    // 开始循环处理
    const processLoop = async () => {
      if (processingEnabled) {
        await processFrame(videoElement);
      }
      animationFrameId = requestAnimationFrame(processLoop);
    };

    processLoop();

    console.log("✅ 摄像头启动成功");
    return true;
  } catch (error) {
    console.error("启动摄像头失败:", error);
    return false;
  }
}

// ==================== 控制函数 ====================
export function pauseProcessing() {
  processingEnabled = false;
}

export function resumeProcessing() {
  processingEnabled = true;
}

export function stopCamera() {
  processingEnabled = false;
  
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
  }
}

// 清理全部资源
export function cleanup() {
  stopCamera();
  if (faceLandmarker?.close) faceLandmarker.close();
  faceLandmarker = null;
}