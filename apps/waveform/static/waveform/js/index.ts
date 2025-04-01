/**
 * Waveform viewer application entry point.
 * Provides public API for the waveform viewer.
 * @module waveform-viewer
 */

import { WaveformViewer, WaveformViewerOptions } from './app';

// Export public API
export { WaveformViewer, WaveformViewerOptions };

// Declare global window interface
declare global {
  interface Window {
    waveformViewer?: WaveformViewer;
  }
}

// Create and initialize the viewer when this module is loaded
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('waveform-viewer-container');

  if (!container) {
    console.error('Waveform viewer container not found');
    return;
  }

  const width = container.clientWidth || 800;
  const height = container.clientHeight || 600;

  // Create viewer instance
  const viewer = new WaveformViewer({
    container,
    width,
    height,
    timeScale: 1,
  });

  // Expose for debugging
  window.waveformViewer = viewer;

  // Load data if available
  const dataElement = document.getElementById('waveform-data');

  if (dataElement?.textContent) {
    try {
      const data = JSON.parse(dataElement.textContent);
      viewer.loadData(data);
    } catch (error) {
      console.error('Failed to parse waveform data', error);
    }
  }
});
