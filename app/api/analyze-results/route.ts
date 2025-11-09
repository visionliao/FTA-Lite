import { NextRequest } from 'next/server'
import { readdir, readFile, mkdir } from 'fs/promises'
import { join } from 'path'

// 扫描结果目录
export async function GET() {
  try {
    const resultDir = join(process.cwd(), 'output', 'result')
    
    // Try to create the directory if it doesn't exist
    try {
      await mkdir(resultDir, { recursive: true })
    } catch (error) {
      // If directory already exists, that's fine
      if ((error as any).code !== 'EEXIST') {
        throw error
      }
    }

    // 读取目录列表
    const directories = await readdir(resultDir, { withFileTypes: true })

    // 过滤出目录并按名称排序（最新的在前面）
    const timestampDirs = directories
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .sort()
      .reverse()

    return Response.json({
      success: true,
      directories: timestampDirs
    })
  } catch (error) {
    console.error('Error scanning result directories:', error)
    return Response.json({
      success: false,
      error: 'Failed to scan result directories'
    }, { status: 500 })
  }
}

// 分析结果数据
export async function POST(request: NextRequest) {
  try {
    const { directory, getLoops, loop } = await request.json()
    
    if (getLoops && directory) {
      // 获取指定目录下的循环次数
      return await getLoopsForDirectory(directory)
    } else if (directory && loop) {
      // 分析指定目录和循环
      return await analyzeLoopResult(directory, loop)
    } else if (!directory || directory === '全部分析') {
      // 分析所有目录
      return await analyzeAllDirectories()
    } else {
      // 分析指定目录
      return await analyzeDirectory(directory)
    }
  } catch (error) {
    console.error('Error analyzing results:', error)
    return Response.json({
      success: false,
      error: 'Failed to analyze results'
    }, { status: 500 })
  }
}

async function analyzeAllDirectories() {
  const resultDir = join(process.cwd(), 'output', 'result')

  // Try to create the directory if it doesn't exist
  try {
    await mkdir(resultDir, { recursive: true })
  } catch (error) {
    // If directory already exists, that's fine
    if ((error as any).code !== 'EEXIST') {
      throw error
    }
  }

  const directories = await readdir(resultDir, { withFileTypes: true })
  const timestampDirs = directories
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
    .sort() // 按时间排序，最新的在后面
    .reverse() // 反转，最新的在前面

  const directoryResults: any[] = []

  for (const dir of timestampDirs) {
    const dirResult = await analyzeDirectory(dir, false)
    if (dirResult && typeof dirResult === 'object' && 'success' in dirResult && dirResult.success) {
      const frameworkStatsValues = Object.values(dirResult.frameworkStats) as any[]
      const firstStat = frameworkStatsValues[0]
      
      directoryResults.push({
        directory: dir,
        frameworkStats: dirResult.frameworkStats,
        loopCount: firstStat?.loopCount || 0
      })
    }
  }

  return Response.json({
    success: true,
    directory: '全部分析',
    isMultiDirectory: true,
    directoryResults,
    directories: timestampDirs
  })
}

async function analyzeDirectory(directory: string, returnFullResult = true): Promise<any> {
  try {
    const dirPath = join(process.cwd(), 'output', 'result', directory)
    const frameworkScores: Record<string, number[]> = {}

    // 获取单轮循环的问题数量和问题总分（通过读取第一个结果文件）
    let questionCount = 10 // 默认值，如果无法确定则使用默认值
    let maxPossibleScore = 0 // 问题总分（所有问题的maxScore相加）
    try {
      const firstResultPath = join(dirPath, '1', 'results.json')
      const firstResultsContent = await readFile(firstResultPath, 'utf-8')
      const firstResults = JSON.parse(firstResultsContent)
      questionCount = firstResults.length

      // 计算问题总分（所有问题的maxScore相加）
      maxPossibleScore = firstResults.reduce((sum: number, item: any) => {
        return sum + (item.maxScore || 0)
      }, 0)
    } catch (error) {
      console.warn('Could not determine question count and max possible score, using default values:', error)
    }

    // 读取循环目录
    const loopDirs = await readdir(dirPath, { withFileTypes: true })

    for (const loopDir of loopDirs) {
      if (!loopDir.isDirectory()) continue

      const loopPath = join(dirPath, loopDir.name)
      const frameworkDirs = await readdir(loopPath, { withFileTypes: true })

      for (const frameworkDir of frameworkDirs) {
        if (!frameworkDir.isDirectory()) continue

        const frameworkPath = join(loopPath, frameworkDir.name)
        const resultsFile = join(frameworkPath, 'results.json')

        try {
          const resultsContent = await readFile(resultsFile, 'utf-8')
          const results = JSON.parse(resultsContent)

          // 提取分数
          const scores = results
            .filter((item: any) => item.score !== undefined)
            .map((item: any) => item.score)

          if (scores.length > 0) {
            if (!frameworkScores[frameworkDir.name]) {
              frameworkScores[frameworkDir.name] = []
            }
            frameworkScores[frameworkDir.name].push(...scores)
          }
        } catch (error) {
          console.warn(`Failed to read results for ${frameworkDir.name}:`, error)
        }
      }
    }

    const result = {
      success: true,
      directory,
      frameworkScores,
      frameworkStats: calculateFrameworkStats(frameworkScores, questionCount, maxPossibleScore)
    }

    return returnFullResult ? Response.json(result) : result
  } catch (error) {
    const result = {
      success: false,
      directory,
      error: 'Failed to analyze directory'
    }
    return returnFullResult ? Response.json(result, { status: 500 }) : result
  }
}

