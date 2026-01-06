const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const DEFAULT_PORT = 3005;
const PORT = process.env.PORT || DEFAULT_PORT;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Store for connected clients (Server-Sent Events)
// Now keyed by jobId for targeted updates
let clients = new Map(); // jobId -> { id, res }

// SSE endpoint for frontend to listen for updates
// Frontend connects with: /events?jobId=abc123
app.get('/events', (req, res) => {
    const jobId = req.query.jobId;
    
    if (!jobId) {
        return res.status(400).json({ error: 'Missing jobId query parameter' });
    }
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', jobId, message: 'Connected to status updates' })}\n\n`);
    
    // Store client with jobId
    clients.set(jobId, { id: Date.now(), res, jobId });
    
    console.log(`✓ Client connected for job: ${jobId}. Active jobs: ${clients.size}`);
    
    // Remove client on disconnect
    req.on('close', () => {
        clients.delete(jobId);
        console.log(`✗ Client disconnected for job: ${jobId}. Active jobs: ${clients.size}`);
    });
});

// Endpoint for n8n to POST status updates
// n8n sends: { jobId: "abc123", status: "processing", title: "...", subtitle: "..." }
app.post('/status', (req, res) => {
    const { jobId, status, title, subtitle } = req.body;
    
    if (!jobId) {
        return res.status(400).json({ error: 'Missing required field: jobId' });
    }
    if (!status || !title) {
        return res.status(400).json({ error: 'Missing required fields: status, title' });
    }
    
    const update = {
        type: 'status_update',
        jobId,
        status,        // 'processing', 'complete', 'error'
        title,
        subtitle: subtitle || '',
        timestamp: new Date().toISOString()
    };
    
    // Find the client for this specific job
    const client = clients.get(jobId);
    
    if (client) {
        console.log(`→ Sending status to job ${jobId}: ${title}`);
        client.res.write(`data: ${JSON.stringify(update)}\n\n`);
        res.json({ success: true, delivered: true });
    } else {
        console.log(`⚠ No client connected for job ${jobId}`);
        res.json({ success: true, delivered: false, reason: 'No client connected for this jobId' });
    }
});

// Job completion endpoint
// n8n sends: { jobId: "abc123", title: "...", subtitle: "...", filesUrl: "https://..." }
app.post('/complete', (req, res) => {
    const { jobId, title, subtitle, details, filesUrl } = req.body;
    
    if (!jobId) {
        return res.status(400).json({ error: 'Missing required field: jobId' });
    }
    
    const update = {
        type: 'job_complete',
        jobId,
        status: 'complete',
        title: title || 'Job Finished',
        subtitle: subtitle || 'Analysis complete',
        filesUrl: filesUrl || null,  // URL for "View Files" button
        details: details || {},
        timestamp: new Date().toISOString()
    };
    
    const client = clients.get(jobId);
    
    if (client) {
        console.log(`✓ Job ${jobId} complete: ${title}${filesUrl ? ` (Files: ${filesUrl})` : ''}`);
        client.res.write(`data: ${JSON.stringify(update)}\n\n`);
        res.json({ success: true, delivered: true });
    } else {
        console.log(`⚠ No client connected for job ${jobId}`);
        res.json({ success: true, delivered: false, reason: 'No client connected for this jobId' });
    }
});

// Health check - now shows active jobs
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        activeJobs: clients.size,
        jobs: Array.from(clients.keys())
    });
});

// List active jobs (useful for debugging)
app.get('/jobs', (req, res) => {
    res.json({
        count: clients.size,
        jobs: Array.from(clients.keys())
    });
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'rof-app.html'));
});

const server = app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║           ROF Status Server Running                       ║
╠═══════════════════════════════════════════════════════════╣
║  Frontend:    http://localhost:${PORT}                       ║
║  SSE Events:  http://localhost:${PORT}/events                ║
║  Status API:  POST http://localhost:${PORT}/status           ║
║  Complete:    POST http://localhost:${PORT}/complete         ║
╠═══════════════════════════════════════════════════════════╣
║  Status Update Payload:                                   ║
║  {                                                        ║
║    "jobId": "job_123...",                                 ║
║    "status": "processing" | "complete" | "error",         ║
║    "title": "Step title",                                 ║
║    "subtitle": "Step description"                         ║
║  }                                                        ║
╠═══════════════════════════════════════════════════════════╣
║  Job Complete Payload:                                    ║
║  {                                                        ║
║    "jobId": "job_123...",                                 ║
║    "title": "Analysis Complete",                          ║
║    "subtitle": "Report ready",                            ║
║    "filesUrl": "https://drive.google.com/..."             ║
║  }                                                        ║
╚═══════════════════════════════════════════════════════════╝
    `);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ Port ${PORT} is already in use!\n`);
        console.log('Try one of these solutions:\n');
        console.log(`  1. Kill the existing process:`);
        console.log(`     lsof -i :${PORT}`);
        console.log(`     kill -9 <PID>\n`);
        console.log(`  2. Use a different port:`);
        console.log(`     PORT=3005 npm start\n`);
        process.exit(1);
    } else {
        throw err;
    }
});