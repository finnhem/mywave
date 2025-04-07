/**
 * Waveform viewer application entry point.
 * Provides public API for the waveform viewer.
 * @module waveform-viewer
 */

import { WaveformViewer } from './app';
import { type UploadApiResponse, WaveformViewerOptions } from './types/index';

/**
 * Custom error class for file upload related errors
 */
class FileUploadError extends Error {
  public readonly code: string;

  constructor(message: string, code = 'UPLOAD_ERROR') {
    super(message);
    this.name = 'FileUploadError';
    this.code = code;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FileUploadError);
    }
  }
}

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
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const uploadButton = document.getElementById('upload-button') as HTMLButtonElement;

  if (uploadForm && fileInput && uploadButton) {
    uploadButton.addEventListener('click', async () => {
      // Check if a file is selected
      if (!fileInput.files || fileInput.files.length === 0) {
        alert('Please select a VCD file to upload');
        return;
      }
      
      // Create a FormData instance from the hidden form
      const formData = new FormData(uploadForm);
      
      // Add the file from the file input
      formData.set('vcd_file', fileInput.files[0]);

      try {
        uploadButton.disabled = true;
        uploadButton.textContent = 'Uploading...';
        
        const response = await fetch(window.location.pathname, {
          method: 'POST',
          body: formData,
          // No need to set Content-Type as FormData will set it with boundary
        });

        const result = (await response.json()) as UploadApiResponse;

        if (result.success) {
          uploadButton.textContent = 'Upload VCD file';
          uploadButton.disabled = false;

          // Load the signals data into the viewer
          if (window.waveformViewer && result.signals) {
            window.waveformViewer.loadData(result.signals);
          }
        } else {
          // Create a custom error with the server's message
          const error = new FileUploadError(result.message || 'Upload failed', 'SERVER_ERROR');
          throw error;
        }
      } catch (error) {
        uploadButton.textContent = 'Upload VCD file';
        uploadButton.disabled = false;
        
        if (error instanceof FileUploadError) {
          console.error(`${error.name} (${error.code}):`, error.message);
          alert(error.message);
        } else {
          console.error('Error uploading file:', error);
          alert('Error uploading file. Please try again.');
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
