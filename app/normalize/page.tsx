'use client'

import {
  Box,
  Button,
  Container,
  Heading,
  VStack,
  Text,
  useToast,
  Progress,
  Card,
  CardBody,
  Icon,
  HStack,
  Select,
  Input,
  FormControl,
  FormLabel,
  Badge,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  IconButton,
} from '@chakra-ui/react'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { FiUpload, FiDownload, FiHome, FiAlertCircle, FiEye } from 'react-icons/fi'
import { PDFDocument } from 'pdf-lib'

interface PageInfo {
  pageNumber: number
  width: number
  height: number
}

async function extractSinglePage(file: File, pageNumber: number): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer()
  const pdfDoc = await PDFDocument.load(arrayBuffer)
  
  const newPdf = await PDFDocument.create()
  const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageNumber - 1])
  newPdf.addPage(copiedPage)
  
  const pdfBytes = await newPdf.save()
  return new Blob([pdfBytes], { type: 'application/pdf' })
}

export default function NormalizePage() {
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [pageInfos, setPageInfos] = useState<PageInfo[]>([])
  const [targetResolution, setTargetResolution] = useState<string>('first')
  const [customWidth, setCustomWidth] = useState<string>('')
  const [customHeight, setCustomHeight] = useState<string>('')
  const [resultInfo, setResultInfo] = useState<{ width: number; height: number; pageCount: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const router = useRouter()

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile)
      setDownloadUrl(null)
      setPageInfos([])
      setResultInfo(null)
      
      // PDF 분석 시작
      setIsAnalyzing(true)
      try {
        const arrayBuffer = await selectedFile.arrayBuffer()
        const pdfDoc = await PDFDocument.load(arrayBuffer)
        const pages = pdfDoc.getPages()
        
        const infos: PageInfo[] = pages.map((page, index) => {
          const { width, height } = page.getSize()
          return {
            pageNumber: index + 1,
            width: Math.round(width),
            height: Math.round(height),
          }
        })
        
        setPageInfos(infos)
        
        // 해상도가 모두 같은지 확인
        const allSame = infos.every(
          (info) => info.width === infos[0].width && info.height === infos[0].height
        )
        
        toast({
          title: allSame ? '모든 페이지가 동일한 해상도입니다' : '다양한 해상도 감지됨',
          description: `${selectedFile.name} (${infos.length}페이지)`,
          status: allSame ? 'info' : 'warning',
          duration: 3000,
        })

      } catch (error) {
        console.error('PDF 분석 오류:', error)
        toast({
          title: '오류',
          description: 'PDF 파일을 분석할 수 없습니다',
          status: 'error',
          duration: 3000,
        })
      } finally {
        setIsAnalyzing(false)
      }
    } else {
      toast({
        title: '오류',
        description: 'PDF 파일만 업로드 가능합니다',
        status: 'error',
        duration: 3000,
      })
    }
  }

  const getTargetResolution = (): { width: number; height: number } | null => {
    if (pageInfos.length === 0) return null

    switch (targetResolution) {
      case 'first':
        return { width: pageInfos[0].width, height: pageInfos[0].height }
      case 'largest':
        const largest = pageInfos.reduce((max, info) =>
          info.width * info.height > max.width * max.height ? info : max
        )
        return { width: largest.width, height: largest.height }
      case 'smallest':
        const smallest = pageInfos.reduce((min, info) =>
          info.width * info.height < min.width * min.height ? info : min
        )
        return { width: smallest.width, height: smallest.height }
      case 'custom':
        const w = parseFloat(customWidth)
        const h = parseFloat(customHeight)
        if (w > 0 && h > 0) {
          return { width: w, height: h }
        }
        return null
      default:
        return null
    }
  }

  const handleNormalize = async () => {
    if (!file) return

    const target = getTargetResolution()
    if (!target) {
      toast({
        title: '오류',
        description: '올바른 타겟 해상도를 설정하세요',
        status: 'error',
        duration: 3000,
      })
      return
    }

    setIsProcessing(true)
    setProgress(0)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('targetWidth', target.width.toString())
    formData.append('targetHeight', target.height.toString())

    try {
      const response = await fetch('/api/normalize-pdf', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'PDF 정규화 실패')
      }

      const resultWidth = response.headers.get('X-Result-Width')
      const resultHeight = response.headers.get('X-Result-Height')
      const pageCount = response.headers.get('X-Page-Count')
      
      if (resultWidth && resultHeight && pageCount) {
        setResultInfo({
          width: parseInt(resultWidth),
          height: parseInt(resultHeight),
          pageCount: parseInt(pageCount),
        })
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      setDownloadUrl(url)
      setProgress(100)

      toast({
        title: '정규화 완료',
        description: `모든 페이지가 ${target.width} x ${target.height}px로 통일되었습니다`,
        status: 'success',
        duration: 5000,
      })
    } catch (error: any) {
      toast({
        title: '오류',
        description: error.message || '파일 정규화 중 오류가 발생했습니다',
        status: 'error',
        duration: 5000,
      })
      console.error(error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownload = () => {
    if (downloadUrl && file) {
      const target = getTargetResolution()
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = file.name.replace('.pdf', `_normalized_${target?.width}x${target?.height}.pdf`)
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }


  const hasDifferentResolutions = pageInfos.length > 0 && !pageInfos.every(
    (info) => info.width === pageInfos[0].width && info.height === pageInfos[0].height
  )

  const handlePreviewPage = async (pageNumber: number) => {
    if (!file) return
    
    try {
      const blob = await extractSinglePage(file, pageNumber)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      
      // URL을 일정 시간 후 정리
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (error) {
      console.error('미리보기 오류:', error)
      toast({
        title: '오류',
        description: '페이지 미리보기를 생성할 수 없습니다',
        status: 'error',
        duration: 3000,
      })
    }
  }

  return (
    <Container maxW="container.lg" py={10}>
      <VStack spacing={8} align="stretch">
        <HStack justify="space-between">
          <Box>
            <Heading size="lg" mb={2}>
              PDF 페이지 해상도 정규화
            </Heading>
            <Text color="gray.600">
              페이지마다 다른 해상도를 하나로 통일
            </Text>
          </Box>
          <Button
            leftIcon={<Icon as={FiHome} />}
            onClick={() => router.push('/')}
          >
            홈으로
          </Button>
        </HStack>

        <Card>
          <CardBody>
            <VStack spacing={6}>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                ref={fileInputRef}
                style={{ display: 'none' }}
              />

              <Button
                leftIcon={<Icon as={FiUpload} />}
                colorScheme="blue"
                size="lg"
                onClick={() => fileInputRef.current?.click()}
                isDisabled={isProcessing || isAnalyzing}
                isLoading={isAnalyzing}
                loadingText="분석 중..."
                width="100%"
              >
                PDF 파일 선택
              </Button>

              {file && pageInfos.length > 0 && (
                <>
                  <Box width="100%">
                    <HStack justify="space-between" mb={3}>
                      <Text fontWeight="bold">
                        페이지 분석 결과: {pageInfos.length}페이지
                      </Text>
                      {hasDifferentResolutions && (
                        <Badge colorScheme="orange" fontSize="sm">
                          <Icon as={FiAlertCircle} mr={1} />
                          다양한 해상도 발견
                        </Badge>
                      )}
                      {!hasDifferentResolutions && (
                        <Badge colorScheme="green" fontSize="sm">
                          모든 페이지 동일
                        </Badge>
                      )}
                    </HStack>

                    {hasDifferentResolutions && (
                      <Alert status="warning" mb={4} borderRadius="md">
                        <AlertIcon />
                        <Box>
                          <AlertTitle>다양한 해상도가 감지되었습니다</AlertTitle>
                          <AlertDescription fontSize="sm">
                            이 PDF는 페이지마다 다른 해상도를 가지고 있습니다. 기준 해상도를 선택하여 모든 페이지를 통일하세요.
                          </AlertDescription>
                        </Box>
                      </Alert>
                    )}

                    {!hasDifferentResolutions && (
                      <Alert status="info" mb={4} borderRadius="md">
                        <AlertIcon />
                        <Box>
                          <AlertTitle>모든 페이지가 동일한 해상도입니다</AlertTitle>
                          <AlertDescription fontSize="sm">
                            이 PDF의 모든 페이지는 이미 {pageInfos[0].width} x {pageInfos[0].height}px로 통일되어 있습니다.
                          </AlertDescription>
                        </Box>
                      </Alert>
                    )}

                    <Box maxH="400px" overflowY="auto" borderWidth={1} borderRadius="md">
                      <Table size="sm" variant="simple">
                        <Thead bg="gray.50" position="sticky" top={0} zIndex={1}>
                          <Tr>
                            <Th>페이지</Th>
                            <Th isNumeric>너비 (px)</Th>
                            <Th isNumeric>높이 (px)</Th>
                            <Th>해상도</Th>
                            <Th width="80px">미리보기</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {pageInfos.map((info) => (
                            <Tr key={info.pageNumber}>
                              <Td>{info.pageNumber}</Td>
                              <Td isNumeric>{info.width}</Td>
                              <Td isNumeric>{info.height}</Td>
                              <Td>
                                <Text fontSize="xs" color="gray.600">
                                  {info.width} x {info.height}
                                </Text>
                              </Td>
                              <Td>
                                <IconButton
                                  aria-label="페이지 미리보기"
                                  icon={<Icon as={FiEye} />}
                                  size="sm"
                                  colorScheme="blue"
                                  variant="ghost"
                                  onClick={() => handlePreviewPage(info.pageNumber)}
                                />
                              </Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </Box>
                  </Box>

                  {!downloadUrl && (
                    <FormControl>
                      <FormLabel fontWeight="bold">기준 해상도 선택</FormLabel>
                      <Select
                        value={targetResolution}
                        onChange={(e) => setTargetResolution(e.target.value)}
                        size="lg"
                        mb={targetResolution === 'custom' ? 3 : 0}
                      >
                        <option value="first">첫 번째 페이지 ({pageInfos[0].width} x {pageInfos[0].height}px)</option>
                        <option value="largest">가장 큰 페이지</option>
                        <option value="smallest">가장 작은 페이지</option>
                        <option value="custom">커스텀 입력...</option>
                      </Select>

                      {targetResolution === 'custom' && (
                        <HStack>
                          <Input
                            type="number"
                            placeholder="너비 (px)"
                            value={customWidth}
                            onChange={(e) => setCustomWidth(e.target.value)}
                            size="lg"
                            min="1"
                          />
                          <Text>x</Text>
                          <Input
                            type="number"
                            placeholder="높이 (px)"
                            value={customHeight}
                            onChange={(e) => setCustomHeight(e.target.value)}
                            size="lg"
                            min="1"
                          />
                        </HStack>
                      )}
                      
                      {getTargetResolution() && (
                        <Text fontSize="sm" color="blue.600" mt={2} fontWeight="semibold">
                          선택된 해상도: {getTargetResolution()?.width} x {getTargetResolution()?.height}px
                        </Text>
                      )}
                    </FormControl>
                  )}

                  {resultInfo && downloadUrl && (
                    <Box
                      p={4}
                      bg="green.50"
                      borderRadius="md"
                      width="100%"
                      borderWidth={2}
                      borderColor="green.200"
                    >
                      <Text fontWeight="bold" mb={2} color="green.800">
                        ✅ 정규화 완료
                      </Text>
                      <Text fontSize="sm" color="gray.700" mb={2}>
                        모든 {resultInfo.pageCount}개 페이지가 통일된 해상도로 변환되었습니다
                      </Text>
                      <Box bg="white" p={3} borderRadius="md">
                        <Text fontSize="xs" color="gray.600" mb={1}>
                          통일된 해상도
                        </Text>
                        <Text fontSize="lg" fontWeight="bold" color="green.700">
                          {resultInfo.width} x {resultInfo.height}px
                        </Text>
                      </Box>
                    </Box>
                  )}

                  {!downloadUrl && (
                    <Button
                      colorScheme="green"
                      size="lg"
                      onClick={handleNormalize}
                      isLoading={isProcessing}
                      loadingText="정규화 중..."
                      width="100%"
                    >
                      페이지 해상도 통일하기
                    </Button>
                  )}
                </>
              )}

              {isProcessing && (
                <Box width="100%">
                  <Text mb={2}>처리 중...</Text>
                  <Progress
                    value={progress}
                    size="lg"
                    colorScheme="green"
                    isIndeterminate={progress === 0}
                  />
                </Box>
              )}

              {downloadUrl && (
                <Button
                  leftIcon={<Icon as={FiDownload} />}
                  colorScheme="purple"
                  size="lg"
                  onClick={handleDownload}
                  width="100%"
                >
                  정규화된 PDF 다운로드
                </Button>
              )}
            </VStack>
          </CardBody>
        </Card>

        <Card bg="purple.50">
          <CardBody>
            <VStack align="start" spacing={2}>
              <Heading size="sm">사용 방법</Heading>
              <Text fontSize="sm">
                1. PDF 파일을 선택하면 모든 페이지의 해상도를 자동 분석합니다
              </Text>
              <Text fontSize="sm">
                2. 페이지마다 해상도가 다르면 경고 메시지가 표시됩니다
              </Text>
              <Text fontSize="sm">
                3. 기준 해상도를 선택합니다 (첫 페이지, 가장 큰 페이지, 가장 작은 페이지, 또는 커스텀)
              </Text>
              <Text fontSize="sm">
                4. 모든 페이지가 선택한 해상도로 통일됩니다
              </Text>
              <Text fontSize="sm" fontWeight="bold" color="purple.800" mt={2}>
                • 페이지 내용의 비율은 유지되며 크기만 조정됩니다
              </Text>
            </VStack>
          </CardBody>
        </Card>
      </VStack>

    </Container>
  )
}
