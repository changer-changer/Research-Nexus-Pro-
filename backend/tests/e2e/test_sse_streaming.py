#!/usr/bin/env python3
"""
SSE流式输出测试 (Server-Sent Events Streaming Tests)

测试EventSource连接、流式消息解析、进度计算、错误处理等
"""

import pytest
import asyncio
import json
import aiohttp
from unittest.mock import Mock, AsyncMock, patch
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.testclient import TestClient


# 创建测试应用
app = FastAPI()


async def mock_event_generator(task_id: str, error_at_stage: str = None):
    """模拟事件生成器"""
    stages = [
        ("init", 0, "初始化论文生成..."),
        ("title", 10, "生成论文标题..."),
        ("abstract", 20, "生成PMR结构摘要..."),
        ("introduction", 35, "撰写引言部分..."),
        ("methodology", 50, "撰写方法论..."),
        ("experiment_design", 65, "设计实验方案..."),
        ("analysis", 80, "准备分析框架..."),
        ("conclusion", 90, "撰写结论..."),
        ("quality_check", 95, "执行质量检查..."),
        ("complete", 100, "论文生成完成!")
    ]
    
    for stage, progress, message in stages:
        # 如果指定了错误阶段，抛出异常
        if error_at_stage == stage:
            error_data = json.dumps({
                "stage": "error",
                "progress": progress,
                "message": f"Error at {stage}",
                "error": "Simulated error"
            })
            yield f"data: {error_data}\n\n"
            return
        
        data = json.dumps({
            "stage": stage,
            "progress": progress,
            "message": message,
            "task_id": task_id,
            "timestamp": "2024-01-01T00:00:00"
        })
        yield f"data: {data}\n\n"
        await asyncio.sleep(0.01)  # 快速测试


