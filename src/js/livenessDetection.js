import {
    initializeFaceDetection,
    setOnResults,
    startCamera,
    stopCamera,
    pauseProcessing
} from './faceDetection.js';
import { config } from './config.js';

export class LivenessDetector {
    constructor(options) {
        this.video = options.videoElement;
        this.canvas = options.canvasElement;
        this.ctx = this.canvas.getContext('2d');
        this.statusElements = options.statusElements;
        this.captureBtn = options.captureBtn;
        this.resultContainer = options.resultContainer;
        this.capturedImage = options.capturedImage;

        // 事件回调
        this.onComplete = options.onComplete || null;
        this.onActionComplete = options.onActionComplete || null;
        this.onError = options.onError || null;

        this._init();
    }

    _init() {
        // 动作列表（从配置读取）
        this.actions = [...config.actions];
        console.log('[初始化] config.actions:', config.actions);
        console.log('[初始化] this.actions 复制后:', this.actions);
        // 根据配置决定是否随机打乱
        if (config.actionOrder === 'random') {
            console.log('[初始化] 随机打乱动作顺序');
            this.shuffleActions();
        }

        // 调试：打印动作顺序
        console.log('[初始化] 最终动作顺序:', this.actions);

        // 当前动作索引
        this.currentActionIndex = -1;

        // 是否允许检测（语音播报完毕后才允许）
        this.allowDetection = false;

        // 检测状态
        this.detectionState = {
            faceDetected: false,
            turnLeft: false,
            turnRight: false,
            nod: false,
            blink: false,
            openMouth: false
        };

        // 是否已完成拍照
        this.captured = false;
        this.captureMode = false;
        this.captureCheckCount = 0;
        this.capturedBase64 = null;
        this.isRunning = false;

        // 参考值
        this.referenceValues = {
            nosePosition: null,
            faceWidth: null,
            maxEAR: 0,
            earHistory: []
        };

        this.initStatusDisplay();
    }

    // 语音播报
    speak(text) {
        if (!config.voice.enabled) return;

        console.log(`[语音播报] ${text}`);

        // 取消之前的语音
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = config.voice.lang;
        utterance.rate = config.voice.rate;
        window.speechSynthesis.speak(utterance);
    }

    // 播报当前动作提示
    speakAction(action) {
        const prompt = config.voice.prompts[action];
        console.log(`[播报动作] action=${action}, prompt=${prompt}`);
        if (prompt) this.speak(prompt);
    }

    // 播报动作完成
    speakComplete(action) {
        const prompt = config.voice.prompts[action + 'Complete'];
        console.log(`[播报完成] action=${action}, prompt=${prompt}`);
        if (prompt) this.speak(prompt);
    }

