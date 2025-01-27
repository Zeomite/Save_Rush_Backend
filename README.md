# SAVE RUSH App

## Workflow
- User can browse and order items from a common inventory.
- Nearby vendors are notified in sequence, and the first vendor with all requested items accepts the request.
- Delivery personnel pick up orders from vendors and deliver them to the users.
- Supports real-time notifications for order status updates.

---

## File Structure
```
project-root
├── src
│   ├── middlewares        # Middleware for authentication and logging
│   ├── models             # Data models for database interaction
│   ├── services           # Modular services for business logic
│   ├── utils              # Utility files (database connection, notifications)
│   ├── routes.js          # Centralized route management
│   └── server.js          # Application server setup
├── .gitignore             # Files to ignore in version control
├── index.js               # Entry point of the application
├── package-lock.json      # NPM lockfile
└── package.json           # Project dependencies and metadata
```

---

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Zeomite/Save_Rush_Backend.git
   cd delivery-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory and configure the following:
   ```env
   PORT=3000
   MONGO_URI=your_database_url
   ```

4. Run the application:
   ```bash
   npm start
   ```

5. Access the app:
   Open `http://localhost:3000` in your browser.

---

## Contributing

Contributions are welcome!  
1. Fork the repository.  
2. Create a new branch (`git checkout -b feature-branch`).  
3. Commit your changes (`git commit -m "Add feature"`).  
4. Push the branch (`git push origin feature-branch`).  
5. Open a pull request.

---
