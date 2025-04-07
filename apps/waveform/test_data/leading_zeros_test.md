# Leading Zeros Display Test

## Purpose
This test file specifically checks if leading zeros are preserved in binary display. It contains signals with various bit widths (4, 8, and 16 bits) with values that contain leading zeros.

## Test Signals
- `signal8`: An 8-bit signal with values that have varying numbers of leading zeros
- `signal4`: A 4-bit signal to test smaller bit-width signals
- `signal16`: A 16-bit signal to test larger bit-width signals with more potential leading zeros

## Test Cases
The file contains the following test cases organized in a table format:

| Signal | Time 0 | Time 10 | Time 20 | Time 30 | Time 40 | Time 50 |
|--------|--------|---------|---------|---------|---------|---------|
| signal4 | `0101` | `0001` | `0001` | `0101` | `0000` | `0010` |
| signal8 | `00001111` | `00010000` | `00000001` | `01010101` | `00000000` | `00000010` |
| signal16 | `0000000000000001` | `0000000000010000` | `0000000100000000` | `0101010101010101` | `0000000000000000` | `0000001000000000` |

## Leading Zeros Count

| Signal | Time 0 | Time 10 | Time 20 | Time 30 | Time 40 | Time 50 |
|--------|--------|---------|---------|---------|---------|---------|
| signal4 | 1 leading zero | 3 leading zeros | 3 leading zeros | 1 leading zero | all zeros | 2 leading zeros |
| signal8 | 4 leading zeros | 3 leading zeros | 7 leading zeros | 1 leading zero | all zeros | 6 leading zeros |
| signal16 | 15 leading zeros | 11 leading zeros | 8 leading zeros | 1 leading zero | all zeros | 7 leading zeros |

## How to Use This Test
1. Load the `leading_zeros_test.vcd` file into the waveform viewer
2. Set all signals to binary display mode
3. Verify that all leading zeros are displayed and not truncated
4. Click at different time points (0, 10, 20, 30, 40, 50) and verify that the displayed values match the expected values in the table above with all leading zeros preserved

## Special Focus
- Pay special attention to the 16-bit signal at time 0, which should show a full 16-bit representation with 15 leading zeros
- Check the 8-bit signal at time 20, which should show a full 8-bit representation with 7 leading zeros
- Also verify that signals with all zeros (at time 40) display correctly 