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
} from '@chakra-ui/react'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { FiUpload, FiDownload, FiClock, FiLayers, FiLayout, FiList } from 'react-icons/fi'
import { PDFDocument } from 'pdf-lib'

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [targetResolution, setTargetResolution] = useState<string>('1920')
  const [customResolution, setCustomResolution] = useState<string>('')
  const [sourceResolution, setSourceResolution] = useState<{ width: number; height: number } | null>(null)
  const [resultResolution, setResultResolution] = useState<{ width: number; height: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const router = useRouter()

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile)
      setDownloadUrl(null)
      setResultResolution(null)
      
      // 원본 해상도 읽기
      try {
        const arrayBuffer = await selectedFile.arrayBuffer()
        const pdfDoc = await PDFDocument.load(arrayBuffer)
        const firstPage = pdfDoc.getPages()[0]
        const { width, height } = firstPage.getSize()
        setSourceResolution({ 
          width: Math.round(width), 
          height: Math.round(height) 
        })
        
        toast({
          title: '파일이 선택되었습니다',
          description: `${selectedFile.name} (${Math.round(width)} x ${Math.round(height)}px)`,
          status: 'success',
          duration: 3000,
        })
      } catch (error) {
        console.error('PDF 읽기 오류:', error)
        toast({
          title: '파일이 선택되었습니다',
          description: selectedFile.name,
          status: 'success',
          duration: 3000,
        })
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

  const handleUpload = async () => {
    if (!file) return

    // 타겟 해상도 결정
    const finalTargetWidth = targetResolution === 'custom' 
      ? customResolution 
      : targetResolution

    if (!finalTargetWidth || parseFloat(finalTargetWidth) <= 0) {
      toast({
        title: '오류',
        description: '올바른 타겟 해상도를 입력하세요',
        status: 'error',
        duration: 3000,
      })
      return
    }

    setIsProcessing(true)
    setProgress(0)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('targetWidth', finalTargetWidth)

    try {
      const response = await fetch('/api/scale-pdf', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('PDF 변환 실패')
      }

      // 헤더에서 변환된 해상도 정보 가져오기
      const resultWidth = response.headers.get('X-Result-Width')
      const resultHeight = response.headers.get('X-Result-Height')
      
      if (resultWidth && resultHeight) {
        setResultResolution({
          width: parseInt(resultWidth),
          height: parseInt(resultHeight),
        })
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      setDownloadUrl(url)
      setProgress(100)

      toast({
        title: '변환 완료',
        description: resultWidth && resultHeight 
          ? `${resultWidth} x ${resultHeight}px로 변환되었습니다`
          : `PDF 파일이 ${finalTargetWidth}px 해상도로 변환되었습니다`,
        status: 'success',
        duration: 5000,
      })
    } catch (error) {
      toast({
        title: '오류',
        description: '파일 변환 중 오류가 발생했습니다',
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
      const finalTargetWidth = targetResolution === 'custom' 
        ? customResolution 
        : targetResolution
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = file.name.replace('.pdf', `_${finalTargetWidth}px.pdf`)
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  return (
    <Container maxW="container.md" py={10}>
      <VStack spacing={8} align="stretch">
        <Box textAlign="center">
          <Heading size="xl" mb={2}>
            PDF 해상도 스케일러
          </Heading>
          <Text color="gray.600" mb={3}>
            어떤 PDF든 원하는 해상도로 자동 변환
          </Text>
          <VStack spacing={2}>
            <HStack justify="center" spacing={2} flexWrap="wrap">
              <Button
                leftIcon={<Icon as={FiLayers} />}
                colorScheme="green"
                variant="outline"
                size="sm"
                onClick={() => router.push('/merge')}
              >
                여러 PDF 병합
              </Button>
              <Button
                leftIcon={<Icon as={FiList} />}
                colorScheme="teal"
                variant="outline"
                size="sm"
                onClick={() => router.push('/reorder')}
              >
                페이지 순서 변경
              </Button>
              <Button
                leftIcon={<Icon as={FiLayout} />}
                colorScheme="purple"
                variant="outline"
                size="sm"
                onClick={() => router.push('/normalize')}
              >
                해상도 통일
              </Button>
            </HStack>
            <Button
              leftIcon={<Icon as={FiClock} />}
              variant="ghost"
              size="xs"
              onClick={() => router.push('/history')}
            >
              변환 히스토리
            </Button>
          </VStack>
        </Box>

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
                isDisabled={isProcessing}
                width="100%"
              >
                PDF 파일 선택
              </Button>

              {file && (
                <Box
                  p={4}
                  bg="gray.50"
                  borderRadius="md"
                  width="100%"
                >
                  <Text fontWeight="bold" mb={1}>
                    선택된 파일:
                  </Text>
                  <Text color="gray.700">{file.name}</Text>
                  <Text color="gray.500" fontSize="sm">
                    크기: {(file.size / 1024 / 1024).toFixed(2)} MB
                  </Text>
                  {sourceResolution && (
                    <Text color="blue.600" fontSize="sm" fontWeight="semibold" mt={1}>
                      원본 해상도: {sourceResolution.width} x {sourceResolution.height}px
                    </Text>
                  )}
                </Box>
              )}

              {resultResolution && downloadUrl && (
                <Box
                  p={4}
                  bg="green.50"
                  borderRadius="md"
                  width="100%"
                  borderWidth={2}
                  borderColor="green.200"
                >
                  <Text fontWeight="bold" mb={2} color="green.800">
                    ✅ 변환 완료
                  </Text>
                  <HStack spacing={4} justify="space-between">
                    <VStack align="start" spacing={0}>
                      <Text fontSize="xs" color="gray.600">원본</Text>
                      <Text fontSize="md" fontWeight="bold" color="blue.700">
                        {sourceResolution?.width} x {sourceResolution?.height}px
                      </Text>
                    </VStack>
                    <Text fontSize="2xl" color="gray.400">→</Text>
                    <VStack align="end" spacing={0}>
                      <Text fontSize="xs" color="gray.600">변환 후</Text>
                      <Text fontSize="md" fontWeight="bold" color="green.700">
                        {resultResolution.width} x {resultResolution.height}px
                      </Text>
                    </VStack>
                  </HStack>
                  {sourceResolution && (
                    <Text fontSize="sm" color="gray.600" mt={2} textAlign="center">
                      스케일: {(resultResolution.width / sourceResolution.width).toFixed(2)}x
                    </Text>
                  )}
                </Box>
              )}

              {file && !downloadUrl && (
                <FormControl>
                  <FormLabel fontWeight="bold">타겟 해상도 선택</FormLabel>
                  <Select
                    value={targetResolution}
                    onChange={(e) => setTargetResolution(e.target.value)}
                    size="lg"
                    mb={targetResolution === 'custom' ? 3 : 0}
                  >
                    <option value="1920">1920px (Full HD)</option>
                    <option value="2560">2560px (2K)</option>
                    <option value="3840">3840px (4K)</option>
                    <option value="custom">커스텀 입력...</option>
                  </Select>
                  
                  {targetResolution === 'custom' && (
                    <Input
                      type="number"
                      placeholder="원하는 너비를 입력하세요 (예: 2000)"
                      value={customResolution}
                      onChange={(e) => setCustomResolution(e.target.value)}
                      size="lg"
                      min="1"
                    />
                  )}
                </FormControl>
              )}

              {file && !downloadUrl && (
                <Button
                  colorScheme="green"
                  size="lg"
                  onClick={handleUpload}
                  isLoading={isProcessing}
                  loadingText="변환 중..."
                  width="100%"
                >
                  해상도 변환 시작
                </Button>
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
                  변환된 PDF 다운로드
                </Button>
              )}
            </VStack>
          </CardBody>
        </Card>

        <Card bg="blue.50">
          <CardBody>
            <VStack align="start" spacing={2}>
              <Heading size="sm">기능 설명</Heading>
              <Text fontSize="sm">
                • 원본 PDF의 해상도를 자동으로 감지하여 선택한 타겟 해상도로 변환합니다
              </Text>
              <Text fontSize="sm">
                • 텍스트, 이미지, 벡터 그래픽 등 모든 요소가 비율에 맞춰 확대/축소됩니다
              </Text>
              <Text fontSize="sm">
                • Full HD(1920px), 2K(2560px), 4K(3840px) 또는 원하는 해상도로 변환 가능
              </Text>
              <Text fontSize="sm">
                • 원본 PDF의 품질을 유지하면서 크기를 조정합니다
              </Text>
            </VStack>
          </CardBody>
        </Card>
      </VStack>
    </Container>
  )
}
