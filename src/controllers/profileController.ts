import { type Request, type Response } from 'express';
import type oracledb from 'oracledb';
import { defaultOutFormat, withOracleConnection } from '../utils/db.js';

interface ProfileRow {
  ID: string;
  EMAIL: string;
  NAME: string | null;
  ROLE: string | null;
  AGE: number | null;
  AVAILABILITY_JSON: string | null;
  PROFILE_PHOTO: string | null;
}

interface UpdateProfileBody {
  name?: string;
  role?: string;
  age?: number;
  availability?: Record<string, string[]>;
  profilePhoto?: string;
}

function mapProfile(row: ProfileRow): Record<string, unknown> {
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

function isValidAvailability(payload: unknown): payload is Record<string, string[]> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return false;
  }

  return Object.values(payload).every((slots) => Array.isArray(slots));
}

export async function getProfile(req: Request, res: Response): Promise<Response> {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: 'Nao autenticado.' });
  }
  try {
    const result = await withOracleConnection(async (connection) => {
      return connection.execute<ProfileRow>(
        `SELECT id, email, name, role, age, availability_json, profile_photo
         FROM clients
         WHERE id = :id`,
        { id: user.id },
        defaultOutFormat
      );
    });

    const rows = result.rows ?? [];
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Perfil nao encontrado.' });
    }

    const [row] = rows;
    if (!row) {
      return res.status(404).json({ message: 'Perfil nao encontrado.' });
    }

    return res.json(mapProfile(row));
  } catch (error) {
    console.error('Erro ao consultar perfil:', error);
    return res.status(500).json({ message: 'Erro ao consultar perfil.' });
  }
}

export async function updateProfile(
  req: Request,
  res: Response
): Promise<Response> {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: 'Nao autenticado.' });
  }
  const { name, role, age, availability, profilePhoto } = req.body as UpdateProfileBody;
  const updates: string[] = [];
  const binds: oracledb.BindParameters = { id: user.id };

  if (name) {
    updates.push('name = :name');
    binds.name = name;
  }

  if (role) {
    updates.push('role = :role');
    binds.role = role;
  }

  if (typeof age === 'number') {
    updates.push('age = :age');
    binds.age = age;
  }

  if (availability !== undefined) {
    if (!isValidAvailability(availability)) {
      return res.status(400).json({ message: 'Disponibilidade deve ser um objeto com listas por dia da semana.' });
    }

    updates.push('availability_json = :availability_json');
    binds.availability_json = JSON.stringify(availability);
  }

  if (profilePhoto) {
    updates.push('profile_photo = :profile_photo');
    binds.profile_photo = profilePhoto;
  }

  if (updates.length === 0) {
    return res.status(400).json({ message: 'Nenhum campo para atualizar.' });
  }

  try {
    await withOracleConnection(async (connection) => {
      await connection.execute(
        `UPDATE clients SET ${updates.join(', ')} WHERE id = :id`,
        binds,
        { autoCommit: true }
      );
    });

    return getProfile(req, res);
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    return res.status(500).json({ message: 'Erro ao atualizar perfil.' });
  }
}