    shuffleActions() {
        for (let i = this.actions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.actions[i], this.actions[j]] = [this.actions[j], this.actions[i]];
        }
    }

    initStatusDisplay() {
        Object.entries(this.statusElements).forEach(([key, el]) => {
            el.classList.add('pending');
            if (key !== 'faceDetected') {
                el.style.display = 'none';
            }
        });
        this.statusElements.faceDetected.classList.add('current');
    }

    showCurrentAction() {
        const currentAction = this.actions[this.currentActionIndex];
        console.log(`[显示动作] 当前索引: ${this.currentActionIndex}, 动作: ${currentAction}`);
        console.log(`[显示动作] 动作数组:`, this.actions);

        // 禁止检测，等待语音播报完毕
        this.allowDetection = false;
        console.log(`[显示动作] 禁止检测，等待语音播报`);

        // 语音播报当前动作（无论状态元素是否存在）
        this.speakAction(currentAction);

        // 更新状态显示
        const el = this.statusElements[currentAction];
        if (el) {
            console.log(`[显示动作] 找到状态元素，设置为 current`);
            el.style.display = 'flex';
            el.classList.remove('pending');
            el.classList.add('current');
        } else {
            console.warn(`[显示动作] 状态元素不存在: ${currentAction}`);
        }

        // 语音播报需要时间，延迟 2 秒后允许检测
        setTimeout(() => {
            this.allowDetection = true;
            console.log(`[显示动作] 语音播报完毕，允许检测`);
        }, 2000);
    }

    async start() {
        this.isRunning = true;
        try {
            await initializeFaceDetection();

            // 设置检测结果回调
            setOnResults(results => {
                if (this.isRunning) {
                    this.onFaceResults(results);
                }
            });

            // 启动摄像头
            await startCamera(this.video);
        } catch (error) {
            console.error('启动失败:', error);
            if (this.onError) this.onError(error);
            throw error;
        }
    }

    // 终止检测
    stop() {
        this.isRunning = false;
        stopCamera();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        window.speechSynthesis.cancel();
    }

    // 重置检测
    reset() {
        this.stop();
        this._init();
        this.initStatusDisplay();
    }

    onFaceResults(results) {
        // 清空画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const landmarks = results.multiFaceLandmarks[0];

            // 标记检测到人脸
            if (!this.detectionState.faceDetected) {
                console.log('[检测到人脸] 准备开始检测流程');
                this.updateStatus('faceDetected', true);
                this.speakAction('faceDetected');
                this.currentActionIndex = 0;
                console.log('[检测到人脸] 设置索引为 0，1.5秒后播报第一个动作');
                // 延迟播报下一个动作
                setTimeout(() => this.showCurrentAction(), 1500);
            }

            // 绘制面部关键点（可配置）
            if (config.showLandmarks) {
                this.drawLandmarks(landmarks);
            }

            // 采集模式检测正对
            if (this.captureMode) {
                this.checkFacingCamera(landmarks);
                return;
            }

            // 只检测当前指定的动作（且允许检测）
            if (
                this.allowDetection &&
                this.currentActionIndex >= 0 &&
                this.currentActionIndex < this.actions.length
            ) {
                const currentAction = this.actions[this.currentActionIndex];
                // console.log(`[检测循环] 索引: ${this.currentActionIndex}, 动作: ${currentAction}`);
                switch (currentAction) {
                    case 'turnLeft':
                    case 'turnRight':
                    case 'nod':
                        this.analyzeHeadMovement(landmarks, currentAction);
                        break;
                    case 'blink':
                        this.analyzeEyeBlinking(landmarks);
                        break;
                    case 'openMouth':
                        this.analyzeMouthOpen(landmarks);
                        break;
                }
            }
        } else {
            this.updateStatus('faceDetected', false);
        }
    }

    drawLandmarks(landmarks) {
        this.ctx.fillStyle = '#00FF00';
        for (const point of landmarks) {
            const x = point.x * this.canvas.width;
            const y = point.y * this.canvas.height;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 1, 0, 2 * Math.PI);
            this.ctx.fill();
        }
    }

    analyzeHeadMovement(landmarks, targetAction) {
        // 关键点：鼻尖(1), 左眼(33), 右眼(263), 左脸颊(234), 右脸颊(454)
        const nose = landmarks[1];
        const leftEye = landmarks[33];
        const rightEye = landmarks[263];
        const leftCheek = landmarks[234];
        const rightCheek = landmarks[454];

        // 计算两眼中心点
        const eyeCenterX = (leftEye.x + rightEye.x) / 2;
        const eyeCenterY = (leftEye.y + rightEye.y) / 2;

        // 计算面部宽度（两眼距离）
        const faceWidth = Math.abs(rightEye.x - leftEye.x);

        // 计算鼻子相对于两眼中心的偏移（归一化）
        const noseOffsetX = (nose.x - eyeCenterX) / faceWidth;

        // 计算脸颊可见度（用于判断转头方向）
        const leftCheekVisible = Math.abs(leftCheek.x - leftEye.x) / faceWidth;
        const rightCheekVisible = Math.abs(rightCheek.x - rightEye.x) / faceWidth;

        // 脸颊可见度差异
        const cheekDiff = Math.abs(leftCheekVisible - rightCheekVisible);

        // 初始化参考值
        if (!this.referenceValues.nosePosition) {
            this.referenceValues.nosePosition = { x: eyeCenterX, y: eyeCenterY };
            this.referenceValues.faceWidth = faceWidth;
            return;
        }

        // 计算面部宽度变化率（检测面部朝向）
        const widthRatio = faceWidth / this.referenceValues.faceWidth;

        if (config.debug) {
            console.log(
                `鼻子偏移: ${noseOffsetX.toFixed(3)}, 宽度比: ${widthRatio.toFixed(
                    3
                )}, 左脸颊: ${leftCheekVisible.toFixed(3)}, 右脸颊: ${rightCheekVisible.toFixed(
                    3
                )}, 差异: ${cheekDiff.toFixed(3)}`
            );
        }

        // 左转头检测：用户视角向左转（鼻子向右偏移，左脸颊更可见）
        if (targetAction === 'turnLeft') {
            // 条件1: 鼻子显著偏右（用户向左转头）
            const noseLeft = noseOffsetX > 0.15;
            // 条件2: 左脸颊明显比右脸颊可见（转头时会露出另一侧脸颊）
            const cheekCorrect = leftCheekVisible > rightCheekVisible + 0.1;
            // 条件3: 脸颊差异足够大（确保是真的转头）
            const cheekDiffEnough = cheekDiff > 0.15;

            if (noseLeft && cheekCorrect && cheekDiffEnough) {
                if (!this.detectionState.turnLeft) {
                    if (config.debug) console.log('左转头完成!');
                    this.completeCurrentAction('turnLeft');
                }
            }
        }

        // 右转头检测：用户视角向右转（鼻子向左偏移，右脸颊更可见）
        if (targetAction === 'turnRight') {
            // 条件1: 鼻子显著偏左（用户向右转头）
            const noseRight = noseOffsetX < -0.15;
            // 条件2: 右脸颊明显比左脸颊可见
            const cheekCorrect = rightCheekVisible > leftCheekVisible + 0.1;
            // 条件3: 脸颊差异足够大
            const cheekDiffEnough = cheekDiff > 0.15;

            if (noseRight && cheekCorrect && cheekDiffEnough) {
                if (!this.detectionState.turnRight) {
                    if (config.debug) console.log('右转头完成!');
                    this.completeCurrentAction('turnRight');
                }
            }
        }

        // 点头检测: 使用鼻子Y轴相对于眼睛中心的偏移
        if (targetAction === 'nod') {
            const noseOffsetY = nose.y - eyeCenterY;
            const normalizedOffsetY = noseOffsetY / faceWidth;

            if (config.debug) console.log(`点头偏移: ${normalizedOffsetY.toFixed(3)}`);

            // 点头时鼻子相对下移（阈值 0.48）
            if (normalizedOffsetY > 0.48) {
                if (!this.detectionState.nod) {
                    if (config.debug) console.log('点头完成!');
                    this.completeCurrentAction('nod');
                }
            }
        }
    }

    analyzeEyeBlinking(landmarks) {
        // MediaPipe Face Mesh 眼睛关键点
        // 左眼: 159(上), 145(下), 33(左外), 133(右内)
        // 右眼: 386(上), 374(下), 362(左内), 263(右外)

        const leftEyeTop = landmarks[159];
        const leftEyeBottom = landmarks[145];
        const leftEyeLeft = landmarks[33];
        const leftEyeRight = landmarks[133];

        const rightEyeTop = landmarks[386];
        const rightEyeBottom = landmarks[374];
        const rightEyeLeft = landmarks[362];
        const rightEyeRight = landmarks[263];

        // 计算 EAR
        const leftEAR = this.calculateEAR(leftEyeTop, leftEyeBottom, leftEyeLeft, leftEyeRight);
        const rightEAR = this.calculateEAR(
            rightEyeTop,
            rightEyeBottom,
            rightEyeLeft,
            rightEyeRight
        );
        const avgEAR = (leftEAR + rightEAR) / 2;

        // 更新历史记录
        this.referenceValues.earHistory.push(avgEAR);
        if (this.referenceValues.earHistory.length > 30) {
            this.referenceValues.earHistory.shift();
        }

        // 计算最近的最大EAR作为参考
        if (this.referenceValues.earHistory.length >= 10) {
            const recentMax = Math.max(...this.referenceValues.earHistory.slice(-10));
            if (recentMax > this.referenceValues.maxEAR) {
                this.referenceValues.maxEAR = recentMax;
            }
        }

        const ratio = this.referenceValues.maxEAR > 0 ? avgEAR / this.referenceValues.maxEAR : 1;

        if (config.debug)
            console.log(
                `[EAR检测] EAR: ${avgEAR.toFixed(3)}, 最大: ${this.referenceValues.maxEAR.toFixed(
                    3
                )}, 比例: ${ratio.toFixed(3)}, 允许检测: ${this.allowDetection}`
            );

        // 检测眨眼: 比例低于阈值即完成
        if (ratio < config.blink.threshold) {
            if (!this.detectionState.blink) {
                if (config.debug) console.log('眨眼完成!');
                this.completeCurrentAction('blink');
            }
        }
    }

    calculateEAR(top, bottom, left, right) {
        const vertical = Math.sqrt(Math.pow(bottom.x - top.x, 2) + Math.pow(bottom.y - top.y, 2));
        const horizontal = Math.sqrt(Math.pow(right.x - left.x, 2) + Math.pow(right.y - left.y, 2));
        return vertical / horizontal;
    }

    analyzeMouthOpen(landmarks) {
        // 上唇中心: 13, 下唇中心: 14
        const upperLip = landmarks[13];
        const lowerLip = landmarks[14];

        const mouthOpen = Math.abs(lowerLip.y - upperLip.y);

        if (config.debug) console.log(`嘴巴张开度: ${mouthOpen.toFixed(3)}`);

        // 张嘴: 达到阈值即完成
        if (mouthOpen > config.mouth.threshold) {
            if (!this.detectionState.openMouth) {
                if (config.debug) console.log('张嘴完成!');
                this.completeCurrentAction('openMouth');
            }
        }
    }

    updateStatus(action, completed) {
        if (completed && !this.detectionState[action]) {
            this.detectionState[action] = true;
            const element = this.statusElements[action];
            element.classList.remove('pending', 'current');
            element.classList.add('completed');
        } else if (!completed && this.detectionState[action]) {
            this.detectionState[action] = false;
            const element = this.statusElements[action];
            element.classList.remove('completed');
            element.classList.add('pending');
        }
    }

    completeCurrentAction(action) {
        console.log(`[完成动作] 动作: ${action}, 当前索引: ${this.currentActionIndex}`);
        this.detectionState[action] = true;
        const el = this.statusElements[action];
        if (el) {
            el.classList.remove('current');
            el.classList.add('completed');
        }

        // 语音播报完成
        this.speakComplete(action);

        // 触发动作完成回调
        if (this.onActionComplete) {
            this.onActionComplete(action, this.currentActionIndex + 1, this.actions.length);
        }

        // 重置参考值
        this.referenceValues.nosePosition = null;
        this.referenceValues.faceWidth = null;
        this.referenceValues.maxEAR = 0;
        this.referenceValues.earHistory = [];

        // 进入下一个动作
        this.currentActionIndex++;
        // 立即禁止检测，等待下一个动作播报
        this.allowDetection = false;
        console.log(
            `[完成动作] 索引递增到: ${this.currentActionIndex}, 总数: ${this.actions.length}, 禁止检测`
        );
        if (this.currentActionIndex < this.actions.length) {
            console.log(`[完成动作] 1.5秒后播报下一个动作`);
            // 延迟播报下一个动作
            setTimeout(() => this.showCurrentAction(), 1500);
        } else {
            console.log(`[完成动作] 所有动作已完成，检查完成状态`);
            this.checkCompletion();
        }
    }

    checkCompletion() {
        if (this.captured) return;

        const allCompleted = Object.values(this.detectionState).every(state => state);
        if (allCompleted) {
            this.captured = true;
            this.speak(config.voice.prompts.allComplete);
            // 延迟后开始采集
            setTimeout(() => {
                this.speak(config.voice.prompts.capturing);
                this.startCapture();
            }, 2000);
        }
    }

    // 开始采集 - 等待用户正对摄像头
    startCapture() {
        this.captureMode = true;
        this.captureCheckCount = 0;
    }

    // 检查是否正对摄像头
    checkFacingCamera(landmarks) {
        if (!this.captureMode) return;

        // 用鼻子位置判断是否正对
        const nose = landmarks[1];
        const leftEye = landmarks[33];
        const rightEye = landmarks[263];

        // 计算鼻子在两眼中间的偏移
        const eyeCenter = (leftEye.x + rightEye.x) / 2;
        const noseOffset = Math.abs(nose.x - eyeCenter);

        // 鼻子在画面中心附近
        const centerOffset = Math.abs(nose.x - 0.5);

        if (config.debug)
            console.log(
                `正对检测 - 鼻子偏移: ${noseOffset.toFixed(3)}, 中心偏移: ${centerOffset.toFixed(
                    3
                )}`
            );

        // 判断是否正对（阈值可调整）
        if (noseOffset < 0.02 && centerOffset < 0.15) {
            this.captureCheckCount++;
            // 连续多帧都正对才采集
            if (this.captureCheckCount >= 10) {
                this.captureMode = false;
                this.capture();
            }
        } else {
            this.captureCheckCount = 0;
        }
    }

    capture() {
        this.isRunning = false;
        pauseProcessing();

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

        // 获取 base64 图片数据
        const imageDataUrl = this.canvas.toDataURL('image/jpeg', 0.9);
        this.capturedImage.src = imageDataUrl;

        // 保存纯 base64 数据（去掉前缀）
        this.capturedBase64 = imageDataUrl.split(',')[1];

        this.resultContainer.style.display = 'block';
        this.captureBtn.disabled = true;

        // 触发完成回调
        if (this.onComplete) {
            this.onComplete(this.capturedBase64);
        }

        console.log('Base64 图片已采集，长度:', this.capturedBase64.length);
    }

    // 获取采集的 base64 图片
    getBase64Image() {
        return this.capturedBase64;
    }
}
