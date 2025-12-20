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
            earHistory: [],
            // 画面稳定性检测
            faceCenterPosition: null, // 人脸中心的绝对位置
            faceCenterHistory: [], // 最近N帧的中心位置历史
            unstableFrames: 0, // 连续不稳定帧数
            // 转头检测：鼻子偏移历史
            noseOffsetHistory: [], // 最近N帧的鼻子偏移值
            lastNoseOffset: null // 上一帧的鼻子偏移
        };

        // 人脸区域检测相关
        this.faceInCircleTime = 0; // 人脸在圆内的时间
        this.lastFrameTime = Date.now(); // 上一帧时间
        this.currentColorIndex = 0; // 当前边框颜色索引
        this.lastColorChangeTime = Date.now(); // 上次颜色变化时间

        this.initStatusDisplay();
    }

    // 语音播报
    speak(text, onComplete = null) {
        if (!config.voice.enabled) {
            // 如果语音禁用，立即调用回调
            if (onComplete) onComplete();
            return;
        }

        console.log(`[语音播报] ${text}`);

        // 取消之前的语音
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = config.voice.lang;
        utterance.rate = config.voice.rate;

        // 监听播报完成事件
        if (onComplete) {
            utterance.onend = () => {
                console.log(`[语音播报完成] ${text}`);
                onComplete();
            };
        }

        window.speechSynthesis.speak(utterance);
    }

    // 播报当前动作提示
    speakAction(action) {
        const prompt = config.voice.prompts[action];
        console.log(`[播报动作] action=${action}, prompt=${prompt}`);
        if (prompt) this.speak(prompt);
    }

    // 播报动作完成
    speakComplete(action, onComplete = null) {
        const prompt = config.voice.prompts[action + 'Complete'];
        console.log(`[播报完成] action=${action}, prompt=${prompt}`);
        if (prompt) {
            this.speak(prompt, onComplete);
        } else if (onComplete) {
            // 如果没有提示词，立即调用回调
            onComplete();
        }
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
        // 防止索引越界
        if (this.currentActionIndex >= this.actions.length) {
            console.log(
                `[显示动作] 索引越界: ${this.currentActionIndex}, 总数: ${this.actions.length}`
            );
            return;
        }

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
            // 再次检查索引，确保还在当前动作
            if (
                this.currentActionIndex < this.actions.length &&
                this.actions[this.currentActionIndex] === currentAction
            ) {
                this.allowDetection = true;
                console.log(`[显示动作] 语音播报完毕，允许检测: ${currentAction}`);
            } else {
                console.log(`[显示动作] 动作已切换，取消允许检测`);
            }
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

        // 绘制圆形区域遮罩（始终显示）
        this.drawCircleMask();

        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const landmarks = results.multiFaceLandmarks[0];

            // 检查人脸是否在圆形区域内
            const faceInCircle = this.isFaceInCircle(landmarks);

            // 标记检测到人脸
            if (!this.detectionState.faceDetected) {
                if (faceInCircle) {
                    // 人脸在圆内，累计时间
                    const now = Date.now();
                    const deltaTime = now - this.lastFrameTime;
                    this.lastFrameTime = now;
                    this.faceInCircleTime += deltaTime;

                    // 停留时间达到阈值，触发“检测到人脸”
                    if (this.faceInCircleTime >= config.faceArea.stayDuration) {
                        console.log('[检测到人脸] 准备开始检测流程');
                        this.updateStatus('faceDetected', true);
                        this.speakAction('faceDetected');
                        this.currentActionIndex = 0;
                        console.log('[检测到人脸] 设置索引为 0，1.5秒后播报第一个动作');
                        // 延迟播报下一个动作
                        setTimeout(() => this.showCurrentAction(), 1500);
                    }
                } else {
                    // 人脸不在圆内，重置计时
                    this.faceInCircleTime = 0;
                    this.lastFrameTime = Date.now();
                }
            } else {
                // 已经检测到人脸，进入动作检测阶段
                // 如果人脸离开圆形，不执行动作检测，但继续绘制遮罩
                if (!faceInCircle) {
                    if (this.allowDetection) {
                        console.warn(`[动作检测阶段] 人脸离开圆形，暂停检测`);
                    }
                    // 绘制面部关键点（可配置）
                    if (config.showLandmarks) {
                        this.drawLandmarks(landmarks);
                    }
                    return; // 不执行动作棅测
                }
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
                const isCompleted = this.detectionState[currentAction];

                // 如果当前动作已完成，不再检测
                if (isCompleted) {
                    console.warn(
                        `[检测循环] 动作 ${currentAction} 已完成，但还在检测，索引: ${this.currentActionIndex}`
                    );
                    return;
                }

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
            // 已经开始动作检测后，即使没有检测到人脸也不重置 faceDetected
            // 这避免了短暂丢失人脸后重新初始化的问题
            if (!this.detectionState.faceDetected) {
                // 只有在还未开始检测时才重置计时
                this.faceInCircleTime = 0;
                this.lastFrameTime = Date.now();
            }
            // 其他情况不处理，保持当前状态
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

    // 绘制圆形区域遮罩
    drawCircleMask() {
        if (!config.faceArea.enabled) return;

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const radius = (this.canvas.width * config.faceArea.circleRatio) / 2;

        // 动态变换颜色
        const now = Date.now();
        if (now - this.lastColorChangeTime > config.faceArea.colorChangeInterval) {
            this.currentColorIndex =
                (this.currentColorIndex + 1) % config.faceArea.borderColors.length;
            this.lastColorChangeTime = now;
        }
        const currentColor = config.faceArea.borderColors[this.currentColorIndex];

        // 🎨 绘制彩色遮罩（圆形外）- 覆盖层颜色闪动
        this.ctx.save();
        // 将 hex 颜色转换为半透明的 rgba
        const overlayColor = this.hexToRgba(currentColor, config.faceArea.maskOpacity);
        this.ctx.fillStyle = overlayColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 清除圆形内部
        this.ctx.globalCompositeOperation = 'destination-out';
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        this.ctx.fill();
        this.ctx.restore();

        // 绘制圆形边框（保持同色）
        this.ctx.strokeStyle = currentColor;
        this.ctx.lineWidth = config.faceArea.borderWidth;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        this.ctx.stroke();
    }

    // 将 hex 颜色转换为 rgba
    hexToRgba(hex, alpha) {
        // 支持 #RGB 和 #RRGGBB 格式
        let r, g, b;
        if (hex.length === 4) {
            r = parseInt(hex[1] + hex[1], 16);
            g = parseInt(hex[2] + hex[2], 16);
            b = parseInt(hex[3] + hex[3], 16);
        } else {
            r = parseInt(hex.slice(1, 3), 16);
            g = parseInt(hex.slice(3, 5), 16);
            b = parseInt(hex.slice(5, 7), 16);
        }
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // 判断人脸是否在圆形区域内
    isFaceInCircle(landmarks) {
        if (!config.faceArea.enabled) return true;

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const radius = (this.canvas.width * config.faceArea.circleRatio) / 2;

        if (config.faceArea.strictMode) {
            // 严格模式：整个人脸边界框都在圆内
            const faceBox = this.getFaceBoundingBox(landmarks);

            // 检查四个角是否都在圆内
            const corners = [
                { x: faceBox.minX, y: faceBox.minY },
                { x: faceBox.maxX, y: faceBox.minY },
                { x: faceBox.minX, y: faceBox.maxY },
                { x: faceBox.maxX, y: faceBox.maxY }
            ];

            return corners.every(corner => {
                const dx = corner.x - centerX;
                const dy = corner.y - centerY;
                return Math.sqrt(dx * dx + dy * dy) <= radius;
            });
        } else {
            // 宽松模式：大部分关键点在圆内即可
            // 使用面部主要关键点：左右眼、鼻尖、嘴角、左右脸颊
            const keyPoints = [
                landmarks[33], // 左眼
                landmarks[263], // 右眼
                landmarks[1], // 鼻尖
                landmarks[61], // 左嘴角
                landmarks[291], // 右嘴角
                landmarks[234], // 左脸颊
                landmarks[454] // 右脸颊
            ];

            // 计算有多少个关键点在圆内
            let pointsInCircle = 0;
            keyPoints.forEach(point => {
                const px = point.x * this.canvas.width;
                const py = point.y * this.canvas.height;
                const dx = px - centerX;
                const dy = py - centerY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= radius) {
                    pointsInCircle++;
                }
            });

            const inCircle = pointsInCircle >= 5;
            // 始终显示关键点数量，方便用户了解实时状态
            console.log(
                `[圆形检测-宽松] 关键点: ${pointsInCircle}/7 在圆内, 状态: ${
                    inCircle ? '✅合格' : '❌不合格'
                }`
            );

            // 至少 5/7 的关键点在圆内（约71%）
            return inCircle;
        }
    }

    // 获取人脸边界框
    getFaceBoundingBox(landmarks) {
        let minX = Infinity,
            minY = Infinity;
        let maxX = -Infinity,
            maxY = -Infinity;

        // 使用关键点：左右眼、鼻尖、嘴角、下巴
        const keyPoints = [33, 263, 1, 61, 291, 199];

        keyPoints.forEach(idx => {
            const point = landmarks[idx];
            const x = point.x * this.canvas.width;
            const y = point.y * this.canvas.height;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        });

        // 扩大边界框 20%
        const width = maxX - minX;
        const height = maxY - minY;
        const padding = Math.max(width, height) * 0.2;

        return {
            minX: minX - padding,
            minY: minY - padding,
            maxX: maxX + padding,
            maxY: maxY + padding
        };
    }

    /**
     * 检测画面是否稳定（区分真实人脸动作和摄像头移动）
     * @param {Array} landmarks - 人脸关键点
     * @returns {boolean} - true表示画面稳定，false表示检测到摄像头移动
     */
    isCameraStable(landmarks) {
        // 计算人脸中心点（使用鼻尖和两眼中心）
        const nose = landmarks[1];
        const leftEye = landmarks[33];
        const rightEye = landmarks[263];

        // 人脸中心使用归一化坐标（0-1范围）
        const faceCenter = {
            x: (nose.x + leftEye.x + rightEye.x) / 3,
            y: (nose.y + leftEye.y + rightEye.y) / 3
        };

        // 首次检测，初始化参考位置
        if (!this.referenceValues.faceCenterPosition) {
            this.referenceValues.faceCenterPosition = faceCenter;
            this.referenceValues.faceCenterHistory = [faceCenter];
            this.referenceValues.unstableFrames = 0;
            return true;
        }

        // 计算当前中心点与参考位置的偏移距离（归一化坐标）
        const dx = faceCenter.x - this.referenceValues.faceCenterPosition.x;
        const dy = faceCenter.y - this.referenceValues.faceCenterPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // 阈值设置：归一化坐标下的移动阈值
        // 0.08 约等于画面宽度的8%，足以检测摄像头移动但不会误判真实动作
        const MOVEMENT_THRESHOLD = 0.08;

        // 保持最近10帧的中心位置历史
        this.referenceValues.faceCenterHistory.push(faceCenter);
        if (this.referenceValues.faceCenterHistory.length > 10) {
            this.referenceValues.faceCenterHistory.shift();
        }

        // 判断是否稳定
        if (distance > MOVEMENT_THRESHOLD) {
            // 检测到大幅移动
            this.referenceValues.unstableFrames++;

            if (config.debug) {
                console.log(
                    `[画面稳定性] ⚠️ 检测到画面移动，距离: ${distance.toFixed(
                        4
                    )}, 阈值: ${MOVEMENT_THRESHOLD}, 连续不稳定帧: ${
                        this.referenceValues.unstableFrames
                    }`
                );
            }

            // 🔴 修复：连续2帧不稳定就立即阻断，避免误触发
            // 原来要等3帧，导致前2帧仍返回true，动作检测已经执行并触发完成
            if (this.referenceValues.unstableFrames >= 2) {
                // 更新参考位置为当前位置
                this.referenceValues.faceCenterPosition = faceCenter;
                this.referenceValues.unstableFrames = 0;

                if (config.debug) {
                    console.log(`[画面稳定性] 🚫 摄像头移动，暂停动作检测`);
                }

                return false; // 画面不稳定，拒绝检测
            }

            // 🔴 新增：即使只有1帧不稳定，也先返回false，等待下一帧确认
            // 这样可以防止在第1帧就触发动作完成
            return false;
        } else {
            // 画面稳定，重置不稳定帧计数
            if (this.referenceValues.unstableFrames > 0) {
                this.referenceValues.unstableFrames--;
            }

            // 缓慢更新参考位置（平滑跟踪）
            const SMOOTH_FACTOR = 0.1; // 10%的权重更新
            this.referenceValues.faceCenterPosition = {
                x:
                    this.referenceValues.faceCenterPosition.x * (1 - SMOOTH_FACTOR) +
                    faceCenter.x * SMOOTH_FACTOR,
                y:
                    this.referenceValues.faceCenterPosition.y * (1 - SMOOTH_FACTOR) +
                    faceCenter.y * SMOOTH_FACTOR
            };
        }

        return true; // 画面稳定，允许检测
    }

    analyzeHeadMovement(landmarks, targetAction) {
        // 🔴 强制校验：必须在圆形区域内才能检测
        if (!this.isFaceInCircle(landmarks)) {
            return;
        }

        // 🔴 画面稳定性检查：检测摄像头移动
        if (!this.isCameraStable(landmarks)) {
            return;
        }

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

        // 🔴 新增：检测鼻子偏移的异常变化（防止摄像头移动导致的误触发）
        if (this.referenceValues.lastNoseOffset !== null) {
            const noseOffsetChange = Math.abs(noseOffsetX - this.referenceValues.lastNoseOffset);

            // 如果鼻子偏移在单帧内变化超过0.15，判定为画面异常移动
            if (noseOffsetChange > 0.15) {
                if (config.debug) {
                    console.log(
                        `[转头检测] 🚫 鼻子偏移异常变化: ${noseOffsetChange.toFixed(
                            3
                        )}, 上一帧: ${this.referenceValues.lastNoseOffset.toFixed(
                            3
                        )}, 当前帧: ${noseOffsetX.toFixed(3)}`
                    );
                }
                // 重置历史，拒绝本次检测
                this.referenceValues.lastNoseOffset = noseOffsetX;
                this.referenceValues.noseOffsetHistory = [];
                return;
            }
        }

        // 更新鼻子偏移历史
        this.referenceValues.lastNoseOffset = noseOffsetX;
        this.referenceValues.noseOffsetHistory.push(noseOffsetX);
        if (this.referenceValues.noseOffsetHistory.length > 5) {
            this.referenceValues.noseOffsetHistory.shift();
        }

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

        // 左转头检测：用户视角向左转（鼻子向右偏移，左脸頊更可见）
        if (targetAction === 'turnLeft') {
            // 条件1: 鼻子显著偏右（用户向左转头）
            const noseLeft = noseOffsetX > 0.15;
            // 条件2: 左脸頊明显比右脸頊可见（转头时会露出另一侧脸頊）
            const cheekCorrect = leftCheekVisible > rightCheekVisible + 0.1;
            // 条件3: 脸頊差异足够大（确保是真的转头）
            const cheekDiffEnough = cheekDiff > 0.15;

            // 🔴 新增：需要连续3帧鼻子偏移都大于0.15，防止瞬间抖动
            let consistentNoseLeft = false;
            if (this.referenceValues.noseOffsetHistory.length >= 3) {
                const recent3 = this.referenceValues.noseOffsetHistory.slice(-3);
                consistentNoseLeft = recent3.every(offset => offset > 0.15);
            }

            if (config.debug) {
                console.log(
                    `[左转头] 条件1(鼻偏右): ${noseLeft}, 条件2(脸頊): ${cheekCorrect}, 条件3(差异): ${cheekDiffEnough}, 条件4(连续3帧): ${consistentNoseLeft}, 已完成: ${this.detectionState.turnLeft}`
                );
            }

            if (noseLeft && cheekCorrect && cheekDiffEnough && consistentNoseLeft) {
                if (!this.detectionState.turnLeft) {
                    console.log(
                        `[左转头检测] 触发完成！鼻偏移: ${noseOffsetX.toFixed(
                            3
                        )}, 脸頊差: ${cheekDiff.toFixed(3)}`
                    );
                    this.completeCurrentAction('turnLeft');
                } else {
                    console.warn(`[左转头检测] 检测到左转头但已标记完成，忽略`);
                }
            }
        }

        // 右转头检测：用户视角向右转（鼻子向左偏移，右脸頊更可见）
        if (targetAction === 'turnRight') {
            // 条件1: 鼻子显著偏左（用户向右转头）
            const noseRight = noseOffsetX < -0.15;
            // 条件2: 右脸頊明显比左脸頊可见
            const cheekCorrect = rightCheekVisible > leftCheekVisible + 0.1;
            // 条件3: 脸頊差异足够大
            const cheekDiffEnough = cheekDiff > 0.15;

            // 🔴 新增：需要连续3帧鼻子偏移都小于-0.15，防止瞬间抖动
            let consistentNoseRight = false;
            if (this.referenceValues.noseOffsetHistory.length >= 3) {
                const recent3 = this.referenceValues.noseOffsetHistory.slice(-3);
                consistentNoseRight = recent3.every(offset => offset < -0.15);
            }

            if (config.debug) {
                console.log(
                    `[右转头] 条件1(鼻偏左): ${noseRight}, 条件2(脸頊): ${cheekCorrect}, 条件3(差异): ${cheekDiffEnough}, 条件4(连续3帧): ${consistentNoseRight}, 已完成: ${this.detectionState.turnRight}`
                );
            }

            if (noseRight && cheekCorrect && cheekDiffEnough && consistentNoseRight) {
                if (!this.detectionState.turnRight) {
                    console.log(
                        `[右转头检测] 触发完成！鼻偏移: ${noseOffsetX.toFixed(
                            3
                        )}, 脸頊差: ${cheekDiff.toFixed(3)}`
                    );
                    this.completeCurrentAction('turnRight');
                } else {
                    console.warn(`[右转头检测] 检测到右转头但已标记完成，忽略`);
                }
            }
        }

        // 点头检测: 使用鼻子Y轴相对于眼睛中心的偏移
        if (targetAction === 'nod') {
            const noseOffsetY = nose.y - eyeCenterY;
            const normalizedOffsetY = noseOffsetY / faceWidth;

            if (config.debug) {
                console.log(
                    `[点头] 偏移: ${normalizedOffsetY.toFixed(3)}, 阈值: 0.48, 已完成: ${
                        this.detectionState.nod
                    }`
                );
            }

            // 点头时鼻子相对下移（阈值 0.48）
            if (normalizedOffsetY > 0.48) {
                if (!this.detectionState.nod) {
                    console.log(`[点头检测] 触发完成！偏移: ${normalizedOffsetY.toFixed(3)}`);
                    this.completeCurrentAction('nod');
                } else {
                    console.warn(`[点头检测] 检测到点头但已标记完成，忽略`);
                }
            }
        }
    }

    analyzeEyeBlinking(landmarks) {
        // 🔴 强制校验：必须在圆形区域内才能检测
        if (!this.isFaceInCircle(landmarks)) {
            return;
        }

        // 🔴 画面稳定性检查：检测摄像头移动
        if (!this.isCameraStable(landmarks)) {
            return;
        }

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
                console.log(
                    `[眨眼检测] 触发完成！EAR: ${avgEAR.toFixed(3)}, 比例: ${ratio.toFixed(3)}`
                );
                this.completeCurrentAction('blink');
            } else {
                console.warn(`[眨眼检测] 检测到眨眼但已标记完成，忽略`);
            }
        }
    }

    calculateEAR(top, bottom, left, right) {
        const vertical = Math.sqrt(Math.pow(bottom.x - top.x, 2) + Math.pow(bottom.y - top.y, 2));
        const horizontal = Math.sqrt(Math.pow(right.x - left.x, 2) + Math.pow(right.y - left.y, 2));
        return vertical / horizontal;
    }

    analyzeMouthOpen(landmarks) {
        // 🔴 强制校验：必须在圆形区域内才能检测
        if (!this.isFaceInCircle(landmarks)) {
            return;
        }

        // 🔴 画面稳定性检查：检测摄像头移动
        if (!this.isCameraStable(landmarks)) {
            return;
        }

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
        console.log(`[完成动作] 检测状态:`, JSON.stringify(this.detectionState));

        // 防止重复完成
        if (this.detectionState[action]) {
            console.warn(`[完成动作] 动作 ${action} 已经完成过了，忽略`);
            return;
        }

        this.detectionState[action] = true;
        const el = this.statusElements[action];
        if (el) {
            el.classList.remove('current');
            el.classList.add('completed');
            console.log(`[完成动作] UI状态已更新: ${action}`);
        }

        // 重置参考值
        this.referenceValues.nosePosition = null;
        this.referenceValues.faceWidth = null;
        this.referenceValues.maxEAR = 0;
        this.referenceValues.earHistory = [];
        console.log(`[完成动作] 参考值已重置`);

        // 进入下一个动作
        const oldIndex = this.currentActionIndex;
        this.currentActionIndex++;
        // 立即禁止检测，等待下一个动作播报
        this.allowDetection = false;
        console.log(
            `[完成动作] 索引从 ${oldIndex} 递增到 ${this.currentActionIndex}, 总数: ${this.actions.length}, 禁止检测`
        );

        // 语音播报完成，并在播报结束后触发下一个动作
        this.speakComplete(action, () => {
            // 触发动作完成回调
            if (this.onActionComplete) {
                this.onActionComplete(action, this.currentActionIndex, this.actions.length);
            }

            if (this.currentActionIndex < this.actions.length) {
                const nextAction = this.actions[this.currentActionIndex];
                console.log(`[完成动作] 下一个动作: ${nextAction}, 语音播报完毕，0.5秒后播报`);
                // 等待 0.5 秒缓冲时间，再播报下一个动作
                setTimeout(() => {
                    console.log(
                        `[完成动作-延迟回调] 准备播报动作，当前索引: ${this.currentActionIndex}`
                    );
                    this.showCurrentAction();
                }, 500);
            } else {
                console.log(`[完成动作] 所有动作已完成，检查完成状态`);
                this.checkCompletion();
            }
        });
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
