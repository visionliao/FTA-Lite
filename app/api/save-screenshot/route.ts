import { NextRequest } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

export async function POST(request: NextRequest) {
  try {
    const { imageData, filename, directory = 'output/reports' } = await request.json()
    
    if (!imageData || !filename) {
      return Response.json({
        success: false,
        error: 'Missing image data or filename'
      }, { status: 400 })
    }

    // Remove data URL prefix if present
    const base64Data = imageData.replace(/^data:image\/png;base64,/, '')
    const imageBuffer = Buffer.from(base64Data, 'base64')

    // Create directory if it doesn't exist
    const fullPath = join(process.cwd(), directory)
    try {
      await mkdir(fullPath, { recursive: true })
    } catch (error) {
        // If directory already exists, that's fine
        if ((error as any).code !== 'EEXIST') {
          throw error
        }
    }

    // Save the image
    const filePath = join(fullPath, filename)
    await writeFile(filePath, imageBuffer)

    return Response.json({
      success: true,
      path: filePath,
      message: `Screenshot saved to ${directory}/${filename}`
    })
  } catch (error) {
    console.error('Error saving screenshot:', error)
    return Response.json({
      success: false,
      error: 'Failed to save screenshot'
    }, { status: 500 })
  }
}