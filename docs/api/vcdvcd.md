# VCDVCD API Documentation

## Overview
Documentation of the vcdvcd library API based on source code analysis. This document will be updated as we discover more details about the API.

## Main Classes

### VCDVCD Class
Main class for parsing and accessing VCD file data.

#### Attributes
- `data: Dict[str, Signal]` - Maps short signal IDs to Signal objects
- `signals: List[str]` - List of full signal names in order of definition
- `references_to_ids: Dict[str, str]` - Maps full signal names to their short IDs
- `timescale: Dict` - Contains timing information
- `endtime: int` - Last timestamp in the VCD
- `begintime: int` - First timestamp in the VCD

#### Methods
- `get_signals() -> List[str]` - Returns list of all signal names
- `get_data() -> Dict[str, Signal]` - Returns the data dictionary (deprecated)
- `get_endtime() -> int` - Returns the last timestamp (deprecated)
- `get_timescale() -> Dict` - Returns timing information (deprecated)
- `__getitem__(refname) -> Signal` - Get signal by name or regex

### Signal Class
Class representing a single signal in the VCD file.

#### Attributes
- `size: int` - Number of bits in the signal
- `var_type: str` - Signal type (e.g., 'wire', 'reg')
- `references: List[str]` - List of human-readable names for this signal
- `tv: List[Tuple[int, str]]` - List of (time, value) pairs
- `endtime: int` - Last timestamp for this signal

#### Methods
- `__getitem__(time) -> str` - Get signal value at given time
  - Can use integer index or slice
  - Returns signal value as string

## Data Structures

### Main Data Organization
```python
{
    'data': {
        '!': Signal(...),  # Short ID -> Signal object
        '"': Signal(...),
        ...
    },
    'signals': ['tb.DUT.a', 'tb.DUT.b', ...],  # Full signal names
    'references_to_ids': {
        'tb.DUT.a': '!',  # Full name -> Short ID
        'tb.DUT.b': '"',
        ...
    }
}
```

### Signal Values
- Binary values: '0', '1'
- Special values: 'x', 'X', 'z', 'Z'
- Vector values: Start with 'b' or 'B' (binary) or 'r' or 'R' (real)

## Usage Examples

### Basic Signal Access
```python
# Create VCD parser
vcd = VCDVCD('path/to/file.vcd')

# Get list of all signals
signals = vcd.get_signals()

# Get data for a specific signal
signal_name = 'tb.DUT.a'
signal_id = vcd.references_to_ids[signal_name]
signal_data = vcd.data[signal_id]

# Access signal values
time_value_pairs = signal_data.tv  # List of (time, value) tuples
```

## Notes
- Signal IDs in VCD files are typically short (often single characters) for file size efficiency
- The API provides mapping between these short IDs and human-readable signal names
- Time values are integers representing time units as defined in the VCD file's timescale 