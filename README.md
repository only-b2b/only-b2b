📊 MERN CSV/XLSX User Dashboard

A MERN stack app to upload and manage user data from .csv or .xlsx files.

🚀 Features
Upload CSV/XLSX files
Store data in MongoDB Atlas
Auto-update users based on Email (no duplicates)
View all data in a paginated dashboard
Supports large datasets (1 lakh+ records)
⚙️ Setup

1. Clone repo

git clone <your-repo-link>
cd mern-csv-dashboard

2. Backend

cd backend
npm install

Create .env:

MONGO_URI=your_mongodb_uri
PORT=####

Run:

npm run dev

3. Frontend

cd ../frontend
npm install
npm run dev
🌐 Usage
Open: http://localhost:5173
Upload file → Data saves to DB → View in dashboard
🛠 Tech Stack
MongoDB Atlas
Express.js
React (Vite)
Node.js
Mongoose
Multer + fast-csv + xlsx
