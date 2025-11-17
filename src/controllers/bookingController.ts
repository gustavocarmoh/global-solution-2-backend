import { type Request, type Response } from 'express';
import type oracledb from 'oracledb';
import { randomUUID } from 'node:crypto';
import { defaultOutFormat, withOracleConnection } from '../utils/db.js';

interface BookingRow {
  ID: string;
  ROOM_LABEL: string;
  STATUS: string;
  DESCRIPTION: string | null;
  MEETING_DATE: string;
  START_TS: string;
  END_TS: string;
}

interface BookingBody {
  room: string;
  meetingDate: string;
  startTime: string;
  endTime: string;
  description?: string;
}

interface UpdateBookingBody {
  meetingDate?: string;
  startTime?: string;
  endTime?: string;
  room?: string;
  description?: string;
}

function composeTimestamp(date: string, time: string): string {
  return `${date}T${time}`;
}

function mapBooking(row: BookingRow) {
  const formatTime = (value: string | null): string | null => (value ? value.substring(11, 16) : null);

  return {
    id: row.ID,
    room: row.ROOM_LABEL,
    meetingDate: row.MEETING_DATE,
    startTimestamp: row.START_TS,
    endTimestamp: row.END_TS,
    startTime: formatTime(row.START_TS),
    endTime: formatTime(row.END_TS),
    description: row.DESCRIPTION,
    status: row.STATUS
  };
}

function validateChronology(startTimestamp: string, endTimestamp: string): boolean {
  const start = new Date(startTimestamp);
  const end = new Date(endTimestamp);
  return end > start;
}

async function assertRoomAvailability(connection: oracledb.Connection, params: {
  room: string;
  meetingDate: string;
  startTimestamp: string;
  endTimestamp: string;
  bookingId?: string;
}): Promise<void> {
  const conflict = await connection.execute<{ TOTAL: number }>(
    `SELECT COUNT(*) AS total
     FROM bookings
     WHERE room_label = :room
       AND status = 'ACTIVE'
       AND meeting_date = TO_DATE(:meeting_date, 'YYYY-MM-DD')
       AND (:booking_id IS NULL OR id <> :booking_id)
       AND (
            (start_time <= TO_TIMESTAMP(:start_ts, 'YYYY-MM-DD"T"HH24:MI') AND end_time > TO_TIMESTAMP(:start_ts, 'YYYY-MM-DD"T"HH24:MI'))
         OR (start_time < TO_TIMESTAMP(:end_ts, 'YYYY-MM-DD"T"HH24:MI') AND end_time >= TO_TIMESTAMP(:end_ts, 'YYYY-MM-DD"T"HH24:MI'))
         OR (start_time >= TO_TIMESTAMP(:start_ts, 'YYYY-MM-DD"T"HH24:MI') AND end_time <= TO_TIMESTAMP(:end_ts, 'YYYY-MM-DD"T"HH24:MI'))
       )`,
    {
      room: params.room,
      meeting_date: params.meetingDate,
      start_ts: params.startTimestamp,
      end_ts: params.endTimestamp,
      booking_id: params.bookingId ?? null
    },
    defaultOutFormat
  );

  const rows = conflict.rows ?? [];
  const total = rows[0]?.TOTAL ?? 0;

  if (total > 0) {
    throw new Error('CONFLICT');
  }
}

