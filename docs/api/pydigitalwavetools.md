# pyDigitalWaveTools API Documentation

## Overview
Documentation of the pyDigitalWaveTools library API based on source code analysis. This library provides an alternative VCD parser implementation.

## Main Classes

### VcdParser Class
Main class for parsing VCD files.

#### Attributes
- `scope: VcdVarScope` - Root scope for signal hierarchy
- `now: int` - Current timestamp
- `idcode2series: Dict[str, List[Tuple[int, str]]]` - Maps signal IDs to their time-value series
- `end_of_definitions: bool` - Flag indicating if header parsing is complete

#### Methods
- `parse(file_handle)` - Parse a VCD file from a file handle
- `parse_str(vcd_string: str)` - Parse a VCD file from a string
- `setNow(value)` - Set current timestamp
- `value_change(vcdId, value, lineNo)` - Record a value change for a signal

### VcdVarScope Class
Represents a scope (module, task, etc.) in the VCD hierarchy.

#### Attributes
- `name: str` - Name of the scope
- `parent: VcdVarScope` - Parent scope
- `children: Dict[str, Union[VcdVarScope, VcdVarInfo]]` - Child scopes and signals

### VcdVarInfo Class
Contains information about a variable/signal in the VCD file.

#### Attributes
- `vcdId: str` - Signal identifier in the VCD file
- `name: str` - Signal name
- `width: int` - Signal width in bits
- `sigType: str` - Signal type (e.g., 'wire', 'reg')
- `parent: VcdVarScope` - Parent scope
- `data: List[Tuple[int, str]]` - Time-value pairs for this signal

## Data Structures

### Signal Data Organization
```python
{
    'idcode2series': {
        '!': [(0, '0'), (10, '1'), ...],  # (time, value) pairs
        '"': [(0, 'x'), (15, '0'), ...],
        ...
    },
    'scope': VcdVarScope(
        name="root",
        children={
            "module1": VcdVarScope(...),
            "signal1": VcdVarInfo(...),
            ...
        }
    )
}
```

### Signal Values
- Single bit: '0', '1', 'x', 'X', 'z', 'Z'
- Vector values: Start with 'b', 'B', 'r', 'R'
- String values: Start with 's'

## Usage Examples

### Basic Parsing
```python
from pyDigitalWaveTools.vcd.parser import VcdParser

# Create parser
parser = VcdParser()

# Parse from file
with open('file.vcd', 'r') as f:
    parser.parse(f)

# Access signal data
signal_data = parser.idcode2series['!']  # List of (time, value) pairs
```

### Accessing Hierarchy
```python
# Get root scope
root = parser.scope

# Access module
module = root.children['module_name']

# Access signal in module
signal = module.children['signal_name']

# Get signal data
data = signal.data  # List of (time, value) pairs
```

## Notes
- Different from vcdvcd, this parser maintains hierarchical structure
- Signals are organized in a tree of scopes
- Time-value pairs are stored directly in signal objects
- Supports both file and string input
- More low-level access to VCD structure compared to vcdvcd 