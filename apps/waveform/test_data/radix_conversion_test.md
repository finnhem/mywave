# Radix Conversion Test

## Purpose
This test file specifically checks if radix (base) conversion displays correctly in different formats. It contains an 8-bit signal with various binary values that should be properly displayed in binary (BIN), hexadecimal (HEX), unsigned decimal (UDEC), and signed decimal (SDEC) views.

## Test Signal
- `sig`: An 8-bit signal with values designed to test different radix conversion scenarios

## Test Cases
The file contains the following test cases organized in a table format:

| Format | Time 0 | Time 10 | Time 20 | Time 30 | Time 40 | Time 50 |
|--------|--------|---------|---------|---------|---------|---------|
| BIN    | `00000000` | `00000101` | `11111111` | `10000000` | `10101010` | `00001111` |
| HEX    | `0x00` | `0x05` | `0xFF` | `0x80` | `0xAA` | `0x0F` |
| UDEC   | `0` | `5` | `255` | `128` | `170` | `15` |
| SDEC   | `0` | `5` | `-1` | `-128` | `-86` | `15` |

## How to Use This Test
1. Load the `radix_conversion_test.vcd` file into the waveform viewer
2. Verify that the signal can be displayed correctly in different radix formats:
   - Change the display format between BIN, HEX, UDEC, and SDEC
   - Ensure the displayed values match the expected values listed in the table above
3. Click at different time points (0, 10, 20, 30, 40, 50) and verify that the displayed values match the expected values in all formats

## Special Focus
- Verify the maximum unsigned value (255) at time 20 is correctly displayed as `-1` in SDEC format
- Check negative values (times 20, 30, 40) are correctly displayed in SDEC format
- Test that the bit pattern with the sign bit set (10000000) at time 30 correctly shows `-128` in SDEC format
- Verify positive values display the same in both UDEC and SDEC formats when the sign bit is not set 