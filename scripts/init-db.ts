import { initDatabase } from '../lib/db'

async function main() {
  try {
    console.log('Initializing database...')
    await initDatabase()
    console.log('Database initialized successfully!')
    process.exit(0)
  } catch (error) {
    console.error('Failed to initialize database:', error)
    console.log('\nNote: PostgreSQL connection is optional.')
    console.log('The app will work without it, but history will not be saved.')
    process.exit(1)
  }
}

main()
