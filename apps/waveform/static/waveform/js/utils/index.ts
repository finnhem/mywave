/**
 * Utility functions for waveform display.
 * @module utils
 */

// Re-export time utilities
export { formatTime } from './time';

// Re-export format utilities
export {
  normalizeBinaryValue,
  binaryToHex,
  binaryToDecimal,
  binaryToAscii,
} from './format';

// Re-export signal value utility
export { getSignalValueAtTime } from './format';

// Re-export zoom utilities
export {
  calculateMinTimeDelta,
  calculateMaxZoom,
  calculateWheelZoom,
} from './zoom';
