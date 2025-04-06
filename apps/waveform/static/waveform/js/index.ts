/**
 * Waveform viewer application entry point.
 * Provides public API for the waveform viewer.
 * @module waveform-viewer
 */

import { WaveformViewer } from './app';
import { WaveformViewerOptions } from './types/index';

// Declare global window interface
declare global {
  interface Window {
    waveformViewer?: WaveformViewer;
  }
}

// Create and initialize the viewer when this module is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize upload form handling
  const uploadForm = document.getElementById('upload-form') as HTMLFormElement;
  const statusElement = document.getElementById('file-upload-status');

  if (uploadForm) {
    uploadForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (statusElement) {
        statusElement.textContent = 'Uploading...';
        statusElement.className = 'ml-auto text-blue-500';
      }

      try {
        const formData = new FormData(uploadForm);
        const response = await fetch(window.location.pathname, {
          method: 'POST',
          body: formData,
          // No need to set Content-Type as FormData will set it with boundary
        });

        const result = await response.json();

        if (result.success) {
          if (statusElement) {
            statusElement.textContent = 'File uploaded successfully!';
            statusElement.className = 'ml-auto text-green-500';
          }

          // Load the signals data into the viewer
          if (window.waveformViewer && result.signals) {
            window.waveformViewer.loadData(result.signals);
          }
        } else {
          if (statusElement) {
            statusElement.textContent = result.message || 'Upload failed';
            statusElement.className = 'ml-auto text-red-500';
          }
          console.error('Upload error:', result);
        }
      } catch (error) {
        console.error('Error uploading file:', error);
        if (statusElement) {
          statusElement.textContent = 'Error uploading file';
          statusElement.className = 'ml-auto text-red-500';
        }
      }
    });
  }

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
