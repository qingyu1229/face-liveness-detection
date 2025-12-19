// 活体检测配置
export const config = {
    // 语音提示
    voice: {
        enabled: true,          // 是否启用语音提示
        lang: 'zh-CN',          // 语音语言
        rate: 1.0,              // 语速
        prompts: {
            faceDetected: '检测到人脸',
            blink: '请眨眼',
            blinkComplete: '眨眼完成',
            openMouth: '请张嘴',
            openMouthComplete: '张嘴完成',
            turnLeft: '请向左转头',
            turnLeftComplete: '左转头完成',
            turnRight: '请向右转头',
            turnRightComplete: '右转头完成',
            nod: '请点头',
            nodComplete: '点头完成',
            allComplete: '所有动作已完成',
            capturing: '请保持不动，正在比对'
        }
    },
    
    // 眨眼检测
    blink: {
        threshold: 0.6      // 闭眼比例阈值
    },
    
    // 张嘴检测
    mouth: {
        threshold: 0.07     // 张嘴阈值
    },
    
    // 转头/点头检测
    head: {
        turnLeft: 0.05,     // 左转头阈值
        turnRight: 0.015,   // 右转头阈值
        nod: 0.03           // 点头阈值
    },
    
    // 动作列表
    actions: ['blink', 'openMouth', 'turnLeft', 'turnRight', 'nod'],
    
    // 动作顺序: 'random' 随机 | 'fixed' 固定
    actionOrder: 'random',
    
    // 是否启用调试日志
    debug: false,
    
    // 是否显示面部关键点
    showLandmarks: false
};
