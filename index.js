require('dotenv').config();
const connectDB = require('./src/utils/database.js');
const app = require('./src/server.js');

const PORT = process.env.PORT || 3000;

// First connect to database, then start server
const startServer = async () => {
    try {
        await connectDB();
        
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();