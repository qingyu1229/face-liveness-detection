const fs = require('fs');
const path = require('path');
const https = require('https');

// 创建models目录
const modelsDir = path.join(__dirname, 'public', 'models');
if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
}

const BASE_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';

// 要下载的模型文件列表
const models = [
    // TinyFaceDetector
    'tiny_face_detector_model-weights_manifest.json',
    'tiny_face_detector_model-shard1',
    // FaceLandmark68
    'face_landmark_68_model-weights_manifest.json',
    'face_landmark_68_model-shard1',
    // FaceRecognition
    'face_recognition_model-weights_manifest.json',
    'face_recognition_model-shard1',
    'face_recognition_model-shard2',
    // FaceExpression
    'face_expression_model-weights_manifest.json',
    'face_expression_model-shard1'
];

// 下载函数
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        console.log(`正在下载: ${url}`);
        
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`下载失败: ${url} (状态码: ${response.statusCode})`));
                return;
            }
            
            response.pipe(file);
            
            file.on('finish', () => {
                file.close();
                console.log(`下载完成: ${dest}`);
                resolve();
            });
            
            file.on('error', (err) => {
                fs.unlink(dest, () => {}); // 删除部分下载的文件
                reject(err);
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

// 并行下载所有模型文件
async function downloadAllModels() {
    console.log('开始下载模型文件...');
    
    try {
        const downloadPromises = models.map(fileName => {
            const url = `${BASE_URL}/${fileName}`;
            const destPath = path.join(modelsDir, fileName);
            return downloadFile(url, destPath);
        });
        
        await Promise.all(downloadPromises);
        console.log('所有模型文件下载完成!');
    } catch (error) {
        console.error('下载过程中出现错误:', error.message);
    }
}

// 执行下载
downloadAllModels();