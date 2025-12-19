<template>
  <view class="face-liveness-container">
    <!-- video 和 canvas 通过 JS 动态创建 -->
    <view id="media-container" class="media-container"></view>
    
    <!-- 遮罩层 -->
    <view class="mask-layer">
      <!-- 椭圆人脸框 -->
      <view class="face-oval">
        <view class="oval-border" :class="{ 'oval-success': isComplete }"></view>
      </view>
    </view>
    
    <!-- 顶部提示区域 -->
    <view class="top-area">
      <view class="action-text">{{ currentActionText }}</view>
      <view class="sub-text" v-if="subText">{{ subText }}</view>
    </view>
    
    <!-- 底部进度区域 -->
    <view class="bottom-area">
      <!-- 动作进度点 -->
      <view class="progress-dots" v-if="showProgress">
        <view
          v-for="(action, index) in actions"
          :key="index"
          class="dot"
          :class="{
            'dot-completed': completedActions.includes(action),
            'dot-current': currentAction === action
          }"
        ></view>
      </view>
      
      <!-- 操作按钮 -->
      <view class="btn-area">
        <button v-if="!isRunning" class="start-btn" @click="handleStart">
          {{ startBtnText }}
        </button>
        <button v-if="isRunning" class="cancel-btn" @click="handleCancel">
          取消
        </button>
      </view>
    </view>
    
    <!-- 完成结果 -->
    <view class="result-layer" v-if="isComplete">
      <view class="result-content">
        <view class="success-icon">✓</view>
        <view class="result-text">验证成功</view>
        <image v-if="capturedImage" :src="capturedImage" class="captured-img" mode="aspectFit"></image>
        <button class="confirm-btn" @click="handleConfirm">确认</button>
      </view>
    </view>
  </view>
</template>

<script>
// #ifdef H5
import { createLivenessDetector, updateConfig, checkSupport, checkCameraPermission } from 'face-liveness-detection';
// #endif

