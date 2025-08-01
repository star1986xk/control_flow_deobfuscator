#!/usr/bin/env node
/**
 * 最终版JavaScript AST处理器
 * 按照正确的逻辑分步骤处理：
 * 1. `else`改成`else if`，生成`x_processed.js`
 * 2. 从 x_processed.js 中提取if条件的值和if内的代码段，生成`x_condition_mapping.json`、`x_simple_mapping.json`
 * 3. 从原始文件中提取控制流数组，生成`x_control_flow.json`
 * 4. 按控制流数组的顺序生成重排序的js，`x_reordered_correct.js`
 */

const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generator = require('@babel/generator').default;
const t = require('@babel/types');
const fs = require('fs');
const path = require('path');

class FinalJSProcessor {
    constructor(controlFlowVar, conditionVar) {
        this.ifNestingMap = new Map();
        this.controlFlowVar = controlFlowVar;  // 控制流变量名
        this.conditionVar = conditionVar;      // if条件变量名
    }

    /**
     * 步骤1: 生成processed.js（已有逻辑，保持不变）
     */
    generateProcessedJS(inputFile) {
        console.log('📝 步骤1: 生成处理后的JavaScript文件...');

        const sourceCode = fs.readFileSync(inputFile, 'utf-8');
        const ast = this.parseCode(sourceCode);

        // 转换else为else if
        this.convertElseToElseIf(ast);
        // 优化条件表达式
        this.optimizeConditions(ast);

        const processedCode = generator(ast).code;
        const baseName = path.parse(inputFile).name;
        const outputFile = `${baseName}_processed.js`;

        fs.writeFileSync(outputFile, processedCode);
        console.log(`✅ 生成processed文件: ${outputFile}`);

        return outputFile;
    }

    /**
     * 步骤2: 从processed.js中提取if条件和代码段（只要最底层的）
     */
    extractIfConditionsAndBlocks(processedFile) {
        console.log('📦 步骤2: 从processed.js中提取最底层if条件和代码段...');

        const processedCode = fs.readFileSync(processedFile, 'utf-8');
        const ast = this.parseCode(processedCode);

        const mapping = {};
        let blockIndex = 0;

        traverse(ast, {
            IfStatement: (path) => {
                const {node} = path;

                // 只处理最底层的if语句（没有嵌套if的）
                if (this.isBottomLevelIf(node)) {
                    // 提取if条件的值
                    let conditionValue = null;
                    if (t.isBinaryExpression(node.test) &&
                        t.isIdentifier(node.test.left) &&
                        node.test.left.name === this.conditionVar &&
                        node.test.operator === '===') {
                        conditionValue = node.test.right.value;
                    }

                    // 提取if内的代码段
                    let codeBlock = '';
                    if (t.isBlockStatement(node.consequent)) {
                        const statements = node.consequent.body;
                        codeBlock = statements.map(stmt => {
                            return generator(stmt).code.trim();
                        }).join(' '); // 多行累加成一行
                    }

                    if (conditionValue !== null && codeBlock) {
                        mapping[blockIndex] = {
                            condition: `${this.conditionVar} === ${conditionValue}`,
                            value: conditionValue,
                            code: codeBlock
                        };
                        blockIndex++;
                    }

                    // 处理else if链条
                    let current = node;
                    while (current.alternate && t.isIfStatement(current.alternate)) {
                        current = current.alternate;

                        let elseIfValue = null;
                        if (t.isBinaryExpression(current.test) &&
                            t.isIdentifier(current.test.left) &&
                            current.test.left.name === this.conditionVar &&
                            current.test.operator === '===') {
                            elseIfValue = current.test.right.value;
                        }

                        let elseIfCode = '';
                        if (t.isBlockStatement(current.consequent)) {
                            const statements = current.consequent.body;
                            elseIfCode = statements.map(stmt => {
                                return generator(stmt).code.trim();
                            }).join(' ');
                        }

                        if (elseIfValue !== null && elseIfCode) {
                            mapping[blockIndex] = {
                                condition: `${this.conditionVar} === ${elseIfValue}`,
                                value: elseIfValue,
                                code: elseIfCode
                            };
                            blockIndex++;
                        }
                    }

                    // 处理最后的else
                    if (current.alternate && t.isBlockStatement(current.alternate)) {
                        const statements = current.alternate.body;
                        const finalElseCode = statements.map(stmt => {
                            return generator(stmt).code.trim();
                        }).join(' ');

                        if (finalElseCode) {
                            mapping[blockIndex] = {
                                condition: 'else',
                                value: 'else',
                                code: finalElseCode
                            };
                            blockIndex++;
                        }
                    }
                }
            }
        });

        console.log(`✅ 提取了 ${blockIndex} 个最底层if条件和代码段`);
        return mapping;
    }

