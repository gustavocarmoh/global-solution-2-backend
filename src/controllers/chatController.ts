import { type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { generateAiResponse } from '../services/aiService.js';
import { defaultOutFormat, withOracleConnection } from '../utils/db.js';

interface SupportMessageRow {
  ID: string;
  CHANNEL: string;
  USER_MESSAGE: string;
  AI_RESPONSE: string | null;
  CREATED_AT: string;
}

interface ChatBody {
  message: string;
}

function mapMessage(row: SupportMessageRow) {
  return {
    id: row.ID,
    channel: row.CHANNEL,
    message: row.USER_MESSAGE,
    aiResponse: row.AI_RESPONSE,
    createdAt: row.CREATED_AT
  };
}

export async function sendSupportMessage(
  req: Request,
  res: Response
): Promise<Response> {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: 'Nao autenticado.' });
  }
  const { message } = req.body as ChatBody;

  if (!message) {
    return res.status(400).json({ message: 'message e obrigatorio.' });
  }

  try {
    const saved = await withOracleConnection(async (connection) => {
      const id = randomUUID();

      await connection.execute(
        `INSERT INTO support_messages (id, client_id, channel, user_message)
         VALUES (:id, :client_id, 'SUPPORT', :message)`,
        { id, client_id: user.id, message },
        { autoCommit: true }
      );

      const result = await connection.execute<SupportMessageRow>(
        `SELECT id, channel, user_message, ai_response,
                TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
         FROM support_messages WHERE id = :id`,
        { id },
        defaultOutFormat
      );

      const rows = result.rows ?? [];
      const [row] = rows;
      if (!row) {
        throw new Error('NOT_FOUND');
      }
      return mapMessage(row);
    });

    return res.status(201).json(saved);
  } catch (error) {
    console.error('Erro ao enviar mensagem de suporte:', error);
    return res.status(500).json({ message: 'Erro ao enviar mensagem de suporte.' });
  }
}

export async function listSupportMessages(req: Request, res: Response): Promise<Response> {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: 'Nao autenticado.' });
  }
  try {
    const result = await withOracleConnection(async (connection) => {
      return connection.execute<SupportMessageRow>(
        `SELECT id, channel, user_message, ai_response,
                TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
         FROM support_messages
         WHERE client_id = :client_id AND channel = 'SUPPORT'
         ORDER BY created_at DESC`,
        { client_id: user.id },
        defaultOutFormat
      );
    });

    const rows = result.rows ?? [];
    return res.json(rows.map(mapMessage));
  } catch (error) {
    console.error('Erro ao consultar mensagens:', error);
    return res.status(500).json({ message: 'Erro ao consultar mensagens.' });
  }
}

export async function sendAiMessage(
  req: Request,
  res: Response
): Promise<Response> {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: 'Nao autenticado.' });
  }
  const { message } = req.body as ChatBody;

  if (!message) {
    return res.status(400).json({ message: 'message e obrigatorio.' });
  }

  try {
    const payload = await withOracleConnection(async (connection) => {
      const profileResult = await connection.execute<{ AVAILABILITY_JSON: string | null }>(
        `SELECT availability_json FROM clients WHERE id = :id`,
        { id: user.id },
        defaultOutFormat
      );

      const profileRows = profileResult.rows ?? [];
      const firstProfile = profileRows[0];
      const availability = firstProfile?.AVAILABILITY_JSON
        ? JSON.parse(firstProfile.AVAILABILITY_JSON)
        : null;

      const aiResponse = await generateAiResponse(message, availability);
      const id = randomUUID();

      await connection.execute(
        `INSERT INTO support_messages (id, client_id, channel, user_message, ai_response)
         VALUES (:id, :client_id, 'AI', :message, :ai_response)`,
        {
          id,
          client_id: user.id,
          message,
          ai_response: aiResponse
        },
        { autoCommit: true }
      );

      return {
        id,
        message,
        aiResponse,
        createdAt: new Date().toISOString()
      };
    });

    return res.status(201).json(payload);
  } catch (error) {
    console.error('Erro ao enviar mensagem de IA:', error);
    return res.status(500).json({ message: 'Erro ao enviar mensagem de IA.' });
  }
}
