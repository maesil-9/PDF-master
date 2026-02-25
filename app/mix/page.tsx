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
  SimpleGrid,
  Image,
  Spinner,
} from '@chakra-ui/react'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FiUpload, FiDownload, FiHome, FiX, FiMove, FiImage } from 'react-icons/fi'
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
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface PageItem {
  id: string
  fileIndex: number
  pageIndex: number
  fileName: string
  pageNumber: number
  width: number
  height: number
  file: File
}

function SortablePageCard({
  pageItem,
  thumbnailUrl,
  isGenerating,
  onRemove,
  onGenerateThumbnail,
}: {
  pageItem: PageItem
  thumbnailUrl: string | null
  isGenerating: boolean
  onRemove: (id: string) => void
  onGenerateThumbnail: (item: PageItem) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pageItem.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <Box
      ref={setNodeRef}
      style={style}
      p={3}
      bg="white"
      borderWidth={2}
      borderColor={isDragging ? 'blue.400' : 'gray.200'}
      borderRadius="md"
      minH="200px"
      position="relative"
    >
      <HStack justify="space-between" mb={2}>
        <Icon
          as={FiMove}
          boxSize={4}
          color="gray.400"
          cursor="grab"
          {...attributes}
          {...listeners}
        />
        <HStack spacing={1}>
          <IconButton
            aria-label="제거"
            icon={<Icon as={FiX} />}
            size="xs"
            colorScheme="red"
            variant="ghost"
            onClick={() => onRemove(pageItem.id)}
          />
        </HStack>
      </HStack>
      <Box
        w="100%"
        h="100px"
        bg="gray.100"
        borderRadius="sm"
        overflow="hidden"
        mb={2}
        flexShrink={0}
      >
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={`${pageItem.fileName} p.${pageItem.pageNumber}`}
            w="100%"
            h="100%"
            objectFit="contain"
          />
        ) : (
          <Box
            w="100%"
            h="100%"
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            gap={2}
          >
            {isGenerating ? (
              <Spinner size="sm" color="blue.400" />
            ) : (
              <Button
                size="xs"
                leftIcon={<Icon as={FiImage} />}
                colorScheme="blue"
                variant="outline"
                onClick={() => onGenerateThumbnail(pageItem)}
              >
                썸네일 생성
              </Button>
            )}
          </Box>
        )}
      </Box>
      <VStack align="stretch" spacing={0} flex={1}>
        <Text fontSize="xs" fontWeight="bold" noOfLines={1} title={pageItem.fileName}>
          {pageItem.fileName}
        </Text>
        <Badge colorScheme="blue" fontSize="xs" alignSelf="flex-start">
          p.{pageItem.pageNumber}
        </Badge>
        <Text fontSize="xs" color="gray.500">
          {pageItem.width} × {pageItem.height}px
        </Text>
      </VStack>
    </Box>
  )
}

async function fetchThumbnail(file: File, pageIndex: number): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('pageIndex', pageIndex.toString())
  const res = await fetch('/api/pdf-thumbnail', { method: 'POST', body: formData })
  if (!res.ok) throw new Error('썸네일 생성 실패')
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

