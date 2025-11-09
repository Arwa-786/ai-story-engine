import express, { NextFunction, Request, Response } from 'express';
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

// 2. Lightweight request/response logger (prints for every request, with latency)
app.use((req: Request, res: Response, next: NextFunction) => {
    const startedAt = Date.now();
    const method = req.method.toUpperCase();
    const url = req.originalUrl || req.url;
    res.on("finish", () => {
        const elapsedMs = Date.now() - startedAt;
        console.log(`➡️  ${method} ${url} → ${res.statusCode} in ${elapsedMs}ms`);
    });
    next();
});

// 2. Set API Routes
// Hash-based text orchestration
app.use('/api/text', textRouter);
// Agent-specific endpoints for text, image, and audio generation
app.use('/api/agents', agentRouter);

// Basic health check route
app.get('/', (_req: Request, res: Response) => {
    res.send('AI Story Engine Backend Running');
});

// Global error handler to ensure all unhandled errors are logged and returned as JSON
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const method = req.method.toUpperCase();
    const url = req.originalUrl || req.url;
    console.error(`\n💥 Unhandled error in ${method} ${url}`);
    console.error(err);
    if (res.headersSent) {
        return;
    }
    const message =
        err instanceof Error ? err.message : typeof err === "string" ? err : "Internal Server Error";
    res.status(500).json({
        error: "Internal Server Error",
        detail: message,
    });
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