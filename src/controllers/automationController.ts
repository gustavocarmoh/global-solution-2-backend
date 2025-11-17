import { type Request, type Response } from 'express';
import oracledb from 'oracledb';
import { withOracleConnection } from '../utils/db.js';

export async function releaseExpiredBookings(_req: Request, res: Response): Promise<Response> {
  try {
    const released = await withOracleConnection(async (connection) => {
      const result = await connection.execute(
        `BEGIN
           PROC_RELEASE_EXPIRED_BOOKINGS(:affected_rows);
         END;`,
        {
          affected_rows: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
        },
        { autoCommit: true }
      );

      const outBinds = result.outBinds as { affected_rows?: number } | undefined;
      return outBinds?.affected_rows ?? 0;
    });

    return res.json({
      message: 'Procedure executada com sucesso.',
      released: Number(released)
    });
  } catch (error) {
    console.error('Erro ao executar automacao:', error);
    return res.status(500).json({ message: 'Erro ao executar automacao. Verifique se a procedure existe.' });
  }
}
