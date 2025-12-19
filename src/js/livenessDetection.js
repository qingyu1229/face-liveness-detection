import { initializeFaceDetection, setOnResults, startCamera, stopCamera } from './faceDetection.js';
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
        
        // 动作列表（从配置读取）
        this.actions = [...config.actions];
        this.shuffleActions();
        
        // 当前动作索引
        this.currentActionIndex = -1;
        
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
        
        // 参考值
        this.referenceValues = {
            nosePosition: null,
            eyeClosed: false,
            mouthOpened: false,
            turnedLeft: false,
            turnedRight: false,
            nodded: false,      // 已点头
            maxEAR: 0,
            earHistory: []
        };
        
        this.initStatusDisplay();
    }
    
    // 语音播报
    speak(text) {
        if (!config.voice.enabled) return;
        
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
        if (prompt) this.speak(prompt);
    }
    
    // 播报动作完成
    speakComplete(action) {
        const prompt = config.voice.prompts[action + 'Complete'];
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
        const el = this.statusElements[currentAction];
        el.style.display = 'flex';
        el.classList.remove('pending');
        el.classList.add('current');
        // 语音播报当前动作
        this.speakAction(currentAction);
    }
    
    async start() {
        try {
            await initializeFaceDetection();
            
            // 设置检测结果回调
            setOnResults((results) => this.onFaceResults(results));
            
            // 启动摄像头
            await startCamera(this.video);
            
        } catch (error) {
            console.error('启动失败:', error);
            throw error;
        }
    }
    
    onFaceResults(results) {
        // 清空画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const landmarks = results.multiFaceLandmarks[0];
            
            // 标记检测到人脸
            if (!this.detectionState.faceDetected) {
                this.updateStatus('faceDetected', true);
                this.speakAction('faceDetected');
                this.currentActionIndex = 0;
                // 延迟播报下一个动作
                setTimeout(() => this.showCurrentAction(), 1500);
            }
            
            // 绘制面部关键点（调试用）
            this.drawLandmarks(landmarks);
            
            // 采集模式检测正对
            if (this.captureMode) {
                this.checkFacingCamera(landmarks);
                return;
            }
            
            // 只检测当前指定的动作
            if (this.currentActionIndex >= 0 && this.currentActionIndex < this.actions.length) {
                const currentAction = this.actions[this.currentActionIndex];
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
        // 鼻尖 - 索引 1
        const nose = landmarks[1];
        const noseX = nose.x;
        const noseY = nose.y;
        
        if (!this.referenceValues.nosePosition) {
            this.referenceValues.nosePosition = { x: noseX, y: noseY };
            return;
        }
        
        const deltaX = noseX - this.referenceValues.nosePosition.x;
        const deltaY = noseY - this.referenceValues.nosePosition.y;
        
        if (config.debug) console.log(`鼻子偏移 X: ${deltaX.toFixed(3)}, Y: ${deltaY.toFixed(3)}`);
        
        // 左转头: 转头后回正才算完成
        if (targetAction === 'turnLeft') {
            if (deltaX > config.head.turnLeft.turnThreshold) {
                this.referenceValues.turnedLeft = true;
                if (config.debug) console.log('检测到左转!');
            } else if (this.referenceValues.turnedLeft && Math.abs(deltaX) < config.head.turnLeft.returnThreshold) {
                if (!this.detectionState.turnLeft) {
                    if (config.debug) console.log('左转头完成!');
                    this.completeCurrentAction('turnLeft');
                }
            }
        }
        
        // 右转头: 转头后回正才算完成
        if (targetAction === 'turnRight') {
            if (deltaX < -config.head.turnRight.turnThreshold) {
                this.referenceValues.turnedRight = true;
                if (config.debug) console.log('检测到右转!');
            } else if (this.referenceValues.turnedRight && Math.abs(deltaX) < config.head.turnRight.returnThreshold) {
                if (!this.detectionState.turnRight) {
                    if (config.debug) console.log('右转头完成!');
                    this.completeCurrentAction('turnRight');
                }
            }
        }
        
        // 点头: 低头后抬头才算完成
        if (targetAction === 'nod') {
            if (deltaY > config.head.nod.downThreshold) {
                this.referenceValues.nodded = true;
                if (config.debug) console.log('检测到低头!');
            } else if (this.referenceValues.nodded && Math.abs(deltaY) < config.head.nod.returnThreshold) {
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
        const rightEAR = this.calculateEAR(rightEyeTop, rightEyeBottom, rightEyeLeft, rightEyeRight);
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
        
        if (config.debug) console.log(`EAR: ${avgEAR.toFixed(3)}, 最大: ${this.referenceValues.maxEAR.toFixed(3)}, 比例: ${ratio.toFixed(3)}, 闭眼: ${this.referenceValues.eyeClosed}`);
        
        // 检测眨眼: 比例低于阈值认为闭眼
        if (ratio < config.blink.closeThreshold) {
            this.referenceValues.eyeClosed = true;
            if (config.debug) console.log('检测到眼睛闭合!');
        } else if (this.referenceValues.eyeClosed && ratio > config.blink.openThreshold) {
            if (!this.detectionState.blink) {
                if (config.debug) console.log('眨眼完成!');
                this.completeCurrentAction('blink');
            }
        }
    }
    
    calculateEAR(top, bottom, left, right) {
        const vertical = Math.sqrt(
            Math.pow(bottom.x - top.x, 2) + 
            Math.pow(bottom.y - top.y, 2)
        );
        const horizontal = Math.sqrt(
            Math.pow(right.x - left.x, 2) + 
            Math.pow(right.y - left.y, 2)
        );
        return vertical / horizontal;
    }
    
    analyzeMouthOpen(landmarks) {
        // 上唇中心: 13, 下唇中心: 14
        const upperLip = landmarks[13];
        const lowerLip = landmarks[14];
        
        const mouthOpen = Math.abs(lowerLip.y - upperLip.y);
        
        if (config.debug) console.log(`嘴巴张开度: ${mouthOpen.toFixed(3)}, 张开过: ${this.referenceValues.mouthOpened}`);
        
        // 张嘴-闭嘴 两个动作才算完成
        if (mouthOpen > config.mouth.openThreshold) {
            this.referenceValues.mouthOpened = true;
            if (config.debug) console.log('检测到嘴巴张开!');
        } else if (this.referenceValues.mouthOpened && mouthOpen < config.mouth.closeThreshold) {
            // 嘴巴闭合
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
        this.detectionState[action] = true;
        const el = this.statusElements[action];
        el.classList.remove('current');
        el.classList.add('completed');
        
        // 语音播报完成
        this.speakComplete(action);
        
        // 重置参考值
        this.referenceValues.nosePosition = null;
        this.referenceValues.eyeClosed = false;
        this.referenceValues.mouthOpened = false;
        this.referenceValues.turnedLeft = false;
        this.referenceValues.turnedRight = false;
        this.referenceValues.nodded = false;
        this.referenceValues.maxEAR = 0;
        this.referenceValues.earHistory = [];
        
        // 进入下一个动作
        this.currentActionIndex++;
        if (this.currentActionIndex < this.actions.length) {
            // 延迟播报下一个动作
            setTimeout(() => this.showCurrentAction(), 1500);
        } else {
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
        
        if (config.debug) console.log(`正对检测 - 鼻子偏移: ${noseOffset.toFixed(3)}, 中心偏移: ${centerOffset.toFixed(3)}`);
        
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
        stopCamera();
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        
        // 获取 base64 图片数据
        const imageDataUrl = this.canvas.toDataURL('image/jpeg', 0.9);
        this.capturedImage.src = imageDataUrl;
        
        // 保存纯 base64 数据（去掉前缀）
        this.capturedBase64 = imageDataUrl.split(',')[1];
        
        this.resultContainer.style.display = 'block';
        this.captureBtn.disabled = true;
        
        console.log('Base64 图片已采集，长度:', this.capturedBase64.length);
    }
    
    // 获取采集的 base64 图片
    getBase64Image() {
        return this.capturedBase64;
    }
}
