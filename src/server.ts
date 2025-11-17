import cors from 'cors';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import { getPool } from './config/oracle.js';
import automationRoutes from './routes/automationRoutes.js';
import authRoutes from './routes/authRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import profileRoutes from './routes/profileRoutes.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/auth', authRoutes);
app.use('/profile', profileRoutes);
app.use('/bookings', bookingRoutes);
app.use('/chat', chatRoutes);
app.use('/automation', automationRoutes);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  const message = err instanceof Error ? err.message : 'Erro desconhecido.';
  res.status(500).json({
    message: 'Erro interno inesperado. Verifique os logs do servidor.',
    details: process.env.NODE_ENV === 'development' ? message : undefined
  });
});

async function bootstrap() {
  try {
    await getPool();
    const port = process.env.PORT ?? 4000;

    if (process.env.NODE_ENV !== 'test') {
      app.listen(port, () => {
        console.log(`API pronta em http://localhost:${port}`);
      });
    }
  } catch (error) {
    console.error('Falha ao inicializar o pool do Oracle:', error);
    process.exit(1);
  }
}

bootstrap();

export default app;
