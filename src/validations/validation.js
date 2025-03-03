import Joi from 'joi';

const productSchema = Joi.object({
    productName: Joi.string().required(),
    productPrice: Joi.number().required(),
    discountedPrice: Joi.number().optional(),
    productDescription: Joi.string().required(),
    selectedCategory: Joi.string().required(),
    selectedImages: Joi.array().items(Joi.string()).required(),
    productBeds: Joi.number().optional(),  // Optional by default
    productBaths: Joi.number().optional(),
    propertyArea: Joi.number().optional(),
    selectedAmenities: Joi.array()
        .items(Joi.string())
        .optional()
        .allow(null)
        .messages({
            'array.base': 'Selected amenities must be an array of strings.',
            'string.base': 'Each amenity must be a string.',
        }),
}).custom((value, helpers) => {
    // Check if vendor's brand_type is 'Real Estate' and validate accordingly
    if (value.brandType === 'Real Estate') {
        if (value.productBeds == null || value.productBaths == null || value.propertyArea == null) {
            return helpers.message('Real Estate details (bed, bath, sqft) must be provided.');
        }
        // Additional validation if necessary
        if (value.productBeds <= 0 || value.productBaths <= 0 || value.propertyArea <= 0) {
            return helpers.message('Bed, bath, and sqft must be positive values.');
        }
    }
    return value;  // return the validated value
});

export const orderValidationSchema = Joi.object({
    clientDetails: Joi.object({
        name: Joi.string().required().messages({
            "string.empty": "Name is required.",
        }),
        email: Joi.string().email().required().messages({
            "string.email": "Invalid email address.",
            "string.empty": "Email is required.",
        }),
        phone: Joi.string().required().messages({
            "string.empty": "Phone number is required.",
        }),
        address: Joi.string().required().messages({
            "string.empty": "Address is required.",
        }),
        city: Joi.string().required().messages({
            "string.empty": "City is required.",
        }),
        state: Joi.string().required().messages({
            "string.empty": "State is required.",
        }),
        country: Joi.string().required().messages({
            "string.empty": "Country is required.",
        }),
        postalCode: Joi.string().required().messages({
            "string.empty": "Postal code is required.",
        }),
    }).required(),
    cartItems: Joi.array()
        .items(
            Joi.object({
                slug: Joi.string().required().messages({
                    "string.empty": "Product slug is required.",
                }),
                productName: Joi.string().required().messages({
                    "string.empty": "Product name is required.",
                }),
                productPrice: Joi.number().required().messages({
                    "number.base": "Product price must be a number.",
                    "number.empty": "Product price is required.",
                }),
                discountedPrice: Joi.number().optional(),
                quantity: Joi.number().min(1).required().messages({
                    "number.base": "Quantity must be a number.",
                    "number.min": "Quantity must be at least 1.",
                    "number.empty": "Quantity is required.",
                }),
            })
        )
        .required()
        .messages({
            "array.base": "Cart items must be an array.",
            "array.empty": "Cart cannot be empty.",
        }),
    totalCost: Joi.number().required().messages({
        "number.base": "Total cost must be a number.",
        "number.empty": "Total cost is required.",
    }),
});

export const validateProduct = (productData) => productSchema.validate(productData);
