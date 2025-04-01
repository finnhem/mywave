# Waveform Viewer TypeScript Application

## Architecture Overview

The waveform viewer application has been refactored to follow a layer-based architecture with cleaner module boundaries and better separation of concerns.

## Directory Structure

```
js/
├── core/               # Core domain logic
│   ├── cursor.ts       # Cursor management
│   ├── viewport.ts     # Viewport and zoom management
│   └── index.ts        # Re-exports
├── services/           # Application services and state management
│   ├── events.ts       # Event bus system
│   ├── hierarchy.ts    # Signal hierarchy management
│   ├── radix.ts        # Signal format preferences
│   └── index.ts        # Re-exports
├── ui/                 # UI rendering components
│   ├── canvas.ts       # Canvas drawing utilities
│   ├── waveform.ts     # Waveform drawing logic
│   └── index.ts        # Re-exports
├── utils/              # Utility functions
│   ├── format.ts       # Signal value formatting
│   ├── time.ts         # Time formatting and manipulation
│   ├── zoom.ts         # Zoom calculations
│   └── index.ts        # Re-exports
├── types/              # Type definitions
│   └── index.ts        # Data structure interfaces
├── app.ts              # Main application class
├── index.ts            # Entry point
└── README.md           # Documentation
```

## Layers Description

### Core Layer
Contains the essential domain entities and business logic, independent of presentation or infrastructure concerns.

### Services Layer
Manages application state, events, and communication between components.

### UI Layer
Handles rendering and user interaction, directly using the DOM and Canvas APIs.

### Utilities Layer
Provides pure functions for common operations used across the application.

## Module Boundaries

Each module exports a clean facade with a well-defined public API:

- **Core modules** expose domain models and operations
- **Service modules** expose state management and event handling
- **UI modules** expose rendering functions
- **Utility modules** expose pure functions

## Type Definitions

The `types/` directory contains shared TypeScript interfaces used throughout the application, ensuring type safety and reducing duplication.

## Usage

To use the waveform viewer in a page:

```html
<div id="waveform-viewer-container"></div>
<script id="waveform-data" type="application/json">
  { "signals": [...], "timescale": { "value": 1, "unit": "ns" } }
</script>
<script src="js/dist/main.js"></script>
```

## Development

When extending the application:

1. Identify the appropriate layer for your new functionality
2. Create or modify files within that layer
3. Maintain clear module boundaries
4. Export functionality through the layer's index.ts
5. Update documentation as needed 