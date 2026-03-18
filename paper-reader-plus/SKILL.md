---
name: paper-reader-plus
description: |
  Enhanced PDF paper reader - reads EVERYTHING in a paper PDF.
  Extracts text (structured by chapters), images (filtered to meaningful figures),
  tables (as CSV), citations (arxiv IDs), formulas, and metadata.
  Outputs a single structured markdown analysis file per paper.
  
  Requires: pdfplumber, pymupdf (fitz)
  
  Triggers on: "read this paper", "analyze this PDF", "extract from paper", 
  "读懂这篇论文", "分析这篇PDF", "paper reader plus"
---

# Paper Reader Plus — 读懂论文里的一切

## 核心能力

| 功能 | 状态 | 说明 |
|------|------|------|
| 全文提取 | ✅ 按章节结构化 | Introduction/Methods/Results/Conclusion 自动识别 |
| 图片提取 | ✅ 自动过滤装饰图 | 只保留≥300px的真正图表 |
| 图表理解 | ✅ 调用 vision model | healer-alpha 描述图表内容 |
| 表格提取 | ✅ CSV格式 | 保留原始数据结构 |
| 公式提取 | ✅ 图片+vision描述 | 数学公式转文字描述 |
| 引用网络 | ✅ 提取所有 arxiv ID | 构建引用关系图 |
| 批量处理 | ✅ 整个文件夹 | 一键处理所有论文 |

## 使用方法

### 单篇完整分析
```bash
python3 read_paper_plus.py paper.pdf --full --output ./output/ --min-img-size 300
```

### 批量处理文件夹
```bash
python3 read_paper_plus.py --batch --input ./论文收集/ --output ./output/
```

### 仅提取引用关系
```bash
python3 read_paper_plus.py paper.pdf --citations
```

### 提取关键图片（用于 vision model 理解）
```bash
python3 read_paper_plus.py paper.pdf --images --min-img-size 300 --img-dir ./figures/
```

## 图表理解流程（需要 vision model）

paper-reader-plus 提取图片后，调用 vision model 理解内容：

```bash
# Step 1: 提取图片
python3 read_paper_plus.py paper.pdf --images --min-img-size 300

# Step 2: 对关键图片调用 vision model（由 agent 使用 healer-alpha）
# agent 自动将图片发送给 vision model，生成描述

# Step 3: 整合到分析文件
python3 read_paper_plus.py paper.pdf --full --output ./output/
```

## 输出格式

```
output/
├── {id}_analysis.md       # 结构化分析（文字+图表描述+表格+引用）
├── {id}_text.txt          # 全文文字
├── {id}_figures/          # 关键图片（已过滤装饰图）
│   ├── fig_001_p1.png
│   └── ...
├── {id}_tables/           # 表格数据
│   ├── table_001_p1.csv
│   └── ...
└── citation_network.json  # 引用关系网络
```

## 分析文件包含

1. **基本信息** — 标题、作者、关键词、页数
2. **研究背景** — 从 Introduction 自动提取
3. **研究问题与方法** — 从 Methods 章节提取
4. **实验结果** — 表格数据 + 结果描述
5. **图表描述** — vision model 对每张图的描述
6. **引用网络** — 所有 arxiv 引用 ID
7. **关键洞察** — 从 Conclusion 提取

## 注意事项

- 原版 `paper-reader` 保留不动
- 本增强版在 `paper-reader-plus/` 独立目录
- 图片过滤默认 min-size=300px，过滤掉装饰性小图
- 引用提取支持多种格式：arXiv:XXXX.XXXXX、arxiv.org/abs/、裸 ID
