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
  Badge,
  IconButton,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from '@chakra-ui/react'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { FiUpload, FiDownload, FiHome, FiX, FiMove } from 'react-icons/fi'
import { PDFDocument } from 'pdf-lib'
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

interface PageInfo {
  id: string
  originalPageNumber: number
  currentPosition: number
  width: number
  height: number
}

function SortablePageItem({
  pageInfo,
  onRemove,
}: {
  pageInfo: PageInfo
  onRemove: (id: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pageInfo.id })

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
          <Badge colorScheme="blue" fontSize="md">
            {pageInfo.currentPosition}
          </Badge>
          <VStack align="start" spacing={0} flex={1}>
            <HStack spacing={2}>
              <Text fontWeight="medium" fontSize="sm">
                페이지 {pageInfo.originalPageNumber}
              </Text>
              {pageInfo.originalPageNumber !== pageInfo.currentPosition && (
                <Badge colorScheme="orange" fontSize="xs">
                  이동됨
                </Badge>
              )}
            </HStack>
            <Text color="gray.500" fontSize="xs">
              해상도: {pageInfo.width} x {pageInfo.height}px
            </Text>
          </VStack>
        </HStack>
        <IconButton
          aria-label="페이지 제거"
          icon={<Icon as={FiX} />}
          size="sm"
          colorScheme="red"
          variant="ghost"
          onClick={() => onRemove(pageInfo.id)}
        />
      </HStack>
    </Box>
  )
}

