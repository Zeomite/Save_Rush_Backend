const express = require('express');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const cors = require('cors');
const routes = require('./routes');

const app = express();

// Essential middleware first
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Debug middleware - after body parsing
app.use((req, res, next) => {
    console.log('Incoming request:', {
        method: req.method,
        url: req.url,
        body: req.body,
        headers: req.headers
    });
    next();
});

// Root route
app.get("/", (req, res) => {
    res.send("Server is Running");
});

// API routes
app.use('/api', routes);

// 404 handler
app.use((req, res, next) => {
    console.log('404 Error - Route not found:', req.url);
    res.status(404).json({ message: `Cannot ${req.method} ${req.url}` });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
