import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ command, mode }) => {
    // demo 开发模式
    if (mode === 'demo') {
        return {
            root: 'demo',
            server: {
                port: 3000,
                open: true
            }
        };
    }
    
    // 库构建模式
    return {
        build: {
            lib: {
                entry: resolve(__dirname, 'src/js/index.js'),
                name: 'FaceLivenessDetection',
                fileName: (format) => `face-liveness-detection.${format}.js`
            },
            rollupOptions: {
                external: ['@mediapipe/face_mesh', '@mediapipe/camera_utils'],
                output: {
                    globals: {
                        '@mediapipe/face_mesh': 'FaceMesh',
                        '@mediapipe/camera_utils': 'CameraUtils'
                    }
                }
            },
            outDir: 'dist',
            sourcemap: true
        }
    };
});