export default {
  name: 'FaceLiveness',
  
  // 兼容 Vue2 和 Vue3
  emits: ['complete', 'error', 'cancel', 'action-complete', 'permission-denied'],
  
  props: {
    // 检测动作列表
    actions: {
      type: Array,
      default: () => ['blink', 'turnLeft', 'turnRight']
    },
    // 动作顺序
    actionOrder: {
      type: String,
      default: 'random' // random | fixed
    },
    // 是否启用语音
    enableVoice: {
      type: Boolean,
      default: true
    },
    // 是否显示进度
    showProgress: {
      type: Boolean,
      default: true
    },
    // 开始按钮文字
    startBtnText: {
      type: String,
      default: '开始检测'
    },
    // 自定义提示词
    prompts: {
      type: Object,
      default: () => ({})
    },
    // 调试模式
    debug: {
      type: Boolean,
      default: false
    }
  },
  
  data() {
    return {
      detector: null,
      videoEl: null,
      canvasEl: null,
      isRunning: false,
      isComplete: false,
      currentAction: '',
      currentActionText: '请将面部置于框内',
      subText: '',
      completedActions: [],
      capturedImage: '',
      capturedBase64: ''
    };
  },
  
  computed: {
    actionTextMap() {
      return {
        faceDetected: '检测到人脸',
        blink: '请眨眼',
        openMouth: '请张嘴',
        turnLeft: '请向左转头',
        turnRight: '请向右转头',
        nod: '请点头',
        ...this.prompts
      };
    }
  },
  
  methods: {
    async handleStart() {
      // #ifdef H5
      try {
        // 检测环境支持
        const support = checkSupport();
        if (!support.supported) {
          throw new Error(support.reasons.join(', '));
        }
        
        // 检测摄像头权限
        const permission = await checkCameraPermission();
        if (!permission.granted) {
          this.$emit('permission-denied', permission);
          throw new Error(permission.message);
        }
        
        this.reset();
        this.isRunning = true;
        this.currentActionText = '正在启动摄像头...';
        
        // 更新配置
        updateConfig({
          actions: this.actions,
          actionOrder: this.actionOrder,
          voice: {
            enabled: this.enableVoice
          },
          debug: this.debug
        });
        
        // 动态创建 video 和 canvas
        const { video, canvas } = this.createMediaElements();
        
        // 创建隐藏的状态元素
        const statusContainer = this.createStatusElements();
        
        // 创建检测器
        this.detector = createLivenessDetector({
          videoElement: video,
          canvasElement: canvas,
          statusElements: statusContainer.elements,
          captureBtn: statusContainer.captureBtn,
          resultContainer: statusContainer.resultContainer,
          capturedImage: statusContainer.capturedImage,
          onComplete: (base64) => {
            this.handleComplete(base64);
          },
          onActionComplete: (action, current, total) => {
            this.handleActionComplete(action, current, total);
          },
          onError: (error) => {
            this.handleError(error);
          }
        });
        
        await this.detector.start();
        this.currentActionText = '请将面部置于框内';
        
      } catch (error) {
        this.handleError(error);
      }
      // #endif
      
      // #ifndef H5
      uni.showToast({
        title: '仅支持 H5 端',
        icon: 'none'
      });
      // #endif
    },
    
    createMediaElements() {
      const container = document.getElementById('media-container');
      
      // 清理旧元素
      container.innerHTML = '';
      
      // 创建 video
      const video = document.createElement('video');
      video.id = 'liveness-video';
      video.className = 'video-layer';
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      container.appendChild(video);
      
      // 创建 canvas
      const canvas = document.createElement('canvas');
      canvas.id = 'liveness-canvas';
      canvas.className = 'canvas-layer';
      canvas.width = 640;
      canvas.height = 480;
      container.appendChild(canvas);
      
      this.videoEl = video;
      this.canvasEl = canvas;
      
      return { video, canvas };
    },
    
    createStatusElements() {
      // 创建隐藏的 DOM 元素供检测器使用
      const container = document.createElement('div');
      container.style.display = 'none';
      container.id = 'liveness-status-container';
      
      const elements = {};
      const allActions = ['faceDetected', 'blink', 'openMouth', 'turnLeft', 'turnRight', 'nod'];
      
      allActions.forEach(action => {
        const el = document.createElement('div');
        el.id = `status-${action}`;
        container.appendChild(el);
        elements[action] = el;
      });
      
      const captureBtn = document.createElement('button');
      captureBtn.id = 'capture-btn';
      container.appendChild(captureBtn);
      
      const resultContainer = document.createElement('div');
      resultContainer.id = 'result-container';
      container.appendChild(resultContainer);
      
      const capturedImage = document.createElement('img');
      capturedImage.id = 'captured-image';
      container.appendChild(capturedImage);
      
      document.body.appendChild(container);
      
      // 监听状态变化
      this.observeStatusChanges(elements);
      
      return {
        elements,
        captureBtn,
        resultContainer,
        capturedImage
      };
    },
    
    observeStatusChanges(elements) {
      // 使用 MutationObserver 监听状态元素的 class 变化
      Object.entries(elements).forEach(([action, el]) => {
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class') {
              if (el.classList.contains('current')) {
                this.currentAction = action;
                this.currentActionText = this.actionTextMap[action] || action;
                this.subText = '';
              }
              if (el.classList.contains('completed') && action !== 'faceDetected') {
                if (!this.completedActions.includes(action)) {
                  this.completedActions.push(action);
                }
              }
            }
          });
        });
        observer.observe(el, { attributes: true });
      });
    },
    
    handleActionComplete(action, current, total) {
      this.subText = `${current}/${total} 完成`;
      this.$emit('action-complete', { action, current, total });
    },
    
    handleComplete(base64) {
      this.isRunning = false;
      this.isComplete = true;
      this.capturedBase64 = base64;
      this.capturedImage = `data:image/jpeg;base64,${base64}`;
      this.currentActionText = '验证成功';
      this.subText = '';
      
      this.$emit('complete', {
        success: true,
        base64: base64,
        imageUrl: this.capturedImage
      });
    },
    
    handleError(error) {
      this.isRunning = false;
      this.currentActionText = '检测失败';
      this.subText = error.message || '请重试';
      
      uni.showToast({
        title: error.message || '检测失败',
        icon: 'none'
      });
      
      this.$emit('error', error);
    },
    
    handleCancel() {
      if (this.detector) {
        this.detector.stop();
      }
      this.reset();
      this.$emit('cancel');
    },
    
    handleConfirm() {
      this.$emit('complete', {
        success: true,
        base64: this.capturedBase64,
        imageUrl: this.capturedImage,
        confirmed: true
      });
    },
    
    reset() {
      this.isRunning = false;
      this.isComplete = false;
      this.currentAction = '';
      this.currentActionText = '请将面部置于框内';
      this.subText = '';
      this.completedActions = [];
      this.capturedImage = '';
      this.capturedBase64 = '';
      
      // 清理 DOM
      const statusContainer = document.getElementById('liveness-status-container');
      if (statusContainer) {
        statusContainer.remove();
      }
      
      // 清理 video 和 canvas
      const mediaContainer = document.getElementById('media-container');
      if (mediaContainer) {
        mediaContainer.innerHTML = '';
      }
      
      this.videoEl = null;
      this.canvasEl = null;
    },
    
    // 公开方法：检测摄像头权限
    async checkCameraPermission() {
      // #ifdef H5
      return await checkCameraPermission();
      // #endif
      
      // #ifndef H5
      return { granted: false, error: 'NotSupportedError', message: '仅支持 H5 端' };
      // #endif
    },
    
    // 公开方法：检测环境支持
    checkSupport() {
      // #ifdef H5
      return checkSupport();
      // #endif
      
      // #ifndef H5
      return { supported: false, reasons: ['仅支持 H5 端'] };
      // #endif
    },
    
    // 公开方法：开始检测
    start() {
      this.handleStart();
    },
    
    // 公开方法：停止检测
    stop() {
      this.handleCancel();
    },
    
    // 公开方法：获取结果
    getResult() {
      return {
        success: this.isComplete,
        base64: this.capturedBase64,
        imageUrl: this.capturedImage
      };
    }
  },
  
  beforeDestroy() {
    // Vue2
    this.handleCancel();
  },
  
  unmounted() {
    // Vue3
    this.handleCancel();
  }
};
</script>

