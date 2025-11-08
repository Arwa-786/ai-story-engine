import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import storyRouter from './routes/storyRoutes.js';
//import storyRouter from './routes/storyRoutes';

// Load environment variables from .env file (CRUCIAL FIX)
// We specify the path to look one directory up (project root)
dotenv.config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// 1. JSON Body Parser: Allows Express to read JSON data sent in POST requests (like the genre)
app.use(express.json());

// 2. Set API Routes
// All requests starting with /api/story will be handled by storyRouter
app.use('/api/story', storyRouter);

// Basic health check route
app.get('/', (_req: Request, res: Response) => {
    res.send('AI Story Engine Backend Running');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('API Endpoint: http://localhost:3000/api/story/start');
});