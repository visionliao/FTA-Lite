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
    const { action, id, question, answer, score } = data

    // 读取现有数据
    const fileData = await fs.readFile(TEST_CASES_PATH, 'utf-8')
    const testCases = JSON.parse(fileData)

    let newCheck

    switch (action) {
      case 'add':
        newCheck = {
          id: Math.max(...testCases.checks.map((c: any) => c.id), 0) + 1,
          question,
          answer,
          score: score || 10
        }
        testCases.checks.push(newCheck)
        break

      case 'edit':
        testCases.checks = testCases.checks.map((check: any) => 
          check.id === id ? { ...check, question, answer, score: score || 10 } : check
        )
        break

      case 'delete':
        testCases.checks = testCases.checks.filter((check: any) => check.id !== id)
        break

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // 写入文件
    await fs.writeFile(TEST_CASES_PATH, JSON.stringify(testCases, null, 2), 'utf-8')

    return NextResponse.json({ success: true, data: testCases })
  } catch (error) {
    console.error('Error updating test cases:', error)
    return NextResponse.json({ error: 'Failed to update test cases' }, { status: 500 })
  }
}