<style scoped>
.face-liveness-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: #000;
  overflow: hidden;
}

.media-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.video-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1); /* 镜像 */
}

.canvas-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  opacity: 0;
}

.mask-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.face-oval {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 260px;
  height: 340px;
}

.oval-border {
  width: 100%;
  height: 100%;
  border: 4px solid rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.6);
  transition: border-color 0.3s;
}

.oval-success {
  border-color: #4CAF50;
  box-shadow: 0 0 20px rgba(76, 175, 80, 0.5), 0 0 0 9999px rgba(0, 0, 0, 0.6);
}

.top-area {
  position: absolute;
  top: 80px;
  left: 0;
  right: 0;
  text-align: center;
  z-index: 10;
}

.action-text {
  font-size: 24px;
  color: #fff;
  font-weight: bold;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}

.sub-text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 10px;
}

.bottom-area {
  position: absolute;
  bottom: 60px;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 10;
}

.progress-dots {
  display: flex;
  gap: 12px;
  margin-bottom: 30px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.3);
  transition: all 0.3s;
}

.dot-current {
  background-color: #fff;
  transform: scale(1.2);
}

.dot-completed {
  background-color: #4CAF50;
}

.btn-area {
  display: flex;
  gap: 20px;
}

.start-btn {
  padding: 14px 50px;
  font-size: 18px;
  color: #fff;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 30px;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.cancel-btn {
  padding: 14px 50px;
  font-size: 18px;
  color: #fff;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 30px;
}

.result-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.result-content {
  text-align: center;
  color: #fff;
}

.success-icon {
  width: 80px;
  height: 80px;
  line-height: 80px;
  font-size: 40px;
  background: #4CAF50;
  border-radius: 50%;
  margin: 0 auto 20px;
}

.result-text {
  font-size: 24px;
  margin-bottom: 30px;
}

.captured-img {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  border: 4px solid #4CAF50;
  margin-bottom: 30px;
}

.confirm-btn {
  padding: 14px 60px;
  font-size: 18px;
  color: #fff;
  background: #4CAF50;
  border: none;
  border-radius: 30px;
}
</style>
