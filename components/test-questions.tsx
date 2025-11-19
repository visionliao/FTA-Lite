"use client"

import { useState, useEffect, useMemo } from "react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertTriangle } from "lucide-react"
import { Pencil, Trash2, X, Check, Loader2, Tag, FileText } from "lucide-react"

interface Question {
  id: number
  tag: string
  source: string
  question: string
  answer: string
  score: number
}

export function TestQuestions() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)

  // 编辑
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTagParts, setEditTagParts] = useState<string[]>([])
  const [editSource, setEditSource] = useState("")
  const [editQuestion, setEditQuestion] = useState("")
  const [editAnswer, setEditAnswer] = useState("")
  const [editScore, setEditScore] = useState(10)

  // 新增
  const [isAdding, setIsAdding] = useState(false)
  const [newTagParts, setNewTagParts] = useState<string[]>([])
  const [newQuestion, setNewQuestion] = useState("")
  const [newAnswer, setNewAnswer] = useState("")
  const [newScore, setNewScore] = useState(10)

  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null)

  // 计算数据中出现Tag最大层级深度（例如 local-spark-qa 是3层）
  const maxTagLevels = useMemo(() => {
    let max = 0
    questions.forEach(q => {
      const parts = (q.tag || "").split("-")
      if (parts.length > max) max = parts.length
    })
    return max > 0 ? max : 3 // 默认为3层
  }, [questions])

  // 计算每一层有哪些可选值
  // 返回结构如: [ ["local", "global"], ["spark", "other"], ["qa", "building"] ]
  const tagOptions = useMemo(() => {
    const options: Set<string>[] = Array.from({ length: maxTagLevels }, () => new Set())

    questions.forEach(q => {
      const parts = (q.tag || "").split("-")
      parts.forEach((part, index) => {
        if (index < maxTagLevels && part) {
          options[index].add(part)
        }
      })
    })

    return options.map(set => Array.from(set))
  }, [questions, maxTagLevels])

  // 加载测试题
  useEffect(() => {
    const loadQuestions = async () => {
      try {
        const response = await fetch("/api/test-cases")
        if (response.ok) {
          const data = await response.json()
          setQuestions(data)
        }
      } catch (error) {
        console.error("Failed to load questions:", error)
      } finally {
        setLoading(false)
      }
    }

    loadQuestions()
  }, [])

  // 初始化新增时的默认标签
  useEffect(() => {
    if (isAdding && newTagParts.length === 0) {
      setNewTagParts(Array(maxTagLevels).fill(""))
    }
  }, [isAdding, maxTagLevels, newTagParts.length])

  const handleEdit = (question: Question) => {
    setEditingId(question.id)
    setEditQuestion(question.question)
    setEditAnswer(question.answer)
    setEditScore(question.score)
    setEditSource(question.source || "")

    // 初始化标签下拉框
    const parts = question.tag ? question.tag.split("-") : []
    // 补齐数组长度，用空字符串填充，绝不使用 default
    while (parts.length < maxTagLevels) {
      parts.push("")
    }
    setEditTagParts(parts)

    // 延迟调整高度，确保 DOM 更新后执行
    setTimeout(() => {
      const editQuestionElement = document.querySelector(`textarea[placeholder="请输入问题..."]`) as HTMLTextAreaElement
      const editAnswerElement = document.querySelector(`textarea[placeholder="请输入标准答案..."]`) as HTMLTextAreaElement

      if (editQuestionElement) {
        editQuestionElement.style.height = "auto"
        editQuestionElement.style.height = editQuestionElement.scrollHeight + "px"
      }
      if (editAnswerElement) {
        editAnswerElement.style.height = "auto"
        editAnswerElement.style.height = editAnswerElement.scrollHeight + "px"
      }
    }, 0)
  }

  const handleSaveEdit = async (id: number) => {
    setSaving(true)
    try {
      const finalTag = editTagParts.filter(p => p.trim() !== "").join("-")
      const response = await fetch('/api/test-cases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'edit',
          id,
          question: editQuestion,
          answer: editAnswer,
          score: editScore,
          tag: finalTag,
          source: editSource
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setQuestions(data.data)
        setEditingId(null)
        setEditQuestion("")
        setEditAnswer("")
        setEditScore(10)
      } else {
        alert('保存失败')
      }
    } catch (error) {
      console.error('Error saving edit:', error)
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditQuestion("")
    setEditAnswer("")
    setEditScore(10)
  }

  const handleDelete = async (id: number) => {
    setShowDeleteConfirm(id)
  }

  const confirmDelete = async () => {
    if (showDeleteConfirm === null) return

    setSaving(true)
    try {
      const response = await fetch('/api/test-cases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete',
          id: showDeleteConfirm
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setQuestions(data.data)
        setShowDeleteConfirm(null)
      } else {
        alert('删除失败')
      }
    } catch (error) {
      console.error('Error deleting:', error)
      alert('删除失败')
    } finally {
      setSaving(false)
    }
  }

  const cancelDelete = () => {
    setShowDeleteConfirm(null)
  }

  const handleAddQuestion = async () => {
    if (newQuestion.trim() && newAnswer.trim()) {
      setSaving(true)
      try {
        const finalTag = newTagParts.filter(p => p.trim() !== "").join("-")
        const response = await fetch('/api/test-cases', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'add',
            question: newQuestion,
            answer: newAnswer,
            score: newScore,
            tag: finalTag
          }),
        })

        if (response.ok) {
          const data = await response.json()
          setQuestions(data.data)
          setNewQuestion("")
          setNewAnswer("")
          setNewScore(10)
          setNewTagParts(Array(maxTagLevels).fill(""))
          setIsAdding(false)
        } else {
          alert('添加失败')
        }
      } catch (error) {
        console.error('Error adding question:', error)
        alert('添加失败')
      } finally {
        setSaving(false)
      }
    }
  }

  const handleCancelAdd = () => {
    setNewQuestion("")
    setNewAnswer("")
    setNewScore(10)
    setIsAdding(false)
  }

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl mx-auto">
        <div className="mb-6 border-b border-border pb-4 md:mb-8">
          <h1 className="text-xl md:text-2xl font-semibold text-foreground">测试题集</h1>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">加载测试题...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl mx-auto">
      <div className="mb-6 border-b border-border pb-4 md:mb-8">
        <h1 className="text-xl font-semibold text-foreground md:text-2xl">测试题集</h1>
      </div>

      <div className="space-y-4">
        {questions.map((question) => (
          // 添加 'group' 类，使子元素的 group-hover 生效
          <div key={question.id} className="border border-border rounded-lg p-4 space-y-3 bg-background group hover:shadow-sm transition-all">
            {editingId === question.id ? (
              <>
                {/* 编辑模式：问题 */}
                <div className="space-y-2">
                  <textarea
                    value={editQuestion}
                    onChange={(e) => {
                      setEditQuestion(e.target.value)
                      e.target.style.height = "auto"
                      e.target.style.height = e.target.scrollHeight + "px"
                    }}
                    placeholder="请输入问题..."
                    className="w-full px-0 py-2 text-base font-medium bg-transparent border-0 border-b border-border focus:border-foreground focus:outline-none resize-none"
                    rows={1}
                  />
                </div>

                {/* 编辑模式：答案 */}
                <div className="space-y-2">
                  <textarea
                    value={editAnswer}
                    onChange={(e) => {
                      setEditAnswer(e.target.value)
                      e.target.style.height = "auto"
                      e.target.style.height = e.target.scrollHeight + "px"
                    }}
                    placeholder="请输入标准答案..."
                    className="w-full px-0 py-2 text-sm text-muted-foreground bg-transparent border-0 border-b border-border focus:border-foreground focus:outline-none resize-none"
                    rows={1}
                  />
                </div>

                {/* 编辑模式：标签 */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-2">
                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <span className="text-xs text-muted-foreground mr-1">标签:</span>
                    {Array.from({ length: maxTagLevels }).map((_, index) => (
                      <select
                        key={index}
                        value={editTagParts[index] || ""}
                        onChange={(e) => {
                          const newParts = [...editTagParts]
                          newParts[index] = e.target.value
                          setEditTagParts(newParts)
                        }}
                        className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {/* 增加空选项，不强制默认值 */}
                        <option value="">--</option>
                        {tagOptions[index]?.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 w-full md:w-auto">
                    <Button variant="ghost" size="sm" onClick={handleCancelEdit} disabled={saving}>
                      <X className="h-4 w-4 mr-1" /> 取消
                    </Button>
                    <Button size="sm" onClick={() => handleSaveEdit(question.id)} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />} 确定
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* 查看模式：顶部 Badge 区域 */}
                {/* 只有当 tag 或 source 存在时才渲染这个区域，避免空白占用 */}
                {(question.tag || question.source) && (
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {/* 只有当 tag 有值时才显示 */}
                    {question.tag && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded-md">
                        <Tag className="w-3 h-3" />
                        <span>类型:</span>
                        <div className="flex gap-1">
                          {question.tag.split('-').map((part, idx) => (
                            <span key={idx} className="font-medium text-foreground/80">
                              {part}
                              {idx < question.tag.split('-').length - 1 && <span className="mx-0.5 text-muted-foreground/50">/</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 只有当 source 有值时才显示 */}
                    {question.source && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary/30 px-2 py-1 rounded-md">
                        <FileText className="w-3 h-3" />
                        <span>来源: {question.source}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1">
                  <p className="text-base font-medium text-foreground">{question.question}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{question.answer}</p>
                </div>

                {/* group-hover 配合父容器的 group 类 */}
                <div className="flex justify-end gap-2 pt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(question)} className="text-muted-foreground hover:text-foreground h-8 px-2">
                    <Pencil className="h-3.5 w-3.5 mr-1" /> 编辑
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(question.id)} className="text-muted-foreground hover:text-destructive h-8 px-2">
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> 删除
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}

        {/* 新增模式 */}
        {isAdding && (
          <div className="border border-border rounded-lg p-4 space-y-3 bg-background">
            <div className="space-y-2">
              <textarea
                value={newQuestion}
                onChange={(e) => {
                  setNewQuestion(e.target.value)
                  e.target.style.height = "auto"
                  e.target.style.height = e.target.scrollHeight + "px"
                }}
                placeholder="请输入问题..."
                className="w-full px-0 py-2 text-base font-medium bg-transparent border-0 border-b border-border focus:border-foreground focus:outline-none resize-none"
                rows={1}
              />
            </div>
            <div className="space-y-2">
              <textarea
                value={newAnswer}
                onChange={(e) => {
                  setNewAnswer(e.target.value)
                  e.target.style.height = "auto"
                  e.target.style.height = e.target.scrollHeight + "px"
                }}
                placeholder="请输入标准答案..."
                className="w-full px-0 py-2 text-sm text-muted-foreground bg-transparent border-0 border-b border-border focus:border-foreground focus:outline-none resize-none"
                rows={1}
              />
            </div>

            {/* 新增模式底部：只显示标签选择，不显示来源输入 */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-2">
               <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <span className="text-xs text-muted-foreground mr-1">标签:</span>
                  {Array.from({ length: maxTagLevels }).map((_, index) => (
                    <select
                      key={index}
                      value={newTagParts[index] || ""}
                      onChange={(e) => {
                        const newParts = [...newTagParts]
                        newParts[index] = e.target.value
                        setNewTagParts(newParts)
                      }}
                      className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="">--</option>
                      {tagOptions[index]?.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ))}
               </div>

              <div className="flex justify-end gap-2 w-full md:w-auto">
                <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)} disabled={saving}>
                  <X className="h-4 w-4 mr-1" /> 取消
                </Button>
                <Button size="sm" onClick={handleAddQuestion} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />} 确定
                </Button>
              </div>
            </div>
          </div>
        )}

        {!isAdding && (
          <div className="flex justify-end pt-2">
            <Button onClick={() => setIsAdding(true)} variant="outline" className="border-border hover:bg-secondary">
              新增问题
            </Button>
          </div>
        )}
      </div>

      <Dialog open={showDeleteConfirm !== null} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              确认删除
            </DialogTitle>
            <DialogDescription>
              确定要删除这个问题吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : "删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}