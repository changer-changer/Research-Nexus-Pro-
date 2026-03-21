/**
 * Research Nexus Pro - T5 交互性优化说明
 * 
 * 实现了 Linear.app 级别的流畅交互体验
 */

## 🧲 1. 磁吸按钮效果 (useMagnetic)

```tsx
import { useMagnetic, magneticPresets } from '../hooks'

function MyButton() {
  const { ref, style, glowStyle } = useMagnetic({
    strength: 0.4,
    radius: 150,
    enableGlow: true,
    glowColor: 'rgba(99, 102, 241, 0.4)',
  })

  return (
    <motion.button
      ref={ref}
      style={style}
      className="relative px-4 py-2 bg-indigo-600 rounded-lg"
    >
      <motion.div
        className="absolute inset-0 rounded-lg pointer-events-none"
        style={glowStyle}
      />
      <span>磁吸按钮</span>
    </motion.button>
  )
}
```

**预设选项:**
- `subtle` - 微妙效果 (适合次要按钮)
- `default` - 标准效果
- `strong` - 强烈效果 (适合 CTA)
- `bouncy` - 游戏风格 (弹性更强)

---

## 🌊 2. 惯性滚动系统 (useInertialScroll)

```tsx
import { useCanvasDrag } from '../hooks'

function Canvas() {
  const { containerRef, scrollX, scrollY, state, scrollTo } = useCanvasDrag({
    inertia: 0.95,
    friction: 0.05,
    enableBounce: true,
    scale: 1,
  })

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden">
      <motion.div
        style={{ x: scrollX, y: scrollY }}
        className="transform-gpu"
      >
        {/* 画布内容 */}
      </motion.div>
    </div>
  )
}
```

**特性:**
- 拖拽惯性 - 松开后继续滑动
- 滚轮平滑 - 带缓动效果
- 边界回弹 - 到达边界时弹性回弹
- 双轴支持

---

## 🤏 3. 手势操作支持 (useGesture)

```tsx
import { useGesture } from '../hooks'

function TouchCanvas() {
  const { ref, scale, x, y, state, zoomTo } = useGesture({
    minScale: 0.1,
    maxScale: 5,
    enablePinch: true,
    enablePan: true,
    onScaleChange: (s) => console.log('Scale:', s),
  })

  return (
    <motion.div
      ref={ref}
      style={{
        scale,
        x,
        y,
      }}
      className="touch-none"
    >
      {/* 内容 */}
    </motion.div>
  )
}
```

**支持的手势:**
- 双指缩放 (Pinch)
- 三指拖拽 (Pan)
- 单指点击 (Tap)
- 双击放大/缩小 (Double Tap)
- Ctrl/Cmd + 滚轮缩放 (桌面端)

---

## 🎯 4. 焦点模式 (useFocusMode)

```tsx
import { useFocusMode } from '../hooks'

function Graph() {
  const { containerRef, focus, exit, isNodeFocused, isNodeDimmed, getNodeStyle, FocusOverlay } = useFocusMode({
    unfocusedOpacity: 0.3,
    blurAmount: 4,
    enableOverlay: true,
    exitOnClickOutside: true,
  })

  return (
    <div ref={containerRef} className="relative">
      <FocusOverlay />
      
      {nodes.map(node => (
        <motion.div
          key={node.id}
          data-node-id={node.id}
          style={getNodeStyle(node.id)}
          onClick={() => focus(node.id)}
          className={cn(
            'transition-all duration-300',
            isNodeDimmed(node.id) && 'pointer-events-none'
          )}
        >
          {node.content}
        </motion.div>
      ))}
    </div㸾
  )
}
```

**快捷键:**
- `Escape` - 退出聚焦
- `Backspace` - 返回上一个聚焦

---

## 🔍 5. 智能搜索 (IntelligentSearch)

