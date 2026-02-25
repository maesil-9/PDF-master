import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import puppeteer from 'puppeteer'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const pageIndex = parseInt(formData.get('pageIndex') as string, 10)

    if (!file || file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'PDF 파일이 필요합니다' },
        { status: 400 }
      )
    }

    if (isNaN(pageIndex) || pageIndex < 0) {
      return NextResponse.json(
        { error: '올바른 pageIndex가 필요합니다' },
        { status: 400 }
      )
    }

    // pdf-lib로 해당 페이지만 추출
    const arrayBuffer = await file.arrayBuffer()
    const pdfDoc = await PDFDocument.load(arrayBuffer)
    const pages = pdfDoc.getPages()

    if (pageIndex >= pages.length) {
      return NextResponse.json(
        { error: '페이지 인덱스가 범위를 벗어났습니다' },
        { status: 400 }
      )
    }

    const newPdf = await PDFDocument.create()
    const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageIndex])
    newPdf.addPage(copiedPage)
    const { width: pageWidth, height: pageHeight } = copiedPage.getSize()
    const pdfBytes = await newPdf.save()

    // Data URL로 변환 (file:// 대신 사용 - Windows 호환성)
    const base64 = Buffer.from(pdfBytes).toString('base64')
    const dataUrl = `data:application/pdf;base64,${base64}`

    // 페이지 비율에 맞춰 뷰포트 설정 (가로형/세로형 유지)
    const maxW = 200
    const maxH = 200
    const scale = Math.min(maxW / pageWidth, maxH / pageHeight)
    const viewportW = Math.round(pageWidth * scale)
    const viewportH = Math.round(pageHeight * scale)

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
    })

    const page = await browser.newPage()
    await page.setViewport({ width: viewportW, height: viewportH })
    await page.goto(dataUrl, { waitUntil: 'load', timeout: 20000 })
    // PDF 뷰어 렌더링 대기 (검은 화면 방지)
    await new Promise((r) => setTimeout(r, 2500))
    const screenshot = await page.screenshot({ type: 'png' })
    await browser.close()

    return new NextResponse(Buffer.from(screenshot as Uint8Array), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch (error: unknown) {
    const err = error as Error
    console.error('PDF 썸네일 생성 오류:', err.message, err.stack)
    return NextResponse.json(
      { error: `썸네일 생성 오류: ${err.message}` },
      { status: 500 }
    )
  }
}
