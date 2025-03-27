# VCD Test File for Radix Conversion Verification

## Purpose
This VCD (Value Change Dump) file is designed to test the radix conversion functionality in our app. The app converts an 8-bit signal value from Binary to Hex, Signed Decimal, Unsigned Decimal, and back to Binary. The test file includes specific value changes for an 8-bit signal to verify that these conversions are performed correctly.

## VCD File Structure
The VCD file is structured as follows:
- **Header**: Contains metadata like date, version, and timescale (set to `1ns`).
- **Scope**: Defined as `module test`.
- **Variable Declaration**: Declares an 8-bit wire named `sig` with an identifier `a`.
- **Initial Value Dump**: Sets the initial value at time `0`.
- **Value Changes**: Specifies new values for `sig` at times `10ns`, `20ns`, `30ns`, `40ns`, `50ns`, and `60ns`.

## Selected Values and Expected Representations
The signal `sig` changes to the following binary values at the specified times. Below each binary value, you'll find its expected representation in Hex, Signed Decimal (SDec), Unsigned Decimal (UDec), and Binary (to confirm the round-trip conversion):

- **Time 0**: `00000000`
  - Binary: `00000000`
  - Hex: `00`
  - Signed Decimal: `0`
  - Unsigned Decimal: `0`
  - Back to Binary: `00000000`

- **Time 10**: `00000101`
  - Binary: `00000101`
  - Hex: `05`
  - Signed Decimal: `5`
  - Unsigned Decimal: `5`
  - Back to Binary: `00000101`

- **Time 20**: `11111111`
  - Binary: `11111111`
  - Hex: `FF`
  - Signed Decimal: `-1`
  - Unsigned Decimal: `255`
  - Back to Binary: `11111111`

- **Time 30**: `10000000`
  - Binary: `10000000`
  - Hex: `80`
  - Signed Decimal: `-128`
  - Unsigned Decimal: `128`
  - Back to Binary: `10000000`

- **Time 40**: `10101010`
  - Binary: `10101010`
  - Hex: `AA`
  - Signed Decimal: `-86`
  - Unsigned Decimal: `170`
  - Back to Binary: `10101010`

- **Time 50**: `00001111`
  - Binary: `00001111`
  - Hex: `0F`
  - Signed Decimal: `15`
  - Unsigned Decimal: `15`
  - Back to Binary: `00001111`

These values are carefully chosen to test:
- Zero and maximum unsigned values (e.g., `00000000` and `11111111`).
- Positive and negative signed values using two's complement (e.g., `-1` and `-128`).
- Unique hex patterns (e.g., `AA` and `0F`).
- Consistency across all conversions, including the round-trip back to Binary.

## How to Use This Test File
To test the conversions using this VCD file, follow these steps:
1. Save the VCD content into a file named `radix_conversion_test.vcd`.
2. Load `radix_conversion_test.vcd` into the app or a compatible waveform viewer.
3. At each time point (0ns, 10ns, 20ns, etc.), check the signal `sig` and switch between the radix displays (Binary, Hex, Signed Decimal, Unsigned Decimal).
4. Verify that the displayed values match the expected representations listed above.
5. Confirm that converting back to Binary yields the original binary value.

## Verification Notes
When testing, pay attention to these key points:
- **Signed Decimal**: Check that two's complement is applied correctly. For example, `11111111` should display as `-1` (not `255`), and `10000000` as `-128`.
- **Hex**: Ensure the 8-bit binary value is accurately grouped into two hex digits. For instance, `10101010` should be `AA`.
- **Round-Trip**: After converting Binary → Hex → Signed Decimal → Unsigned Decimal → Binary, the final Binary value must match the original (e.g., `11111111` remains `11111111`).
- **Transitions**: Verify that the app updates the signal value correctly at each timestamp (e.g., from `00000101` at 10ns to `11111111` at 20ns).

By following these steps and checks, you can confirm that the app’s radix conversion functionality—Binary to Hex, Signed Decimal, Unsigned Decimal, and back to Binary—works correctly for all test cases.