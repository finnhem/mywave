# Leading Zeros Display Test

## Purpose
This test file specifically checks if leading zeros are preserved in binary display. It contains signals with various bit widths (4, 8, and 16 bits) with values that contain leading zeros.

## Test Signals
- `signal8`: An 8-bit signal with values that have varying numbers of leading zeros
- `signal4`: A 4-bit signal to test smaller bit-width signals
- `signal16`: A 16-bit signal to test larger bit-width signals with more potential leading zeros

## Test Cases
The file contains the following test cases:

### At Time 0
- `signal8`: `00001111` (4 leading zeros)
- `signal4`: `0101` (1 leading zero)
- `signal16`: `0000000000000001` (15 leading zeros)

### At Time 10
- `signal8`: `00010000` (3 leading zeros)
- `signal4`: `0001` (3 leading zeros)
- `signal16`: `0000000000010000` (11 leading zeros)

### At Time 20
- `signal8`: `00000001` (7 leading zeros)
- `signal4`: `0001` (3 leading zeros)
- `signal16`: `0000000100000000` (8 leading zeros)

### At Time 30
- `signal8`: `01010101` (1 leading zero)
- `signal4`: `0101` (1 leading zero)
- `signal16`: `0101010101010101` (1 leading zero)

### At Time 40
- `signal8`: `00000000` (all zeros)
- `signal4`: `0000` (all zeros)
- `signal16`: `0000000000000000` (all zeros)

### At Time 50
- `signal8`: `00000010` (6 leading zeros)
- `signal4`: `0010` (2 leading zeros)
- `signal16`: `0000001000000000` (7 leading zeros)

## How to Use This Test
1. Load the `leading_zeros_test.vcd` file into the waveform viewer
2. Set all signals to binary display mode
3. Verify that all leading zeros are displayed and not truncated
4. Click at different time points (0, 10, 20, 30, 40, 50) and verify that the displayed values match the expected values with all leading zeros preserved

## Special Focus
- Pay special attention to the 16-bit signal at time 0, which should show a full 16-bit representation with 15 leading zeros
- Check the 8-bit signal at time 20, which should show a full 8-bit representation with 7 leading zeros
- Also verify that signals with all zeros (at time 40) display correctly 