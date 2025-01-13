# Documentation

This directory contains documentation for the various APIs and libraries used in the project.

## Structure

```
docs/
├── README.md           # This file
└── api/               # API documentation for external libraries
    ├── vcdvcd.md      # Documentation for vcdvcd library
    └── pydigitalwavetools.md  # Documentation for pyDigitalWaveTools library
```

## API Documentation

### VCD Parser Libraries
We use two different VCD parser libraries, each with its own strengths:

1. **vcdvcd** (`api/vcdvcd.md`)
   - Primary parser
   - Simple, flat data structure
   - Easy direct access to signals
   - Good for basic VCD parsing needs

2. **pyDigitalWaveTools** (`api/pydigitalwavetools.md`)
   - Fallback parser
   - Hierarchical data structure
   - Maintains full VCD scope information
   - Better for complex structural analysis

### Key Differences

| Feature | vcdvcd | pyDigitalWaveTools |
|---------|--------|-------------------|
| Data Structure | Flat | Hierarchical |
| Signal Access | Direct via name/ID | Through scope tree |
| Scope Handling | Basic mapping | Full hierarchy |
| API Level | High-level | Low-level |
| Use Case | Simple signal access | Detailed VCD analysis |

## Contributing

When adding new documentation:
1. Create a new markdown file in the appropriate directory
2. Update this README if adding new sections
3. Follow the existing format for consistency
4. Include:
   - Overview
   - API details
   - Data structures
   - Usage examples
   - Notes/caveats

## Updating Documentation

When updating existing documentation:
1. Keep the format consistent
2. Add new sections as needed
3. Update examples if API changes
4. Add notes about version differences if relevant 