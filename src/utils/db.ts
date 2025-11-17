import oracledb from 'oracledb';
import { getConnection } from '../config/oracle.js';

export async function withOracleConnection<T>(
  callback: (connection: oracledb.Connection) => Promise<T>
): Promise<T> {
  const connection = await getConnection();

  try {
    return await callback(connection);
  } finally {
    await connection.close();
  }
}

export const defaultOutFormat: oracledb.ExecuteOptions = {
  outFormat: oracledb.OUT_FORMAT_OBJECT
};
