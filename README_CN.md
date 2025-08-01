# ControlFlowDeobfuscator 控制流平坦化反混淆工具

一个专门用于处理和还原控制流平坦化（Control Flow Flattening）混淆的 JavaScript 代码处理器。

[English Version](README.md)

---

## 功能介绍

该工具通过以下四个步骤处理 JavaScript 文件：

1. 将 `else` 语句转换为 `else if` 语句
2. 从处理后的文件中提取 if 条件和对应的代码块
3. 从原始文件中提取控制流数组
4. 根据控制流数组重新排序代码块，生成易于阅读的 JavaScript 代码

## 安装依赖

在使用之前，请确保安装了所需的依赖：

```bash
npm install
```

## 使用方法

```bash
node control_flow_deobfuscator.js <input_file.js> <control_flow_var> <condition_var>
```

### 参数说明

- `input_file.js`：要处理的 JavaScript 文件
- `control_flow_var`：控制流数组变量名
- `condition_var`：if 条件变量名

### 示例

```bash
node control_flow_deobfuscator.js demo.js _$fl _$hC
```

## 输出文件

运行工具后会生成以下文件：

- `<filename>_processed.js`：处理后的代码（else 转换为 else if，条件优化）
- `<filename>_condition_mapping.json`：条件和代码段的详细映射
- `<filename>_simple_mapping.json`：简化的索引到代码段映射
- `<filename>_control_flow.json`：控制流数组
- `<filename>_reordered_correct.js`：按控制流重排序后的代码

## 工作原理

1. **代码解析**：使用 Babel 解析 JavaScript 代码为 AST
2. **条件优化**：将类似 `< x` 的条件转换为 `=== (x-1)` 形式
3. **Else 转换**：将 `else` 语句转换为 `else if` 语句
4. **信息提取**：提取最底层的 if 条件和对应的代码块
5. **控制流分析**：从原始代码中提取控制流数组
6. **代码重排**：根据控制流数组重新排列代码块

## 注意事项

- 该工具主要针对特定格式的控制流混淆代码
- 如果未找到指定的控制流变量，工具会尝试使用备用方法
- 输出的重排序代码可能需要进一步的人工审查和调整

## 许可证

MIT License