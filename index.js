require('dotenv').config(); 
const app = require('./src/server.js'); 

const PORT = process.env.PORT || 3000;

app.get("/", (req ,res) => {
    res.send("Server is Running")
})

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
