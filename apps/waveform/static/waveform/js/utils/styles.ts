/**
 * Central location for all styling constants and classes
 * This provides a single source of truth for styling across the application
 */

// Grid layout definitions
export const GRID_LAYOUTS = {
  // Main grid for signal rows and header
  WAVEFORM_GRID: 'grid-cols-[300px_100px_50px_1fr]',
};

// Common styling classes by component
export const STYLES = {
  // Waveform row styling
  SIGNAL_ROW: {
    BASE: 'grid items-center min-w-fit h-10 px-0 hover:bg-gray-50',
    ACTIVE: 'active bg-blue-50 border-l-3 border-blue-500',
  },

  // Cell styling
  CELLS: {
    NAME: 'overflow-hidden text-ellipsis whitespace-nowrap px-2.5',
    VALUE: 'flex justify-end text-right font-mono text-sm w-full px-2.5',
    VALUE_TEXT: 'font-mono text-sm w-full text-right tabular-nums',
    RADIX: 'flex justify-center',
    WAVEFORM: 'overflow-hidden min-w-0 h-10',
  },

  // Header styling
  HEADER: {
    ROW: 'grid items-stretch h-10 font-bold bg-white sticky top-0 z-10 flex-grow',
    NAME_CELL: 'flex items-center px-2.5',
    VALUE_CELL: 'flex items-center justify-center',
    RADIX_CELL: 'flex items-center justify-center',
    TIMELINE_CELL: 'overflow-hidden h-full',
  },

  // Radix display styling
  RADIX: {
    BASE: 'text-xs uppercase font-bold cursor-pointer',
    BIN: 'text-gray-500',
    HEX: 'text-indigo-600',
    UDEC: 'text-blue-600',
    SDEC: 'text-green-600',
  },

  // Canvas styling
  CANVAS: {
    BASE: 'w-full h-full block',
  },
};

/**
 * Helper to generate proper className strings from the style constants
 * @param baseStyles - Base styles to apply
 * @param conditionalStyles - Object mapping condition to style string
 * @returns Combined className string
 */
export function classNames(
  baseStyles: string,
  conditionalStyles: Record<string, boolean> = {}
): string {
  const classes = [baseStyles];

  for (const [styleClass, condition] of Object.entries(conditionalStyles)) {
    if (condition) {
      classes.push(styleClass);
    }
  }

  return classes.join(' ');
}

/**
 * Apply styles to a DOM element using our style constants
 * @param element - Element to style
 * @param styles - Object containing style values to apply
 */
export function applyStyles(element: HTMLElement, styles: Record<string, string>): void {
  for (const [property, value] of Object.entries(styles)) {
    // Use type-safe property assignment
    element.style.setProperty(property, value);
  }
}
