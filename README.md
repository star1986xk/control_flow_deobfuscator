# ControlFlowDeobfuscator - Control Flow Flattening Deobfuscation Tool

A JavaScript code processor specifically designed to handle and reverse control flow flattening obfuscation.

[中文说明](README_CN.md)

---

## Features

This tool processes JavaScript files through the following four steps:

1. Convert `else` statements to `else if` statements
2. Extract if conditions and corresponding code blocks from the processed file
3. Extract the control flow array from the original file
4. Reorder code blocks based on the control flow array to generate readable JavaScript code

## Installation

Before using, please ensure you have installed the required dependencies:

```bash
npm install
```

## Usage

```bash
node control_flow_deobfuscator.js <input_file.js> <control_flow_var> <condition_var>
```

### Parameters

- `input_file.js`: The JavaScript file to process
- `control_flow_var`: Control flow array variable name
- `condition_var`: If condition variable name

### Example

```bash
node control_flow_deobfuscator.js demo.js _$fl _$hC
```

## Output Files

Running the tool will generate the following files:

- `<filename>_processed.js`: Processed code (else converted to else if, conditions optimized)
- `<filename>_condition_mapping.json`: Detailed mapping of conditions and code segments
- `<filename>_simple_mapping.json`: Simplified index to code segment mapping
- `<filename>_control_flow.json`: Control flow array
- `<filename>_reordered_correct.js`: Code reordered according to control flow

## How It Works

1. **Code Parsing**: Uses Babel to parse JavaScript code into AST
2. **Condition Optimization**: Converts conditions like `< x` to `=== (x-1)` format
3. **Else Conversion**: Converts `else` statements to `else if` statements
4. **Information Extraction**: Extracts the deepest level if conditions and corresponding code blocks
5. **Control Flow Analysis**: Extracts the control flow array from the original code
6. **Code Reordering**: Reorders code blocks according to the control flow array

## Notes

- This tool is primarily targeted at specific formats of control flow obfuscated code
- If the specified control flow variable is not found, the tool will attempt to use alternative methods
- The output reordered code may require further manual review and adjustment

## License

[MIT License](License)
