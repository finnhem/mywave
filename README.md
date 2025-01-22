# MyWave - Digital Waveform Viewer

A web-based digital waveform viewer for VCD (Value Change Dump) files. Built with Django and JavaScript.

## Features

- Interactive waveform display
- Signal selection and highlighting
- Cursor-based time navigation
- Edge detection (rising/falling)
- Zoom functionality with mouse wheel support
- Time-based navigation controls
- Real-time signal value display

## Prerequisites

- Python 3.8 or higher
- Node.js and npm (for JavaScript dependencies)
- uv (install via curl: https://github.com/astral-sh/uv#installation)

## Installation

1. Install uv using the official installer:
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

2. Clone the repository:
```bash
git clone https://github.com/yourusername/mywave.git
cd mywave
```

3. Create and activate a virtual environment using uv:
```bash
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

4. Install Python dependencies using uv:
```bash
uv pip install -e .
```

5. Generate lock file (if not exists):
```bash
uv lock
```

## Dependency Management

We use uv for deterministic dependency management:
- `pyproject.toml`: Project metadata and dependencies (PEP 621)
- `uv.lock`: Generated lock file with exact versions
- Use `uv lock` to update the lock file
- Use `uv sync` to update the environment

## Running the Development Server

1. Apply database migrations:
```bash
python manage.py migrate
```

2. Run Tailwind CSS:
```bash
python manage.py tailwind start
```

3. Start the development server:
```bash
python manage.py runserver
```

3. Open your browser and navigate to `http://localhost:8000`

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
   - Or use mouse wheel over the waveform
   - The view centers on cursor when navigating

## Development

The project structure:
```
mywave/
├── apps/
│   └── waveform/
│       ├── static/
│       │   └── waveform/
│       │       ├── css/
│       │       └── js/
│       ├── templates/
│       └── ...
├── media/
│   └── logs/
└── ...
```

Key JavaScript modules:
- `waveform.js`: Handles waveform rendering and zoom functionality
- `cursor.js`: Manages cursor state and movement
- `signal.js`: Handles signal selection and edge navigation
- `utils.js`: Utility functions for signal processing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details
