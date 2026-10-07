/** React bindings for the audio engine and metronome (subscriptions are released on unmount). */
import { useEffect, useState } from 'react';
import type { EngineStatus } from '../audio/engine';
import { audioEngine } from './services';

export function useEngineStatus(): EngineStatus {
  const [status, setStatus] = useState<EngineStatus>(audioEngine.currentStatus);
  useEffect(() => {
    setStatus(audioEngine.currentStatus);
    return audioEngine.status.on(setStatus);
  }, []);
  return status;
}

/** Microphone screens turn the microphone off when the user leaves (battery, privacy indicator). */
export function useMicReleasedOnExit(): void {
  useEffect(
    () => () => {
      audioEngine.setTuner(false, null);
      audioEngine.setJob(null);
      audioEngine.stopMic();
    },
    [],
  );
}
