/**
 * Face Liveness Detection
 * 人脸活体检测 npm 包
 */

import { LivenessDetector } from './livenessDetection.js';
import { config as defaultConfig } from './config.js';

// 默认配置
const DEFAULT_CONFIG = { ...defaultConfig };

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
    // 深度合并配置
    Object.keys(userConfig).forEach(key => {
        if (typeof userConfig[key] === 'object' && !Array.isArray(userConfig[key])) {
            defaultConfig[key] = { ...defaultConfig[key], ...userConfig[key] };
        } else {
            defaultConfig[key] = userConfig[key];
        }
    });
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
