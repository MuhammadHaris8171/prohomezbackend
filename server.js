import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './src/routes/routes.js';
import authRoutes from './src/routes/authroutes.js';
import bodyParser from "body-parser";

dotenv.config();

const app = express();

app.use(express.json());

// ✅ Correct CORS configuration
app.use(cors({
  origin: 'http://localhost:5173', // Allow frontend URL
  credentials: true, // Allow cookies if needed
}));

app.use(express.static('public'));
app.use(bodyParser.json());

app.use('/', routes);
app.use('/api/auth', authRoutes);



const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