    /**
     * 步骤3: 从原始文件中提取控制流数组
     */
    extractControlFlowFromOriginal(originalFile) {
        console.log(`🎯 步骤3: 从原始文件中提取控制流数组（变量：${this.controlFlowVar}）...`);

        const originalCode = fs.readFileSync(originalFile, 'utf-8');
        const ast = this.parseCode(originalCode);

        let controlFlow = [];

        // 查找控制流变量的赋值
        traverse(ast, {
            VariableDeclarator: (path) => {
                const {node} = path;
                if (t.isIdentifier(node.id) && node.id.name === this.controlFlowVar) {
                    if (t.isArrayExpression(node.init)) {
                        // 提取数组元素
                        controlFlow = node.init.elements.map(element => {
                            if (t.isNumericLiteral(element)) {
                                return element.value;
                            }
                            return null;
                        }).filter(val => val !== null);

                        console.log(`✅ 找到控制流变量 ${this.controlFlowVar}，包含 ${controlFlow.length} 个元素`);
                        console.log(`📋 前10个元素: [${controlFlow.slice(0, 10).join(', ')}...]`);
                    }
                }
            },

            // 也查找赋值表达式，以防控制流数组是通过赋值设置的
            AssignmentExpression: (path) => {
                const {node} = path;
                if (t.isIdentifier(node.left) && node.left.name === this.controlFlowVar) {
                    if (t.isArrayExpression(node.right)) {
                        controlFlow = node.right.elements.map(element => {
                            if (t.isNumericLiteral(element)) {
                                return element.value;
                            }
                            return null;
                        }).filter(val => val !== null);

                        console.log(`✅ 找到控制流变量赋值 ${this.controlFlowVar}，包含 ${controlFlow.length} 个元素`);
                        console.log(`📋 前10个元素: [${controlFlow.slice(0, 10).join(', ')}...]`);
                    }
                }
            }
        });

        if (controlFlow.length === 0) {
            console.log(`⚠️  未找到控制流变量 ${this.controlFlowVar}，将使用备用方法`);
            // 备用方法：分析代码结构
            let flowIndex = 0;
            traverse(ast, {
                IfStatement: (path) => {
                    controlFlow.push(flowIndex++);
                }
            });
        }

        return controlFlow;
    }

    /**
     * 步骤4: 按控制流数组的顺序生成重排序的js
     */
    generateReorderedCode(mapping, controlFlow) {
        console.log('📝 步骤4: 按控制流数组的顺序生成重排序的js...');

        const reorderedLines = [];

        // 根据控制流数组的顺序重新组织代码
        for (let i = 0; i < controlFlow.length; i++) {
            const flowValue = controlFlow[i];

            // 在mapping中查找对应的代码块
            for (const [index, block] of Object.entries(mapping)) {
                if (block.value === flowValue ||
                    (typeof block.value === 'number' && block.value === flowValue)) {
                    reorderedLines.push(`// 控制流位置 ${i}: ${block.condition}`);
                    reorderedLines.push(block.code);
                    reorderedLines.push('');
                    break;
                }
            }
        }

        console.log(`✅ 按控制流重新排序了 ${reorderedLines.length} 行代码`);
        return reorderedLines.join('\n');
    }

