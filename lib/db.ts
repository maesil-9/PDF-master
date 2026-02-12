import { Pool } from 'pg'

let pool: Pool | null = null

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    })
  }
  return pool
}

export interface PdfHistory {
  originalFilename: string
  sourceWidth: number
  targetWidth: number
  scale: number
  originalSize: number
  scaledSize: number
}

export async function initDatabase() {
  const client = getPool()
  
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS pdf_history (
        id SERIAL PRIMARY KEY,
        original_filename VARCHAR(255) NOT NULL,
        source_width INTEGER NOT NULL,
        target_width INTEGER NOT NULL,
        scale DECIMAL(10, 4) NOT NULL,
        original_size BIGINT NOT NULL,
        scaled_size BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('Database initialized successfully')
  } catch (error) {
    console.error('Database initialization error:', error)
    throw error
  }
}

export async function savePdfHistory(data: PdfHistory) {
  const client = getPool()
  
  try {
    await client.query(
      `INSERT INTO pdf_history 
       (original_filename, source_width, target_width, scale, original_size, scaled_size)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        data.originalFilename,
        data.sourceWidth,
        data.targetWidth,
        data.scale,
        data.originalSize,
        data.scaledSize,
      ]
    )
  } catch (error) {
    console.error('Error saving PDF history:', error)
    throw error
  }
}

export async function getPdfHistory(limit: number = 50) {
  const client = getPool()
  
  try {
    const result = await client.query(
      `SELECT * FROM pdf_history ORDER BY created_at DESC LIMIT $1`,
      [limit]
    )
    return result.rows
  } catch (error) {
    console.error('Error fetching PDF history:', error)
    throw error
  }
}
