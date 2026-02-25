import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const targetWidth = parseFloat(formData.get('targetWidth') as string)

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

    console.log(`${files.length}개의 PDF 파일을 ${targetWidth}px로 변환 및 병합 시작...`)

    // 병합된 PDF를 담을 새 문서 생성
    const mergedPdf = await PDFDocument.create()
    
    // 결과 해상도 저장용 변수
    let resultWidth = 0
    let resultHeight = 0

    // 각 파일을 처리하고 병합
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      console.log(`처리 중 (${i + 1}/${files.length}): ${file.name}`)

      try {
        // PDF 파일 읽기
        const arrayBuffer = await file.arrayBuffer()
        const pdfDoc = await PDFDocument.load(arrayBuffer)

        // 페이지 가져오기
        const pages = pdfDoc.getPages()

        if (pages.length === 0) {
          console.warn(`${file.name}에 페이지가 없습니다. 건너뜁니다.`)
          continue
        }

        // 첫 번째 페이지의 원본 너비로 스케일 계산
        const firstPage = pages[0]
        const { width: sourceWidth, height: sourceHeight } = firstPage.getSize()
        const scale = targetWidth / sourceWidth

        console.log(
          `  ${file.name}: ${Math.round(sourceWidth)} x ${Math.round(sourceHeight)}px → ${targetWidth}px (${scale.toFixed(2)}x)`
        )

        // 모든 페이지에 스케일 적용
        for (const page of pages) {
          const { width, height } = page.getSize()

          // 새로운 크기 설정
          const newWidth = width * scale
          const newHeight = height * scale

          // 첫 번째 파일의 첫 페이지의 최종 크기를 저장 (대표 해상도)
          if (i === 0 && page === firstPage) {
            resultWidth = Math.round(newWidth)
            resultHeight = Math.round(newHeight)
          }

          // 페이지 크기 변경
          page.setSize(newWidth, newHeight)

          // 기존 콘텐츠를 스케일하기 위해 변환 행렬 적용
          page.scaleContent(scale, scale)

          // 콘텐츠 위치 조정
          const scaledHeight = height * scale
          page.translateContent(0, newHeight - scaledHeight)
        }

        // 스케일링된 페이지들을 병합된 PDF에 복사
        const copiedPages = await mergedPdf.copyPages(
          pdfDoc,
          pdfDoc.getPageIndices()
        )

        copiedPages.forEach((page) => {
          mergedPdf.addPage(page)
        })
      } catch (fileError) {
        console.error(`${file.name} 처리 중 오류:`, fileError)
        return NextResponse.json(
          { error: `${file.name} 처리 중 오류가 발생했습니다` },
          { status: 500 }
        )
      }
    }

    // 병합된 PDF가 비어있는지 확인
    if (mergedPdf.getPageCount() === 0) {
      return NextResponse.json(
        { error: '병합할 유효한 페이지가 없습니다' },
        { status: 400 }
      )
    }

    console.log(
      `병합 완료! 총 ${mergedPdf.getPageCount()}페이지가 생성되었습니다. 최종 해상도: ${resultWidth} x ${resultHeight}px`
    )

    // 병합된 PDF 저장
    const mergedPdfBytes = await mergedPdf.save()

    // 파일명 인코딩 (한글 지원)
    const filename = `merged_${resultWidth}px.pdf`
    const encodedFilename = encodeURIComponent(filename)

    // 응답 반환 (결과 해상도 정보를 헤더에 포함)
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
    console.error('PDF 병합 오류:', error)
    return NextResponse.json(
      { error: 'PDF 병합 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
