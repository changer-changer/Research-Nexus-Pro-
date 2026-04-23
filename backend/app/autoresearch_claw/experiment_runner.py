"""AutoResearchClaw 适配层 - 实验执行引擎

借鉴 AutoResearchClaw 的 edit→run→eval→keep/discard 循环，
为 Research-Nexus Pro 提供 AI 自动实验执行能力。

核心流程：
1. 接收创新点和实验代码
2. 在沙盒环境中执行实验
3. 评估实验结果
4. 保留成功结果，失败则重试
5. 可选的 Git 分支管理
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import subprocess
import time
from dataclasses import asdict, dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional
import uuid

logger = logging.getLogger(__name__)


@dataclass
class ProcResult:
    """Subprocess execution result"""
    stdout: str = ""
    stderr: str = ""
    returncode: int = 0


class ExperimentMode(str, Enum):
    """实验执行模式"""
    AI_AUTO = "ai_auto"
    HUMAN_GUIDED = "human_guided"
    HYBRID = "hybrid"


class ExperimentStatus(str, Enum):
    """实验状态"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"


@dataclass
class ExperimentConfig:
    """实验配置"""
    timeout_sec: int = 3600  # 超时时间（秒）
    max_retries: int = 3  # 最大重试次数
    metric_key: str = "accuracy"  # 主要评估指标
    docker_image: str = "python:3.11-slim"  # Docker 镜像
    workspace_dir: str = "/tmp/experiments"  # 工作目录
    enable_git: bool = True  # 是否启用 Git 集成
    keep_threshold: float = 0.01  # 改进阈值
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ExperimentResult:
    """实验结果"""
    run_id: str
    iteration: int
    status: ExperimentStatus
    metrics: Dict[str, float] = field(default_factory=dict)
    primary_metric: Optional[float] = None
    code: str = ""
    stdout: str = ""
    stderr: str = ""
    error: Optional[str] = None
    elapsed_sec: float = 0.0
    output_files: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "run_id": self.run_id,
            "iteration": self.iteration,
            "status": self.status.value,
            "metrics": self.metrics,
            "primary_metric": self.primary_metric,
            "code": self.code,
            "stdout": self.stdout,
            "stderr": self.stderr,
            "error": self.error,
            "elapsed_sec": self.elapsed_sec,
            "output_files": self.output_files
        }


@dataclass
class ExperimentHistory:
    """实验历史记录"""
    results: List[ExperimentResult] = field(default_factory=list)
    best_result: Optional[ExperimentResult] = None
    baseline_metric: Optional[float] = None
    
    def add(self, result: ExperimentResult) -> None:
        self.results.append(result)
        if self.baseline_metric is None and result.primary_metric is not None:
            self.baseline_metric = result.primary_metric
        if self.best_result is None or (
            result.primary_metric is not None and 
            (self.best_result.primary_metric is None or 
             result.primary_metric > self.best_result.primary_metric)
        ):
            self.best_result = result
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "results": [r.to_dict() for r in self.results],
            "best_result": self.best_result.to_dict() if self.best_result else None,
            "baseline_metric": self.baseline_metric
        }


class CodeGenerationError(Exception):
    """Raised when generated code has syntax errors"""
    pass


def _sanitize_code_output(raw_output: str) -> str:
    """Sanitize code output before writing to file.

    1. Remove markdown fences
    2. Validate Python syntax (if applicable)
    3. Remove filename annotations like 'filename:main.py'

    Fixes AutoResearchClaw Stage 10 bug where ```filename:main.py
    gets written as the first line of a .py file, causing SyntaxError.
    """
    lines = raw_output.split("\n")

    # Remove opening fence and filename annotation
    if lines and lines[0].strip().startswith("```"):
        lines = lines[1:]
    # Remove lines like 'filename:main.py' or 'main.py'
    if lines and ("filename:" in lines[0] or lines[0].strip().endswith(".py")):
        lines = lines[1:]

    # Remove closing fence
    if lines and lines[-1].strip().startswith("```"):
        lines = lines[:-1]

    code = "\n".join(lines).strip()

    # Validate Python syntax if it looks like Python
    if "import " in code or "def " in code or "class " in code:
        import ast
        try:
            ast.parse(code)
        except SyntaxError as e:
            raise CodeGenerationError(
                f"Generated code has syntax error at line {e.lineno}: {e.msg}"
            )

    return code


