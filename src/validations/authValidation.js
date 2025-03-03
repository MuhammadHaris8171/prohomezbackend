import Joi from 'joi';

const registerSchema = Joi.object({
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    storeName: Joi.string().required(),
    storeId: Joi.string()
        .pattern(/^[a-z0-9-]+$/)
        .required()
        .messages({
            'string.pattern.base': 'Store ID must be lowercase, contain no spaces, and only include letters, numbers, and hyphens.',
        }),
    address1: Joi.string().required(),
    address2: Joi.string().allow(null, '').optional(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    country: Joi.string().required(),
    postcode: Joi.string().required(),
    phone: Joi.string().pattern(/^\d+$/).required(),
    email: Joi.string().email().required(),
    brandType: Joi.string().required(),
    password: Joi.string().min(6).required(),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required()
        .messages({ 'any.only': 'Confirm password must match password' }),
});


const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
});

export const validateRegister = (data) => registerSchema.validate(data);
export const validateLogin = (data) => loginSchema.validate(data);
