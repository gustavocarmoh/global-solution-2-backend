import dotenv from 'dotenv';
import oracledb from 'oracledb';

dotenv.config();

let pool: oracledb.Pool | undefined;

export async function getPool(): Promise<oracledb.Pool> {
  if (pool !== undefined) {
    return pool;
  }

  pool = await oracledb.createPool({
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECTION_STRING,
    poolMin: Number(process.env.ORACLE_POOL_MIN ?? 1),
    poolMax: Number(process.env.ORACLE_POOL_MAX ?? 4),
    poolIncrement: Number(process.env.ORACLE_POOL_INCREMENT ?? 1)
  });

  return pool;
}

export async function getConnection(): Promise<oracledb.Connection> {
  const currentPool = await getPool();
  return currentPool.getConnection();
}

async function closePool(): Promise<void> {
  if (pool !== undefined) {
    await pool.close(0);
    pool = undefined;
  }
}

process.once('SIGINT', async () => {
  await closePool();
  process.exit(0);
});

process.once('SIGTERM', async () => {
  await closePool();
  process.exit(0);
});
