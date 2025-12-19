# FaceLiveness 组件

基于 face-liveness-detection 的 uniapp 人脸活体检测组件，UI 风格类似阿里云活体检测。

> **注意：仅支持 H5 端**，App 端请使用原生插件方案。

## 安装依赖

```bash
npm install face-liveness-detection
```

## 使用方法

### 1. 引入组件

```vue
<template>
  <face-liveness
    ref="faceLiveness"
    :actions="['blink', 'turnLeft', 'turnRight']"
    action-order="random"
    :enable-voice="true"
    :show-progress="true"
    @complete="onComplete"
    @error="onError"
    @cancel="onCancel"
    @action-complete="onActionComplete"
  />
</template>

<script>
import FaceLiveness from '@/components/face-liveness/face-liveness.vue';

export default {
  components: {
    FaceLiveness
  },
  
  methods: {
    onComplete(result) {
      console.log('检测完成', result);
      // result: { success: true, base64: '...', imageUrl: 'data:image/jpeg;base64,...' }
      
      // 上传到服务器进行人脸比对
      this.uploadFaceImage(result.base64);
    },
    
    onError(error) {
      console.error('检测失败', error);
    },
    
    onCancel() {
      console.log('用户取消');
    },
    
    onActionComplete({ action, current, total }) {
      console.log(`完成动作: ${action} (${current}/${total})`);
    },
    
    // 通过 ref 调用方法
    startDetection() {
      this.$refs.faceLiveness.start();
    },
    
    stopDetection() {
      this.$refs.faceLiveness.stop();
    }
  }
};
</script>
```

### 2. Vue3 setup 语法

```vue
<template>
  <face-liveness
    ref="faceLivenessRef"
    :actions="actions"
    @complete="onComplete"
  />
</template>

<script setup>
import { ref } from 'vue';
import FaceLiveness from '@/components/face-liveness/face-liveness.vue';

const faceLivenessRef = ref(null);
const actions = ['blink', 'openMouth', 'nod'];

const onComplete = (result) => {
  console.log('检测完成', result.base64);
};

// 调用方法
const start = () => {
  faceLivenessRef.value.start();
};
</script>
```

## Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| actions | Array | `['blink', 'turnLeft', 'turnRight']` | 检测动作列表 |
| actionOrder | String | `'random'` | 动作顺序：`random` 随机 / `fixed` 固定 |
| enableVoice | Boolean | `true` | 是否启用语音提示 |
| showProgress | Boolean | `true` | 是否显示进度点 |
| startBtnText | String | `'开始检测'` | 开始按钮文字 |
| prompts | Object | `{}` | 自定义提示词 |
| debug | Boolean | `false` | 调试模式 |

## 可用动作

| 动作 | 标识 | 说明 |
|------|------|------|
| 眨眼 | `blink` | 闭眼达到阈值 |
| 张嘴 | `openMouth` | 张嘴达到阈值 |
| 左转头 | `turnLeft` | 左转达到阈值 |
| 右转头 | `turnRight` | 右转达到阈值 |
| 点头 | `nod` | 低头达到阈值 |

## Events

| 事件 | 参数 | 说明 |
|------|------|------|
| complete | `{ success, base64, imageUrl }` | 检测完成 |
| error | `Error` | 检测出错 |
| cancel | - | 用户取消 |
| action-complete | `{ action, current, total }` | 单个动作完成 |
| permission-denied | `{ granted, error, message }` | 摄像头权限被拒绝 |

## Methods

| 方法 | 说明 |
|------|------|
| checkSupport() | 检测环境支持，返回 `{ supported, reasons }` |
| checkCameraPermission() | 检测摄像头权限（异步），返回 `{ granted, error, message }` |
| start() | 开始检测 |
| stop() | 停止检测 |
| getResult() | 获取检测结果 |

## 自定义提示词

```vue
<face-liveness
  :prompts="{
    blink: '请眨一下眼睛',
    turnLeft: '请把头转向左边',
    turnRight: '请把头转向右边'
  }"
/>
```

## 注意事项

1. **仅支持 H5 端**，组件内部使用条件编译 `#ifdef H5`
2. 需要 HTTPS 环境或 localhost 才能访问摄像头
3. 用户需要授权摄像头权限
4. 建议在检测前引导用户到光线充足的环境
