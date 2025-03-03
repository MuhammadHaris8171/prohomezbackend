import express from 'express';
import { checkStoreId, checkEmail, loginVendor, registerVendor } from '../controllers/authControllers.js';

const router = express.Router();

router.post('/register', registerVendor);
router.post('/login', loginVendor);
router.get('/check-store-id/:storeId', async (req, res, next) => {
    if (!req.params.storeId) {
        return res.status(400).json({ message: 'Store ID is required' });
    }
    next();
}, checkStoreId);
router.get('/check-email/:email', async (req, res, next) => {
    if (!req.params.email) {
        return res.status(400).json({ message: 'Email is required' });
    }
    next();
}, checkEmail);

export default router;
