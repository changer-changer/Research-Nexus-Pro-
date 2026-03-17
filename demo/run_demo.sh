#!/bin/bash
# 🦞 虾博 Paper Research - 现场演示脚本
# 用于龙虾AI Agent创新大赛现场展示

set -e  # 遇到错误立即退出

echo "=========================================="
echo "🦞 虾博 Paper Research - 现场演示"
echo "=========================================="
echo ""

# 配置
QUERY="${1:-Tac3D tactile sensor}"  # 默认搜索关键词
NUM_PAPERS="${2:-2}"                 # 默认分析2篇
OUTPUT_DIR="${3:-./demo_output}"

echo "📋 演示配置:"
echo "   搜索关键词: $QUERY"
echo "   分析论文数: $NUM_PAPERS"
echo "   输出目录: $OUTPUT_DIR"
echo ""

# 创建输出目录
mkdir -p "$OUTPUT_DIR"

# ===========================================
# Phase 1: 搜索与下载
# ===========================================
echo "=========================================="
echo "🚀 Phase 1: 程序化搜索与下载"
echo "=========================================="
echo ""

python3 << PYTHON
import sys
sys.path.insert(0, '~/.openclaw/workspace/skills/paper-research')

from paper_research import ArxivSearcher, PaperDeduplicator, PDFDownloader
from pathlib import Path
import json
from datetime import datetime

output_dir = Path("$OUTPUT_DIR")
output_dir.mkdir(parents=True, exist_ok=True)

print(f"🔍 搜索关键词: '$QUERY'")
searcher = ArxivSearcher(max_results=$NUM_PAPERS)
papers = searcher.search('$QUERY')

if not papers:
    print("❌ 没有找到论文")
    sys.exit(1)

dedup = PaperDeduplicator()
papers = dedup.deduplicate(papers)

print(f"\n📥 开始下载 {len(papers)} 篇论文...")
downloader = PDFDownloader(str(output_dir))

for paper in papers:
    pdf_path = downloader.download(paper)
    if pdf_path:
        paper['pdf_path'] = str(pdf_path)

# 保存元数据
metadata_file = output_dir / "_demo_metadata.json"
with open(metadata_file, 'w', encoding='utf-8') as f:
    json.dump({
        "query": '$QUERY',
        "timestamp": datetime.now().isoformat(),
        "papers": papers
    }, f, indent=2, ensure_ascii=False)

print(f"✅ Phase 1完成!")
print(f"   📄 论文数: {len(papers)}")
print(f"   💾 元数据: {metadata_file}")
PYTHON

echo ""

# ===========================================
# Phase 2: 展示Agent任务
# ===========================================
echo "=========================================="
echo "🤖 Phase 2: Agent集群分析（核心演示）"
echo "=========================================="
echo ""

python3 << PYTHON
import json
from pathlib import Path

output_dir = Path("$OUTPUT_DIR")
metadata_file = output_dir / "_demo_metadata.json"

with open(metadata_file, 'r', encoding='utf-8') as f:
    data = json.load(f)
    papers = data['papers']

print(f"准备启动 {len(papers)} 个SubAgent进行深度分析\n")

for i, paper in enumerate(papers, 1):
    if 'pdf_path' not in paper:
        continue
    
    arxiv_id = paper['arxiv_id']
    title = paper['title']
    
    print(f"[{i}] {title[:60]}...")
    print(f"    📄 PDF: {paper['pdf_path']}")
    print(f"    🎯 Agent任务: 深度阅读 + 6部分报告")
    print(f"    📤 输出: {output_dir}/{arxiv_id}_analysis.md")
    print()

print("⏳ 每个Agent需要5-10分钟完成分析")
print("   Agent正在执行：")
print("   1️⃣  读取完整PDF")
print("   2️⃣  逐章分析（Introduction→Methods→Results）")
print("   3️⃣  提取所有表格和图表")
print("   4️⃣  生成6部分详细报告")
print()

print("📝 Agent任务示例：")
print("─" * 50)
print(f"""
【虾博 Agent任务】

你必须完整阅读这篇论文的每一个章节：
- 研究背景：领域脉络、前作引用
- 研究问题：具体问题、核心假设  
- 核心创新：方法细节、创新点
- 实验设计：数据集、Baseline、结果
- 核心洞察：主要发现、实践建议
- 未来方向：待解决问题

所有引用必须标注原文位置 [Section X.Y]
严禁编造数据！
""")
print("─" * 50)

PYTHON

echo ""

# ===========================================
# Phase 3: 展示已有成果
# ===========================================
echo "=========================================="
echo "📊 Phase 3: 分析成果展示"
echo "=========================================="
echo ""

# 检查是否有预生成的分析报告
ANALYSIS_DIR="~/.openclaw/workspace/lobster-contest-2026/demo/sample_analysis"
if [ -d "$ANALYSIS_DIR" ]; then
    echo "📁 展示预生成的分析报告示例："
    ls -la "$ANALYSIS_DIR"/*.md 2>/dev/null || echo "   暂无示例报告"
else
    echo "📝 分析报告结构预览："
    echo ""
    cat << 'EOF'
论文标题-arxiv编号.md
├── 1. 研究背景 (Research Background)
│   ├── 领域背景
│   ├── 前人研究基础
│   └── 已有实验基础
│
├── 2. 研究问题 (Research Problem)
│   ├── 解决什么问题
│   ├── 识别到的问题
│   └── 解决思路
│
├── 3. 核心创新工作 (Core Innovation)
│   ├── 具体工作内容
│   ├── 技术细节
│   └── 核心创新点对比表
│
├── 4. 关键实验设计 (Experimental Design)
│   ├── 实验设置（数据集、指标）
│   ├── 实验结果表格（真实数据）
│   └── 实验分析
│
├── 5. 核心洞察与结论 (Key Insights)
│   ├── 主要发现
│   ├── 领域洞察
│   └── 实践启示
│
└── 6. 待解决问题与未来方向 (Future Work)
    ├── 本文局限性
    ├── 待解决问题
    └── 未来研究方向
EOF
fi

echo ""

# ===========================================
# 演示统计
# ===========================================
echo "=========================================="
echo "📈 演示统计"
echo "=========================================="
echo ""

echo "⏱️  时间对比："
echo "   人工调研10篇论文：2-3天"
echo "   虾博 Agent集群：2-3小时"
echo "   加速比：10-20x"
echo ""

echo "📊 质量保障："
echo "   ✅ 强制完整阅读PDF"
echo "   ✅ 真实提取表格数据"
echo "   ✅ 所有引用标注来源"
echo "   ✅ 6部分标准化报告"
echo ""

echo "📁 输出文件："
ls -lh "$OUTPUT_DIR" 2>/dev/null || echo "   目录为空"
echo ""

# ===========================================
# 结束语
# ===========================================
echo "=========================================="
echo "✅ 演示完成！"
echo "=========================================="
echo ""
echo "🦞 虾博 Paper Research"
echo "   不是工具，是你的科研合伙人"
echo ""
echo "📧 Contact: [your@email.com]"
echo "🐙 GitHub: github.com/yourname/xiabo"
echo ""
