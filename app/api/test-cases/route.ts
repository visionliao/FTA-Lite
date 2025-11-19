import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const TEST_CASES_PATH = path.join(process.cwd(), 'template', 'questions', 'test_cases.json')

export async function GET() {
  try {
    const data = await fs.readFile(TEST_CASES_PATH, 'utf-8')
    const testCases = JSON.parse(data)
    return NextResponse.json(testCases)
  } catch (error) {
    console.error('Error reading test cases:', error)
    return NextResponse.json({ error: 'Failed to read test cases' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const { action, id, question, answer, score, tag, source } = data

    // 读取现有数据
    const fileData = await fs.readFile(TEST_CASES_PATH, 'utf-8')
    let questions = JSON.parse(fileData)

    if (!Array.isArray(questions)) {
      // 容错处理：如果文件损坏或为空
      questions = []
    }

    switch (action) {
      case 'add':
        const newId = questions.length > 0
          ? Math.max(...questions.map((c: any) => c.id)) + 1
          : 1

        questions.push({
          id: newId,
          tag: tag || "",
          source: "用户自定义",
          question,
          answer,
          score: score || 10
        })
        break

      case 'edit':
        questions = questions.map((item: any) =>
          item.id === id ? {
            ...item,
            question,
            answer,
            score: score || 10,
            tag: tag || "",
            source: source
          } : item
        )
        break

      case 'delete':
        questions = questions.filter((item: any) => item.id !== id)
        break

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // 写入文件
    await fs.writeFile(TEST_CASES_PATH, JSON.stringify(questions, null, 2), 'utf-8')

    return NextResponse.json({ success: true, data: questions })
  } catch (error) {
    console.error('Error updating test cases:', error)
    return NextResponse.json({ error: 'Failed to update test cases' }, { status: 500 })
  }
}