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
  IconButton,
} from '@chakra-ui/react'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { FiUpload, FiDownload, FiHome, FiX, FiMove } from 'react-icons/fi'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { PDFDocument } from 'pdf-lib'

interface FileItem {
  id: string
  file: File
  resolution?: { width: number; height: number }
}

function SortableFileItem({
  fileItem,
  index,
  onRemove,
}: {
  fileItem: FileItem
  index: number
  onRemove: (id: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: fileItem.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <Box
      ref={setNodeRef}
      style={style}
      p={4}
      bg="white"
      borderWidth={2}
      borderColor={isDragging ? 'blue.400' : 'gray.200'}
      borderRadius="md"
      width="100%"
    >
      <HStack justify="space-between">
        <HStack spacing={3} flex={1}>
          <Icon
            as={FiMove}
            boxSize={5}
            color="gray.400"
            cursor="grab"
            {...attributes}
            {...listeners}
          />
          <Badge colorScheme="blue">{index + 1}</Badge>
          <VStack align="start" spacing={0} flex={1}>
            <Text fontWeight="medium" fontSize="sm">
              {fileItem.file.name}
            </Text>
            <HStack spacing={3}>
              <Text color="gray.500" fontSize="xs">
                {(fileItem.file.size / 1024 / 1024).toFixed(2)} MB
              </Text>
              {fileItem.resolution && (
                <Text color="blue.600" fontSize="xs" fontWeight="semibold">
                  {fileItem.resolution.width} x {fileItem.resolution.height}px
                </Text>
              )}
            </HStack>
          </VStack>
        </HStack>
        <IconButton
          aria-label="파일 제거"
          icon={<Icon as={FiX} />}
          size="sm"
          colorScheme="red"
          variant="ghost"
          onClick={() => onRemove(fileItem.id)}
        />
      </HStack>
    </Box>
  )
}

export default function MergePage() {
  const [files, setFiles] = useState<FileItem[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [targetResolution, setTargetResolution] = useState<string>('1920')
  const [customResolution, setCustomResolution] = useState<string>('')
  const [resultResolution, setResultResolution] = useState<{ width: number; height: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const router = useRouter()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    const pdfFiles = selectedFiles.filter(
      (file) => file.type === 'application/pdf'
    )

    if (pdfFiles.length === 0) {
      toast({
        title: '오류',
        description: 'PDF 파일만 업로드 가능합니다',
        status: 'error',
        duration: 3000,
      })
      return
    }

    // 각 파일의 해상도를 읽기
    const newFileItems: FileItem[] = []
    
    for (const file of pdfFiles) {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const pdfDoc = await PDFDocument.load(arrayBuffer)
        const firstPage = pdfDoc.getPages()[0]
        const { width, height } = firstPage.getSize()
        
        newFileItems.push({
          id: `${Date.now()}-${Math.random()}`,
          file,
          resolution: {
            width: Math.round(width),
            height: Math.round(height),
          },
        })
      } catch (error) {
        console.error(`${file.name} 해상도 읽기 오류:`, error)
        newFileItems.push({
          id: `${Date.now()}-${Math.random()}`,
          file,
        })
      }
    }

    setFiles((prev) => [...prev, ...newFileItems])
    setDownloadUrl(null)
    setResultResolution(null)
    
    toast({
      title: '파일 추가됨',
      description: `${pdfFiles.length}개의 PDF 파일이 추가되었습니다`,
      status: 'success',
      duration: 3000,
    })

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setFiles((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => prev.filter((item) => item.id !== id))
    toast({
      title: '파일 제거됨',
      status: 'info',
      duration: 2000,
    })
  }

  const handleMerge = async () => {
    if (files.length === 0) return

    const finalTargetWidth =
      targetResolution === 'custom' ? customResolution : targetResolution

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
    files.forEach((fileItem) => {
      formData.append('files', fileItem.file)
    })
    formData.append('targetWidth', finalTargetWidth)

    try {
      const response = await fetch('/api/merge-pdf', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'PDF 병합 실패')
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
        title: '병합 완료',
        description: resultWidth && resultHeight 
          ? `${files.length}개의 PDF가 ${resultWidth} x ${resultHeight}px로 병합되었습니다`
          : `${files.length}개의 PDF가 ${finalTargetWidth}px 해상도로 병합되었습니다`,
        status: 'success',
        duration: 5000,
      })
    } catch (error: any) {
      toast({
        title: '오류',
        description: error.message || '파일 병합 중 오류가 발생했습니다',
        status: 'error',
        duration: 5000,
      })
      console.error(error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownload = () => {
    if (downloadUrl) {
      const finalTargetWidth =
        targetResolution === 'custom' ? customResolution : targetResolution
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `merged_${finalTargetWidth}px.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  return (
    <Container maxW="container.lg" py={10}>
      <VStack spacing={8} align="stretch">
        <HStack justify="space-between">
          <Box>
            <Heading size="lg" mb={2}>
              PDF 병합 & 스케일러
            </Heading>
            <Text color="gray.600">
              여러 PDF를 동일한 해상도로 변환하고 하나로 병합
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
                multiple
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
                PDF 파일 추가 (여러 개 선택 가능)
              </Button>

              {files.length > 0 && (
                <>
                  <Box width="100%">
                    <HStack justify="space-between" mb={3}>
                      <Text fontWeight="bold">
                        선택된 파일: {files.length}개
                      </Text>
                      <Button
                        size="sm"
                        variant="ghost"
                        colorScheme="red"
                        onClick={() => {
                          setFiles([])
                          setDownloadUrl(null)
                        }}
                      >
                        모두 제거
                      </Button>
                    </HStack>

                    <Text fontSize="sm" color="gray.600" mb={4}>
                      드래그하여 순서를 변경하세요
                    </Text>

                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={files.map((f) => f.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <VStack spacing={2} width="100%">
                          {files.map((fileItem, index) => (
                            <SortableFileItem
                              key={fileItem.id}
                              fileItem={fileItem}
                              index={index}
                              onRemove={handleRemoveFile}
                            />
                          ))}
                        </VStack>
                      </SortableContext>
                    </DndContext>
                  </Box>

                  {!downloadUrl && (
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
                        ✅ 병합 완료
                      </Text>
                      <Text fontSize="sm" color="gray.700" mb={2}>
                        {files.length}개의 PDF가 통일된 해상도로 병합되었습니다
                      </Text>
                      <Box bg="white" p={3} borderRadius="md">
                        <Text fontSize="xs" color="gray.600" mb={1}>
                          최종 해상도
                        </Text>
                        <Text fontSize="lg" fontWeight="bold" color="green.700">
                          {resultResolution.width} x {resultResolution.height}px
                        </Text>
                      </Box>
                    </Box>
                  )}

                  {!downloadUrl && (
                    <Button
                      colorScheme="green"
                      size="lg"
                      onClick={handleMerge}
                      isLoading={isProcessing}
                      loadingText="병합 중..."
                      width="100%"
                    >
                      해상도 변환 후 병합하기
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
                  병합된 PDF 다운로드
                </Button>
              )}
            </VStack>
          </CardBody>
        </Card>

        <Card bg="green.50">
          <CardBody>
            <VStack align="start" spacing={2}>
              <Heading size="sm">사용 방법</Heading>
              <Text fontSize="sm">
                1. "PDF 파일 추가" 버튼을 클릭하여 여러 PDF 파일을 선택합니다
              </Text>
              <Text fontSize="sm">
                2. 파일 목록에서 드래그하여 순서를 조정합니다
              </Text>
              <Text fontSize="sm">
                3. 원하는 타겟 해상도를 선택합니다
              </Text>
              <Text fontSize="sm">
                4. "해상도 변환 후 병합하기" 버튼을 클릭합니다
              </Text>
              <Text fontSize="sm" fontWeight="bold" color="green.800" mt={2}>
                • 모든 PDF가 동일한 해상도로 변환된 후 하나로 병합됩니다
              </Text>
            </VStack>
          </CardBody>
        </Card>
      </VStack>
    </Container>
  )
}
