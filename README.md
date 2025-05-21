# MyWave - Digital Waveform Viewer

A web-based digital waveform viewer for VCD (Value Change Dump) files. Built with Django and TypeScript.

## Features

- Interactive waveform display
- Signal selection and highlighting
- Cursor-based time navigation
- Edge detection (rising/falling)
- Zoom functionality with mouse wheel support
- Time-based navigation controls
- Real-time signal value display
- Type-safe signal value formatting and radix conversion

## Prerequisites

- Python 3
- make

## Development

1. Clone the repository:
```bash
git clone https://github.com/yourusername/mywave.git
cd mywave
```

2. Generate devcontainer config:
```bash
make generate-devcontainer
```

3. Reopen repo in devcontainer

4. Install dependencies:
```bash
make devcontainer_deps
```

5. Run website
```bash
make run_website
```

6. Kill website
```bash
make kill
```

## Dependency Management

We use multiple tools for dependency management:
- Python dependencies:
  - `pyproject.toml`: Project metadata and dependencies (PEP 621)
  - `uv.lock`: Generated lock file with exact versions
  - Use `uv lock` to update the lock file
  - Use `uv sync` to update the environment
- TypeScript/JavaScript dependencies:
  - `package.json`: Frontend dependencies and scripts
  - `package-lock.json`: Lock file for npm dependencies
  - `tsconfig.json`: TypeScript configuration
  - `biome.json`: Biome configuration for linting and formatting
  - `rspack.config.js`: Rspack bundler configuration

All changes will be automatically recompiled:
- Python files: Django auto-reloads
- CSS/Tailwind: Auto-recompiled by Tailwind
- TypeScript/JavaScript: Auto-rebuilt by Rspack
- Templates: Django auto-reloads

## Code Quality

We use Biome for code quality:

1. Format code:
```bash
npm run format
```

2. Lint code:
```bash
npm run lint
```

3. Check types and lint:
```bash
npm run check
```

## Usage

1. Upload a VCD file using the file input at the top of the page
2. Click on signal names to select them for edge navigation
3. Use the navigation controls:
   - ⏮ Start: Jump to start of timeline
   - ↓ Prev: Previous falling edge
   - ↑ Prev: Previous rising edge
   - ◀ Prev: Previous transition
   - Next ▶: Next transition
   - Next ↑: Next rising edge
   - Next ↓: Next falling edge
   - End ⏭: Jump to end of timeline

4. Zoom controls:
   - Use 🔍- and 🔍+ buttons to zoom out/in
   - Or use mouse wheel over the waveform (hold CTRL)
   - CTRL+Drag to zoom into a specific region
   - The view centers on cursor when navigating

## Project Structure

```
mywave/
├── apps/
│   └── waveform/
│       ├── static/
│       │   └── waveform/
│       │       ├── css/
│       │       └── js/
│       │           ├── components/    # TypeScript UI components
│       │           ├── types.ts       # TypeScript type definitions
│       │           ├── main.ts        # Main waveform viewer
│       │           ├── cursor.ts      # Cursor management
│       │           ├── signal.ts      # Signal handling
│       │           ├── radix.ts       # Value formatting
│       │           ├── zoom.ts        # Zoom functionality
│       │           └── ...
│       ├── templates/
│       └── ...
├── media/
│   └── logs/
└── ...
```

Key TypeScript modules:
- `main.ts`: Main waveform viewer implementation
- `types.ts`: Core type definitions and interfaces
- `cursor.ts`: Cursor state and movement management
- `signal.ts`: Signal selection and edge navigation
- `radix.ts`: Signal value formatting and radix conversion
- `components/*.ts`: Reusable UI components

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

Please ensure:
- All new code is written in TypeScript
- Type definitions are provided for public APIs
- Code is formatted using Biome
- All Biome checks pass

## License

This project is licensed under the MIT License - see the LICENSE file for details



## Reference

```bash
cd theme/static_src && npx tailwindcss --postcss -i ./src/styles.css -o ../static/css/dist/styles.css
```