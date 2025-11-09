import express, { Request, Response } from 'express';
import cors from 'cors';
import { loadEnv, validateRequiredEnvVars } from './config/env.js';
import textRouter from './routes/storyRoutes.js';
import agentRouter from './routes/agentRoutes.js';
//import storyRouter from './routes/storyRoutes';

// Load environment variables robustly (project root or CWD)
loadEnv();

// Validate all required environment variables are present
validateRequiredEnvVars();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// 0. CORS: Allow local dev tools (Vite, Storybook, etc.) to hit this API.
app.use(
    cors({
        origin: true,
        credentials: true,
    }),
);
// 1. JSON Body Parser: Allows Express to read JSON data sent in POST requests (like the genre)
app.use(express.json());

// 2. Set API Routes
// Hash-based text orchestration
app.use('/api/text', textRouter);
// Agent-specific endpoints for text, image, and audio generation
app.use('/api/agents', agentRouter);

// Basic health check route
app.get('/', (_req: Request, res: Response) => {
    res.send('AI Story Engine Backend Running');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Text Endpoint: http://localhost:3000/api/text/generate');
    console.log('Agent Endpoints:');
    console.log('  POST http://localhost:3000/api/agents/text');
    console.log('  POST http://localhost:3000/api/agents/image');
    console.log('  POST http://localhost:3000/api/agents/audio');
});