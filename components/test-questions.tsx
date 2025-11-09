"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertTriangle } from "lucide-react"
import { Pencil, Trash2, X, Check, Loader2 } from "lucide-react"

interface Question {
  id: number
  question: string
  answer: string
  score: number
}

export function TestQuestions() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editQuestion, setEditQuestion] = useState("")
  const [editAnswer, setEditAnswer] = useState("")
  const [editScore, setEditScore] = useState(10)

  const [isAdding, setIsAdding] = useState(false)
  const [newQuestion, setNewQuestion] = useState("")
  const [newAnswer, setNewAnswer] = useState("")
  const [newScore, setNewScore] = useState(10)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null)

  // 加载测试题
  useEffect(() => {
    const loadQuestions = async () => {
      try {
        const response = await fetch("/api/test-cases")
        if (response.ok) {
          const data = await response.json()
          setQuestions(data.checks)
        }
      } catch (error) {
        console.error("Failed to load questions:", error)
      } finally {
        setLoading(false)
      }
    }

    loadQuestions()
  }, [])

  const handleEdit = (question: Question) => {
    setEditingId(question.id)
    setEditQuestion(question.question)
    setEditAnswer(question.answer)
    setEditScore(question.score)

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
          score: editScore
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setQuestions(data.data.checks)
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
        setQuestions(data.data.checks)
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
        const response = await fetch('/api/test-cases', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'add',
            question: newQuestion,
            answer: newAnswer,
            score: newScore
          }),
        })

        if (response.ok) {
          const data = await response.json()
          setQuestions(data.data.checks)
          setNewQuestion("")
          setNewAnswer("")
          setNewScore(10)
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
          <div key={question.id} className="border border-border rounded-lg p-4 space-y-3 bg-background">
            {editingId === question.id ? (
              <>
                <div className="space-y-2">
                  <textarea
                    ref={(el) => {
                      if (el) {
                        el.style.height = "auto"
                        el.style.height = el.scrollHeight + "px"
                      }
                    }}
                    value={editQuestion}
                    onChange={(e) => {
                      setEditQuestion(e.target.value)
                      e.target.style.height = "auto"
                      e.target.style.height = e.target.scrollHeight + "px"
                    }}
                    placeholder="请输入问题..."
                    className="w-full px-0 py-2 text-sm bg-transparent border-0 border-b border-border focus:border-foreground focus:outline-none resize-none transition-colors overflow-hidden"
                    rows={1}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement
                      target.style.height = "auto"
                      target.style.height = target.scrollHeight + "px"
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <textarea
                    ref={(el) => {
                      if (el) {
                        el.style.height = "auto"
                        el.style.height = el.scrollHeight + "px"
                      }
                    }}
                    value={editAnswer}
                    onChange={(e) => {
                      setEditAnswer(e.target.value)
                      e.target.style.height = "auto"
                      e.target.style.height = e.target.scrollHeight + "px"
                    }}
                    placeholder="请输入标准答案..."
                    className="w-full px-0 py-2 text-sm bg-transparent border-0 border-b border-border focus:border-foreground focus:outline-none resize-none transition-colors overflow-hidden"
                    rows={1}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement
                      target.style.height = "auto"
                      target.style.height = target.scrollHeight + "px"
                    }}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelEdit}
                    disabled={saving}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4 mr-1" />
                    取消
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSaveEdit(question.id)}
                    disabled={saving}
                    className="bg-foreground text-background hover:bg-foreground/90"
                  >
                    {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                    确定
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-foreground">{question.question}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{question.answer}</p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(question)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    编辑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(question.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    删除
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}

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
                className="w-full px-0 py-2 text-sm bg-transparent border-0 border-b border-border focus:border-foreground focus:outline-none resize-none transition-colors overflow-hidden"
                rows={1}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement
                  target.style.height = "auto"
                  target.style.height = target.scrollHeight + "px"
                }}
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
                className="w-full px-0 py-2 text-sm bg-transparent border-0 border-b border-border focus:border-foreground focus:outline-none resize-none transition-colors overflow-hidden"
                rows={1}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement
                  target.style.height = "auto"
                  target.style.height = target.scrollHeight + "px"
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelAdd}
                disabled={saving}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleAddQuestion}
                disabled={saving}
                className="bg-foreground text-background hover:bg-foreground/90"
              >
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                确定
              </Button>
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

      {/* 删除确认对话框 */}
      <Dialog open={showDeleteConfirm !== null} onOpenChange={cancelDelete}>
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
            <Button variant="outline" onClick={cancelDelete}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  删除中...
                </>
              ) : (
                "删除"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}