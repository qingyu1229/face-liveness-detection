/**
 * Face Liveness Detection
 * 人脸活体检测 npm 包
 */

import { LivenessDetector } from './livenessDetection.js';
import { config } from './config.js';

/**
 * 检测摄像头权限
 * @returns {Promise<Object>} { granted: boolean, error?: string, message?: string }
 */
export async function checkCameraPermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        // 立即释放
        stream.getTracks().forEach(track => track.stop());
        return { granted: true };
    } catch (error) {
        return {
            granted: false,
            error: error.name,
            message: getCameraErrorMessage(error.name)
        };
    }
}

/**
 * 获取摄像头错误提示信息
 */
function getCameraErrorMessage(errorName) {
    const messages = {
        NotAllowedError: '摄像头权限被拒绝，请在浏览器设置中允许访问摄像头',
        NotFoundError: '未检测到摄像头设备',
        NotReadableError: '摄像头被其他程序占用',
        OverconstrainedError: '摄像头不支持请求的配置',
        SecurityError: '安全错误，请使用 HTTPS 访问',
        AbortError: '摄像头访问被中断'
    };
    return messages[errorName] || '摄像头访问失败';
}

/**
 * 检测当前环境是否支持活体检测
 * @returns {Object} { supported: boolean, reasons: string[] }
 */
export function checkSupport() {
    const reasons = [];

    // 检测浏览器环境
    if (typeof window === 'undefined') {
        reasons.push('需要浏览器环境');
    }

    // 检测 getUserMedia
    if (!navigator?.mediaDevices?.getUserMedia) {
        reasons.push('不支持摄像头访问 (getUserMedia)');
    }

    // 检测 WebAssembly
    if (typeof WebAssembly === 'undefined') {
        reasons.push('不支持 WebAssembly');
    }

    // 检测 HTTPS 或 localhost
    // if (typeof location !== 'undefined') {
    //     const isSecure =
    //         location.protocol === 'https:' ||
    //         location.hostname === 'localhost' ||
    //         location.hostname === '127.0.0.1';
    //     if (!isSecure) {
    //         reasons.push('需要 HTTPS 或 localhost 环境');
    //     }
    // }

    // 检测 Canvas
    if (typeof document !== 'undefined') {
        const canvas = document.createElement('canvas');
        if (!canvas.getContext('2d')) {
            reasons.push('不支持 Canvas 2D');
        }
    }

    return {
        supported: reasons.length === 0,
        reasons
    };
}

// 默认配置（备份）
const DEFAULT_CONFIG = { ...config };

/**
 * 创建活体检测器实例
 * @param {Object} options - 配置选项
 * @param {HTMLVideoElement} options.videoElement - 视频元素
 * @param {HTMLCanvasElement} options.canvasElement - Canvas 元素
 * @param {Object} options.statusElements - 状态显示元素
 * @param {HTMLButtonElement} options.captureBtn - 拍照按钮
 * @param {HTMLElement} options.resultContainer - 结果容器
 * @param {HTMLImageElement} options.capturedImage - 采集图片元素
 * @param {Object} options.config - 自定义配置（可选）
 * @returns {LivenessDetector}
 */
export function createLivenessDetector(options) {
    // 合并用户配置
    if (options.config) {
        mergeConfig(options.config);
    }

    return new LivenessDetector({
        videoElement: options.videoElement,
        canvasElement: options.canvasElement,
        statusElements: options.statusElements,
        captureBtn: options.captureBtn,
        resultContainer: options.resultContainer,
        capturedImage: options.capturedImage,
        onComplete: options.onComplete,
        onActionComplete: options.onActionComplete,
        onError: options.onError
    });
}

/**
 * 合并用户配置到默认配置
 * @param {Object} userConfig - 用户配置
 */
function mergeConfig(userConfig) {
    // 调试：打印传入的用户配置
    console.log('传入 mergeConfig 的 userConfig.actions:', userConfig.actions);

    // 深度合并配置到 config 对象
    Object.keys(userConfig).forEach(key => {
        if (typeof userConfig[key] === 'object' && !Array.isArray(userConfig[key])) {
            config[key] = { ...config[key], ...userConfig[key] };
        } else {
            config[key] = userConfig[key];
        }
    });

    // 调试：打印合并后的配置
    console.log('mergeConfig 执行后，config.actions:', config.actions);
}

/**
 * 获取默认配置
 * @returns {Object}
 */
export function getDefaultConfig() {
    return { ...DEFAULT_CONFIG };
}

/**
 * 更新配置
 * @param {Object} newConfig - 新配置
 */
export function updateConfig(newConfig) {
    mergeConfig(newConfig);
}

// 导出类和配置
export { LivenessDetector } from './livenessDetection.js';
export { config } from './config.js';
