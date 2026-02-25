import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'

interface PageRef {
  fileIndex: number
  pageIndex: number
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const targetWidth = parseFloat(formData.get('targetWidth') as string)
    const pageOrderStr = formData.get('pageOrder') as string

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: '파일이 제공되지 않았습니다' },
        { status: 400 }
      )
    }

    if (!targetWidth || targetWidth <= 0) {
      return NextResponse.json(
        { error: '올바른 타겟 해상도를 입력하세요' },
        { status: 400 }
      )
    }

    let pageOrder: PageRef[]
    try {
      pageOrder = JSON.parse(pageOrderStr || '[]') as PageRef[]
    } catch {
      return NextResponse.json(
        { error: '페이지 순서 형식이 올바르지 않습니다' },
        { status: 400 }
      )
    }

    if (pageOrder.length === 0) {
      return NextResponse.json(
        { error: '병합할 페이지를 선택하세요' },
        { status: 400 }
      )
    }

    console.log(`${files.length}개 파일에서 ${pageOrder.length}페이지를 ${targetWidth}px로 혼합 시작...`)

    const mergedPdf = await PDFDocument.create()
    let resultWidth = 0
    let resultHeight = 0

    // PDF 문서들을 미리 로드
    const pdfDocs: PDFDocument[] = []
    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(arrayBuffer)
      pdfDocs.push(pdfDoc)
    }

    for (let i = 0; i < pageOrder.length; i++) {
      const { fileIndex, pageIndex } = pageOrder[i]

      if (fileIndex < 0 || fileIndex >= pdfDocs.length) continue

      const pdfDoc = pdfDocs[fileIndex]
      const pages = pdfDoc.getPages()

      if (pageIndex < 0 || pageIndex >= pages.length) continue

      const page = pages[pageIndex]
      const { width: sourceWidth, height: sourceHeight } = page.getSize()
      const scale = targetWidth / sourceWidth

      const newWidth = sourceWidth * scale
      const newHeight = sourceHeight * scale

      if (i === 0) {
        resultWidth = Math.round(newWidth)
        resultHeight = Math.round(newHeight)
      }

      // 새 문서에 페이지 복사
      const [copiedPage] = await mergedPdf.copyPages(pdfDoc, [pageIndex])
      mergedPdf.addPage(copiedPage)

      // 복사된 페이지에 스케일 적용 (마지막에 추가된 페이지)
      const addedPage = mergedPdf.getPage(mergedPdf.getPageCount() - 1)
      addedPage.setSize(newWidth, newHeight)
      addedPage.scaleContent(scale, scale)
      const scaledHeight = sourceHeight * scale
      addedPage.translateContent(0, newHeight - scaledHeight)
    }

    if (mergedPdf.getPageCount() === 0) {
      return NextResponse.json(
        { error: '병합할 유효한 페이지가 없습니다' },
        { status: 400 }
      )
    }

    const mergedPdfBytes = await mergedPdf.save()
    const filename = `mixed_${resultWidth}px.pdf`
    const encodedFilename = encodeURIComponent(filename)

    return new NextResponse(Buffer.from(mergedPdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
        'X-Result-Width': resultWidth.toString(),
        'X-Result-Height': resultHeight.toString(),
        'X-Total-Pages': mergedPdf.getPageCount().toString(),
      },
    })
  } catch (error) {
    console.error('PDF 혼합 오류:', error)
    return NextResponse.json(
      { error: 'PDF 혼합 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