    /**
     * 主处理函数
     */
    async process(inputFile) {
        const baseName = path.parse(inputFile).name;

        try {
            // 步骤1: 生成processed.js
            const processedFile = this.generateProcessedJS(inputFile);

            // 步骤2: 从processed.js中提取if条件和代码段
            const mapping = this.extractIfConditionsAndBlocks(processedFile);

            // 生成简化的索引:代码段映射
            const simpleMapping = {};
            Object.keys(mapping).forEach(key => {
                simpleMapping[key] = mapping[key].code;
            });

            // 步骤3: 从原始文件中提取控制流数组
            const controlFlow = this.extractControlFlowFromOriginal(inputFile);

            // 步骤4: 按控制流数组的顺序生成重排序的js
            const reorderedCode = this.generateReorderedCode(mapping, controlFlow);

            // 保存所有结果文件
            const conditionMappingFile = `${baseName}_condition_mapping.json`;
            const simpleMappingFile = `${baseName}_simple_mapping.json`;
            const controlFlowFile = `${baseName}_control_flow.json`;
            const reorderedFile = `${baseName}_reordered_correct.js`;

            // 写入文件
            fs.writeFileSync(conditionMappingFile, JSON.stringify(mapping, null, 2));
            fs.writeFileSync(controlFlowFile, JSON.stringify(controlFlow, null, 2));
            fs.writeFileSync(simpleMappingFile, JSON.stringify(simpleMapping, null, 2));
            fs.writeFileSync(reorderedFile, reorderedCode);

            console.log('\n🎉 处理完成！生成的文件:');
            console.log(`📄 ${processedFile} - 处理后的代码`);
            console.log(`📄 ${conditionMappingFile} - 条件和代码段映射`);
            console.log(`📄 ${simpleMappingFile} - 简化的索引:代码段映射`);
            console.log(`📄 ${controlFlowFile} - 控制流数组`);
            console.log(`📄 ${reorderedFile} - 按控制流重排序的代码`);

        } catch (error) {
            console.error('❌ 处理过程中出现错误:', error);
            throw error;
        }
    }

    // ====== 辅助方法 ======

    parseCode(code) {
        try {
            return parser.parse(code, {
                sourceType: 'script',
                allowImportExportEverywhere: true,
                allowReturnOutsideFunction: true,
                plugins: ['asyncGenerators', 'bigInt', 'classProperties', 'decorators-legacy', 'doExpressions', 'dynamicImport', 'exportDefaultFrom', 'exportNamespaceFrom', 'functionBind', 'functionSent', 'importMeta', 'nullishCoalescingOperator', 'numericSeparator', 'objectRestSpread', 'optionalCatchBinding', 'optionalChaining', 'throwExpressions', 'topLevelAwait', 'trailingFunctionCommas']
            });
        } catch (error) {
            console.error('❌ 代码解析失败:', error.message);
            throw error;
        }
    }

    /**
     * 检查是否为最底层的if语句
     */
    isBottomLevelIf(ifNode) {
        // 检查if语句的consequent中是否不包含嵌套的if语句
        if (!t.isBlockStatement(ifNode.consequent)) return false;

        for (const stmt of ifNode.consequent.body) {
            if (t.isIfStatement(stmt)) {
                return false; // 包含嵌套if，不是最底层
            }
        }

        return true; // 不包含嵌套if，是最底层
    }

    /**
     * 转换else为else if
     */
    convertElseToElseIf(ast) {
        const self = this;
        let conversionCount = 0;

        // 第一遍遍历：建立嵌套关系映射
        traverse(ast, {
            IfStatement: {
                enter(path) {
                    const {node} = path;
                    const depth = self.getNodeDepth(path);

                    if (!self.ifNestingMap.has(depth)) {
                        self.ifNestingMap.set(depth, []);
                    }
                    self.ifNestingMap.get(depth).push(path);
                }
            }
        });

        // 按深度从小到大排序处理（外层到内层）
        const sortedDepths = Array.from(self.ifNestingMap.keys()).sort((a, b) => a - b);

        for (const depth of sortedDepths) {
            const ifStatements = self.ifNestingMap.get(depth);

            for (const ifPath of ifStatements) {
                if (ifPath.node.alternate &&
                    t.isBlockStatement(ifPath.node.alternate) &&
                    !t.isIfStatement(ifPath.node.alternate)) {

                    // 找到正确的else条件
                    const correctCondition = self.findCorrectElseCondition(ifPath);

                    if (correctCondition) {
                        // 创建新的else if节点
                        const newElseIf = t.ifStatement(
                            correctCondition,
                            ifPath.node.alternate
                        );

                        // 替换原来的else
                        ifPath.node.alternate = newElseIf;
                        conversionCount++;
                    }
                }
            }
        }

        console.log(`✅ 转换了 ${conversionCount} 个else为else if`);
    }

