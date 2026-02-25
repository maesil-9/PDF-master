import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const targetWidth = parseFloat(formData.get('targetWidth') as string)
    const targetHeight = parseFloat(formData.get('targetHeight') as string)

    if (!file) {
      return NextResponse.json(
        { error: '파일이 제공되지 않았습니다' },
        { status: 400 }
      )
    }

    if (!targetWidth || targetWidth <= 0 || !targetHeight || targetHeight <= 0) {
      return NextResponse.json(
        { error: '올바른 타겟 해상도를 입력하세요' },
        { status: 400 }
      )
    }

    console.log(`PDF 정규화 시작: 타겟 해상도 ${targetWidth} x ${targetHeight}px`)

    // PDF 파일 읽기
    const arrayBuffer = await file.arrayBuffer()
    const pdfDoc = await PDFDocument.load(arrayBuffer)

    // 모든 페이지에 대해 정규화 적용
    const pages = pdfDoc.getPages()
    
    if (pages.length === 0) {
      return NextResponse.json(
        { error: 'PDF 페이지가 없습니다' },
        { status: 400 }
      )
    }

    console.log(`총 ${pages.length}개 페이지 처리 중...`)

    // 각 페이지를 타겟 해상도로 변환
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i]
      const { width: currentWidth, height: currentHeight } = page.getSize()

      // 현재 페이지가 이미 타겟 해상도와 같으면 스킵
      if (
        Math.abs(currentWidth - targetWidth) < 1 &&
        Math.abs(currentHeight - targetHeight) < 1
      ) {
        console.log(
          `  페이지 ${i + 1}: 이미 타겟 해상도와 동일 (${Math.round(currentWidth)} x ${Math.round(currentHeight)}px)`
        )
        continue
      }

      // 스케일 계산 (너비 기준)
      const scaleX = targetWidth / currentWidth
      const scaleY = targetHeight / currentHeight

      console.log(
        `  페이지 ${i + 1}: ${Math.round(currentWidth)} x ${Math.round(currentHeight)}px → ${targetWidth} x ${targetHeight}px (스케일: ${scaleX.toFixed(2)}x, ${scaleY.toFixed(2)}x)`
      )

      // 페이지 크기 변경
      page.setSize(targetWidth, targetHeight)

      // 기존 콘텐츠를 스케일하기 위해 변환 행렬 적용
      page.scaleContent(scaleX, scaleY)

      // 콘텐츠 위치 조정
      const scaledHeight = currentHeight * scaleY
      page.translateContent(0, targetHeight - scaledHeight)
    }

    console.log(`정규화 완료: 모든 페이지가 ${targetWidth} x ${targetHeight}px로 통일됨`)

    // 수정된 PDF 저장
    const pdfBytes = await pdfDoc.save()

    // 파일명 인코딩 (한글 지원)
    const originalName = file.name.replace(
      '.pdf',
      `_normalized_${targetWidth}x${targetHeight}.pdf`
    )
    const encodedFilename = encodeURIComponent(originalName)

    // 응답 반환 (결과 정보를 헤더에 포함)
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
        'X-Result-Width': targetWidth.toString(),
        'X-Result-Height': targetHeight.toString(),
        'X-Page-Count': pages.length.toString(),
      },
    })
  } catch (error) {
    console.error('PDF 정규화 오류:', error)
    return NextResponse.json(
      { error: 'PDF 정규화 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
