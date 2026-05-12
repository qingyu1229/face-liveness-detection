// 活体检测配置
export const config = {
    // 语音提示
    voice: {
        enabled: true, // 是否启用语音提示
        lang: 'zh-CN', // 语音语言
        rate: 1.0, // 语速
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
        threshold: 0.6 // 闭眼比例阈值
    },

    // 张嘴检测
    mouth: {
        threshold: 0.07 // 张嘴阈值
    },

    // 人脸区域检测
    faceArea: {
        enabled: true, // 是否启用区域检测
        circleRatio: 0.8, // 圆形直径占画面宽度比例（0.8 = 80%）
        stayDuration: 1000, // 初始停留时间（毫秒）
        strictMode: false, // 是否严格模式（true: 整个人脸必须在圆内，false: 人脸中心在圆内即可）

        // UI配置
        borderWidth: 4, // 边框宽度
        borderColors: ['#00FF00', '#00FFFF', '#0080FF', '#FF00FF'], // 动态变化的颜色
        colorChangeInterval: 500, // 颜色变化间隔（毫秒）
        maskOpacity: 0.8, // 黑色遮罩透明度
        promptText: '请将人脸移入检测区域' // 提示文字
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
