'use client'

import {
  Box,
  Container,
  Heading,
  VStack,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Button,
  useToast,
  Spinner,
  Text,
  HStack,
  Icon,
} from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FiHome, FiRefreshCw } from 'react-icons/fi'

interface HistoryItem {
  id: number
  original_filename: string
  source_width: number
  target_width: number
  scale: number
  original_size: number
  scaled_size: number
  created_at: string
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()
  const router = useRouter()

  const fetchHistory = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/history')
      if (!response.ok) {
        throw new Error('히스토리를 가져올 수 없습니다')
      }
      const data = await response.json()
      setHistory(data)
    } catch (error: any) {
      setError(error.message)
      toast({
        title: '오류',
        description: error.message,
        status: 'error',
        duration: 5000,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  const formatBytes = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR')
  }

  return (
    <Container maxW="container.xl" py={10}>
      <VStack spacing={6} align="stretch">
        <HStack justify="space-between">
          <Heading size="lg">변환 히스토리</Heading>
          <HStack>
            <Button
              leftIcon={<Icon as={FiRefreshCw} />}
              onClick={fetchHistory}
              isLoading={loading}
            >
              새로고침
            </Button>
            <Button
              leftIcon={<Icon as={FiHome} />}
              colorScheme="blue"
              onClick={() => router.push('/')}
            >
              홈으로
            </Button>
          </HStack>
        </HStack>

        {loading ? (
          <Box textAlign="center" py={10}>
            <Spinner size="xl" />
            <Text mt={4}>로딩 중...</Text>
          </Box>
        ) : error ? (
          <Box textAlign="center" py={10}>
            <Text color="red.500">{error}</Text>
            <Text mt={2} color="gray.600">
              PostgreSQL이 설정되지 않았거나 연결할 수 없습니다.
            </Text>
          </Box>
        ) : history.length === 0 ? (
          <Box textAlign="center" py={10}>
            <Text color="gray.600">변환 히스토리가 없습니다.</Text>
          </Box>
        ) : (
          <Box overflowX="auto">
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>파일명</Th>
                  <Th isNumeric>원본 해상도</Th>
                  <Th isNumeric>변환 해상도</Th>
                  <Th isNumeric>스케일</Th>
                  <Th isNumeric>원본 크기</Th>
                  <Th isNumeric>변환 크기</Th>
                  <Th>변환 시간</Th>
                </Tr>
              </Thead>
              <Tbody>
                {history.map((item) => (
                  <Tr key={item.id}>
                    <Td>{item.original_filename}</Td>
                    <Td isNumeric>{item.source_width}px</Td>
                    <Td isNumeric>{item.target_width}px</Td>
                    <Td isNumeric>{parseFloat(item.scale.toString()).toFixed(2)}x</Td>
                    <Td isNumeric>{formatBytes(item.original_size)}</Td>
                    <Td isNumeric>{formatBytes(item.scaled_size)}</Td>
                    <Td>{formatDate(item.created_at)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
      </VStack>
    </Container>
  )
}
