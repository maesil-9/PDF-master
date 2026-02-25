import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const pageOrderStr = formData.get('pageOrder') as string

    if (!file) {
      return NextResponse.json(
        { error: '파일이 제공되지 않았습니다' },
        { status: 400 }
      )
    }

    if (!pageOrderStr) {
      return NextResponse.json(
        { error: '페이지 순서가 제공되지 않았습니다' },
        { status: 400 }
      )
    }

    const pageOrder: number[] = JSON.parse(pageOrderStr)

    if (pageOrder.length === 0) {
      return NextResponse.json(
        { error: '페이지 순서가 비어있습니다' },
        { status: 400 }
      )
    }

    console.log(`PDF 순서 변경 시작: ${pageOrder.length}페이지`)
    console.log(`새로운 순서: [${pageOrder.join(', ')}]`)

    // 원본 PDF 파일 읽기
    const arrayBuffer = await file.arrayBuffer()
    const pdfDoc = await PDFDocument.load(arrayBuffer)
    const totalPages = pdfDoc.getPageCount()

    // 새로운 PDF 문서 생성
    const newPdf = await PDFDocument.create()

    // 지정된 순서대로 페이지 복사
    for (let i = 0; i < pageOrder.length; i++) {
      const originalPageNum = pageOrder[i]
      
      // 페이지 번호 검증 (1-based index를 0-based로 변환)
      const pageIndex = originalPageNum - 1
      
      if (pageIndex < 0 || pageIndex >= totalPages) {
        console.error(`잘못된 페이지 번호: ${originalPageNum}`)
        continue
      }

      // 원본 PDF에서 페이지 복사
      const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageIndex])
      newPdf.addPage(copiedPage)
      
      console.log(`페이지 ${originalPageNum} → 위치 ${i + 1}`)
    }

    if (newPdf.getPageCount() === 0) {
      return NextResponse.json(
        { error: '복사할 유효한 페이지가 없습니다' },
        { status: 400 }
      )
    }

    console.log(`순서 변경 완료: ${newPdf.getPageCount()}페이지`)

    // 새로운 PDF 저장
    const pdfBytes = await newPdf.save()

    // 파일명 인코딩 (한글 지원)
    const originalName = file.name.replace('.pdf', '_reordered.pdf')
    const encodedFilename = encodeURIComponent(originalName)

    // 응답 반환
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
        'X-Page-Count': newPdf.getPageCount().toString(),
      },
    })
  } catch (error) {
    console.error('PDF 순서 변경 오류:', error)
    return NextResponse.json(
      { error: 'PDF 순서 변경 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
