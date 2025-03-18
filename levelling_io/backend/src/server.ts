import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { handleSocketConnection } from './socket/handlers';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    allowUpgrades: true,
    pingTimeout: 10000,
    pingInterval: 5000
});

// Middleware
app.use(cors());
app.use(express.json());

// Basic health check route
app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok' });
});

// WebSocket connection handling
io.on('connection', handleSocketConnection);

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});