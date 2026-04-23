# 端到端测试套件 (E2E Test Suite)

Research Nexus Pro - 论文生成系统端到端测试

## 测试文件结构

```
backend/tests/e2e/
├── __init__.py                     # 测试包初始化
├── test_database_integration.py    # 数据库集成测试 (CRUD, 约束, 级联删除)
├── test_api_endpoints.py           # API端点测试 (REST API)
├── test_paper_generation_engine.py # 论文生成引擎测试
├── test_feasibility_evaluator.py   # 实验可行性评估测试
├── test_sse_streaming.py          # SSE流式输出测试
├── e2e_test.py                    # 完整端到端测试脚本
├── optimize_database.py           # 数据库优化脚本
├── run_e2e_tests.sh               # 测试运行脚本
└── README.md                      # 本文件
```

## 测试内容

### 1. 数据库集成测试 (test_database_integration.py)

测试所有数据库表的CRUD操作:
- `innovation_favorites` - 创新点收藏表
- `paper_generation_tasks` - 论文生成任务表
- `experiment_slots` - 实验占位符表
- `paper_versions` - 论文版本表

包含测试:
- ✅ 创建、读取、更新、删除操作
- ✅ 外键约束验证
- ✅ 级联删除
- ✅ 唯一约束
- ✅ 索引性能

### 2. API端点测试 (test_api_endpoints.py)

测试所有API端点:
- ✅ POST /api/v3/favorites - 添加收藏
- ✅ GET /api/v3/favorites - 获取收藏列表
- ✅ DELETE /api/v3/favorites/{id} - 删除收藏
- ✅ POST /api/v3/paper-tasks - 创建论文生成任务
- ✅ GET /api/v3/paper-tasks/{id} - 获取任务详情
- ✅ GET /api/v3/paper-tasks/{id}/stream - SSE流式输出
- ✅ POST /api/v3/paper-tasks/{id}/experiments/{slot_id} - 提交实验数据
- ✅ POST /api/v3/paper-tasks/{id}/continue - 续写论文
- ✅ GET /api/v3/papers - 论文仓库列表
- ✅ GET /api/v3/papers/{id}/preview - 论文预览
- ✅ GET /api/v3/papers/{id}/download - 下载论文

### 3. 论文生成引擎测试 (test_paper_generation_engine.py)

测试PaperGenerationEngine完整流程:
- ✅ 各阶段生成 (title, abstract, introduction...)
- ✅ 实验设计生成和占位符标记
- ✅ PaperAssembler 组装 Markdown
- ✅ LaTeX 转换
- ✅ QualityChecker 质量验证
- ✅ CompletenessChecker 完整性检查
- ✅ 流式生成 (stream_generate)

### 4. 实验可行性评估测试 (test_feasibility_evaluator.py)

测试ExperimentFeasibilityEvaluator:
- ✅ 评估维度分数 (0-100范围)
- ✅ 风险等级分类 (low/medium/high/critical)
- ✅ 建议生成
- ✅ 资源缺口检测
- ✅ 成功率估算
- ✅ 快速检查 (quick_check)

### 5. SSE流式输出测试 (test_sse_streaming.py)

测试SSE流式输出:
- ✅ EventSource连接建立
- ✅ 流式消息格式验证
- ✅ 进度计算
- ✅ 错误处理
- ✅ 取消生成
- ✅ 断线重连

### 6. 端到端测试脚本 (e2e_test.py)

完整工作流测试:
1. 收藏创新点
2. 创建论文生成任务
3. 等待生成完成 (SSE流式监听)
4. 查看生成的论文
5. 填写实验数据
6. 续写论文
7. 下载最终论文

## 运行测试

### 快速测试

```bash
# 运行所有单元测试
cd backend/tests/e2e
./run_e2e_tests.sh --quick

# 或使用Python直接运行
python -m pytest test_database_integration.py test_feasibility_evaluator.py -v
```

### 完整测试

```bash
# 运行完整测试套件（包括需要服务器的端到端测试）
./run_e2e_tests.sh --full
```

### 单独运行特定测试

```bash
# 数据库集成测试
python -m pytest test_database_integration.py -v

# API端点测试
python -m pytest test_api_endpoints.py -v

# 论文生成引擎测试
python -m pytest test_paper_generation_engine.py -v

# 可行性评估测试
python -m pytest test_feasibility_evaluator.py -v

# SSE流式测试
python -m pytest test_sse_streaming.py -v
```

### 端到端测试（需要后端服务器）

```bash
# 1. 先启动后端服务器
cd backend
python -m app.api.main

# 2. 在另一个终端运行端到端测试
cd backend/tests/e2e
python e2e_test.py --verbose

# 或指定服务器地址
python e2e_test.py --host http://localhost:8000
```

## 数据库优化

### 运行优化脚本

```bash
cd backend/tests/e2e
python optimize_database.py

# 或
./run_e2e_tests.sh --optimize
```

### 优化内容

- ✅ 添加推荐索引
- ✅ 启用WAL模式
- ✅ 设置缓存大小
- ✅ 设置同步模式
- ✅ 运行VACUUM优化

### 创建的索引

| 索引名 | 表 | 列 | 用途 |
|--------|-----|-----|------|
| idx_paper_tasks_user_id | paper_generation_tasks | user_id | 加速按用户查询任务 |
| idx_paper_tasks_status | paper_generation_tasks | status | 加速按状态查询任务 |
| idx_favorites_user_id | innovation_favorites | user_id | 加速查询用户收藏 |
| idx_experiment_slots_task_id | experiment_slots | task_id | 加速查询实验槽 |
| idx_paper_versions_task_id | paper_versions | task_id | 加速查询版本 |

## 测试覆盖率

| 模块 | 覆盖率 |
|------|--------|
| 数据库操作 | CRUD + 约束 + 索引 |
| API端点 | 11个REST端点 |
| 论文生成引擎 | 8个阶段 + 验证器 |
| 可行性评估 | 4个风险等级 + 评分算法 |
| SSE流式 | 连接 + 消息 + 错误处理 |

## Bug修复清单

测试过程中发现并修复的潜在问题:

1. ✅ 论文生成超时处理 - 通过asyncio超时控制
2. ✅ SSE连接断开重连 - 支持Last-Event-ID
3. ✅ 实验数据JSON序列化 - 使用json.dumps/loads
4. ✅ Markdown特殊字符转义 - PaperAssembler处理
5. ✅ LaTeX特殊字符转义 - to_latex方法处理
6. ✅ 数据库连接池 - 使用连接上下文管理器

## 性能优化

### 数据库优化
- 批量查询替代多次单条查询
- 索引加速查询
- WAL模式提高并发性能

### 论文生成优化
- 流式响应减少内存占用
- 异步处理避免阻塞
- 缓存热点数据

### 前端优化建议
- Markdown渲染虚拟滚动
- 图片懒加载
- SSE连接复用

## 持续集成

建议在CI/CD流程中添加:

```yaml
# .github/workflows/test.yml
- name: Run E2E Tests
  run: |
    cd backend/tests/e2e
    ./run_e2e_tests.sh --quick
```

## 注意事项

1. 运行端到端测试前确保后端服务器已启动
2. 数据库优化脚本会修改生产数据库，请在维护窗口运行
3. 测试使用临时数据库，不会影响生产数据
4. SSE测试可能需要调整超时时间以适应慢速环境

---

**测试套件版本**: 1.0
**最后更新**: 2024-04-15
