/**
 * Generic Notification Ring/Chime Sound Utility
 * Uses Web Audio API for zero-latency, reliable, cross-browser chime playback
 * with pleasant harmonic bell tones.
 */

let sharedAudioCtx = null;

const getAudioContext = () => {
    if (typeof window === 'undefined') return null;
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

// Auto-unlock audio context on first user click or tap anywhere
if (typeof window !== 'undefined') {
    const unlock = () => {
        const ctx = getAudioContext();
        if (ctx && ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }
        window.removeEventListener('click', unlock);
        window.removeEventListener('keydown', unlock);
        window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
}

/**
 * Plays a pleasant, generic two-tone notification ring chime
 * Tone 1: 587.33 Hz (D5)
 * Tone 2: 880.00 Hz (A5) with rich harmonic bell decay
 */
export const playNotificationSound = () => {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;

        // Master volume gain
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(0.3, now);
        masterGain.connect(ctx.destination);

        // --- Note 1: Lower Chime Tone (D5 - 587.33 Hz) ---
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, now);

        // Subtle bell harmonic
        const harmonic1 = ctx.createOscillator();
        harmonic1.type = 'triangle';
        harmonic1.frequency.setValueAtTime(1174.66, now);

        gain1.gain.setValueAtTime(0.4, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        osc1.connect(gain1);
        harmonic1.connect(gain1);
        gain1.connect(masterGain);

        osc1.start(now);
        harmonic1.start(now);
        osc1.stop(now + 0.22);
        harmonic1.stop(now + 0.22);

        // --- Note 2: Higher Crisp Peak Tone (A5 - 880 Hz) ---
        const startTime2 = now + 0.11;
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880.00, startTime2);

        // Warm shimmer harmonic
        const harmonic2 = ctx.createOscillator();
        harmonic2.type = 'triangle';
        harmonic2.frequency.setValueAtTime(1760.00, startTime2);

        gain2.gain.setValueAtTime(0.5, startTime2);
        gain2.gain.exponentialRampToValueAtTime(0.001, startTime2 + 0.55);

        osc2.connect(gain2);
        harmonic2.connect(gain2);
        gain2.connect(masterGain);

        osc2.start(startTime2);
        harmonic2.start(startTime2);
        osc2.stop(startTime2 + 0.55);
        harmonic2.stop(startTime2 + 0.55);
    } catch (err) {
        console.warn('Failed to play notification chime:', err);
    }
};

export default playNotificationSound;
