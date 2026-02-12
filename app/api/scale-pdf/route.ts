import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import { savePdfHistory } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const targetWidth = parseFloat(formData.get('targetWidth') as string)

    if (!file) {
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

    // PDF 파일 읽기
    const arrayBuffer = await file.arrayBuffer()
    const pdfDoc = await PDFDocument.load(arrayBuffer)

    // 모든 페이지에 대해 스케일 적용
    const pages = pdfDoc.getPages()
    
    if (pages.length === 0) {
      return NextResponse.json(
        { error: 'PDF 페이지가 없습니다' },
        { status: 400 }
      )
    }

    // 첫 번째 페이지의 원본 너비 가져오기 (모든 페이지가 같은 크기라고 가정)
    const firstPage = pages[0]
    const { width: sourceWidth, height: sourceHeight } = firstPage.getSize()

    // 스케일 계산
    const scale = targetWidth / sourceWidth

    console.log(`원본 해상도: ${Math.round(sourceWidth)} x ${Math.round(sourceHeight)}px → 타겟 너비: ${targetWidth}px (스케일: ${scale.toFixed(2)}x)`)
    
    let resultWidth = 0
    let resultHeight = 0
    
    for (const page of pages) {
      const { width, height } = page.getSize()
      
      // 새로운 크기 설정
      const newWidth = width * scale
      const newHeight = height * scale
      
      // 첫 페이지의 최종 크기 저장
      if (page === firstPage) {
        resultWidth = Math.round(newWidth)
        resultHeight = Math.round(newHeight)
      }
      
      // 페이지 크기 변경
      page.setSize(newWidth, newHeight)
      
      // 기존 콘텐츠를 스케일하기 위해 변환 행렬 적용
      page.scaleContent(scale, scale)
      
      // 콘텐츠를 중앙 정렬 (필요한 경우)
      const scaledHeight = height * scale
      page.translateContent(0, newHeight - scaledHeight)
    }
    
    console.log(`변환 완료: ${resultWidth} x ${resultHeight}px`)

    // 수정된 PDF 저장
    const pdfBytes = await pdfDoc.save()

    // DB에 변환 기록 저장 (선택적)
    try {
      await savePdfHistory({
        originalFilename: file.name,
        sourceWidth,
        targetWidth,
        scale,
        originalSize: arrayBuffer.byteLength,
        scaledSize: pdfBytes.byteLength,
      })
    } catch (dbError) {
      console.error('DB 저장 오류 (무시됨):', dbError)
    }

    // 파일명 인코딩 (한글 지원)
    const originalName = file.name.replace('.pdf', `_${resultWidth}px.pdf`)
    const encodedFilename = encodeURIComponent(originalName)
    
    // 응답 반환 (변환된 해상도 정보를 헤더에 포함)
    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
        'X-Result-Width': resultWidth.toString(),
        'X-Result-Height': resultHeight.toString(),
        'X-Source-Width': Math.round(sourceWidth).toString(),
        'X-Source-Height': Math.round(sourceHeight).toString(),
        'X-Scale': scale.toFixed(4),
      },
    })
  } catch (error) {
    console.error('PDF 처리 오류:', error)
    return NextResponse.json(
      { error: 'PDF 처리 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
