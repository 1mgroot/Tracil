"use client"

import { useState } from 'react'
import { FullscreenModal } from '@/components/ui/FullscreenModal'
import { Button } from '@/components/ui/button'

export default function FullscreenDemoPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Fullscreen Modal Demo
        </h1>
        
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            React Flow 全屏功能演示
          </h2>
          
          <p className="text-gray-600 mb-6">
            这个演示展示了如何为 React Flow 图表添加全屏查看功能。
            点击下面的按钮可以打开一个全屏 Modal，展示图表的完整视图。
          </p>
          
          <div className="space-y-4">
            <Button 
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              打开全屏图表视图
            </Button>
            
            <div className="text-sm text-gray-500">
              <p>• 支持 ESC 键关闭</p>
              <p>• 支持浏览器全屏模式</p>
              <p>• 响应式设计，适配各种屏幕尺寸</p>
              <p>• 包含操作说明和导航控制</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            功能特性
          </h3>
          
          <ul className="space-y-2 text-gray-600">
            <li>✅ 全屏 Modal 显示</li>
            <li>✅ 键盘快捷键支持 (ESC)</li>
            <li>✅ 浏览器全屏模式切换</li>
            <li>✅ 响应式布局</li>
            <li>✅ 操作说明提示</li>
            <li>✅ 无障碍访问支持</li>
            <li>✅ 平滑动画效果</li>
          </ul>
        </div>
      </div>
      
      {/* Fullscreen Modal */}
      <FullscreenModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="React Flow 全屏视图演示"
        className="bg-gray-100"
      >
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center">
            <div className="w-96 h-64 bg-white rounded-lg shadow-lg border-2 border-dashed border-gray-300 flex items-center justify-center mb-6">
              <div className="text-gray-500">
                <div className="text-4xl mb-2">📊</div>
                <div className="text-lg font-medium">React Flow 图表</div>
                <div className="text-sm">这里会显示完整的图表内容</div>
              </div>
            </div>
            
            <div className="text-gray-600">
              <p className="mb-2">这是一个全屏 Modal 的演示</p>
              <p className="text-sm">你可以在这里放置完整的 React Flow 图表</p>
            </div>
          </div>
        </div>
      </FullscreenModal>
    </div>
  )
}
