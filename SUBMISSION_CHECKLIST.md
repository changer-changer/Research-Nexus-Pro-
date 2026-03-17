# 🦞 Lobster Competition 2026 - 提交清单

## ✅ 已完成

### 1. 项目说明书 (10页内)
- [x] **文件**: `docs/PROJECT_MANUAL.md`
- [x] **内容**: 产品概述、系统架构、双模块详解、使用场景、技术亮点
- [x] **字数**: ~5000字

### 2. 代码仓库
- [x] **GitHub**: https://github.com/yourusername/research-nexus-pro
- [x] **Module 1**: `paper-research-agent/` - 论文调研Agent
- [x] **Module 2**: `research-nexus/` - 可视化系统
- [x] **README**: 快速开始指南

### 3. 演示材料
- [x] **技术白皮书**: `docs/TECHNICAL_WHITEPAPER.md`
- [x] **演示脚本**: `docs/PRESENTATION_SCRIPT.md`
- [x] **产品展示**: `docs/PRODUCT_SHOWCASE.md`

### 4. 截图/录屏
- [ ] **项目海报** (16:9 横版，1920×1080)
- [ ] **演示视频** (3-5分钟)

## 📝 待填写

### 项目描述
```
你的虾能干什么？解决了什么问题？效果如何？

Research-Nexus Pro 是一个AI原生的学术探索系统：

【解决问题】
1. 信息过载: 读100篇论文耗时2天 → Agent自动提炼图谱
2. 认知局限: 线性阅读难见全貌 → 三维正交可视化
3. 决策困难: 难以识别Research Gap → 自动高亮蓝海机会

【核心能力】
• PaperResearchAgent: 4级深度搜索 + 并行分析 + 6段式报告
• ResearchNexus: 问题演化树 + 方法瞄准图 + 领域泳道时间线

【效果】
• 10篇论文处理时间: 2天 → 30分钟 (提升96x)
• Research Gap识别: 依赖经验 → 自动发现
• 知识结构: 零散笔记 → 可视化图谱

【独创性】
- 多Agent协作工作流
- 正交可视化（三视图联动）
- 完全数据驱动（JSON即知识库）
```

### 外部链接

| 项目 | 链接 | 状态 |
|------|------|------|
| 项目说明书 | [飞书文档/Google Drive] | 待上传 |
| 项目海报 | [图片链接] | 待制作 |
| 演示视频 | [YouTube/Bilibili] | 待录制 |
| 代码仓库 | [GitHub] | ✅ 已准备 |

## 🚀 提交流程

### 步骤1: 上传文档
- [ ] 将 `PROJECT_MANUAL.md` 转为PDF
- [ ] 上传到飞书/Google Drive
- [ ] 设置权限为"任何人可查看"

### 步骤2: 制作海报
- [ ] 设计16:9海报 (1920×1080)
- [ ] 包含: Logo + 一句话介绍 + 核心功能图 + 二维码
- [ ] 上传并获取图片链接

### 步骤3: 录制视频
- [ ] 3-5分钟演示视频
- [ ] 包含: 问题引入 + 产品演示 + 效果展示
- [ ] 上传到YouTube/Bilibili

### 步骤4: 提交表单
- [ ] 填写项目描述
- [ ] 粘贴三个链接
- [ ] 确认开放访问权限

## 📦 打包命令

```bash
cd ~/.openclaw/workspace/lobster-contest-2026

# 清理不必要的文件
find . -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true
find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
find . -name "*.pyc" -delete 2>/dev/null || true

# 打包
zip -r research-nexus-pro-lobster2026.zip \
  paper-research-agent/ \
  research-nexus/ \
  docs/ \
  README.md \
  -x "*.sqlite" -x "*.log" -x "*.pdf" -x "output_data/*"

# 检查大小
ls -lh research-nexus-pro-lobster2026.zip
```

## 🎯 提交前检查

- [ ] 项目说明书 ≤ 10页
- [ ] 所有链接可公开访问
- [ ] 代码可正常运行
- [ ] 视频 ≤ 5分钟
- [ ] 海报16:9比例

## 📅 截止时间

**2026年3月22日 23:59 (北京时间)**

---

*最后更新: 2026-03-15*
*提交人: Walker*
