import { NextResponse } from 'next/server'
import { getPdfHistory } from '@/lib/db'

export async function GET() {
  try {
    const history = await getPdfHistory(100)
    return NextResponse.json(history)
  } catch (error) {
    console.error('Error fetching history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch history' },
      { status: 500 }
    )
  }
}
