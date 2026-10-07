/** The app-wide AudioEngine instance (one AudioContext per page). */
import { browserPlatform } from './browserPlatform';
import { AudioEngine } from './engine';

export const audioEngine = new AudioEngine(browserPlatform());
