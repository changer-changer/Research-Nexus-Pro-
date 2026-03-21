# 🦞 虾博 Paper Research - 文件命名规范标准

> **标准化是科研的基础，我们定义了AI时代的学术调研文件规范**

---

## 核心命名规则

### PDF文件命名

```
{论文标题}-{arxiv编号}.pdf
```

**示例**：
```
GelFusion_Enhancing_Robotic_Manipulation-2505.07455.pdf
3D_Diffusion_Policy-2403.03954.pdf
TacDiffusion_Tactile_Diffusion_Policy-2409.11047.pdf
```

**设计原则**：
- ✅ **论文标题在前**：便于人类识别和搜索
- ✅ **arxiv编号在后**：确保唯一性，便于追溯
- ✅ **下划线连接**：文件名安全，跨平台兼容
- ✅ **长度限制**：标题最多80字符，避免过长

---

### 分析报告命名

```
{论文标题}-{arxiv编号}.md
```

**示例**：
```
GelFusion_Enhancing_Robotic_Manipulation-2505.07455.md
3D_Diffusion_Policy-2403.03954.md
```

**设计原则**：
- ✅ 与PDF文件一一对应
- ✅ 仅扩展名不同（.md vs .pdf）
- ✅ 便于关联查找

---

## 完整仓库结构

```
research-topic/                              # 研究主题目录
│
├── README.md                                 # 研究主题说明
├── _metadata.json                            # 论文元数据索引
├── _search_log.json                          # 搜索历史记录
├── _survey.md                                # 自动生成的综述
│
├── papers/                                   # 原始论文目录
│   ├── GelFusion_Enhancing_Robotic_Manipulation-2505.07455.pdf
│   ├── 3D_Diffusion_Policy-2403.03954.pdf
│   ├── TacDiffusion_Tactile_Diffusion_Policy-2409.11047.pdf
│   └── ...
│
├── analysis/                                 # 深度分析报告目录
│   ├── GelFusion_Enhancing_Robotic_Manipulation-2505.07455.md
│   ├── 3D_Diffusion_Policy-2403.03954.md
│   ├── TacDiffusion_Tactile_Diffusion_Policy-2409.11047.md
│   └── ...
│
└── figures/                                  # 提取的图表目录（可选）
    ├── GelFusion_Enhancing_Robotic_Manipulation-2505.07455_fig1.png
    └── ...
```

---

## 命名规范详解

### 1. 论文标题处理

**原始标题**：
```
GelFusion: Enhancing Robotic Manipulation under Visual Constraints via Visuotactile Fusion
```

**处理后**：
```
GelFusion_Enhancing_Robotic_Manipulation_under_Visual_Constraints_via_Visuotactile_Fusion
```

**处理规则**：
1. 移除非法字符：`\ / : * ? " < > |`
2. 空格替换为下划线：`_`
3. 多个空格合并为一个下划线
4. 限制长度：最多80个字符
5. 保留核心语义词

### 2. arxiv编号格式

**支持的格式**：
```
2403.03954        # 基础版本
2403.03954v1      # 带版本号
2403.03954v2
2403.03954v3
```

**去重策略**：
- 系统自动识别版本号
- 保留最新版本（版本号最高）
- 旧版本自动跳过

### 3. 文件关联逻辑

通过文件名关联PDF和分析报告：

```python
def get_analysis_path(pdf_path: str) -> str:
    """
    PDF: GelFusion-2505.07455.pdf
    MD:  GelFusion-2505.07455.md
    """
    base_name = pdf_path.replace('.pdf', '')
    return f"{base_name}.md"
```

---

## 标准化价值

### 对个人的价值

| 场景 | 传统方式 | 标准化后 |
|------|---------|----------|
| 查找论文 | 在Downloads里翻找 | 按文件名搜索 |
| 关联报告 | 不知道哪篇对应哪个笔记 | 文件名一一对应 |
| 整理归档 | 手动重命名 | 自动生成规范名称 |

### 对团队的价值

| 场景 | 传统方式 | 标准化后 |
|------|---------|----------|
| 共享论文 | 发送混乱的文件名 | 规范的统一格式 |
| 知识传承 | 新人不知道文件名含义 | 文件名即内容摘要 |
| 协作写作 | 引用时找不到原文 | 按编号精准定位 |

---

## 实现代码

```python
class FileNamingConvention:
    """文件命名规范实现"""
    
    @staticmethod
    def sanitize_title(title: str) -> str:
        """
        清理论文标题，使其适合作为文件名
        """
        # 移除非法字符
        title = re.sub(r'[\\/*?:"<>|]', '', title)
        # 空格替换为下划线
        title = re.sub(r'\s+', '_', title)
        # 限制长度
        return title[:80]
    
    @staticmethod
    def generate_filename(title: str, arxiv_id: str, ext: str) -> str:
        """
        生成标准文件名
        
        Args:
            title: 论文标题
            arxiv_id: arxiv编号
            ext: 文件扩展名 (pdf/md)
        
        Returns:
            标准文件名: 论文标题-arxiv编号.ext
        """
        safe_title = FileNamingConvention.sanitize_title(title)
        return f"{safe_title}-{arxiv_id}.{ext}"
    
    @staticmethod
    def parse_filename(filename: str) -> dict:
        """
        解析标准文件名
        
        Returns:
            {
                'title': '论文标题',
                'arxiv_id': 'arxiv编号',
                'ext': '扩展名'
            }
        """
        # 移除扩展名
        base = filename.rsplit('.', 1)[0]
        ext = filename.rsplit('.', 1)[1]
        
        # 分离标题和arxiv编号
        # 假设arxiv编号格式为: 4位数字.5位数字 或带版本号
        match = re.match(r'(.+)-(\d{4}\.\d{5}(?:v\d+)?)$', base)
        if match:
            return {
                'title': match.group(1).replace('_', ' '),
                'arxiv_id': match.group(2),
                'ext': ext
            }
        return None


# 使用示例
naming = FileNamingConvention()

# 生成文件名
pdf_name = naming.generate_filename(
    "GelFusion: Enhancing Robotic Manipulation",
    "2505.07455",
    "pdf"
)
# 结果: GelFusion_Enhancing_Robotic_Manipulation-2505.07455.pdf

# 解析文件名
info = naming.parse_filename("GelFusion_Enhancing_Robotic_Manipulation-2505.07455.pdf")
# 结果: {'title': 'GelFusion Enhancing Robotic Manipulation', 
#        'arxiv_id': '2505.07455', 
#        'ext': 'pdf'}
```

---

## 竞品对比

| 工具 | 文件命名 | 是否规范 | 可读性 | 可追溯 |
|------|---------|---------|--------|--------|
| **Zotero** | 自动生成 | ⚠️ 不直观 | ⭐⭐ | ⭐⭐⭐ |
| **Mendeley** | 用户定义 | ⚠️ 不统一 | ⭐⭐ | ⭐⭐ |
| **人工下载** | 随机命名 | ❌ 混乱 | ⭐ | ⭐ |
| **虾博** | **标题-编号** | ✅ **标准化** | ⭐⭐⭐ | ⭐⭐⭐ |

**核心差异**：
- 竞品：方便软件管理，不方便人类阅读
- 虾博：兼顾机器管理和人类阅读

---

## 总结

> **文件名即信息**
> 
> 虾博的文件命名规范，让每一篇论文都有唯一的、可读的、可追溯的身份标识。
> 
> 这是科研数字化的基础，也是知识管理的起点。

---

*文档版本: v1.0*  
*规范制定: 虾博团队*  
*适用范围: 虾博 Paper Research 系统*