export default function MixPage() {
  const [files, setFiles] = useState<File[]>([])
  const [pageItems, setPageItems] = useState<PageItem[]>([])
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({})
  const [generatingThumbnailIds, setGeneratingThumbnailIds] = useState<Set<string>>(new Set())
  const [isProcessing, setIsProcessing] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [targetResolution, setTargetResolution] = useState<string>('1920')
  const [customResolution, setCustomResolution] = useState<string>('')
  const [resultResolution, setResultResolution] = useState<{ width: number; height: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const router = useRouter()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []).filter(
      (f) => f.type === 'application/pdf'
    )

    if (selectedFiles.length === 0) {
      toast({
        title: '오류',
        description: 'PDF 파일만 업로드 가능합니다',
        status: 'error',
        duration: 3000,
      })
      return
    }

    setIsAnalyzing(true)
    const newFiles = [...files]
    const newPageItems: PageItem[] = []

    try {
      for (let fileIdx = 0; fileIdx < selectedFiles.length; fileIdx++) {
        const file = selectedFiles[fileIdx]
        const fileIndex = files.length + fileIdx
        newFiles.push(file)

        const arrayBuffer = await file.arrayBuffer()
        const pdfDoc = await PDFDocument.load(arrayBuffer)
        const pages = pdfDoc.getPages()

        for (let p = 0; p < pages.length; p++) {
          const { width, height } = pages[p].getSize()
          newPageItems.push({
            id: `f${fileIndex}-p${p}-${Date.now()}-${Math.random()}`,
            fileIndex,
            pageIndex: p,
            fileName: file.name,
            pageNumber: p + 1,
            width: Math.round(width),
            height: Math.round(height),
            file,
          })
        }
      }

      setFiles(newFiles)
      setPageItems((prev) => [...prev, ...newPageItems])
      setThumbnailUrls({})
      setGeneratingThumbnailIds(new Set())
      setDownloadUrl(null)
      setResultResolution(null)

      toast({
        title: '파일 추가됨',
        description: `${selectedFiles.length}개 파일, ${newPageItems.length}페이지 추가`,
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

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // 업로드 시 자동 썸네일 생성 (순차 처리)
  useEffect(() => {
    if (pageItems.length === 0) return

    let cancelled = false

    async function loadThumbnails() {
      for (const item of pageItems) {
        if (cancelled) return
        setGeneratingThumbnailIds((prev) => new Set(prev).add(item.id))
        try {
          const url = await fetchThumbnail(item.file, item.pageIndex)
          if (cancelled) return
          setThumbnailUrls((prev) => ({ ...prev, [item.id]: url }))
        } catch (e) {
          if (!cancelled) console.error('썸네일 로드 실패:', item.fileName, item.pageNumber, e)
        } finally {
          setGeneratingThumbnailIds((prev) => {
            const next = new Set(prev)
            next.delete(item.id)
            return next
          })
        }
      }
    }

    loadThumbnails()
    return () => {
      cancelled = true
    }
  }, [pageItems])

  const handleGenerateThumbnail = async (item: PageItem) => {
    setGeneratingThumbnailIds((prev) => new Set(prev).add(item.id))
    try {
      const url = await fetchThumbnail(item.file, item.pageIndex)
      setThumbnailUrls((prev) => ({ ...prev, [item.id]: url }))
      toast({
        title: '썸네일 생성됨',
        description: `${item.fileName} p.${item.pageNumber}`,
        status: 'success',
        duration: 2000,
      })
    } catch (e) {
      console.error('썸네일 로드 실패:', item.fileName, item.pageNumber, e)
      toast({
        title: '썸네일 생성 실패',
        description: `${item.fileName} p.${item.pageNumber}`,
        status: 'error',
        duration: 3000,
      })
    } finally {
      setGeneratingThumbnailIds((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setPageItems((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id)
        const newIndex = items.findIndex((i) => i.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const handleRemovePage = (id: string) => {
    const url = thumbnailUrls[id]
    if (url) URL.revokeObjectURL(url)
    setThumbnailUrls((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setPageItems((prev) => prev.filter((i) => i.id !== id))
    toast({ title: '페이지 제거됨', status: 'info', duration: 2000 })
  }

  const handleMix = async () => {
    if (pageItems.length === 0) return

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

    const formData = new FormData()
    files.forEach((f) => formData.append('files', f))
    formData.append('targetWidth', finalTargetWidth)
    formData.append(
      'pageOrder',
      JSON.stringify(pageItems.map((p) => ({ fileIndex: p.fileIndex, pageIndex: p.pageIndex })))
    )

    try {
      const response = await fetch('/api/mix-pdf', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'PDF 혼합 실패')
      }

      const rw = response.headers.get('X-Result-Width')
      const rh = response.headers.get('X-Result-Height')
      if (rw && rh) {
        setResultResolution({ width: parseInt(rw), height: parseInt(rh) })
      }

      const blob = await response.blob()
      setDownloadUrl(URL.createObjectURL(blob))

      toast({
        title: '혼합 완료',
        description: `${pageItems.length}페이지가 병합되었습니다`,
        status: 'success',
        duration: 5000,
      })
    } catch (error: any) {
      toast({
        title: '오류',
        description: error.message || '혼합 중 오류가 발생했습니다',
        status: 'error',
        duration: 5000,
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownload = () => {
    if (downloadUrl) {
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `mixed_${targetResolution === 'custom' ? customResolution : targetResolution}px.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  const handleClearAll = () => {
    Object.values(thumbnailUrls).forEach((url) => URL.revokeObjectURL(url))
    setThumbnailUrls({})
    setGeneratingThumbnailIds(new Set())
    setFiles([])
    setPageItems([])
    setDownloadUrl(null)
    setResultResolution(null)
    toast({ title: '초기화됨', status: 'info', duration: 2000 })
  }

  return (
    <Container maxW="container.xl" py={10}>
      <VStack spacing={8} align="stretch">
        <HStack justify="space-between">
          <Box>
            <Heading size="lg" mb={2}>
              PDF 페이지 혼합
            </Heading>
            <Text color="gray.600">
              여러 PDF의 페이지를 드래그로 배열하고 원하는 해상도로 병합
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
                isDisabled={isProcessing || isAnalyzing}
                isLoading={isAnalyzing}
                loadingText="분석 중..."
                width="100%"
              >
                PDF 파일 추가 (여러 개 선택 가능)
              </Button>

              {pageItems.length > 0 && (
                <>
                  <Box width="100%">
                    <HStack justify="space-between" mb={3}>
                      <Text fontWeight="bold">
                        페이지: {pageItems.length}개 (파일 {files.length}개)
                      </Text>
                      <Button size="sm" variant="ghost" colorScheme="red" onClick={handleClearAll}>
                        모두 제거
                      </Button>
                    </HStack>
                    <Text fontSize="sm" color="gray.600" mb={4}>
                      드래그하여 순서 변경 · 업로드 시 자동 썸네일 생성 (실패 시 버튼으로 재생성) · ✕ 제거
                    </Text>

                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={pageItems.map((p) => p.id)}
                        strategy={rectSortingStrategy}
                      >
                        <SimpleGrid columns={{ base: 2, md: 4, lg: 5 }} spacing={3}>
                          {pageItems.map((item) => (
                            <SortablePageCard
                              key={item.id}
                              pageItem={item}
                              thumbnailUrl={thumbnailUrls[item.id] ?? null}
                              isGenerating={generatingThumbnailIds.has(item.id)}
                              onRemove={handleRemovePage}
                              onGenerateThumbnail={handleGenerateThumbnail}
                            />
                          ))}
                        </SimpleGrid>
                      </SortableContext>
                    </DndContext>
                  </Box>

                  {!downloadUrl && (
                    <FormControl width="100%">
                      <FormLabel fontWeight="bold">타겟 해상도</FormLabel>
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
                          placeholder="너비 (px)"
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
                        ✅ 혼합 완료
                      </Text>
                      <Text fontSize="sm" color="gray.700">
                        {pageItems.length}페이지 · {resultResolution.width} × {resultResolution.height}px
                      </Text>
                    </Box>
                  )}

                  {!downloadUrl && (
                    <Button
                      colorScheme="green"
                      size="lg"
                      onClick={handleMix}
                      isLoading={isProcessing}
                      loadingText="혼합 중..."
                      width="100%"
                    >
                      페이지 혼합하기
                    </Button>
                  )}
                </>
              )}

              {isProcessing && (
                <Box width="100%">
                  <Progress size="lg" colorScheme="green" isIndeterminate />
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
                  혼합된 PDF 다운로드
                </Button>
              )}
            </VStack>
          </CardBody>
        </Card>

        <Card bg="orange.50">
          <CardBody>
            <VStack align="start" spacing={2}>
              <Heading size="sm">사용 방법</Heading>
              <Text fontSize="sm">1. 여러 PDF 파일을 추가하면 모든 페이지가 그리드에 표시됩니다</Text>
              <Text fontSize="sm">2. 드래그하여 페이지 순서를 자유롭게 변경하세요</Text>
              <Text fontSize="sm">3. 업로드 시 자동 썸네일 생성, 실패한 페이지만 버튼으로 재생성</Text>
              <Text fontSize="sm">4. 타겟 해상도를 선택하고 "페이지 혼합하기"를 클릭하세요</Text>
              <Text fontSize="sm" fontWeight="bold" color="orange.800" mt={2}>
                • 여러 파일의 페이지를 섞어서 하나의 PDF로 만들 수 있습니다
              </Text>
            </VStack>
          </CardBody>
        </Card>
      </VStack>
    </Container>
  )
}
