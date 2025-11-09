"use client"

import { useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { ModelSettings } from "@/components/model-settings"
import { ProjectOverview } from "@/components/project-overview"
import { TestQuestions } from "@/components/test-questions"
import { RunResults } from "@/components/run-results"
import { UserManual } from "@/components/user-manual"
import { useAppStore } from "@/store/app-store"
import { DataAnalysis } from "@/components/data-analysis"

export function SettingsLayout() {
  const {
    activeSection,
    sidebarCollapsed,
    isMobile,
    setActiveSection,
    setSidebarCollapsed,
    setIsMobile
  } = useAppStore()

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile) {
        setSidebarCollapsed(true)
      }
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [setIsMobile, setSidebarCollapsed])

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        isMobile={isMobile}
      />
      <main className="flex-1 min-w-0 overflow-auto">
        {activeSection === "project-overview" && <ProjectOverview />}
        {activeSection === "model-settings" && <ModelSettings />}
        {activeSection === "test-questions" && <TestQuestions />}
        {activeSection === "run-results" && <RunResults />}
        {activeSection === "data-analysis" && <DataAnalysis />}
        {activeSection === "user-manual" && <UserManual />}
        {/* Other sections can be added here */}
      </main>
    </div>
  )
}
