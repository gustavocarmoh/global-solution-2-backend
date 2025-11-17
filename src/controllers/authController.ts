import bcrypt from 'bcryptjs';
import { type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { defaultOutFormat, withOracleConnection } from '../utils/db.js';

interface ClientRow {
  ID: string;
  EMAIL: string;
  NAME: string;
  ROLE: string | null;
  AGE: number | null;
  AVAILABILITY_JSON: string | null;
  PROFILE_PHOTO: string | null;
  PASSWORD_HASH: string;
}

interface ClientPayload {
  id: string;
  email: string;
  name: string | null;
  role: string | null;
  age: number | null;
  availability: Record<string, string[]> | null;
  profilePhoto: string | null;
}

interface RegisterBody {
  email: string;
  password: string;
  name: string;
}

interface LoginBody {
  email: string;
  password: string;
}

function sanitizeClientRow(row: ClientRow | undefined): ClientPayload | null {
  if (!row) {
    return null;
  }

  return {
    id: row.ID,
    email: row.EMAIL,
    name: row.NAME,
    role: row.ROLE,
    age: row.AGE,
    availability: row.AVAILABILITY_JSON ? JSON.parse(row.AVAILABILITY_JSON) : null,
    profilePhoto: row.PROFILE_PHOTO
  };
}

function signToken(client: ClientPayload): string {
  return jwt.sign(
    { sub: client.id, email: client.email },
    process.env.JWT_SECRET ?? 'changeme',
    { expiresIn: '8h' }
  );
}

export async function register(req: Request, res: Response): Promise<Response> {
  const { email, password, name } = req.body as RegisterBody;

  try {
    const client = await withOracleConnection(async (connection) => {
      const existing = await connection.execute(
        'SELECT id FROM clients WHERE email = :email',
        { email },
        defaultOutFormat
      );

      const existingRows = existing.rows ?? [];

      if (existingRows.length > 0) {
        return null;
      }

      const clientId = randomUUID();
      const passwordHash = await bcrypt.hash(password, 10);

      await connection.execute(
        `INSERT INTO clients (id, email, password_hash, name)
         VALUES (:id, :email, :password_hash, :name)`,
        {
          id: clientId,
          email,
          password_hash: passwordHash,
          name
        },
        { autoCommit: true }
      );

      const createdClient: ClientPayload = {
        id: clientId,
        email,
        name,
        role: null,
        age: null,
        availability: null,
        profilePhoto: null
      };

      return createdClient;
    });

    if (!client) {
      return res.status(409).json({ message: 'E-mail ja esta em uso.' });
    }

    const token = signToken(client);

    return res.status(201).json({ token, client });
  } catch (error) {
    console.error('Erro ao registrar cliente:', error);
    return res.status(500).json({ message: 'Erro ao registrar cliente.' });
  }
}

export async function login(req: Request, res: Response): Promise<Response> {
  const { email, password } = req.body as LoginBody;

  try {
    const result = await withOracleConnection(async (connection) => {
      return connection.execute<ClientRow>(
        `SELECT id, email, name, role, age, availability_json, profile_photo, password_hash
         FROM clients
         WHERE email = :email`,
        { email },
        defaultOutFormat
      );
    });

    const rows = result.rows ?? [];

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Credenciais invalidas.' });
    }

    const [row] = rows;

    if (!row) {
      return res.status(401).json({ message: 'Credenciais invalidas.' });
    }

    const passwordMatch = await bcrypt.compare(password, row.PASSWORD_HASH);

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Credenciais invalidas.' });
    }

    const client = sanitizeClientRow(row);

    if (!client) {
      return res.status(500).json({ message: 'Cliente invalido.' });
    }

    const token = signToken(client);

    return res.json({ token, client });
  } catch (error) {
    console.error('Erro ao realizar login:', error);
    return res.status(500).json({ message: 'Erro ao realizar login.' });
  }
}