export default function ReorderPage() {
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [pageInfos, setPageInfos] = useState<PageInfo[]>([])
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
    const selectedFile = e.target.files?.[0]
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile)
      setDownloadUrl(null)
      setPageInfos([])

      setIsAnalyzing(true)
      try {
        const arrayBuffer = await selectedFile.arrayBuffer()
        const pdfDoc = await PDFDocument.load(arrayBuffer)
        const pages = pdfDoc.getPages()

        const infos: PageInfo[] = pages.map((page, index) => {
          const { width, height } = page.getSize()
          return {
            id: `page-${index + 1}`,
            originalPageNumber: index + 1,
            currentPosition: index + 1,
            width: Math.round(width),
            height: Math.round(height),
          }
        })

        setPageInfos(infos)

        toast({
          title: '파일 분석 완료',
          description: `${selectedFile.name} (${infos.length}페이지)`,
          status: 'success',
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setPageInfos((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)
        const newItems = arrayMove(items, oldIndex, newIndex)
        
        // currentPosition 업데이트
        return newItems.map((item, index) => ({
          ...item,
          currentPosition: index + 1,
        }))
      })
    }
  }

  const handleRemovePage = (id: string) => {
    setPageInfos((prev) => {
      const filtered = prev.filter((item) => item.id !== id)
      // currentPosition 재정렬
      return filtered.map((item, index) => ({
        ...item,
        currentPosition: index + 1,
      }))
    })
    toast({
      title: '페이지 제거됨',
      status: 'info',
      duration: 2000,
    })
  }

  const handleReorder = async () => {
    if (!file || pageInfos.length === 0) return

    setIsProcessing(true)

    const formData = new FormData()
    formData.append('file', file)
    
    // 새로운 페이지 순서 전송 (originalPageNumber 기준)
    const pageOrder = pageInfos.map((info) => info.originalPageNumber)
    formData.append('pageOrder', JSON.stringify(pageOrder))

    try {
      const response = await fetch('/api/reorder-pdf', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'PDF 순서 변경 실패')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      setDownloadUrl(url)

      toast({
        title: '순서 변경 완료',
        description: `${pageInfos.length}페이지가 재정렬되었습니다`,
        status: 'success',
        duration: 5000,
      })
    } catch (error: any) {
      toast({
        title: '오류',
        description: error.message || '페이지 순서 변경 중 오류가 발생했습니다',
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
      a.download = file.name.replace('.pdf', '_reordered.pdf')
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  const hasChanges = pageInfos.some(
    (info) => info.originalPageNumber !== info.currentPosition
  )
  
  const removedPages = pageInfos.length > 0 && file
    ? (() => {
        // 원본 파일의 전체 페이지 수를 알기 위해 계산
        const maxOriginalPage = Math.max(...pageInfos.map(p => p.originalPageNumber))
        return maxOriginalPage - pageInfos.length
      })()
    : 0

  return (
    <Container maxW="container.lg" py={10}>
      <VStack spacing={8} align="stretch">
        <HStack justify="space-between">
          <Box>
            <Heading size="lg" mb={2}>
              PDF 페이지 순서 변경
            </Heading>
            <Text color="gray.600">
              드래그하여 페이지 순서를 자유롭게 변경
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
                      <HStack spacing={3}>
                        <Text fontWeight="bold">
                          페이지: {pageInfos.length}개
                        </Text>
                        {hasChanges && (
                          <Badge colorScheme="orange" fontSize="sm">
                            순서가 변경되었습니다
                          </Badge>
                        )}
                        {removedPages > 0 && (
                          <Badge colorScheme="red" fontSize="sm">
                            {removedPages}페이지 제거됨
                          </Badge>
                        )}
                      </HStack>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm('모든 변경사항을 취소하고 원본 순서로 되돌리시겠습니까?')) {
                            handleFileSelect({
                              target: { files: [file] }
                            } as any)
                          }
                        }}
                      >
                        초기화
                      </Button>
                    </HStack>

                    {(hasChanges || removedPages > 0) && (
                      <Alert status="info" mb={4} borderRadius="md">
                        <AlertIcon />
                        <Box>
                          <AlertTitle>변경사항 감지</AlertTitle>
                          <AlertDescription fontSize="sm">
                            {hasChanges && '페이지 순서가 변경되었습니다. '}
                            {removedPages > 0 && `${removedPages}개의 페이지가 제거되었습니다. `}
                            변경사항을 적용하려면 "순서 변경 적용" 버튼을 클릭하세요.
                          </AlertDescription>
                        </Box>
                      </Alert>
                    )}

                    <Text fontSize="sm" color="gray.600" mb={4}>
                      ☰ 아이콘을 드래그하여 순서를 변경하거나, ✕ 버튼으로 페이지를 제거하세요
                    </Text>

                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={pageInfos.map((p) => p.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <VStack spacing={2} width="100%">
                          {pageInfos.map((pageInfo) => (
                            <SortablePageItem
                              key={pageInfo.id}
                              pageInfo={pageInfo}
                              onRemove={handleRemovePage}
                            />
                          ))}
                        </VStack>
                      </SortableContext>
                    </DndContext>
                  </Box>

                  {!downloadUrl && (
                    <Button
                      colorScheme="green"
                      size="lg"
                      onClick={handleReorder}
                      isLoading={isProcessing}
                      loadingText="처리 중..."
                      width="100%"
                      isDisabled={pageInfos.length === 0}
                    >
                      순서 변경 적용
                    </Button>
                  )}
                </>
              )}

              {isProcessing && (
                <Box width="100%">
                  <Text mb={2}>PDF 재구성 중...</Text>
                  <Progress
                    size="lg"
                    colorScheme="green"
                    isIndeterminate
                  />
                </Box>
              )}

              {downloadUrl && (
                <>
                  <Box
                    p={4}
                    bg="green.50"
                    borderRadius="md"
                    width="100%"
                    borderWidth={2}
                    borderColor="green.200"
                  >
                    <Text fontWeight="bold" mb={2} color="green.800">
                      ✅ 순서 변경 완료
                    </Text>
                    <Text fontSize="sm" color="gray.700">
                      새로운 PDF 파일이 생성되었습니다
                    </Text>
                  </Box>
                  
                  <Button
                    leftIcon={<Icon as={FiDownload} />}
                    colorScheme="purple"
                    size="lg"
                    onClick={handleDownload}
                    width="100%"
                  >
                    재정렬된 PDF 다운로드
                  </Button>
                </>
              )}
            </VStack>
          </CardBody>
        </Card>

        <Card bg="teal.50">
          <CardBody>
            <VStack align="start" spacing={2}>
              <Heading size="sm">사용 방법</Heading>
              <Text fontSize="sm">
                1. PDF 파일을 선택하면 모든 페이지가 목록으로 표시됩니다
              </Text>
              <Text fontSize="sm">
                2. ☰ 아이콘을 드래그하여 페이지 순서를 변경합니다
              </Text>
              <Text fontSize="sm">
                3. ✕ 버튼을 클릭하여 불필요한 페이지를 제거합니다
              </Text>
              <Text fontSize="sm">
                4. "순서 변경 적용" 버튼을 클릭하여 새로운 PDF를 생성합니다
              </Text>
              <Text fontSize="sm" fontWeight="bold" color="teal.800" mt={2}>
                • 원본 파일은 변경되지 않으며, 새로운 PDF가 생성됩니다
              </Text>
            </VStack>
          </CardBody>
        </Card>
      </VStack>
    </Container>
  )
}
