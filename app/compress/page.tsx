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
import { FiUpload, FiDownload, FiHome, FiMinimize2 } from 'react-icons/fi'
import { PDFDocument } from 'pdf-lib'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export default function CompressPage() {
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [sourceResolution, setSourceResolution] = useState<{ width: number; height: number } | null>(null)
  const [resultResolution, setResultResolution] = useState<{ width: number; height: number } | null>(null)
  const [resultSize, setResultSize] = useState<number | null>(null)
  const [compressionLevel, setCompressionLevel] = useState<string>('70')
  const [customLevel, setCustomLevel] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const router = useRouter()

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile)
      setDownloadUrl(null)
      setResultResolution(null)
      setResultSize(null)

      try {
        const arrayBuffer = await selectedFile.arrayBuffer()
        const pdfDoc = await PDFDocument.load(arrayBuffer)
        const firstPage = pdfDoc.getPages()[0]
        const { width, height } = firstPage.getSize()
        setSourceResolution({
          width: Math.round(width),
          height: Math.round(height),
        })

        toast({
          title: '파일이 선택되었습니다',
          description: `${selectedFile.name} (${formatFileSize(selectedFile.size)})`,
          status: 'success',
          duration: 3000,
        })
      } catch (error) {
        console.error('PDF 읽기 오류:', error)
        toast({
          title: '오류',
          description: 'PDF 파일을 읽을 수 없습니다',
          status: 'error',
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

  const handleCompress = async () => {
    if (!file || !sourceResolution) return

    const level =
      compressionLevel === 'custom'
        ? parseFloat(customLevel)
        : parseFloat(compressionLevel)

    if (isNaN(level) || level <= 0 || level > 100) {
      toast({
        title: '오류',
        description: '올바른 압축 비율을 입력하세요 (1~100%)',
        status: 'error',
        duration: 3000,
      })
      return
    }

    setIsProcessing(true)

    const targetWidth = Math.round(sourceResolution.width * (level / 100))
    if (targetWidth < 100) {
      toast({
        title: '오류',
        description: '압축 비율이 너무 낮습니다. 최소 100px 이상이어야 합니다',
        status: 'error',
        duration: 3000,
      })
      setIsProcessing(false)
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('targetWidth', targetWidth.toString())

    try {
      const response = await fetch('/api/scale-pdf', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('PDF 압축 실패')
      }

      const resultWidth = response.headers.get('X-Result-Width')
      const resultHeight = response.headers.get('X-Result-Height')
      if (resultWidth && resultHeight) {
        setResultResolution({
          width: parseInt(resultWidth),
          height: parseInt(resultHeight),
        })
      }

      const blob = await response.blob()
      setResultSize(blob.size)
      setDownloadUrl(URL.createObjectURL(blob))

      const savedPercent = ((1 - blob.size / file.size) * 100).toFixed(1)
      toast({
        title: '압축 완료',
        description: `용량 ${savedPercent}% 감소 (${formatFileSize(file.size)} → ${formatFileSize(blob.size)})`,
        status: 'success',
        duration: 5000,
      })
    } catch (error) {
      toast({
        title: '오류',
        description: 'PDF 압축 중 오류가 발생했습니다',
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
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = file.name.replace('.pdf', '_compressed.pdf')
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  return (
    <Container maxW="container.md" py={10}>
      <VStack spacing={8} align="stretch">
        <HStack justify="space-between">
          <Box>
            <Heading size="lg" mb={2}>
              PDF 용량 압축
            </Heading>
            <Text color="gray.600">
              해상도를 조정하여 PDF 파일 용량 줄이기
            </Text>
          </Box>
          <Button leftIcon={<Icon as={FiHome} />} onClick={() => router.push('/')}>
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
                    선택된 파일
                  </Text>
                  <Text color="gray.700">{file.name}</Text>
                  <HStack spacing={4} mt={2}>
                    <Text color="blue.600" fontSize="sm" fontWeight="semibold">
                      용량: {formatFileSize(file.size)}
                    </Text>
                    {sourceResolution && (
                      <Text color="gray.500" fontSize="sm">
                        해상도: {sourceResolution.width} × {sourceResolution.height}px
                      </Text>
                    )}
                  </HStack>
                </Box>
              )}

              {resultResolution && downloadUrl && resultSize !== null && file && (
                <Box
                  p={4}
                  bg="green.50"
                  borderRadius="md"
                  width="100%"
                  borderWidth={2}
                  borderColor="green.200"
                >
                  <Text fontWeight="bold" mb={2} color="green.800">
                    ✅ 압축 완료
                  </Text>
                  <HStack spacing={6} justify="space-between" flexWrap="wrap">
                    <VStack align="start" spacing={0}>
                      <Text fontSize="xs" color="gray.600">
                        원본
                      </Text>
                      <Text fontSize="md" fontWeight="bold" color="gray.700">
                        {formatFileSize(file.size)}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {sourceResolution?.width} × {sourceResolution?.height}px
                      </Text>
                    </VStack>
                    <Text fontSize="2xl" color="gray.400">
                      →
                    </Text>
                    <VStack align="end" spacing={0}>
                      <Text fontSize="xs" color="gray.600">
                        압축 후
                      </Text>
                      <Text fontSize="md" fontWeight="bold" color="green.700">
                        {formatFileSize(resultSize)}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {resultResolution.width} × {resultResolution.height}px
                      </Text>
                    </VStack>
                  </HStack>
                  <Text fontSize="sm" color="green.700" mt={2} fontWeight="semibold">
                    {((1 - resultSize / file.size) * 100).toFixed(1)}% 용량 감소
                  </Text>
                </Box>
              )}

              {file && !downloadUrl && (
                <FormControl width="100%">
                  <FormLabel fontWeight="bold">압축 수준</FormLabel>
                  <Select
                    value={compressionLevel}
                    onChange={(e) => setCompressionLevel(e.target.value)}
                    size="lg"
                    mb={compressionLevel === 'custom' ? 3 : 0}
                  >
                    <option value="50">최대 압축 (50%) - 용량 최소, 품질 저하</option>
                    <option value="70">강한 압축 (70%)</option>
                    <option value="85">보통 (85%)</option>
                    <option value="95">최소 압축 (95%) - 용량 유지, 품질 우선</option>
                    <option value="custom">커스텀 (%)</option>
                  </Select>
                  {compressionLevel === 'custom' && (
                    <Input
                      type="number"
                      placeholder="압축 비율 (1~100)"
                      value={customLevel}
                      onChange={(e) => setCustomLevel(e.target.value)}
                      size="lg"
                      min="1"
                      max="100"
                    />
                  )}
                </FormControl>
              )}

              {file && !downloadUrl && (
                <Button
                  leftIcon={<Icon as={FiMinimize2} />}
                  colorScheme="cyan"
                  size="lg"
                  onClick={handleCompress}
                  isLoading={isProcessing}
                  loadingText="압축 중..."
                  width="100%"
                >
                  용량 압축하기
                </Button>
              )}

              {isProcessing && (
                <Box width="100%">
                  <Progress size="lg" colorScheme="cyan" isIndeterminate />
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
                  압축된 PDF 다운로드
                </Button>
              )}
            </VStack>
          </CardBody>
        </Card>

        <Card bg="cyan.50">
          <CardBody>
            <VStack align="start" spacing={2}>
              <Heading size="sm">사용 방법</Heading>
              <Text fontSize="sm">
                1. PDF 파일을 선택하면 원본 용량과 해상도가 표시됩니다
              </Text>
              <Text fontSize="sm">
                2. 압축 수준을 선택하세요 (낮을수록 용량 감소, 품질 저하)
              </Text>
              <Text fontSize="sm">
                3. "용량 압축하기" 버튼을 클릭합니다
              </Text>
              <Text fontSize="sm">
                4. 압축된 PDF를 다운로드합니다
              </Text>
              <Text fontSize="sm" fontWeight="bold" color="cyan.800" mt={2}>
                • 해상도를 낮춰 용량을 줄입니다. 문서/이미지 PDF 모두 적용 가능
              </Text>
            </VStack>
          </CardBody>
        </Card>
      </VStack>
    </Container>
  )
}
