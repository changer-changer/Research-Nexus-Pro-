---
name: paper-reader-plus
description: |
  Enhanced PDF paper reader with image understanding, citation extraction, and batch processing.
  Upgrades the original paper-reader with: vision model integration for chart understanding,
  citation network extraction, structured markdown output, and batch folder processing.
  
  Requires: pdfplumber, pymupdf, Pillow
  Optional: vision model for image understanding (via separate describe step)
---

# Paper Reader Plus — Enhanced PDF Extraction

## 核心功能

### 比原版 paper-reader 增强了什么

| 功能 | paper-reader | paper-reader-plus |
|------|-------------|-------------------|
| 文字提取 | ✅ | ✅ 按章节结构化 |
| 图片提取 | ✅ PNG文件 | ✅ + AI 描述 |
| 表格提取 | ✅ CSV | ✅ CSV |
| 元数据 | ✅ | ✅ |
| 引用网络 | ❌ | ✅ 提取所有引用 |
| 批量处理 | ❌ | ✅ 整个文件夹 |
| 图表理解 | ❌ | ✅ 调用 vision model |
| 综合输出 | 分散文件 | ✅ 单个 .md 分析文件 |

## 使用方法

### 单篇论文（完整分析）
```bash
python3 read_paper_plus.py --pdf paper.pdf --full --output ./output/
```

### 批量处理整个文件夹
```bash
python3 read_paper_plus.py --batch --input ./论文收集/ --output ./output/
```

### 仅提取引用网络
```bash
python3 read_paper_plus.py --pdf paper.pdf --citations
```

### 图片理解（需 vision model）
```bash
python3 read_paper_plus.py --pdf paper.pdf --understand-images --output ./output/
```

## 输出结构

```
output/
├── {arxiv_id}_analysis.md      # 完整分析（文字+图表描述+表格+引用）
├── {arxiv_id}_text.txt         # 纯文字
├── {arxiv_id}_figures/         # 提取的图片
│   ├── fig_01.png
│   └── fig_02.png
├── {arxiv_id}_tables/          # 提取的表格
│   ├── table_01.csv
│   └── table_02.csv
└── citation_network.json       # 批量处理时的引用网络
```

## 分析文件格式

每篇论文生成一个结构化的 .md 分析文件：

```markdown
# 论文标题

## 基本信息
- ArXiv ID, 作者, 发表时间, 关键词

## 1. 研究背景
## 2. 研究问题
## 3. 核心方法（含图表描述）
## 4. 实验结果（含表格数据）
## 5. 引用网络
## 6. 关键洞察
```

## 图片理解流程

1. 提取 PDF 中所有图片
2. 过滤装饰性图片（太小的跳过）
3. 对每张关键图片调用 vision model 生成描述
4. 将描述嵌入分析文件对应位置

## 依赖

```bash
pip install pdfplumber pymupdf Pillow
```