export async function createBooking(
  req: Request,
  res: Response
): Promise<Response> {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: 'Nao autenticado.' });
  }
  const { room, meetingDate, startTime, endTime, description } = req.body as BookingBody;

  if (!room || !meetingDate || !startTime || !endTime) {
    return res.status(400).json({ message: 'room, meetingDate, startTime e endTime sao obrigatorios.' });
  }

  const startTimestamp = composeTimestamp(meetingDate, startTime);
  const endTimestamp = composeTimestamp(meetingDate, endTime);

  if (!validateChronology(startTimestamp, endTimestamp)) {
    return res.status(400).json({ message: 'Horario final deve ser apos o horario inicial.' });
  }

  try {
    const booking = await withOracleConnection(async (connection) => {
      await assertRoomAvailability(connection, {
        room,
        meetingDate,
        startTimestamp,
        endTimestamp
      });

      const bookingId = randomUUID();

      await connection.execute(
        `INSERT INTO bookings (
            id, client_id, room_label, meeting_date,
            start_time, end_time, description, status
         )
         VALUES (
            :id, :client_id, :room, TO_DATE(:meeting_date, 'YYYY-MM-DD'),
            TO_TIMESTAMP(:start_ts, 'YYYY-MM-DD"T"HH24:MI'),
            TO_TIMESTAMP(:end_ts, 'YYYY-MM-DD"T"HH24:MI'),
            :description, 'ACTIVE'
         )`,
        {
          id: bookingId,
          client_id: user.id,
          room,
          meeting_date: meetingDate,
          start_ts: startTimestamp,
          end_ts: endTimestamp,
          description
        },
        { autoCommit: true }
      );

      const inserted = await connection.execute<BookingRow>(
        `SELECT id, room_label, status, description,
                TO_CHAR(meeting_date, 'YYYY-MM-DD') AS meeting_date,
                TO_CHAR(start_time, 'YYYY-MM-DD"T"HH24:MI') AS start_ts,
                TO_CHAR(end_time, 'YYYY-MM-DD"T"HH24:MI') AS end_ts
         FROM bookings
         WHERE id = :id`,
        { id: bookingId },
        defaultOutFormat
      );

      const insertedRows = inserted.rows ?? [];
      const [insertedRow] = insertedRows;
      if (!insertedRow) {
        throw new Error('NOT_FOUND');
      }
      return mapBooking(insertedRow);
    });

    return res.status(201).json(booking);
  } catch (error) {
    if (error instanceof Error && error.message === 'CONFLICT') {
      return res.status(409).json({ message: 'Ja existe um agendamento para a sala nesse intervalo.' });
    }

    console.error('Erro ao criar agendamento:', error);
    return res.status(500).json({ message: 'Erro ao criar agendamento.' });
  }
}

export async function listBookings(req: Request, res: Response): Promise<Response> {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: 'Nao autenticado.' });
  }
  try {
    const result = await withOracleConnection(async (connection) => {
      return connection.execute<BookingRow>(
        `SELECT id, room_label, status, description,
                TO_CHAR(meeting_date, 'YYYY-MM-DD') AS meeting_date,
                TO_CHAR(start_time, 'YYYY-MM-DD"T"HH24:MI') AS start_ts,
                TO_CHAR(end_time, 'YYYY-MM-DD"T"HH24:MI') AS end_ts
         FROM bookings
         WHERE client_id = :client_id
         ORDER BY start_time`,
        { client_id: user.id },
        defaultOutFormat
      );
    });

    const rows = result.rows ?? [];
    return res.json(rows.map(mapBooking));
  } catch (error) {
    console.error('Erro ao listar agendamentos:', error);
    return res.status(500).json({ message: 'Erro ao listar agendamentos.' });
  }
}

