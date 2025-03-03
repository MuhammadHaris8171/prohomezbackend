import db from '../config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { validateRegister, validateLogin } from '../validations/authValidation.js';

export const registerVendor = async (req, res) => {
    const { error } = validateRegister(req.body);
    if (error) {
        return res.status(400).send({ message: error.details[0].message });
    }

    const {
        firstName,
        lastName,
        storeName,
        storeId,
        address1,
        address2,
        city,
        state,
        country,
        postcode,
        phone,
        brandType,
        password,
        email,
    } = req.body;

    try {
        const checkStoreIdQuery = `SELECT COUNT(*) AS count FROM vendors WHERE store_id = ?`;
        const [checkResult] = await new Promise((resolve, reject) => {
            db.query(checkStoreIdQuery, [storeId], (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });

        if (checkResult.count > 0) {
            return res.status(400).send({ message: 'Store ID is already taken' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const query = `
            INSERT INTO vendors 
            (first_name, last_name, store_name, store_id, address1, address2, city, state_county, country, postcode, store_phone, brand_type, password, email)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.query(
            query,
            [
                firstName,
                lastName,
                storeName,
                storeId,
                address1,
                address2,
                city,
                state,
                country,
                postcode,
                phone,
                brandType,
                hashedPassword,
                email,
            ],
            (err, result) => {
                if (err) {
                    res.status(500).send({ message: 'Database error', error: err });
                } else {
                    res.status(200).send({ message: 'Vendor registered successfully!' });
                }
            }
        );
    } catch (error) {
        res.status(500).send({ message: 'Server error', error });
    }
};


export const loginVendor = (req, res) => {
    const { error } = validateLogin(req.body);
    if (error) {
        return res.status(400).json({ message: error.details[0].message });
    }

    const { email, password } = req.body;

    const query = 'SELECT * FROM vendors WHERE email = ?';
    db.query(query, [email], async (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'Vendor not found!' });
        }

        const vendor = results[0];

        
        const isPasswordMatch = await bcrypt.compare(password, vendor.password);
        
        if (!isPasswordMatch) {
            return res.status(401).json({ message: 'Invalid email or password!' });
        }
        // Check if vendor status is 'active'
        if (vendor.vendor_status !== 1   && vendor.isAdmin == 0) {
            return res.status(403).json({ message: 'Vendor account is not active. Please contact support at (+92) 315 5625755.' });
        }

        try {
            const token = jwt.sign(
                {
                    id: vendor.id,
                    store_id: vendor.store_id,
                    email: vendor.email,
                },
                process.env.JWT_SECRET,
                { expiresIn: '2h' }
            );

            return res.status(200).json({
                message: 'Login successful',
                token,
            });
        } catch (tokenError) {
            console.error('Error generating token:', tokenError);
            return res.status(500).json({ message: 'Could not generate authentication token' });
        }
    });
};

// Check Store ID
export const checkStoreId = async (req, res) => {
    const { storeId } = req.params;

    if (!storeId) {
        return res.status(400).send({ message: 'Store ID is required.' });
    }

    try {
        const query = 'SELECT COUNT(*) AS count FROM vendors WHERE store_id = ?';
        const [result] = await new Promise((resolve, reject) => {
            db.query(query, [storeId], (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });

        if (result.count > 0) {
            return res.status(200).send({ exists: true, message: 'Store ID is already taken.' });
        }

        return res.status(200).send({ exists: false, message: 'Store ID is available.' });
    } catch (error) {
        console.error('Error checking store ID:', error);
        return res.status(500).send({ message: 'Server error', error });
    }
};

// Check Store Email
export const checkEmail = async (req, res) => {
    const { email } = req.params;

    if (!email) {
        return res.status(400).send({ message: 'Email is required.' });
    }

    try {
        const query = 'SELECT COUNT(*) AS count FROM vendors WHERE email = ?';
        const [result] = await new Promise((resolve, reject) => {
            db.query(query, [email], (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });

        if (result.count > 0) {
            return res.status(200).send({ exists: true, message: 'Email is already taken.' });
        }

        return res.status(200).send({ exists: false, message: 'Email is available.' });
    } catch (error) {
        console.error('Error checking Email:', error);
        return res.status(500).send({ message: 'Server error', error });
    }
};