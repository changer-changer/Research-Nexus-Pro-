#!/usr/bin/env python3
"""
端到端测试脚本 (End-to-End Test Script)
Research Nexus Pro - 论文生成系统

完整流程:
1. 收藏创新点
2. 创建论文生成任务
3. 等待生成完成 (SSE)
4. 查看生成的论文
5. 填写实验数据
6. 续写论文
7. 下载最终论文

运行: python e2e_test.py [--host HOST] [--verbose]
"""

import asyncio
import argparse
import json
import sys
import time
from typing import Optional
from dataclasses import dataclass
from datetime import datetime

try:
    import aiohttp
    import requests
except ImportError:
    print("请先安装依赖: pip install aiohttp requests")
    sys.exit(1)


# 测试配置
DEFAULT_HOST = "http://localhost:8000"
TEST_USER_ID = "e2e-test-user-001"
TEST_INNOVATION_ID = "innovation-e2e-test-001"


@dataclass
class E2ETestResult:
    """测试结果"""
    step: int
    name: str
    passed: bool
    duration: float
    message: str = ""
    data: dict = None


class E2ETestRunner:
    """端到端测试运行器"""
    
    def __init__(self, base_url: str, verbose: bool = False):
        self.base_url = base_url
        self.verbose = verbose
        self.results: list[E2ETestResult] = []
        self.favorite_id: Optional[str] = None
        self.task_id: Optional[str] = None
        self.slots: list = []
    
    def log(self, message: str, level: str = "info"):
        """输出日志"""
        if self.verbose or level in ["error", "success"]:
            timestamp = datetime.now().strftime("%H:%M:%S")
            icon = {"info": "ℹ️", "success": "✓", "error": "✗", "warning": "⚠️"}.get(level, "ℹ️")
            print(f"[{timestamp}] {icon} {message}")
    
    async def run_all(self) -> bool:
        """运行所有测试步骤"""
        steps = [
            ("步骤1: 收藏创新点", self.step1_create_favorite),
            ("步骤2: 创建论文生成任务", self.step2_create_task),
            ("步骤3: SSE流式监听生成进度", self.step3_stream_progress),
            ("步骤4: 获取生成的论文", self.step4_get_paper),
            ("步骤5: 查看实验占位符", self.step5_get_experiments),
            ("步骤6: 填写实验数据", self.step6_submit_experiment_data),
            ("步骤7: 续写论文", self.step7_continue_paper),
            ("步骤8: 下载最终论文", self.step8_download_paper),
        ]
        
        print("\n" + "="*60)
        print("Research Nexus Pro - 端到端测试")
        print("="*60 + "\n")
        
        all_passed = True
        for i, (name, step_func) in enumerate(steps, 1):
            start_time = time.time()
            try:
                passed = await step_func()
                duration = time.time() - start_time
                
                result = E2ETestResult(
                    step=i,
                    name=name,
                    passed=passed,
                    duration=duration
                )
                
                if passed:
                    self.log(f"{name} - 通过 ({duration:.2f}s)", "success")
                else:
                    self.log(f"{name} - 失败 ({duration:.2f}s)", "error")
                    all_passed = False
                    
            except Exception as e:
                duration = time.time() - start_time
                self.log(f"{name} - 异常: {e} ({duration:.2f}s)", "error")
                all_passed = False
                result = E2ETestResult(
                    step=i,
                    name=name,
                    passed=False,
                    duration=duration,
                    message=str(e)
                )
            
            self.results.append(result)
        
        return all_passed
    
    async def step1_create_favorite(self) -> bool:
        """步骤1: 收藏创新点"""
        self.log("创建收藏...")
        
        async with aiohttp.ClientSession() as session:
            url = f"{self.base_url}/api/v3/favorites"
            payload = {
                "innovation_id": TEST_INNOVATION_ID,
                "user_id": TEST_USER_ID,
                "notes": "端到端测试创新点"
            }
            
            async with session.post(url, json=payload) as resp:
                if resp.status == 201 or resp.status == 200:
                    data = await resp.json()
                    self.favorite_id = data.get("id")
                    self.log(f"收藏创建成功 (ID: {self.favorite_id})", "success")
                    return True
                else:
                    text = await resp.text()
                    self.log(f"创建失败: {resp.status} - {text}", "error")
                    return False
    
    async def step2_create_task(self) -> bool:
        """步骤2: 创建论文生成任务"""
        self.log("创建论文生成任务...")
        
        async with aiohttp.ClientSession() as session:
            url = f"{self.base_url}/api/v3/paper-tasks"
            payload = {
                "innovationId": TEST_INNOVATION_ID,
                "targetVenue": "NeurIPS",
                "user_id": TEST_USER_ID
            }
            
            async with session.post(url, json=payload) as resp:
                if resp.status == 201 or resp.status == 200:
                    data = await resp.json()
                    self.task_id = data.get("id")
                    stream_url = data.get("stream_url", "")
                    self.log(f"任务创建成功 (ID: {self.task_id})", "success")
                    self.log(f"SSE流地址: {stream_url}")
                    return True
                else:
                    text = await resp.text()
                    self.log(f"创建失败: {resp.status} - {text}", "error")
                    return False
    
    async def step3_stream_progress(self) -> bool:
        """步骤3: SSE流式监听生成进度"""
        if not self.task_id:
            self.log("任务ID不存在，跳过此步骤", "warning")
            return False
        
        self.log("连接SSE流，监听生成进度...")
        
        async with aiohttp.ClientSession() as session:
            url = f"{self.base_url}/api/v3/paper-tasks/{self.task_id}/stream"
            
            try:
                async with session.get(url) as resp:
                    if resp.status != 200:
                        text = await resp.text()
                        self.log(f"SSE连接失败: {resp.status} - {text}", "error")
                        return False
                    
                    self.log("SSE连接成功，接收事件...")
                    last_progress = 0
                    
                    async for line in resp.content:
                        line = line.decode('utf-8').strip()
                        
                        if line.startswith("data:"):
                            try:
                                data = json.loads(line[5:])
                                stage = data.get("stage", "")
                                progress = data.get("progress", 0)
                                message = data.get("message", "")
                                
                                # 只在进度变化超过10%时输出，减少日志量
                                if progress - last_progress >= 10 or stage in ["complete", "error"]:
                                    self.log(f"  进度: {progress}% - {message}")
                                    last_progress = progress
                                
                                if stage == "complete":
                                    self.log("论文生成完成!", "success")
                                    return True
                                elif stage == "error":
                                    error_msg = data.get("error", "Unknown error")
                                    self.log(f"生成错误: {error_msg}", "error")
                                    return False
                                    
                            except json.JSONDecodeError:
                                continue
                    
                    # 流结束但没有收到complete事件
                    self.log("SSE流意外结束", "warning")
                    return False
                    
            except Exception as e:
                self.log(f"SSE连接异常: {e}", "error")
                return False
    
    async def step4_get_paper(self) -> bool:
        """步骤4: 获取生成的论文"""
        if not self.task_id:
            self.log("任务ID不存在，跳过此步骤", "warning")
            return False
        
        self.log("获取论文详情...")
        
        async with aiohttp.ClientSession() as session:
            url = f"{self.base_url}/api/v3/paper-tasks/{self.task_id}"
            
            async with session.get(url) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    paper_path = data.get("output_path", "")
                    status = data.get("status", "")
                    self.log(f"论文状态: {status}")
                    self.log(f"论文路径: {paper_path or 'N/A'}")
                    return True
                else:
                    text = await resp.text()
                    self.log(f"获取失败: {resp.status} - {text}", "error")
                    return False
    
    async def step5_get_experiments(self) -> bool:
        """步骤5: 查看实验占位符"""
        if not self.task_id:
            self.log("任务ID不存在，跳过此步骤", "warning")
            return False
        
        self.log("获取实验占位符...")
        
        async with aiohttp.ClientSession() as session:
            url = f"{self.base_url}/api/v3/paper-tasks/{self.task_id}/experiments"
            
            async with session.get(url) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    self.slots = data.get("slots", [])
                    self.log(f"发现 {len(self.slots)} 个实验占位符", "success")
                    
                    for slot in self.slots:
                        slot_id = slot.get("slot_id", "N/A")
                        slot_type = slot.get("type", "N/A")
                        self.log(f"  - {slot_id} ({slot_type})")
                    
                    return len(self.slots) > 0
                else:
                    text = await resp.text()
                    self.log(f"获取失败: {resp.status} - {text}", "error")
                    return False
    
    async def step6_submit_experiment_data(self) -> bool:
        """步骤6: 填写实验数据"""
        if not self.task_id or not self.slots:
            self.log("任务ID或实验槽不存在，跳过此步骤", "warning")
            return False
        
        # 使用第一个实验槽
        slot = self.slots[0]
        slot_id = slot.get("slot_id")
        
        self.log(f"提交实验数据到 {slot_id}...")
        
        async with aiohttp.ClientSession() as session:
            url = f"{self.base_url}/api/v3/paper-tasks/{self.task_id}/experiments/{slot_id}"
            payload = {
                "actual_data": {
                    "accuracy": 0.95,
                    "f1_score": 0.94,
                    "precision": 0.93,
                    "recall": 0.96,
                    "auc": 0.97
                },
                "observations": "实验结果超出预期，在所有指标上都优于基线方法"
            }
            
            async with session.post(url, json=payload) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    if data.get("success"):
                        self.log("实验数据提交成功", "success")
                        return True
                    else:
                        self.log("提交失败: 响应标记为不成功", "error")
                        return False
                else:
                    text = await resp.text()
                    self.log(f"提交失败: {resp.status} - {text}", "error")
                    return False
    
    async def step7_continue_paper(self) -> bool:
        """步骤7: 续写论文"""
        if not self.task_id:
            self.log("任务ID不存在，跳过此步骤", "warning")
            return False
        
        self.log("触发论文续写...")
        
        async with aiohttp.ClientSession() as session:
            url = f"{self.base_url}/api/v3/paper-tasks/{self.task_id}/continue"
            
            async with session.post(url) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    if data.get("success"):
                        self.log(f"续写已启动: {data.get('message', '')}", "success")
                        return True
                    else:
                        self.log("续写失败: 响应标记为不成功", "error")
                        return False
                else:
                    text = await resp.text()
                    self.log(f"续写失败: {resp.status} - {text}", "error")
                    return False
    
    async def step8_download_paper(self) -> bool:
        """步骤8: 下载最终论文"""
        if not self.task_id:
            self.log("任务ID不存在，跳过此步骤", "warning")
            return False
        
        formats = ["md", "tex"]
        all_success = True
        
        for fmt in formats:
            self.log(f"下载论文 ({fmt}格式)...")
            
            async with aiohttp.ClientSession() as session:
                url = f"{self.base_url}/api/v3/papers/{self.task_id}/download?format={fmt}"
                
                async with session.get(url) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        content = data.get("content", "")
                        filename = data.get("filename", "")
                        
                        if content:
                            self.log(f"  文件名: {filename}")
                            self.log(f"  内容长度: {len(content)} 字符", "success")
                        else:
                            self.log("  内容为空", "warning")
                            all_success = False
                    else:
                        text = await resp.text()
                        self.log(f"  下载失败: {resp.status} - {text}", "error")
                        all_success = False
        
        return all_success
    
    def print_summary(self):
        """打印测试摘要"""
        print("\n" + "="*60)
        print("测试摘要")
        print("="*60)
        
        passed = sum(1 for r in self.results if r.passed)
        failed = len(self.results) - passed
        total_time = sum(r.duration for r in self.results)
        
        for result in self.results:
            status = "✓ 通过" if result.passed else "✗ 失败"
            print(f"  {result.step}. {result.name}: {status} ({result.duration:.2f}s)")
        
        print("-"*60)
        print(f"总计: {passed}/{len(self.results)} 通过, {failed} 失败")
        print(f"用时: {total_time:.2f}秒")
        
        if all(r.passed for r in self.results):
            print("\n🎉 端到端测试全部通过!")
        else:
            print("\n⚠️  部分测试未通过，请检查日志")
        
        print("="*60 + "\n")


def parse_args():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(
        description="Research Nexus Pro - 端到端测试脚本"
    )
    parser.add_argument(
        "--host",
        default=DEFAULT_HOST,
        help=f"API服务器地址 (默认: {DEFAULT_HOST})"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="启用详细输出"
    )
    return parser.parse_args()


async def main():
    """主函数"""
    args = parse_args()
    
    runner = E2ETestRunner(
        base_url=args.host,
        verbose=args.verbose
    )
    
    try:
        success = await runner.run_all()
        runner.print_summary()
        
        return 0 if success else 1
        
    except KeyboardInterrupt:
        print("\n\n测试被用户中断")
        runner.print_summary()
        return 130
    except Exception as e:
        print(f"\n\n测试运行时异常: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
