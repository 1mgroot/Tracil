# React Flow 全屏 Modal 功能

## 概述

为 React Flow 图表添加了全屏查看功能，用户可以通过点击全屏按钮将图表展开到全屏 Modal 中，提供更好的图表浏览体验。

## 功能特性

### ✅ 核心功能
- **全屏 Modal 显示** - 图表在独立的全屏 Modal 中展示
- **键盘快捷键支持** - ESC 键快速关闭
- **浏览器全屏模式** - 支持真正的浏览器全屏
- **响应式布局** - 适配各种屏幕尺寸

### ✅ 用户体验
- **操作说明提示** - 底部显示操作指引
- **平滑动画效果** - 优雅的打开/关闭动画
- **无障碍访问** - 支持屏幕阅读器和键盘导航
- **状态管理** - 防止页面滚动冲突

## 使用方法

### 1. 基本用法

```tsx
import { useState } from 'react'
import { FullscreenModal } from '@/components/ui/FullscreenModal'
import { Button } from '@/components/ui/button'

function MyComponent() {
  const [isFullscreen, setIsFullscreen] = useState(false)

  return (
    <div>
      {/* 全屏按钮 */}
      <Button onClick={() => setIsFullscreen(true)}>
        打开全屏视图
      </Button>

      {/* 全屏 Modal */}
      <FullscreenModal
        isOpen={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        title="图表全屏视图"
      >
        {/* 你的 React Flow 图表内容 */}
        <ReactFlow nodes={nodes} edges={edges} />
      </FullscreenModal>
    </div>
  )
}
```

### 2. 在 LineageGraphReactFlow 中的集成

全屏功能已经集成到 `LineageGraphReactFlow` 组件中：

```tsx
// 在标题区域自动显示全屏按钮
<div className="flex items-center justify-between">
  <h2>Lineage Flow Chart</h2>
  
  {/* 全屏按钮 - 自动生成 */}
  <Button
    variant="ghost"
    size="sm"
    onClick={() => setIsFullscreen(true)}
    aria-label="Open fullscreen view"
  >
    <Maximize2 className="w-4 h-4" />
  </Button>
</div>
```

### 3. 自定义配置

```tsx
<FullscreenModal
  isOpen={isFullscreen}
  onClose={() => setIsFullscreen(false)}
  title="自定义标题"
  className="bg-white" // 自定义背景色
>
  {/* 内容 */}
</FullscreenModal>
```

## 组件 API

### FullscreenModal Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `isOpen` | `boolean` | - | 控制 Modal 显示/隐藏 |
| `onClose` | `() => void` | - | 关闭 Modal 的回调函数 |
| `children` | `ReactNode` | - | Modal 内容 |
| `title` | `string` | `"Fullscreen View"` | Modal 标题 |
| `className` | `string` | `""` | 额外的 CSS 类名 |

## 技术实现

### 1. 状态管理

```tsx
const [isFullscreen, setIsFullscreen] = useState(false)

// 打开全屏
const openFullscreen = () => setIsFullscreen(true)

// 关闭全屏
const closeFullscreen = () => setIsFullscreen(false)
```

### 2. 事件处理

```tsx
// ESC 键关闭
useEffect(() => {
  if (isOpen) {
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden' // 防止背景滚动
  }

  return () => {
    document.removeEventListener('keydown', handleEscape)
    document.body.style.overflow = 'unset'
  }
}, [isOpen, handleEscape])
```

### 3. 浏览器全屏 API

```tsx
const toggleFullscreen = useCallback(() => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(console.error)
  } else {
    document.exitFullscreen().catch(console.error)
  }
}, [])
```

## 最佳实践

### 1. 性能优化

- 使用 `useCallback` 包装事件处理函数
- 避免在全屏 Modal 中重复渲染大量数据
- 考虑使用 `React.memo` 优化子组件

### 2. 用户体验

- 提供清晰的操作指引
- 支持多种关闭方式（按钮、ESC 键、点击外部）
- 保持与主界面一致的视觉风格

### 3. 无障碍访问

- 使用语义化的 HTML 标签
- 提供适当的 ARIA 标签
- 支持键盘导航

## 示例页面

访问 `/fullscreen-demo` 页面查看完整的功能演示。

## 故障排除

### 常见问题

1. **Modal 不显示**
   - 检查 `isOpen` 状态是否正确
   - 确认组件是否正确导入

2. **ESC 键不工作**
   - 检查事件监听器是否正确添加
   - 确认没有其他组件拦截键盘事件

3. **样式问题**
   - 检查 Tailwind CSS 是否正确配置
   - 确认 z-index 层级设置

### 调试技巧

```tsx
// 添加调试日志
useEffect(() => {
  console.log('Modal state:', isOpen)
}, [isOpen])

// 检查事件监听器
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    console.log('Key pressed:', e.key)
    if (e.key === 'Escape') {
      console.log('ESC pressed, closing modal')
      onClose()
    }
  }
  
  document.addEventListener('keydown', handleKeyDown)
  return () => document.removeEventListener('keydown', handleKeyDown)
}, [onClose])
```

## 更新日志

- **v1.0.0** - 初始版本，支持基本全屏功能
- **v1.1.0** - 添加浏览器全屏模式支持
- **v1.2.0** - 集成到 LineageGraphReactFlow 组件
- **v1.3.0** - 添加无障碍访问支持
