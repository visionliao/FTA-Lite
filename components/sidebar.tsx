"use client"

import { cn } from "@/lib/utils"
import { FileText, Lightbulb, Settings, Play, BookOpen, PanelLeftClose, PanelLeftOpen, ListChecks, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SidebarProps {
  activeSection: string
  onSectionChange: (section: string) => void
  collapsed: boolean
  onToggleCollapse: () => void
  isMobile: boolean
}

const menuItems = [
  {
    id: "project-overview",
    label: "项目配置",
    icon: FileText,
  },
  {
    id: "model-settings",
    label: "模型设置",
    icon: Settings,
  },
  {
    id: "test-questions",
    label: "测试题集",
    icon: ListChecks,
  },
  {
    id: "run-results",
    label: "开始运行",
    icon: Play,
  },
  {
    id: "data-analysis",
    label: "测试报告",
    icon: BarChart3,
  },
  {
    id: "user-manual",
    label: "使用手册",
    icon: BookOpen,
  },
]

export function Sidebar({ activeSection, onSectionChange, collapsed, onToggleCollapse, isMobile }: SidebarProps) {
  return (
    <>
      {isMobile && !collapsed && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onToggleCollapse} />
      )}

      <div
        className={cn(
          "bg-muted/30 border-r border-border transition-all duration-300 flex-shrink-0",
          collapsed ? "w-0 md:w-16" : "w-80",
          isMobile && !collapsed && "fixed left-0 top-0 h-full z-50",
        )}
      >
        <div className={cn("h-full overflow-hidden", collapsed && "w-16")}>
          <div className="p-6">
            <div className="mb-8">
              <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between")}>
                {!collapsed && (
                  <div>
                    <h1 className="text-xl font-semibold text-foreground mb-1">FTA</h1>
                    <p className="text-sm text-muted-foreground">factory test agent<br/>工厂测试工具</p>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleCollapse}
                  className="h-8 w-8 p-0 hover:bg-secondary"
                  title={collapsed ? "显示面板" : "隐藏面板"}
                >
                  {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <nav className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon
                const isActive = activeSection === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => onSectionChange(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                      isActive
                        ? "bg-secondary text-secondary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                      collapsed && "justify-center",
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                  </button>
                )
              })}
            </nav>
          </div>
        </div>
      </div>
    </>
  )
}