async function getLoopsForDirectory(directory: string) {
  try {
    const dirPath = join(process.cwd(), 'output', 'result', directory)
    const loopDirs = await readdir(dirPath, { withFileTypes: true })

    // 过滤出目录并排序
    const loops = loopDirs
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .sort((a, b) => parseInt(a) - parseInt(b))

    return Response.json({
      success: true,
      loops
    })
  } catch (error) {
    return Response.json({
      success: false,
      error: 'Failed to get loops'
    }, { status: 500 })
  }
}

async function analyzeLoopResult(directory: string, loop: string) {
  try {
    if (loop === 'all') {
      return await analyzeAllLoopsResult(directory)
    }

    const resultPath = join(process.cwd(), 'output', 'result', directory, loop, 'results.json')
    const resultsContent = await readFile(resultPath, 'utf-8')
    const results = JSON.parse(resultsContent)

    return Response.json({
      success: true,
      directory,
      loop,
      results
    })
  } catch (error) {
    return Response.json({
      success: false,
      error: 'Failed to analyze loop result'
    }, { status: 500 })
  }
}

async function analyzeAllLoopsResult(directory: string) {
  try {
    const dirPath = join(process.cwd(), 'output', 'result', directory)
    const loopDirs = await readdir(dirPath, { withFileTypes: true })

    // 过滤出目录并排序
    const loops = loopDirs
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .sort((a, b) => parseInt(a) - parseInt(b))

    const allResults: any[] = []

    // 读取所有轮次的结果
    for (const loop of loops) {
      const resultPath = join(dirPath, loop, 'results.json')
      try {
        const resultsContent = await readFile(resultPath, 'utf-8')
        const results = JSON.parse(resultsContent)

        // 为每个结果添加轮次信息
        results.forEach((result: any) => {
          allResults.push({
            ...result,
            loop
          })
        })
      } catch (error) {
        console.warn(`Failed to read results for loop ${loop}:`, error)
      }
    }

    if (allResults.length === 0) {
      throw new Error('No results found')
    }

    return Response.json({
      success: true,
      directory,
      loop: 'all',
      results: allResults,
      isAllLoops: true
    })
  } catch (error) {
    return Response.json({
      success: false,
      error: 'Failed to analyze all loops result'
    }, { status: 500 })
  }
}

function calculateFrameworkStats(frameworkScores: Record<string, number[]>, questionCount: number, maxPossibleScore: number) {
  const stats: Record<string, {
    totalScore: number
    averageScore: number
    questionCount: number
    maxScore: number
    minScore: number
    averageTotalScore: number // 每轮循环的平均总分
    loopCount: number // 循环次数
    allLoopTotalScores: number[] // 所有循环的总分列表
    maxPossibleScore: number // 问题总分（所有问题的maxScore相加）
  }> = {}

  Object.entries(frameworkScores).forEach(([framework, scores]) => {
    if (scores.length > 0) {
      // 计算平均分（每个问题的平均分）
      const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length

      // 找出最高分和最低分
      const maxScore = Math.max(...scores)
      const minScore = Math.min(...scores)

      // 根据问题数量计算循环次数
      const loopCount = scores.length / questionCount

      // 计算每轮循环的平均总分
      let averageTotalScore = 0
      const allLoopTotalScores: number[] = []
      if (loopCount > 0) {
        // 将分数按每轮的问题数量进行分组
        for (let i = 0; i < loopCount; i++) {
          const startIndex = i * questionCount
          const loopScore = scores.slice(startIndex, startIndex + questionCount).reduce((sum, score) => sum + score, 0)
          allLoopTotalScores.push(loopScore)
        }
        averageTotalScore = allLoopTotalScores.reduce((sum, score) => sum + score, 0) / allLoopTotalScores.length
      }

      stats[framework] = {
        totalScore: Number(averageTotalScore.toFixed(2)), // 使用平均总分而不是总分累加
        averageScore: Number(averageScore.toFixed(2)),
        questionCount: questionCount, // 动态计算的问题数量
        maxScore,
        minScore,
        averageTotalScore: Number(averageTotalScore.toFixed(2)),
        loopCount,
        allLoopTotalScores,
        maxPossibleScore: maxPossibleScore // 问题总分（所有问题的maxScore相加）
      }
    }
  })

  return stats
}