```tsx
import { IntelligentSearch } from '../components/Search/IntelligentSearch'

function App() {
  const handleSelect = (item) => {
    console.log('Selected:', item)
    // 导航到对应节点
  }

  return (
    <IntelligentSearch
      data={{
        problems: nexusStore.problems,
        methods: nexusStore.methods,
        papers: nexusStore.papers,
        branches: nexusStore.branches,
      }}
      onSelect={handleSelect}
      enableSemantic={true}
      maxResults={10}
    />
  )
}
```

**特性:**
- ⌘K 快捷唤起
- 语义搜索 (同义词、模糊匹配)
- 实时搜索建议
- 结果高亮
- 分组展示
- 键盘导航 (↑↓↵)

---

## ⌨️ 6. 快捷键系统 (shortcuts)

```tsx
import { initShortcuts, useShortcut, useShortcutHelp } from '../utils/shortcuts'

// 在应用初始化时注册全局快捷键
useEffect(() => {
  const unregister = initShortcuts()
  return unregister
}, [])

// 在组件中监听特定快捷键
useShortcut({
  id: 'custom.action',
  name: '自定义操作',
  description: '执行自定义操作',
  keys: ['x'],
  modifiers: ['cmd'],
  category: '自定义',
  handler: () => {
    console.log('Custom action triggered!')
  },
})

// 快捷键帮助面板
function HelpPanel() {
  const { shortcuts, isOpen, toggle } = useShortcutHelp()
  
  return isOpen ? (
    <div className="shortcut-help">
      {shortcuts.map(s => (
        <div key={s.id}>
          <span>{s.displayKeys}</span>
          <span>{s.name}</span>
        </div>
      ))}
    </div>
  ) : null
}
```

**预定义快捷键:**

| 快捷键 | 功能 | 分类 |
|--------|------|------|
| ⌘K | 搜索 | 导航 |
| Shift+? | 快捷键帮助 | 导航 |
| Escape | 退出/取消 | 导航 |
| ⌘= | 放大 | 视图 |
| ⌘- | 缩小 | 视图 |
| ⌘0 | 重置缩放 | 视图 |
| ⌘1 | 适应屏幕 | 视图 |
| ⌘Z | 撤销 | 编辑 |
| ⌘⇧Z | 重做 | 编辑 |
| F | 聚焦节点 | 节点 |
| E | 编辑节点 | 节点 |
| Space | 展开/折叠 | 节点 |
| ⌘B | 添加书签 | 节点 |

**Vim 导航 (Vim Mode 启用时):**
| 键 | 功能 |
|----|------|
| H | 向左移动 |
| J | 向下移动 |
| K | 向上移动 |
| L | 向右移动 |
| P | 跳转到父节点 |
| C | 跳转到子节点 |

---

## 🎨 综合使用示例

```tsx
import { motion } from 'framer-motion'
import { useMagneticPreset, useCanvasDrag, useFocusMode } from '../hooks'
import { IntelligentSearch } from '../components/Search/IntelligentSearch'
import { initShortcuts } from '../utils/shortcuts'

function App() {
  // 初始化快捷键
  useEffect(() => initShortcuts(), [])

  // 画布拖拽
  const canvasDrag = useCanvasDrag({ inertia: 0.95 })
  
  // 焦点模式
  const focusMode = useFocusMode({ unfocusedOpacity: 0.3 })

  return (
    <div className="app">
      {/* 搜索 */}
      <IntelligentSearch
        data={{ problems, methods, papers }}
        onSelect={(item) => focusMode.focus(item.id)}
      />

      {/* 画布 */}
      <div ref={canvasDrag.containerRef} className="canvas-container">
        <motion.div style={{ x: canvasDrag.springX, y: canvasDrag.springY }}>
          <div ref={focusMode.containerRef}>
            <FocusOverlay />
            {nodes.map(node => (
              <Node
                key={node.id}
                node={node}
                style={focusMode.getNodeStyle(node.id)}
                onClick={() => focusMode.focus(node.id)}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
```