def _write_code_atomic(path: Path, code: str) -> None:
    """Write code file atomically: write temp -> rename -> validate."""
    temp_path = path.with_suffix(path.suffix + ".tmp")
    temp_path.write_text(code, encoding="utf-8")
    # Verify filesystem consistency
    written = temp_path.read_text(encoding="utf-8")
    if written != code:
        raise RuntimeError(f"Filesystem inconsistency: {temp_path} does not match expected content")
    temp_path.rename(path)


class ExperimentRunner:
    """实验执行器
    
    实现 edit→run→eval→keep/discard 循环
    支持 Docker 沙盒、Git 分支管理、失败重试
    """
    
    def __init__(
        self,
        workspace_dir: Optional[str] = None,
        config: Optional[ExperimentConfig] = None
    ):
        self.config = config or ExperimentConfig()
        if workspace_dir:
            self.config.workspace_dir = workspace_dir
        
        self.workspace = Path(self.config.workspace_dir)
        self.workspace.mkdir(parents=True, exist_ok=True)
        
        self.history = ExperimentHistory()
        self.current_run: Optional[ExperimentResult] = None
        self.is_running = False
        
        logger.info(f"ExperimentRunner initialized, workspace: {self.workspace}")
    
    async def run_experiment(
        self,
        code: str,
        requirements: Optional[List[str]] = None,
        experiment_id: Optional[str] = None,
        feasibility_result: Optional[Dict[str, Any]] = None,
    ) -> ExperimentResult:
        """
        执行实验

        Args:
            code: Python 实验代码
            requirements: 依赖包列表
            experiment_id: 实验 ID（可选，自动生成）
            feasibility_result: 可行性评估结果（用于 gate 检查）

        Returns:
            实验结果
        """
        run_id = experiment_id or f"exp_{uuid.uuid4().hex[:8]}"
        self.is_running = True

        logger.info(f"Starting experiment {run_id}")

        try:
            # Feasibility gate: refuse auto-run if not AI_AUTO with high confidence
            if feasibility_result:
                decision = feasibility_result.get("decision", "unknown")
                score = feasibility_result.get("overall_score", 0)
                if decision != "ai_auto" or score < 80:
                    logger.warning(
                        f"Feasibility gate blocked: decision={decision}, score={score}. "
                        "Auto-experiment requires ai_auto with score >= 80."
                    )
                    return ExperimentResult(
                        run_id=run_id,
                        iteration=0,
                        status=ExperimentStatus.FAILED,
                        code=code,
                        error=(
                            f"Feasibility gate blocked: decision={decision}, score={score}. "
                            "Auto-experiment requires ai_auto with score >= 80. "
                            "Use human-guided mode or improve feasibility."
                        ),
                    )

            # 创建实验目录
            exp_dir = self.workspace / run_id
            exp_dir.mkdir(parents=True, exist_ok=True)

            # 写入代码文件（sanitize + atomic write）
            main_py = exp_dir / "main.py"
            try:
                sanitized = _sanitize_code_output(code)
            except CodeGenerationError as e:
                logger.error(f"Code sanitization failed: {e}")
                return ExperimentResult(
                    run_id=run_id,
                    iteration=0,
                    status=ExperimentStatus.FAILED,
                    code=code,
                    error=f"Code sanitization failed: {e}",
                )
            _write_code_atomic(main_py, sanitized)

            # 写入依赖文件
            if requirements:
                req_file = exp_dir / "requirements.txt"
                req_file.write_text("\n".join(requirements), encoding="utf-8")

            # 运行实验
            result = await self._execute_with_retry(sanitized, run_id, exp_dir)

            # 更新历史记录
            self.history.add(result)
            self.current_run = result

            logger.info(
                f"Experiment {run_id} completed: status={result.status.value}, "
                f"metric={result.primary_metric}"
            )

            return result

        except Exception as e:
            logger.error(f"Experiment {run_id} failed: {e}", exc_info=True)
            error_result = ExperimentResult(
                run_id=run_id,
                iteration=0,
                status=ExperimentStatus.FAILED,
                code=code,
                error=str(e),
            )
            self.current_run = error_result
            return error_result
        finally:
            self.is_running = False
    
    async def _execute_with_retry(
        self,
        code: str,
        run_id: str,
        exp_dir: Path
    ) -> ExperimentResult:
        """带重试的执行"""
        last_result = None
        
        for attempt in range(self.config.max_retries):
            if not self.is_running:
                break
            
            logger.info(f"Attempt {attempt + 1}/{self.config.max_retries} for {run_id}")
            
            result = await self._execute_single(code, run_id, exp_dir, attempt)
            last_result = result
            
            # 如果成功，直接返回
            if result.status == ExperimentStatus.COMPLETED:
                return result
            
            # 如果失败但还有重试次数，等待后重试
            if attempt < self.config.max_retries - 1:
                wait_time = min(2 ** attempt, 30)  # 指数退避
                logger.warning(f"Attempt {attempt + 1} failed, retrying in {wait_time}s...")
                await asyncio.sleep(wait_time)
        
        return last_result or ExperimentResult(
            run_id=run_id,
            iteration=0,
            status=ExperimentStatus.FAILED,
            code=code,
            error="All retries exhausted"
        )
    
    async def _execute_single(
        self,
        code: str,
        run_id: str,
        exp_dir: Path,
        iteration: int
    ) -> ExperimentResult:
        """单次执行"""
        start_time = time.time()
        
        try:
            # 尝试 Docker 执行（如果可用）
            if await self._is_docker_available():
                return await self._execute_in_docker(code, run_id, exp_dir, iteration, start_time)
            else:
                # 降级为本地执行
                logger.warning("Docker not available, falling back to local execution")
                return await self._execute_locally(code, run_id, exp_dir, iteration, start_time)
        
        except asyncio.TimeoutError:
            elapsed = time.time() - start_time
            return ExperimentResult(
                run_id=run_id,
                iteration=iteration,
                status=ExperimentStatus.TIMEOUT,
                code=code,
                error=f"Timeout after {elapsed:.1f}s",
                elapsed_sec=elapsed
            )
        except Exception as e:
            elapsed = time.time() - start_time
            return ExperimentResult(
                run_id=run_id,
                iteration=iteration,
                status=ExperimentStatus.FAILED,
                code=code,
                error=str(e),
                elapsed_sec=elapsed
            )
    
    async def _execute_in_docker(
        self,
        code: str,
        run_id: str,
        exp_dir: Path,
        iteration: int,
        start_time: float
    ) -> ExperimentResult:
        """在 Docker 容器中执行实验
        
        三阶段执行：
        Phase 0: pip install 依赖（如果存在 requirements.txt）
        Phase 1: 运行 setup.py（如果存在，用于数据集下载）
        Phase 2: 运行 main.py
        """
        container_id = f"rc-exp-{uuid.uuid4().hex[:8]}"
        
        try:
            # 1. 启动容器
            await self._docker_run(container_id, exp_dir)
            
            # 2. 安装依赖
            req_file = exp_dir / "requirements.txt"
            if req_file.exists():
                await self._docker_exec(container_id, "pip install -r /workspace/requirements.txt")
            
            # 3. 运行实验（带超时）
            proc = await asyncio.wait_for(
                self._docker_exec(container_id, "python /workspace/main.py"),
                timeout=self.config.timeout_sec
            )
            
            elapsed = time.time() - start_time
            
            # 4. 解析结果
            metrics = self._parse_metrics(proc.stdout)
            
            # 5. 收集输出文件
            output_files = await self._collect_outputs(exp_dir)
            
            return ExperimentResult(
                run_id=run_id,
                iteration=iteration,
                status=ExperimentStatus.COMPLETED if proc.returncode == 0 else ExperimentStatus.FAILED,
                metrics=metrics,
                primary_metric=metrics.get(self.config.metric_key),
                code=code,
                stdout=proc.stdout,
                stderr=proc.stderr,
                elapsed_sec=elapsed,
                output_files=output_files
            )
        
        except asyncio.TimeoutError:
            # 超时则清理容器
            await self._docker_stop(container_id)
            raise
        finally:
            # 清理容器
            await self._docker_stop(container_id)
    
    async def _execute_locally(
        self,
        code: str,
        run_id: str,
        exp_dir: Path,
        iteration: int,
        start_time: float
    ) -> ExperimentResult:
        """本地执行（降级方案）"""
        try:
            # 安装依赖
            req_file = exp_dir / "requirements.txt"
            if req_file.exists():
                proc_install = await asyncio.create_subprocess_exec(
                    "pip", "install", "-r", str(req_file),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                await proc_install.communicate()
            
            # 运行实验
            proc = await asyncio.create_subprocess_exec(
                "python", str(exp_dir / "main.py"),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(exp_dir)
            )
            
            try:
                stdout, stderr = await asyncio.wait_for(
                    proc.communicate(),
                    timeout=self.config.timeout_sec
                )
            except asyncio.TimeoutError:
                proc.kill()
                raise
            
            elapsed = time.time() - start_time
            
            # 解析结果
            stdout_str = stdout.decode('utf-8', errors='replace')
            stderr_str = stderr.decode('utf-8', errors='replace')
            metrics = self._parse_metrics(stdout_str)
            output_files = await self._collect_outputs(exp_dir)
            
            return ExperimentResult(
                run_id=run_id,
                iteration=iteration,
                status=ExperimentStatus.COMPLETED if proc.returncode == 0 else ExperimentStatus.FAILED,
                metrics=metrics,
                primary_metric=metrics.get(self.config.metric_key),
                code=code,
                stdout=stdout_str,
                stderr=stderr_str,
                elapsed_sec=elapsed,
                output_files=output_files
            )
        
        except asyncio.TimeoutError:
            elapsed = time.time() - start_time
            return ExperimentResult(
                run_id=run_id,
                iteration=iteration,
                status=ExperimentStatus.TIMEOUT,
                code=code,
                error=f"Timeout after {elapsed:.1f}s",
                elapsed_sec=elapsed
            )
        except Exception as e:
            elapsed = time.time() - start_time
            return ExperimentResult(
                run_id=run_id,
                iteration=iteration,
                status=ExperimentStatus.FAILED,
                code=code,
                error=str(e),
                elapsed_sec=elapsed
            )
    
    # ========== Docker 辅助方法 ==========
    
    async def _is_docker_available(self) -> bool:
        """检查 Docker 是否可用"""
        try:
            proc = await asyncio.create_subprocess_exec(
                "docker", "info",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await proc.communicate()
            # docker info 必须在 daemon 运行时才能成功
            return proc.returncode == 0 and b"Server" in stdout
        except Exception:
            return False
    
    async def _docker_run(self, container_id: str, workspace: Path):
        """启动容器并等待其就绪"""
        proc = await asyncio.create_subprocess_exec(
            "docker", "run", "-d",
            "--name", container_id,
            "-v", f"{workspace}:/workspace",
            "-w", "/workspace",
            self.config.docker_image,
            "tail", "-f", "/dev/null"
        )
        await proc.communicate()
        # 等待容器真正启动（最多 10 秒）
        for _ in range(20):
            check = await asyncio.create_subprocess_exec(
                "docker", "inspect", "-f", "{{.State.Running}}", container_id,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await check.communicate()
            if stdout.decode().strip() == "true":
                return
            await asyncio.sleep(0.5)
        raise RuntimeError(f"Docker container {container_id} failed to start")

    async def _docker_exec(self, container_id: str, command: str) -> ProcResult:
        """在容器中执行命令"""
        proc = await asyncio.create_subprocess_exec(
            "docker", "exec", container_id, "bash", "-c", command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        return ProcResult(
            stdout=stdout.decode("utf-8", errors="replace"),
            stderr=stderr.decode("utf-8", errors="replace"),
            returncode=proc.returncode,
        )
    
    async def _docker_stop(self, container_id: str):
        """停止并删除容器"""
        try:
            await asyncio.create_subprocess_exec(
                "docker", "stop", "-t", "2", container_id
            )
            await asyncio.create_subprocess_exec(
                "docker", "rm", container_id
            )
        except Exception:
            pass  # 忽略清理错误
    
    # ========== 结果解析 ==========
    
    def _parse_metrics(self, output: str) -> Dict[str, float]:
        """从输出中解析指标
        
        支持格式：
        - accuracy: 0.95
        - {'accuracy': 0.95}
        - {"accuracy": 0.95}
        - Metric: accuracy = 0.95
        """
        metrics = {}
        
        # 尝试解析 JSON
        import re
        json_pattern = r'\{[^{}]*\}'
        for match in re.finditer(json_pattern, output):
            try:
                data = json.loads(match.group())
                if isinstance(data, dict):
                    for key, value in data.items():
                        if isinstance(value, (int, float)):
                            metrics[key] = float(value)
            except json.JSONDecodeError:
                pass
        
        # 尝试解析 key: value 格式
        kv_pattern = r'(\w+):\s*([0-9.]+)'
        for match in re.finditer(kv_pattern, output):
            key = match.group(1).lower()
            value = float(match.group(2))
            metrics[key] = value
        
        # 尝试解析 Metric: key = value 格式
        metric_pattern = r'Metric:\s*(\w+)\s*=\s*([0-9.]+)'
        for match in re.finditer(metric_pattern, output):
            key = match.group(1).lower()
            value = float(match.group(2))
            metrics[key] = value
        
        return metrics
    
    async def _collect_outputs(self, exp_dir: Path) -> List[str]:
        """收集输出文件"""
        output_files = []
        for ext in ["*.png", "*.jpg", "*.pdf", "*.csv", "*.json"]:
            for f in exp_dir.glob(ext):
                output_files.append(str(f.relative_to(self.workspace)))
        return output_files
    
    # ========== 状态查询 ==========
    
    def get_status(self, run_id: str) -> Optional[ExperimentResult]:
        """获取实验状态"""
        for result in self.history.results:
            if result.run_id == run_id:
                return result
        return self.current_run if self.current_run and self.current_run.run_id == run_id else None
    
    def get_history(self) -> ExperimentHistory:
        """获取实验历史"""
        return self.history
    
    def cancel_experiment(self):
        """取消当前运行的实验"""
        self.is_running = False
        logger.info("Experiment cancellation requested")


# 全局实验运行器实例（用于 FastAPI 集成）
_runner: Optional[ExperimentRunner] = None

def get_runner() -> ExperimentRunner:
    global _runner
    if _runner is None:
        _runner = ExperimentRunner()
    return _runner


async def run_experiment_api(
    code: str,
    requirements: Optional[List[str]] = None,
    experiment_id: Optional[str] = None,
    feasibility_result: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    FastAPI 接口调用的实验执行函数

    Args:
        code: Python 实验代码
        requirements: 依赖包列表
        experiment_id: 实验 ID
        feasibility_result: 可行性评估结果（用于 gate 检查）

    Returns:
        实验结果字典
    """
    runner = get_runner()
    result = await runner.run_experiment(code, requirements, experiment_id, feasibility_result)
    return result.to_dict()


def get_experiment_status_api(run_id: str) -> Optional[Dict[str, Any]]:
    """获取实验状态 API"""
    runner = get_runner()
    result = runner.get_status(run_id)
    return result.to_dict() if result else None


def get_experiment_history_api() -> Dict[str, Any]:
    """获取实验历史 API"""
    runner = get_runner()
    return runner.get_history().to_dict()