    /**
     * 找到else应该使用的正确条件
     */
    findCorrectElseCondition(ifPath) {
        const {node} = ifPath;

        // 收集当前if-else if链条中已使用的值
        const usedValues = new Set();
        let currentNode = node;
        let variable = null;

        // 分析主if条件，找到变量名
        if (t.isBinaryExpression(currentNode.test)) {
            if (currentNode.test.operator === '===' && t.isIdentifier(currentNode.test.left)) {
                variable = currentNode.test.left.name;
                usedValues.add(currentNode.test.right.value);
            }
        }

        // 遍历else if链条
        while (currentNode.alternate && t.isIfStatement(currentNode.alternate)) {
            currentNode = currentNode.alternate;
            if (t.isBinaryExpression(currentNode.test) &&
                currentNode.test.operator === '===' &&
                t.isIdentifier(currentNode.test.left) &&
                currentNode.test.left.name === variable) {
                usedValues.add(currentNode.test.right.value);
            }
        }

        if (variable && usedValues.size > 0) {
            // 找到下一个连续的值
            const maxValue = Math.max(...Array.from(usedValues));
            const nextValue = maxValue + 1;

            // 创建新的条件
            return t.binaryExpression(
                '===',
                t.identifier(variable),
                t.numericLiteral(nextValue)
            );
        }

        return null;
    }

    /**
     * 优化条件表达式
     */
    optimizeConditions(ast) {
        let optimizationCount = 0;

        traverse(ast, {
            BinaryExpression: (path) => {
                const {node} = path;

                // 将 < x 改为 === (x-1)
                if (node.operator === '<' &&
                    t.isIdentifier(node.left) &&
                    t.isNumericLiteral(node.right)) {

                    const newValue = node.right.value - 1;
                    if (newValue >= 0) {
                        node.operator = '===';
                        node.right.value = newValue;
                        optimizationCount++;
                    }
                }
            }
        });

        console.log(`✅ 优化了 ${optimizationCount} 个条件表达式`);
    }

    /**
     * 获取节点的嵌套深度
     */
    getNodeDepth(path) {
        let depth = 0;
        let current = path.parent;

        while (current) {
            if (t.isIfStatement(current) || t.isBlockStatement(current)) {
                depth++;
            }
            current = path.parentPath?.parent;
            path = path.parentPath;
        }

        return depth;
    }
}

// 主函数
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log(`
📖 用法: node js_ast_final.js <input_file.js> [control_flow_var] [condition_var]

📝 参数:
  input_file.js      - 要处理的JavaScript文件
  control_flow_var   - 控制流数组变量名
  condition_var      - if条件变量名

📝 功能:
  1. 生成 x_processed.js（else转else if，条件优化）
  2. 从 x_processed.js 中提取if条件的值和if内的代码段
  3. 从原始文件中提取控制流数组
  4. 按控制流数组的顺序生成重排序的js

📁 输出文件:
  - <n>_processed.js          - 处理后的代码
  - <n>_condition_mapping.json - 条件和代码段映射
  - <n>_simple_mapping.json   - 简化的索引:代码段映射
  - <n>_control_flow.json     - 控制流数组
  - <n>_reordered_correct.js  - 按控制流重排序的代码

💡 示例:
  node js_ast_final.js demo.js _$fl _$hC
`);
        process.exit(1);
    }

    const inputFile = args[0];
    const controlFlowVar = args[1];
    const conditionVar = args[2];

    if (!fs.existsSync(inputFile)) {
        console.error(`❌ 文件不存在: ${inputFile}`);
        process.exit(1);
    }

    console.log(`🚀 开始处理文件: ${inputFile}`);
    console.log(`📊 控制流变量: ${controlFlowVar}`);
    console.log(`🎯 条件变量: ${conditionVar}`);

    try {
        const processor = new FinalJSProcessor(controlFlowVar, conditionVar);
        await processor.process(inputFile);
        console.log('\n🎉 所有步骤完成！');
    } catch (error) {
        console.error('❌ 处理失败:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = FinalJSProcessor;