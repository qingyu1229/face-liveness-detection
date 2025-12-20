export interface VoiceConfig {
    enabled: boolean;
    lang: string;
    rate: number;
    prompts: {
        faceDetected: string;
        blink: string;
        blinkComplete: string;
        openMouth: string;
        openMouthComplete: string;
        turnLeft: string;
        turnLeftComplete: string;
        turnRight: string;
        turnRightComplete: string;
        nod: string;
        nodComplete: string;
        allComplete: string;
        capturing: string;
    };
}

export interface BlinkConfig {
    threshold: number;
}

export interface MouthConfig {
    threshold: number;
}

export interface HeadConfig {
    turnLeft: number;
    turnRight: number;
    nod: number;
}

export interface FaceAreaConfig {
    enabled: boolean;
    circleRatio: number;
    stayDuration: number;
    strictMode: boolean;
    borderWidth: number;
    borderColors: string[];
    colorChangeInterval: number;
    maskOpacity: number;
    promptText: string;
}

export interface LivenessConfig {
    voice: VoiceConfig;
    blink: BlinkConfig;
    mouth: MouthConfig;
    head: HeadConfig;
    faceArea: FaceAreaConfig;
    actions: ActionType[];
    actionOrder: 'random' | 'fixed';
    debug: boolean;
    showLandmarks: boolean;
}

export type ActionType = 'blink' | 'openMouth' | 'turnLeft' | 'turnRight' | 'nod';

export interface StatusElements {
    faceDetected: HTMLElement;
    blink?: HTMLElement;
    openMouth?: HTMLElement;
    turnLeft?: HTMLElement;
    turnRight?: HTMLElement;
    nod?: HTMLElement;
}

export interface LivenessDetectorOptions {
    videoElement: HTMLVideoElement;
    canvasElement: HTMLCanvasElement;
    statusElements: StatusElements;
    captureBtn: HTMLButtonElement;
    resultContainer: HTMLElement;
    capturedImage: HTMLImageElement;
    onComplete?: (base64Image: string) => void;
    onActionComplete?: (action: ActionType, currentIndex: number, totalActions: number) => void;
    onError?: (error: Error) => void;
    config?: Partial<LivenessConfig>;
}

export class LivenessDetector {
    constructor(options: LivenessDetectorOptions);
    start(): Promise<void>;
    stop(): void;
    reset(): void;
    capture(): void;
    getBase64Image(): string | null;
}

export interface SupportResult {
    supported: boolean;
    reasons: string[];
}

export interface CameraPermissionResult {
    granted: boolean;
    error?: string;
    message?: string;
}

export function checkSupport(): SupportResult;
export function checkCameraPermission(): Promise<CameraPermissionResult>;
export function createLivenessDetector(options: LivenessDetectorOptions): LivenessDetector;
export function getDefaultConfig(): LivenessConfig;
export function updateConfig(config: Partial<LivenessConfig>): void;

export { config } from './config';