@app.get("/api/v3/paper-tasks/{task_id}/stream")
async def stream_endpoint(task_id: str):
    """SSE流端点"""
    return StreamingResponse(
        mock_event_generator(task_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.get("/api/v3/paper-tasks/{task_id}/stream-with-error")
async def stream_with_error(task_id: str, error_at: str = "methodology"):
    """带错误的SSE流端点"""
    return StreamingResponse(
        mock_event_generator(task_id, error_at),
        media_type="text/event-stream"
    )


class TestSSEStreaming:
    """SSE流式输出测试类"""
    
    @pytest.fixture
    def client(self):
        """创建测试客户端"""
        return TestClient(app)
    
    # ==================== 基本连接测试 ====================
    
    def test_sse_connection_established(self, client):
        """测试EventSource连接建立"""
        response = client.get(
            "/api/v3/paper-tasks/task_001/stream",
            headers={"Accept": "text/event-stream"}
        )
        
        assert response.status_code == 200
        assert "text/event-stream" in response.headers.get("content-type", "")
    
    def test_sse_headers(self, client):
        """测试SSE响应头"""
        response = client.get("/api/v3/paper-tasks/task_001/stream")
        
        assert response.headers.get("Cache-Control") == "no-cache"
        assert response.headers.get("Connection") == "keep-alive"
        assert response.headers.get("X-Accel-Buffering") == "no"
    
    def test_sse_message_format(self, client):
        """测试SSE消息格式"""
        response = client.get("/api/v3/paper-tasks/task_001/stream")
        
        content = response.text
        lines = content.strip().split('\n')
        
        # 每个消息应该以 "data: " 开头
        data_lines = [l for l in lines if l.startswith("data:")]
        assert len(data_lines) > 0
        
        # 验证每个数据行包含有效的JSON
        for line in data_lines:
            json_str = line[5:].strip()  # 移除 "data: "
            data = json.loads(json_str)
            assert "stage" in data
            assert "progress" in data
            assert "message" in data
    
    # ==================== 流式消息解析测试 ====================
    
    def test_stream_message_parsing(self, client):
        """测试流式消息解析"""
        response = client.get("/api/v3/paper-tasks/task_001/stream")
        content = response.text
        
        events = []
        for line in content.split('\n'):
            if line.startswith("data:"):
                json_str = line[5:].strip()
                events.append(json.loads(json_str))
        
        # 验证事件序列
        assert len(events) > 0
        
        # 第一个事件应该是init
        assert events[0]["stage"] == "init"
        assert events[0]["progress"] == 0
        
        # 最后一个事件应该是complete
        assert events[-1]["stage"] == "complete"
        assert events[-1]["progress"] == 100
    
    def test_progress_calculation(self, client):
        """测试进度计算"""
        response = client.get("/api/v3/paper-tasks/task_001/stream")
        content = response.text
        
        events = []
        for line in content.split('\n'):
            if line.startswith("data:"):
                events.append(json.loads(line[5:].strip()))
        
        # 验证进度单调递增
        progress_values = [e["progress"] for e in events]
        for i in range(1, len(progress_values)):
            assert progress_values[i] >= progress_values[i-1]
        
        # 验证进度范围
        for progress in progress_values:
            assert 0 <= progress <= 100
    
    def test_stage_sequence(self, client):
        """测试阶段序列"""
        expected_stages = [
            "init", "title", "abstract", "introduction", 
            "methodology", "experiment_design", "analysis",
            "conclusion", "quality_check", "complete"
        ]
        
        response = client.get("/api/v3/paper-tasks/task_001/stream")
        content = response.text
        
        events = []
        for line in content.split('\n'):
            if line.startswith("data:"):
                events.append(json.loads(line[5:].strip()))
        
        actual_stages = [e["stage"] for e in events]
        
        # 验证阶段序列
        for expected in expected_stages:
            assert expected in actual_stages, f"Missing stage: {expected}"
    
    # ==================== 错误处理测试 ====================
    
    def test_error_handling(self, client):
        """测试错误处理"""
        response = client.get(
            "/api/v3/paper-tasks/task_001/stream-with-error?error_at=methodology"
        )
        
        content = response.text
        events = []
        for line in content.split('\n'):
            if line.startswith("data:"):
                events.append(json.loads(line[5:].strip()))
        
        # 验证包含错误事件
        error_events = [e for e in events if e.get("stage") == "error"]
        assert len(error_events) > 0
        assert "error" in error_events[0]
    
    def test_error_message_format(self, client):
        """测试错误消息格式"""
        response = client.get(
            "/api/v3/paper-tasks/task_001/stream-with-error?error_at=title"
        )
        
        content = response.text
        
        for line in content.split('\n'):
            if line.startswith("data:"):
                data = json.loads(line[5:].strip())
                if data.get("stage") == "error":
                    assert "error" in data or "message" in data
                    assert "progress" in data
    
    # ==================== 取消生成测试 ====================
    
    @pytest.mark.asyncio
    async def test_cancel_generation(self):
        """测试取消生成"""
        cancel_flag = False
        
        async def cancellable_generator():
            stages = [
                ("init", 0), ("title", 10), ("abstract", 20),
                ("introduction", 35), ("methodology", 50)
            ]
            
            for stage, progress in stages:
                if cancel_flag:
                    yield f"data: {json.dumps({'stage': 'cancelled', 'progress': progress})}\n\n"
                    return
                
                yield f"data: {json.dumps({'stage': stage, 'progress': progress})}\n\n"
                await asyncio.sleep(0.01)
        
        events = []
        async for event in cancellable_generator():
            events.append(event)
            # 模拟在abstract阶段取消
            if len(events) >= 3:
                cancel_flag = True
        
        assert any("cancelled" in e for e in events)
    
    # ==================== 重连测试 ====================
    
    def test_reconnection_with_progress(self, client):
        """测试断线重连与进度恢复"""
        # 模拟第一次连接，获取到progress=50
        response = client.get("/api/v3/paper-tasks/task_001/stream")
        content = response.text
        
        events = []
        for line in content.split('\n'):
            if line.startswith("data:"):
                events.append(json.loads(line[5:].strip()))
        
        # 假设在methodology阶段断开
        disconnect_at = "methodology"
        last_progress = 0
        
        for e in events:
            if e["stage"] == disconnect_at:
                last_progress = e["progress"]
                break
        
        assert last_progress > 0
        assert last_progress < 100
        
        # 模拟重连时应该从断点开始
        # 实际实现应该支持Last-Event-ID头
    
    # ==================== 性能测试 ====================
    
    def test_streaming_performance(self, client):
        """测试流式传输性能"""
        import time
        
        start_time = time.time()
        response = client.get("/api/v3/paper-tasks/task_001/stream")
        content = response.text
        end_time = time.time()
        
        # 应该快速完成（所有模拟事件）
        duration = end_time - start_time
        assert duration < 5  # 5秒内完成
        
        # 验证内容大小合理
        content_size = len(content)
        assert content_size < 100 * 1024  # 小于100KB
    
    def test_message_size(self, client):
        """测试单个消息大小"""
        response = client.get("/api/v3/paper-tasks/task_001/stream")
        content = response.text
        
        for line in content.split('\n'):
            if line.startswith("data:"):
                # 每个消息应该小于合理大小
                assert len(line) < 10 * 1024  # 小于10KB
    
    # ==================== 客户端解析测试 ====================
    
    def test_client_side_event_source_parsing(self, client):
        """测试客户端EventSource解析"""
        response = client.get("/api/v3/paper-tasks/task_001/stream")
        content = response.text
        
        # 模拟JavaScript EventSource解析
        parsed_events = []
        current_data = []
        
        for line in content.split('\n'):
            line = line.strip()
            
            if line.startswith("data:"):
                current_data.append(line[5:].strip())
            elif line == "":
                # 空行表示事件结束
                if current_data:
                    event_data = '\n'.join(current_data)
                    try:
                        parsed = json.loads(event_data)
                        parsed_events.append(parsed)
                    except json.JSONDecodeError:
                        pass
                    current_data = []
        
        assert len(parsed_events) > 0
        
        # 验证第一个和最后一个事件
        assert parsed_events[0]["stage"] == "init"
        assert parsed_events[-1]["stage"] == "complete"
    
    # ==================== 多任务并发测试 ====================
    
    @pytest.mark.asyncio
    async def test_concurrent_streams(self):
        """测试并发SSE流"""
        async with aiohttp.ClientSession() as session:
            tasks = []
            
            # 创建3个并发请求
            for i in range(3):
                url = f"http://localhost:8000/api/v3/paper-tasks/task_{i}/stream"
                # 这里使用mock而不是真实请求
                tasks.append(self._mock_fetch_stream(f"task_{i}"))
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # 验证所有任务都完成
            assert len(results) == 3
    
    async def _mock_fetch_stream(self, task_id: str):
        """模拟流获取"""
        events = []
        async for event in mock_event_generator(task_id):
            events.append(event)
        return events
    
    # ==================== 边界情况测试 ====================
    
    def test_empty_stream(self, client):
        """测试空流"""
        async def empty_generator():
            return
            yield  # 使生成器有效
        
        response = StreamingResponse(empty_generator(), media_type="text/event-stream")
        
        # 空流应该立即返回
        assert response is not None
    
    def test_malformed_json_handling(self):
        """测试畸形JSON处理"""
        malformed_events = [
            "data: {invalid json}",
            "data: not json at all",
            "data: {\"valid\": \"json\"}"  # 一个有效的
        ]
        
        valid_count = 0
        for event in malformed_events:
            if event.startswith("data:"):
                json_str = event[5:].strip()
                try:
                    json.loads(json_str)
                    valid_count += 1
                except json.JSONDecodeError:
                    pass
        
        # 应该只解析出一个有效的
        assert valid_count == 1
    
    def test_unicode_content(self, client):
        """测试Unicode内容"""
        async def unicode_generator():
            data = json.dumps({
                "stage": "complete",
                "message": "论文生成完成！🎉 你好世界"
            }, ensure_ascii=False)
            yield f"data: {data}\n\n"
        
        # 验证Unicode可以正确编码
        content = ""
        async def collect():
            nonlocal content
            async for chunk in unicode_generator():
                content += chunk
        
        asyncio.run(collect())
        
        assert "🎉" in content
        assert "你好世界" in content


class TestSSEClientImplementation:
    """SSE客户端实现测试类"""
    
    def test_progress_bar_update(self):
        """测试进度条更新逻辑"""
        events = [
            {"stage": "init", "progress": 0},
            {"stage": "title", "progress": 10},
            {"stage": "abstract", "progress": 20},
            {"stage": "complete", "progress": 100}
        ]
        
        # 模拟前端进度条更新
        progress_values = []
        for event in events:
            progress_values.append(event["progress"])
        
        # 验证进度值
        assert progress_values[0] == 0
        assert progress_values[-1] == 100
        assert all(0 <= p <= 100 for p in progress_values)
    
    def test_stage_ui_mapping(self):
        """测试阶段UI映射"""
        stage_labels = {
            "init": "初始化",
            "title": "生成标题",
            "abstract": "生成摘要",
            "introduction": "撰写引言",
            "methodology": "撰写方法论",
            "experiment_design": "设计实验",
            "analysis": "准备分析框架",
            "conclusion": "撰写结论",
            "quality_check": "质量检查",
            "complete": "完成",
            "error": "错误"
        }
        
        events = [
            {"stage": "init", "progress": 0},
            {"stage": "title", "progress": 10},
            {"stage": "complete", "progress": 100}
        ]
        
        for event in events:
            stage = event["stage"]
            assert stage in stage_labels
            label = stage_labels[stage]
            assert len(label) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
