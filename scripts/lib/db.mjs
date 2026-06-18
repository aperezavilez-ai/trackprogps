import { loadRootEnv, DB_HOST } from './load-env.mjs'

export function getDbPassword(argvPassword) {
  loadRootEnv()
  const pw = argvPassword ?? process.env.SUPABASE_DB_PASSWORD
  if (!pw) {
    console.error('Falta SUPABASE_DB_PASSWORD en .env o como argumento del script')
    console.error('Obtén el password en: Supabase → Project Settings → Database')
    process.exit(1)
  }
  return pw
}

export async function createDbClient(password) {
  const pg = await import('pg')
  const Client = pg.default?.Client ?? pg.Client
  const client = new Client({
    host: DB_HOST,
    port: 5432,
    user: 'postgres',
    password: password ?? getDbPassword(),
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  return client
}
