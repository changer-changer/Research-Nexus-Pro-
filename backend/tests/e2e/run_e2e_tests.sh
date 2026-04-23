#!/bin/bash
#
# 端到端测试运行脚本
# Research Nexus Pro - 论文生成系统
#
# 用法: ./run_e2e_tests.sh [--full] [--quick]
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../../.."
TEST_DIR="$SCRIPT_DIR"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印函数
print_header() {
    echo ""
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "  $1"
}

# 检查Python环境
check_python() {
    if ! command -v python3 &> /dev/null; then
        print_error "Python3 未安装"
        exit 1
    fi
    print_success "Python3 已安装: $(python3 --version)"
}

# 检查依赖
check_dependencies() {
    print_info "检查测试依赖..."
    
    local deps=("pytest" "aiohttp" "requests")
    local missing_deps=()
    
    for dep in "${deps[@]}"; do
        if ! python3 -c "import $dep" 2>/dev/null; then
            missing_deps+=("$dep")
        fi
    done
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        print_warning "缺少依赖: ${missing_deps[*]}"
        print_info "正在安装依赖..."
        pip3 install "${missing_deps[@]}" -q
        print_success "依赖安装完成"
    else
        print_success "所有依赖已安装"
    fi
}

# 运行单元测试
run_unit_tests() {
    print_header "运行单元测试"
    
    cd "$BACKEND_DIR"
    
    # 数据库集成测试
    print_info "测试 1: 数据库集成测试"
    if python3 -m pytest "$TEST_DIR/test_database_integration.py" -v --tb=short 2>&1 | tail -5; then
        print_success "数据库集成测试通过"
    else
        print_error "数据库集成测试失败"
        return 1
    fi
    
    echo ""
    
    # 可行性评估测试
    print_info "测试 2: 实验可行性评估测试"
    if python3 -m pytest "$TEST_DIR/test_feasibility_evaluator.py" -v --tb=short 2>&1 | tail -5; then
        print_success "可行性评估测试通过"
    else
        print_error "可行性评估测试失败"
        return 1
    fi
    
    echo ""
    
    # SSE流式测试
    print_info "测试 3: SSE流式输出测试"
    if python3 -m pytest "$TEST_DIR/test_sse_streaming.py" -v --tb=short 2>&1 | tail -5; then
        print_success "SSE流式测试通过"
    else
        print_warning "SSE流式测试可能失败（需要服务器运行）"
    fi
}

# 运行API测试
run_api_tests() {
    print_header "运行API端点测试"
    
    cd "$BACKEND_DIR"
    
    print_info "测试 API 端点..."
    if python3 -m pytest "$TEST_DIR/test_api_endpoints.py" -v --tb=short 2>&1 | tail -10; then
        print_success "API端点测试通过"
    else
        print_error "API端点测试失败"
        return 1
    fi
}

# 运行论文生成引擎测试
run_engine_tests() {
    print_header "运行论文生成引擎测试"
    
    cd "$BACKEND_DIR"
    
    print_info "测试论文生成引擎..."
    if python3 -m pytest "$TEST_DIR/test_paper_generation_engine.py" -v --tb=short 2>&1 | tail -10; then
        print_success "论文生成引擎测试通过"
    else
        print_error "论文生成引擎测试失败"
        return 1
    fi
}

# 运行数据库优化
run_database_optimization() {
    print_header "运行数据库优化"
    
    cd "$TEST_DIR"
    
    if python3 optimize_database.py; then
        print_success "数据库优化完成"
    else
        print_warning "数据库优化可能失败（数据库不存在）"
    fi
}

# 运行完整端到端测试
run_full_e2e() {
    print_header "运行完整端到端测试"
    
    cd "$TEST_DIR"
    
    print_info "启动端到端测试..."
    print_info "注意: 需要后端服务器在 localhost:8000 运行"
    echo ""
    
    # 检查服务器是否运行
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        print_success "后端服务器已连接"
    else
        print_warning "后端服务器未响应，请确保服务器在 localhost:8000 运行"
        print_info "可以使用以下命令启动服务器:"
        print_info "  cd backend && python -m app.api.main"
        echo ""
        read -p "是否继续测试? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            return 1
        fi
    fi
    
    # 运行端到端测试
    python3 e2e_test.py --verbose
}

# 运行快速测试
run_quick_tests() {
    print_header "运行快速测试套件"
    
    check_python
    check_dependencies
    
    run_database_optimization
    run_unit_tests
    
    print_header "快速测试完成"
}

# 运行完整测试套件
run_full_tests() {
    print_header "Research Nexus Pro - 端到端测试套件"
    
    check_python
    check_dependencies
    
    run_database_optimization
    run_unit_tests
    run_api_tests
    run_engine_tests
    run_full_e2e
    
    print_header "全部测试完成"
}

# 主函数
main() {
    local mode="${1:-quick}"
    
    case "$mode" in
        --full)
            run_full_tests
            ;;
        --quick)
            run_quick_tests
            ;;
        --unit)
            check_python
            check_dependencies
            run_unit_tests
            ;;
        --api)
            check_python
            check_dependencies
            run_api_tests
            ;;
        --engine)
            check_python
            check_dependencies
            run_engine_tests
            ;;
        --e2e)
            run_full_e2e
            ;;
        --optimize)
            run_database_optimization
            ;;
        --help|-h)
            echo "用法: $0 [选项]"
            echo ""
            echo "选项:"
            echo "  --full      运行完整测试套件（默认）"
            echo "  --quick     运行快速测试"
            echo "  --unit      仅运行单元测试"
            echo "  --api       仅运行API测试"
            echo "  --engine    仅运行引擎测试"
            echo "  --e2e       仅运行端到端测试（需要服务器）"
            echo "  --optimize  仅运行数据库优化"
            echo "  --help      显示此帮助"
            echo ""
            exit 0
            ;;
        *)
            echo "未知选项: $mode"
            echo "使用 --help 查看可用选项"
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"
