# Waveform Viewer Styling Guide

## Overview

This document describes our approach to maintaining consistent styling across the Waveform Viewer application. We've implemented a centralized styling system to ensure that all components follow the same design patterns and to make style changes easier to maintain.

## Single Source of Truth

All styles are defined in a single location:

```
apps/waveform/static/waveform/js/utils/styles.ts
```

This file contains:

1. Constants for grid layouts
2. Component-specific style classes
3. Helper functions for applying styles

## Using the Styling System

### In JavaScript/TypeScript

Import the styles and utility functions:

```typescript
import { GRID_LAYOUTS, STYLES, applyStyles, classNames } from '../utils/styles';
```

Apply styles to dynamically created elements:

```typescript
// Apply Tailwind classes
element.className = `base-class ${STYLES.COMPONENT.VARIANT}`;

// Apply inline styles
applyStyles(element, {
  display: 'grid',
  gridTemplateColumns: '300px 100px 50px 1fr',
  // other styles...
});
```

### In HTML Templates

Use data attributes to indicate which styles are being used:

```html
<div class="grid grid-cols-[300px_100px_50px_1fr]" 
     data-grid-layout="waveform-grid">
  <!-- content -->
</div>
```

## Benefits

1. **Consistency**: All components use the same styles for the same purposes
2. **Maintainability**: Style changes only need to be made in one place
3. **Documentation**: The styling constants serve as documentation of the design system
4. **Type Safety**: TypeScript provides type checking for style constants

## Updating Styles

When you need to update a style:

1. Modify the appropriate constant in `styles.ts`
2. The change will automatically propagate to all components using that style

## Tailwind Integration

The styling system works alongside Tailwind CSS. We use Tailwind classes in our constants to leverage Tailwind's utility classes while maintaining a single source of truth.

## Grid Layouts

Grid layouts are particularly important for maintaining alignment in the waveform viewer. All grid layouts are defined in the `GRID_LAYOUTS` constant:

```typescript
export const GRID_LAYOUTS = {
  WAVEFORM_GRID: 'grid-cols-[300px_100px_50px_1fr]',
  // other grid layouts...
};
```

This ensures that header rows and signal rows use the exact same grid definition. 