export async function updateBooking(
  req: Request,
  res: Response
): Promise<Response> {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: 'Nao autenticado.' });
  }
  const { bookingId } = req.params as { bookingId: string };
  const { meetingDate, startTime, endTime, room, description } = req.body as UpdateBookingBody;

  if (!meetingDate && !startTime && !endTime && !room && !description) {
    return res.status(400).json({ message: 'Informe algum campo para atualizar.' });
  }

  try {
    const booking = await withOracleConnection(async (connection) => {
      const existing = await connection.execute<BookingRow>(
        `SELECT id, room_label,
                TO_CHAR(meeting_date, 'YYYY-MM-DD') AS meeting_date,
                TO_CHAR(start_time, 'YYYY-MM-DD"T"HH24:MI') AS start_ts,
                TO_CHAR(end_time, 'YYYY-MM-DD"T"HH24:MI') AS end_ts,
                status, description
         FROM bookings
         WHERE id = :id AND client_id = :client_id`,
        { id: bookingId, client_id: user.id },
        defaultOutFormat
      );

      const existingRows = existing.rows ?? [];

      if (existingRows.length === 0) {
        return null;
      }

      const [current] = existingRows;
      if (!current) {
        return null;
      }
      const safeStartIso = current.START_TS ?? composeTimestamp(current.MEETING_DATE, '00:00');
      const safeEndIso = current.END_TS ?? composeTimestamp(current.MEETING_DATE, '00:30');

      const nextMeetingDate = meetingDate ?? current.MEETING_DATE;
      const nextStartTime = startTime ?? safeStartIso.substring(11, 16);
      const nextEndTime = endTime ?? safeEndIso.substring(11, 16);
      const startTimestamp = composeTimestamp(nextMeetingDate, nextStartTime);
      const endTimestamp = composeTimestamp(nextMeetingDate, nextEndTime);

      if (!validateChronology(startTimestamp, endTimestamp)) {
        throw new Error('INVALID_RANGE');
      }

      const nextRoom = room ?? current.ROOM_LABEL;

      await assertRoomAvailability(connection, {
        room: nextRoom,
        meetingDate: nextMeetingDate,
        startTimestamp,
        endTimestamp,
        bookingId
      });

      const updates: string[] = [];
      const binds: oracledb.BindParameters = { id: bookingId };

      if (room) {
        updates.push('room_label = :room');
        binds.room = room;
      }

      if (meetingDate) {
        updates.push('meeting_date = TO_DATE(:meeting_date, \'YYYY-MM-DD\')');
        binds.meeting_date = nextMeetingDate;
        updates.push('start_time = TO_TIMESTAMP(:start_ts, \'YYYY-MM-DD"T"HH24:MI\')');
        updates.push('end_time = TO_TIMESTAMP(:end_ts, \'YYYY-MM-DD"T"HH24:MI\')');
        binds.start_ts = startTimestamp;
        binds.end_ts = endTimestamp;
      } else if (startTime || endTime) {
        updates.push('start_time = TO_TIMESTAMP(:start_ts, \'YYYY-MM-DD"T"HH24:MI\')');
        updates.push('end_time = TO_TIMESTAMP(:end_ts, \'YYYY-MM-DD"T"HH24:MI\')');
        binds.start_ts = startTimestamp;
        binds.end_ts = endTimestamp;
      }

      if (description !== undefined) {
        updates.push('description = :description');
        binds.description = description;
      }

      if (updates.length === 0) {
        return mapBooking(current);
      }

      await connection.execute(
        `UPDATE bookings SET ${updates.join(', ')} WHERE id = :id`,
        binds,
        { autoCommit: true }
      );

      const updated = await connection.execute<BookingRow>(
        `SELECT id, room_label, status, description,
                TO_CHAR(meeting_date, 'YYYY-MM-DD') AS meeting_date,
                TO_CHAR(start_time, 'YYYY-MM-DD"T"HH24:MI') AS start_ts,
                TO_CHAR(end_time, 'YYYY-MM-DD"T"HH24:MI') AS end_ts
         FROM bookings
         WHERE id = :id`,
        { id: bookingId },
        defaultOutFormat
      );

      const updatedRows = updated.rows ?? [];
      const [updatedRow] = updatedRows;
      if (!updatedRow) {
        throw new Error('NOT_FOUND');
      }
      return mapBooking(updatedRow);
    });

    if (!booking) {
      return res.status(404).json({ message: 'Agendamento nao encontrado.' });
    }

    return res.json(booking);
  } catch (error) {
    if (error instanceof Error && error.message === 'CONFLICT') {
      return res.status(409).json({ message: 'Ja existe um agendamento para a sala nesse intervalo.' });
    }

    if (error instanceof Error && error.message === 'INVALID_RANGE') {
      return res.status(400).json({ message: 'Horarios invalidos.' });
    }

    console.error('Erro ao atualizar agendamento:', error);
    return res.status(500).json({ message: 'Erro ao atualizar agendamento.' });
  }
}

export async function cancelBooking(
  req: Request,
  res: Response
): Promise<Response> {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: 'Nao autenticado.' });
  }
  const { bookingId } = req.params as { bookingId: string };

  try {
    const updated = await withOracleConnection(async (connection) => {
      const result = await connection.execute(
        `UPDATE bookings
         SET status = 'CANCELED'
         WHERE id = :id AND client_id = :client_id AND status = 'ACTIVE'`,
        { id: bookingId, client_id: user.id },
        { autoCommit: true }
      );

      return result.rowsAffected ?? 0;
    });

    if (updated === 0) {
      return res.status(404).json({ message: 'Agendamento nao encontrado ou ja cancelado.' });
    }

    return res.json({ message: 'Agendamento cancelado.' });
  } catch (error) {
    console.error('Erro ao cancelar agendamento:', error);
    return res.status(500).json({ message: 'Erro ao cancelar agendamento.' });
  }
}
