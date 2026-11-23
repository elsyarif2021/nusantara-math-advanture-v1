export function createAudioMixer() {
  let context;
  const gains = new WeakMap();
  const volumes = new WeakMap();

  return {
    prepare(...tracks) {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return;
      try {
        context ??= new AudioContext();
        for (const track of tracks) {
          if (gains.has(track)) continue;
          const gain = context.createGain();
          gain.gain.value = volumes.get(track) ?? 1;
          context.createMediaElementSource(track).connect(gain);
          gain.connect(context.destination);
          gains.set(track,gain);
          track.volume = 1;
        }
        context.resume().catch(() => {});
      } catch {
        // Use the media element's volume when Web Audio is unavailable.
      }
    },
    volume(track,value) {
      volumes.set(track,value);
      const gain = gains.get(track);
      if (gain) gain.gain.setTargetAtTime(value,context.currentTime,.045);
      else track.volume = value;
    }
  };
}
