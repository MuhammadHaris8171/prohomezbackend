import jwt from 'jsonwebtoken';

export const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    console.log('Auth Token:', token); // Debug log
    
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized access' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        console.log('Decoded token:', decoded); // Debug log
        console.log('Auth middleware - req.user:', req.user); // Debug log
        next();
    } catch (err) {
        console.error('Token verification error:', err); // Debug log
        return res.status(403).json({ message: 'Invalid or expired token' });
    }
};
