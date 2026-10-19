import { AppState, Platform, Vibration } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

let sharedAudioCtx = null;
let nativePlayer = null;
let nativeAudioUnavailable = false;
let nativePlaybackBusy = false;
async function playNativeChime() {
    if (nativePlaybackBusy || nativeAudioUnavailable || AppState.currentState !== 'active') return;
    nativePlaybackBusy = true;
    try {
        // Check before importing: Metro reports failed native imports even when caught.
        if (!requireOptionalNativeModule('ExpoAudio')) {
            nativeAudioUnavailable = true;
            console.warn('Notification sound unavailable in this app build; using vibration. Update Expo Go or rebuild and reinstall the development APK to enable sound.');
            return;
        }
        const { createAudioPlayer, setAudioModeAsync } = require('expo-audio');
        if (!nativePlayer) {
            await setAudioModeAsync({ playsInSilentMode: false, shouldPlayInBackground: false, interruptionMode: 'mixWithOthers' });
            nativePlayer = createAudioPlayer(require('../../assets/notification-chime.wav'));
            nativePlayer.volume = 0.6;
        }
        if (nativePlayer.isLoaded) await nativePlayer.seekTo(0);
        nativePlayer.play();
    } catch (error) {
        if (/native module|Cannot find|not found/i.test(error.message || '')) nativeAudioUnavailable = true;
        console.warn('Notification audio playback failed:', error.message || error);
    } finally { nativePlaybackBusy = false; }
}

const getWebAudioContext = () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx) {
        sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
        sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
};

// Auto-unlock audio context on user tap in web mode
if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const unlock = () => {
        const ctx = getWebAudioContext();
        if (ctx && ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }
        window.removeEventListener('click', unlock);
        window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
}

/**
 * Plays a pleasant generic ring/chime notification sound
 * On Mobile (Android/iOS): Plays a bundled chime and dual-pulse vibration while open
 * On Web / Browser / Hybrid: Plays crisp two-tone harmonic chime (D5 -> A5)
 */
export const playNotificationSound = () => {
    try {
        // 1. Physical vibration ring on mobile device
        if (Platform.OS !== 'web') {
            // Pattern: wait 0ms, vibrate 180ms, pause 90ms, vibrate 240ms
            Vibration.vibrate([0, 180, 90, 240]);
            void playNativeChime();
        }

        // 2. Audio chime playback
        if (Platform.OS === 'web' || typeof window !== 'undefined') {
            const ctx = getWebAudioContext();
            if (ctx) {
                const now = ctx.currentTime;
                const masterGain = ctx.createGain();
                masterGain.gain.setValueAtTime(0.35, now);
                masterGain.connect(ctx.destination);

                // Note 1: 587.33 Hz (D5)
                const osc1 = ctx.createOscillator();
                const gain1 = ctx.createGain();
                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(587.33, now);
                gain1.gain.setValueAtTime(0.4, now);
                gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
                osc1.connect(gain1);
                gain1.connect(masterGain);
                osc1.start(now);
                osc1.stop(now + 0.22);

                // Note 2: 880.00 Hz (A5)
                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(880.00, now + 0.11);
                gain2.gain.setValueAtTime(0.5, now + 0.11);
                gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
                osc2.connect(gain2);
                gain2.connect(masterGain);
                osc2.start(now + 0.11);
                osc2.stop(now + 0.55);
            }
        }
    } catch (err) {
        console.warn('Notification sound error:', err);
    }
};

export default playNotificationSound;
