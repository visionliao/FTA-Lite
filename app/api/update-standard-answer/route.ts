import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, readdir } from 'fs/promises'
import { join } from 'path'

// 更新标准答案和测试结果的API
export async function POST(request: NextRequest) {
  try {
    const { questionId, modelAnswer, loop, directory } = await request.json()

    if (!questionId || !modelAnswer || !directory) {
      return NextResponse.json({
        success: false,
        error: '缺少必要参数: questionId, modelAnswer 或 directory'
      }, { status: 400 })
    }

    console.log(`[Update Standard Answer] Starting update for question #${questionId}`)
    console.log(`[Update Standard Answer] Directory: ${directory}, Loop: ${loop}`)

    // 1. 更新 template/questions/test_cases.json 中的标准答案
    const testCasesPath = join(process.cwd(), 'template', 'questions', 'test_cases.json')
    const testCasesContent = await readFile(testCasesPath, 'utf-8')
    const testCases = JSON.parse(testCasesContent)

    const questionIndex = testCases.findIndex((q: any) => q.id === questionId)
    if (questionIndex === -1) {
      return NextResponse.json({
        success: false,
        error: `未找到问题 ID: ${questionId}`
      }, { status: 404 })
    }

    const oldAnswer = testCases[questionIndex].answer
    const maxScore = testCases[questionIndex].score
    testCases[questionIndex].answer = modelAnswer

    await writeFile(testCasesPath, JSON.stringify(testCases, null, 2), 'utf-8')
    console.log(`[Update Standard Answer] Updated test_cases.json for question #${questionId}`)

    // 2. 更新测试结果文件中的分数
    const resultBaseDir = join(process.cwd(), 'output', 'result', directory)

    if (loop === 'all') {
      // 全部轮次：更新所有轮次的 results.json
      const loopDirs = await readdir(resultBaseDir, { withFileTypes: true })
      const loops = loopDirs
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .sort((a, b) => parseInt(a) - parseInt(b))

      console.log(`[Update Standard Answer] Updating all loops: ${loops.join(', ')}`)

      for (const loopNum of loops) {
        await updateResultFile(join(resultBaseDir, loopNum, 'results.json'), questionId, maxScore)
      }
    } else {
      // 单个轮次：只更新指定轮次的 results.json
      console.log(`[Update Standard Answer] Updating single loop: ${loop}`)
      await updateResultFile(join(resultBaseDir, loop, 'results.json'), questionId, maxScore)
    }

    console.log(`[Update Standard Answer] All updates completed successfully`)

    return NextResponse.json({
      success: true,
      questionId,
      oldAnswer,
      newAnswer: modelAnswer,
      maxScore
    })
  } catch (error: any) {
    console.error('[Update Standard Answer] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || '更新标准答案失败'
    }, { status: 500 })
  }
}

// 辅助函数：更新单个结果文件中的分数
async function updateResultFile(filePath: string, questionId: number, maxScore: number) {
  try {
    const content = await readFile(filePath, 'utf-8')
    const results = JSON.parse(content)

    let updated = false
    results.forEach((result: any) => {
      if (result.id === questionId) {
        result.score = maxScore
        updated = true
        console.log(`[Update Standard Answer] Updated score to ${maxScore} for question #${questionId} in ${filePath}`)
      }
    })

    if (updated) {
      await writeFile(filePath, JSON.stringify(results, null, 2), 'utf-8')
    }
  } catch (error) {
    console.error(`[Update Standard Answer] Failed to update ${filePath}:`, error)
    throw error
  }
}
