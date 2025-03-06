import db from '../config/db.js';
import { dbQuery, executeQuery } from '../reuseable/functions.js';
import { orderValidationSchema, validateProduct } from '../validations/validation.js';
import slugify from 'slugify';
import bcrypt from 'bcryptjs';
import nodemailer from "nodemailer";


// Store Images
export const uploadImages = async (req, res) => {

    // Extract store_id from req.user
    const { store_id } = req.user;

    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'No files uploaded.' });
    }

    try {
        // Map through files to get filenames and add store_id and date
        const images = req.files.map((file) => file.filename);
        const values = images.map((image) => [image, store_id, new Date()]);

        // Updated SQL query to include store_id column
        const sql = 'INSERT INTO media (image, store_id, date) VALUES ?';
        await executeQuery(sql, [values]);

        return res.json({
            status: 'Success',
            images,
        });
    } catch (err) {
        console.error('Error uploading images:', err);
        return res.status(500).json({ message: 'Failed to upload images.' });
    }
};

// Get All Images
export const getAllImages = (req, res) => {
    // Extract store_id from req.user
    const { store_id } = req.user;
    const isAdmin = req.query.isAdmin;

    if (!store_id) {
        return res.status(400).json({ message: 'Store ID is required.' });
    }
    let sql;
    if(isAdmin == 1){
        sql = 'SELECT * FROM media';
    } else{
        sql = 'SELECT * FROM media WHERE store_id = ?';
    }

    db.query(sql, [store_id], (err, result) => {
        if (err) {
            console.error('Error fetching media:', err);
            return res.status(500).json({ message: 'Error fetching media.' });
        }

        return res.json(result); // Return filtered images
    });
};

// store product details
export const createProduct = async (req, res) => {
    const { error } = validateProduct(req.body);
    if (error) {
        return res.status(400).json({ message: error.details[0].message });
    }
    const {
        productName,
        productPrice,
        discountedPrice = null,
        productDescription,
        selectedCategory,
        selectedImages,
        productBeds,
        productBaths, 
        propertyArea,
        selectedAmenities
    } = req.body;

    if (!Array.isArray(selectedImages) || selectedImages.length === 0) {
        return res.status(400).json({ message: 'Selected images cannot be empty.' });
    }

    const featureImage = selectedImages[0];
    const imagesJson = JSON.stringify(selectedImages);

    try {
        const { store_id } = req.user;
        const amenitiesJson = selectedAmenities ? JSON.stringify(selectedAmenities) : null;

        // Fetch vendor details
        const userQuery = `
            SELECT brand_type, store_name, store_phone, email, image 
            FROM vendors 
            WHERE store_id = ?`;
        const userResult = await executeQuery(userQuery, [store_id]);

        if (userResult.length === 0) {
            return res.status(404).json({ message: 'Vendor not found.' });
        }

        const { brand_type: brandType, store_name, store_phone, email, image } = userResult[0];

        // Create a vendor details JSON
        const vendorDetails = JSON.stringify({
            store_name,
            store_phone,
            email,
            store_id,
            image,
        });

        // Generate a slug
        let slug = slugify(productName, { lower: true, strict: true });

        // Check if slug already exists
        const slugQuery = `SELECT COUNT(*) AS count FROM products WHERE slug = ?`;
        let slugExists = await executeQuery(slugQuery, [slug]);

        // Append a unique suffix if slug already exists
        if (slugExists[0].count > 0) {
            const uniqueSuffix = Date.now();
            slug = `${slug}-${uniqueSuffix}`;
        }

        // Real estate-specific logic to store bed, bath, sqft as JSON if brand_type is "Real Estate"
        let realEstateDetails = null;
        if (brandType === 'Real Estate') {
            if (productBeds != null && productBaths != null && propertyArea != null) {
                realEstateDetails = JSON.stringify({ productBeds, productBaths, propertyArea });
            } else {
                return res.status(400).json({ message: 'Real Estate details (bed, bath, sqft) must be provided.' });
            }
        }

        // Insert product data into database
        const sql = `
            INSERT INTO products (
                productName, 
                productPrice, 
                discountedPrice, 
                productDescription, 
                selectedCategory, 
                mainCategory, 
                selectedImages, 
                featureImage,
                storeId,
                slug,
                numberOfReviews,
                vendorDetails,
                realEstateDetails, 
                amenities
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;


        const result = await executeQuery(sql, [
            productName,
            productPrice,
            discountedPrice,
            productDescription,
            selectedCategory,
            brandType,
            imagesJson,
            featureImage,
            store_id,
            slug,
            0, // Initialize numberOfReviews to 0
            vendorDetails,
            realEstateDetails,
            amenitiesJson
        ]);

        res.status(201).json({
            message: 'Product created successfully!',
            productId: result.insertId,
            slug,
        });
    } catch (err) {
        console.error('Error creating product:', err);
        res.status(500).json({ message: 'Failed to create product.' });
    }
};

// Fetch all products
export const getProducts = (req, res) => {
    const searchTerm = req.query.search;
    
    let sql = 'SELECT productName, slug, featureImage, mainCategory, productPrice,selectedCategory FROM products';
    let params = [];

    if (searchTerm) {
        sql += ' WHERE productName LIKE ?';
        params = [`%${searchTerm}%`];
    }

    sql += ' LIMIT 10'; // Limit results for better performance

    db.query(sql, params, (err, results) => {
        if (err) {
            console.error('Error fetching products:', err);
            return res.status(500).json({ message: 'Failed to fetch products.' });
        }
        res.status(200).json(results);
    });
};

// Get Product By ID
export const getProductBySlug = async (req, res) => {
  const { slug } = req.params;
  try {
    const result = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM products WHERE slug = ?', [slug], (error, results) => {
        if (error) return reject(error);
        resolve(results);
      });
    });

    if (result.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(result[0]); // Return the first product
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ message: 'Failed to fetch product' });
  }
};

// Update Product
export const updateProduct = async (req, res) => {
  const { slug } = req.params;
  const { 
    productName, 
    productPrice, 
    discountedPrice, 
    productDescription, 
    selectedCategory, 
    selectedImages 
  } = req.body;

  if (!slug) {
    return res.status(400).json({ message: 'Slug is required.' });
  }

  // Check if the product exists
  try {
    const rows = await dbQuery('SELECT * FROM products WHERE slug = ?', [slug]);
    const productExists = rows.length > 0 ? rows[0] : null; // Get the first row or null

    if (!productExists) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    // Update the product
    const sql = `
      UPDATE products 
      SET 
        productName = ?, 
        productPrice = ?, 
        discountedPrice = ?, 
        productDescription = ?, 
        selectedCategory = ?, 
        selectedImages = ? 
      WHERE slug = ?`;

    const values = [
      productName, 
      productPrice, 
      discountedPrice || null, 
      productDescription, 
      selectedCategory, 
      JSON.stringify(selectedImages), 
      slug,
    ];

    await dbQuery(sql, values);

    res.status(200).json({ message: 'Product updated successfully!' });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Failed to update product.' });
  }
};

// Delete Product 
export const deleteProduct = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query('DELETE FROM products WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.status(200).json({ message: 'Product deleted successfully!' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Failed to delete product' });
  }
};

// Fetch Vendor products
export const fetchVendorProducts = async (req, res) => {
    try {
        const isAdmin = req.query.isAdmin;
        const { store_id } = req.user; 
        let sql = ``;
        if(isAdmin == 1){
            sql = `SELECT * FROM products`;
        } else {
            sql = `SELECT * FROM products WHERE storeId = ?`;
        }
        const products = await executeQuery(sql, [store_id]);

        res.status(200).json(products);
    } catch (err) {
        console.error('Error fetching vendor products:', err);
        res.status(500).json({ message: 'Failed to fetch vendor products.' });
    }
};

// Fetch Vendor Detail
export const fetchVendorDetails = async (req, res) => {
    try {
        const { store_id } = req.user;  // Extract the store_id from the authenticated user's info
        
        // Fetch vendor details based on store_id
        const sql = `
            SELECT brand_type, store_name, store_phone, email, image, isAdmin
            FROM vendors 
            WHERE store_id = ?
        `;
        const vendorResult = await executeQuery(sql, [store_id]);

        // If the vendor does not exist
        if (vendorResult.length === 0) {
            return res.status(404).json({ message: 'Vendor not found.' });
        }

        // Extract vendor details
        const { brand_type: brandType, store_name, store_phone, email, image, isAdmin } = vendorResult[0];

        // Send the vendor details as a response
        return res.status(200).json({
            store_name,
            store_phone,
            email,
            image,
            brand_type: brandType,
            isAdmin,
        });

    } catch (error) {
        console.error('Error fetching vendor details:', error);
        return res.status(500).json({ message: 'Failed to fetch vendor details' });
    }
};

export const fetchAllVendors = async (req, res) => {
    try {
        const isAdmin = req.query.isAdmin;
        let sql;
        if(isAdmin == 1){
            sql = `SELECT address1, address2, brand_type, city, country, email, first_name, image, isAdmin, last_name, postcode, state_county, store_id, store_name, store_phone, vendor_status
            FROM vendors`;
        } 
        const vendors = await executeQuery(sql);

        // Respond with the fetched vendors
        res.status(200).json(vendors);
    } catch (err) {
        console.error('Error fetching vendors:', err);
        res.status(500).json({ message: 'Failed to fetch vendors.' });
    }
};

// Controller to update vendor access status
export const updateVendorAccess = async (req, res) => {
    const {vendorId, newStatus} = req.body;

    if (!vendorId || newStatus === undefined) {
        return res.status(400).json({ message: 'store_id and newStatus are required' });
    }
    try {
        const query = 'UPDATE vendors SET vendor_status = ? WHERE store_id = ?';
        await db.query(query, [newStatus, vendorId]);
        res.status(200).json({ message: 'Vendor access status updated successfully' });
    } catch (error) {
        console.error('Error updating vendor access status:', error);
        res.status(500).json({ message: 'Failed to update vendor access status' });
    }
};

const generateOrderId = () => {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const randomLetters = letters.charAt(Math.floor(Math.random() * letters.length)) +
                        letters.charAt(Math.floor(Math.random() * letters.length));
  const randomNumbers = Math.floor(1000 + Math.random() * 9000); // Generates a 4-digit number
  return `${randomLetters}${randomNumbers}`;
};

export const checkoutOrder = async (req, res) => {
  const { error } = orderValidationSchema.validate(req.body, { abortEarly: false });
  if (error) {
      const errorMessages = error.details.map((err) => err.message);
      return res.status(400).json({ message: errorMessages });
  }

  const { clientDetails, cartItems, totalCost } = req.body;

  try {
      // Validate product slugs and fetch corresponding vendor details
      const slugs = cartItems.map((item) => item.slug);
      const slugQuery = `
          SELECT slug, productName, store_id, store_name, v.email 
          FROM products p
          JOIN vendors v ON store_id = v.store_id
          WHERE slug IN (?)
      `;
      const productRows = await executeQuery(slugQuery, [slugs]);

      const existingSlugs = new Map(
          productRows.map((row) => [
              row.slug,
              { productName: row.productName, store_id: row.store_id, store_name: row.store_name,email:row.email },
          ])
      );

      const missingProducts = cartItems.filter((item) => !existingSlugs.has(item.slug));
      if (missingProducts.length > 0) {
          const missingNames = missingProducts.map((item) => item.productName).join(", ");
          return res.status(400).json({ message: `The following products are not available: ${missingNames}` });
      }

      const vendorDetails = [];
      for (const item of cartItems) {
          const productData = existingSlugs.get(item.slug);
          vendorDetails.push({
              store_id: productData.store_id,
              store_name: productData.store_name,
              productName: productData.productName,
              VendorEmail:productData.email
          });
      }
    //   console.log(productData);
      // Generate a unique order ID
      const orderId = generateOrderId();
      // Save the order in the database
      const orderQuery = `
          INSERT INTO orders (order_id, client_details, cart_items, total_cost, vendor_details, order_date)
          VALUES (?, ?, ?, ?, ?, NOW())
      `;
      const orderResult = await executeQuery(orderQuery, [
          orderId,
          JSON.stringify(clientDetails),
          JSON.stringify(cartItems),
          totalCost,
          JSON.stringify(vendorDetails),
      ]);


      console.log(vendorDetails);

      // Send Email to Customer
      const transporter = nodemailer.createTransport({
        host: 'smtp.prohomez.com', // Replace with your SMTP server
        port: 465, // Use 587 for TLS
        secure: true, // Use false for TLS
        auth: {
            user: process.env.EMAIL_USER, 
            pass: process.env.EMAIL_PASS, 
        },
    });
    console.log(cartItems);
    const userMailOptions = {
        from: process.env.EMAIL_USER,
        to: clientDetails.email,
        subject: "Order Confirmation - Your Order has been placed",
        html: `
            <h2>Thank you for your order, ${clientDetails.name}!</h2>
            <p>Your order ID: <strong>${orderId}</strong></p>
            <p>Total Amount: <strong>$${totalCost}</strong></p>
            <h3>Order Details:</h3>
            <table border="1" cellspacing="0" cellpadding="10">
                <thead>
                    <tr>
                        <th>Product Name</th>
                        <th>Original Price</th>
                        <th>Discounted Price</th>
                        <th>Quantity</th>
                    </tr>
                </thead>
                <tbody>
                    ${cartItems
                        .map(
                            (item) => `
                            <tr>
                                <td>${item.productName}</td>
                                <td>$${item.productPrice}</td>
                                <td>$${item.discountedPrice}</td>
                                <td>${item.quantity}</td>
                            </tr>
                        `
                        )
                        .join("")}
                </tbody>
            </table>
            <p>We will notify you when your order is shipped.</p>
        `,
    };
    
    await transporter.sendMail(userMailOptions);


    // Send Email to Vendors
    for (const vendor of vendorDetails) {

        const vendorMailOptions = {
            from: process.env.EMAIL_USER,
            to: vendor.VendorEmail,
            subject: "New Order Received",
            html: `
                <h2>New Order Received</h2>
                <p>Store: <strong>${vendor.store_name}</strong></p>
                <p>Product: <strong>${vendor.productName}</strong></p>
                <p>Customer: <strong>${clientDetails.name}</strong></p>
                <p>Address: ${clientDetails.address}, ${clientDetails.city}, ${clientDetails.country}</p>
                <p>Please process the order as soon as possible.</p>
            `,
        };

        await transporter.sendMail(vendorMailOptions);
    }
      res.status(201).json({ message: "Order placed successfully!", orderResult });
  } catch (error) {
      console.error("Error saving order:", error);
      res.status(500).json({ message: "Failed to place order" });
  }
};

export const getOrdersByVendor = async (req, res) => {
    const isAdmin = req.query.isAdmin;
  const { store_id } = req.user; 
  try {
    let query;
    if(isAdmin == 1){
        query = `
            SELECT 
    order_id, 
    JSON_UNQUOTE(client_details) AS client_details_raw, 
    JSON_UNQUOTE(cart_items) AS cart_items_raw,  
    total_cost, 
    order_date, 
    JSON_UNQUOTE(vendor_details) AS vendor_details_raw
FROM orders
ORDER BY order_date DESC;

        `;
    } else{
        query = `
            SELECT order_id, 
            JSON_UNQUOTE(client_details) AS client_details_raw, 
            JSON_UNQUOTE(cart_items) AS cart_items_raw,   
            total_cost, order_date, 
            JSON_UNQUOTE(vendor_details) AS vendor_details_raw
            FROM orders
            WHERE JSON_CONTAINS(vendor_details, JSON_OBJECT('store_id', ?))
            ORDER BY order_date DESC
        `;
    }
    const orders = await executeQuery(query, [store_id]);
    const parsedOrders = orders.map(order => ({
        ...order,
        client_details: JSON.parse(order.client_details_raw || '{}'),
        cart_items: JSON.parse(order.cart_items_raw || '[]'),
        vendor_details: JSON.parse(order.vendor_details_raw || '{}'),
    }));
    
    res.status(200).json(parsedOrders);
    
  } catch (error) {
      console.error("Error fetching vendor orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
  }
};

export const fetchAllVendorsPublic = async (req, res) => {
    try {
        // ✅ Fetch only vendor names
        const sql = `SELECT store_name FROM vendors`;

        const vendors = await executeQuery(sql);

        if (!vendors || vendors.length === 0) {
            return res.status(404).json({ message: "No vendors found." });
        }

        console.log("Fetched vendor names:", vendors); // Debugging

        return res.status(200).json(vendors);
    } catch (err) {
        console.error("Error fetching vendor names:", err);
        res.status(500).json({ message: "Failed to fetch vendor names." });
    }
};

export const getVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const sql = "SELECT * FROM vendors WHERE store_id = ?";
        
        const vendor = await executeQuery(sql, [id]);
        
        if (!vendor || vendor.length === 0) {
            return res.status(404).json({ message: "Vendor not found" });
        }
        
        res.json(vendor[0]);
    } catch (error) {
        console.error("Error fetching vendor:", error);
        res.status(500).json({ message: "Error fetching vendor", error: error.message });
    }
};
  
// Update vendor details
export const updateVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const { firstName, lastName, phone, password, avatar, about } = req.body;
        
        await db.query(
            "UPDATE vendors SET firstName=?, lastName=?, phone=?, password=?, avatar=?, about=? WHERE id=?",
            [firstName, lastName, phone, password, avatar, about, id]
        );
    
        res.json({ message: "Vendor updated successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error updating vendor", error });
    }
};

export const getVendorProfile = async (req, res) => {
    try {
        const { store_id } = req.user; // Use store_id from decoded token
        
        const vendors = await executeQuery(
            `SELECT store_id, brand_type, store_name, store_phone, email, image, 
                    address1, address2, city, state_county, country, postcode,
                    first_name, last_name, vendor_status, isAdmin
             FROM vendors WHERE store_id = ?`, 
            [store_id]
        );
    
        if (!vendors.length) {
            return res.status(404).json({ message: "Vendor not found" });
        }
    
        res.json(vendors[0]);
    } catch (error) {
        console.error("Error fetching vendor profile:", error);
        res.status(500).json({ message: "Server error" });
    }
};
  
// Update vendor profile
export const updateVendorProfile = async (req, res) => {
    try {
        const { store_id } = req.user;
        if (!store_id) {
            return res.status(400).json({ message: "Vendor ID is required" });
        }

        console.log('Request body:', req.body);
        console.log('User token data:', req.user);

        // Map the incoming field names to database field names
        const fieldMapping = {
            firstName: 'first_name',
            lastName: 'last_name',
            phone: 'store_phone',
            brand_type: 'brand_type',
            store_name: 'store_name',
            image: 'image',
            address1: 'address1',
            address2: 'address2',
            city: 'city',
            state_county: 'state_county',
            country: 'country',
            postcode: 'postcode',
            password: 'password'
        };

        // Update validColumns array to remove email
        const validColumns = [
            'first_name',
            'last_name',
            'store_phone',
            'brand_type',
            'store_name',
            'image',
            'address1',
            'address2',
            'city',
            'state_county',
            'country',
            'postcode',
            'password'
        ];

        // Convert incoming fields to database fields
        const updateFields = {};
        Object.entries(req.body).forEach(([key, value]) => {
            const dbField = fieldMapping[key];
            if (dbField && validColumns.includes(dbField)) {
                updateFields[dbField] = value;
            }
        });

        console.log('Update fields after mapping:', updateFields);

        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({ 
                message: "No valid fields to update",
                receivedFields: Object.keys(req.body),
                allowedFields: Object.keys(fieldMapping)
            });
        }

        // Check if vendor exists
        const existingVendor = await executeQuery(
            'SELECT * FROM vendors WHERE store_id = ?', 
            [store_id]
        );

        if (existingVendor.length === 0) {
            return res.status(404).json({ message: "Vendor not found" });
        }

        console.log('Existing vendor data:', existingVendor[0]);

        // Build dynamic SQL update query
        const updates = [];
        const values = [];
        
        for (const [key, value] of Object.entries(updateFields)) {
            if (key === 'password') {
                const hashedPassword = await bcrypt.hash(value, 10);
                updates.push(`${key} = ?`);
                values.push(hashedPassword);
            } else {
                const existingValue = String(existingVendor[0][key] || '');
                const newValue = String(value || '');
                
                console.log(`Comparing ${key}:`, { 
                    existing: existingValue, 
                    new: newValue 
                });

                if (existingValue !== newValue) {
                    updates.push(`${key} = ?`);
                    values.push(value);
                }
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ 
                message: "No changes detected in the provided data",
                existing: existingVendor[0],
                provided: updateFields
            });
        }

        values.push(store_id);

        const updateSql = `
            UPDATE vendors 
            SET ${updates.join(', ')}
            WHERE store_id = ?
        `;

        console.log('Update SQL:', updateSql);
        console.log('Update values:', values);

        const result = await executeQuery(updateSql, values);
        console.log('Update result:', result);

        if (result.affectedRows === 0) {
            return res.status(400).json({ 
                message: "No rows were affected by the update"
            });
        }

        // Fetch updated vendor data
        const updatedVendor = await executeQuery(
            'SELECT * FROM vendors WHERE store_id = ?',
            [store_id]
        );

        res.status(200).json({ 
            message: "Profile updated successfully",
            updatedProfile: {
                brand_type: updatedVendor[0].brand_type,
                store_name: updatedVendor[0].store_name,
                store_phone: updatedVendor[0].store_phone,
                image: updatedVendor[0].image,
                address1: updatedVendor[0].address1,
                address2: updatedVendor[0].address2,
                city: updatedVendor[0].city,
                state_county: updatedVendor[0].state_county,
                country: updatedVendor[0].country,
                postcode: updatedVendor[0].postcode,
                first_name: updatedVendor[0].first_name,
                last_name: updatedVendor[0].last_name,
                store_id
            }
        });

    } catch (error) {
        console.error("Error updating vendor profile:", error);
        // Send more detailed error information
        res.status(500).json({ 
            message: "Failed to update vendor profile",
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};
// export const getProductsByCategory = async (req, res) => {
//     try {
//       const { category } = req.query;
//       if (!category) {
//         return res.status(400).json({ message: "Category is required" });
//       }
  
//       const products = await executeQuery(
//         "SELECT id, productName, productPrice, featureImage FROM products WHERE selectedCategory = ?",
//         [category]
//       );
//       res.setHeader("Content-Type", "application/json");
//       res.status(200).json(products);
//     } catch (error) {
//       res.status(500).json({ message: "Failed to fetch products", error: error.message });
//     }
//   };
export const getProductsByCategory = async (req, res) => {
    try {
        const { category } = req.query;
        
        if (!category) {
            return res.status(400).json({ error: "Category parameter is required" });
        }

        const query = "SELECT productName, productPrice, selectedCategory, selectedImages FROM products WHERE selectedCategory = ?";
        const products = await executeQuery(query, [category]);

        if (!products || products.length === 0) {
            return res.status(404).json({ error: "No products found in this category" });
        }

        // Convert selectedImages from JSON string to an array
        const formattedProducts = products.map(product => ({
            ...product,
            selectedImages: product.selectedImages 
                ? JSON.parse(product.selectedImages) // Convert to array if it's a string
                : [] // Default to an empty array if null/undefined
        }));

        res.json(formattedProducts);
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ error: "Internal server error", details: error.message });
    }
};
export const getProdcutsByMainCategory = async (req, res) => {
    try {
      const { mainCategory } = req.query;
  
      if (!mainCategory) {
        return res.status(400).json({ error: "mainCategory is required" });
      }
  
      const query = "SELECT * FROM products WHERE mainCategory = ?";
      const [products] = await pool.query(query, [mainCategory]);
  
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }

  export const getProductImages = async (req, res) => {
    try {
        const { id } = req.params; // Get product ID from route params

        const query = `SELECT selectedImages FROM products WHERE id = ?`;

        const product = await executeQuery(query, [id]);

        if (!product || product.length === 0) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.status(200).json({ selectedImages: product[0].selectedImages });
    } catch (error) {
        console.error("Error fetching product images:", error);
        res.status(500).json({ message: "Failed to fetch product images" });
    }
};
export const fetchVendorProductsByStoreId = async (req, res) => {
    try {
        const { store_id } = req.params; // Get store_id from params

        if (!store_id) {
            return res.status(400).json({ message: "Missing store ID in request parameters" });
        }

        const sql = `SELECT * FROM products WHERE storeId = ?`;
        const products = await executeQuery(sql, [store_id]);

        if (products.length === 0) {
            return res.status(404).json({ message: "No products found for this vendor" });
        }

        res.status(200).json(products);
    } catch (err) {
        console.error('Error fetching vendor products:', err);
        res.status(500).json({ message: 'Failed to fetch vendor products.' });
    }
};
export const fetchVendorDetails2 = async (req, res) => {
    try {
        const { store_id } = req.params;
        
        // Fetch vendor details based on store_id
        const sql = `
            SELECT brand_type, store_name, store_phone, email, image, isAdmin, description, address1,address2
            FROM vendors 
            WHERE store_id = ?
        `;
        const vendorResult = await executeQuery(sql, [store_id]);

        // If the vendor does not exist
        if (vendorResult.length === 0) {
            return res.status(404).json({ message: 'Vendor not found.' });
        }

        // Extract vendor details
        const { brand_type: brandType, store_name, store_phone, email, image, isAdmin,description,address1,address2 } = vendorResult[0];

        // Send the vendor details as a response
        return res.status(200).json({
            store_name,
            store_phone,
            email,
            image,
            brand_type: brandType,
            isAdmin,
            description,
            address1,
            address2
        });

    } catch (error) {
        console.error('Error fetching vendor details:', error);
        return res.status(500).json({ message: 'Failed to fetch vendor details' });
    }
};
export const fetchAllVendors2 = async (req, res) => {
    try {
        const sql = `SELECT address1,description, address2, brand_type, city, country, email, first_name, image, isAdmin, last_name, postcode, state_county, store_id, store_name, store_phone, vendor_status FROM vendors`;

        const vendors = await executeQuery(sql);

        res.status(200).json(vendors);
    } catch (err) {
        console.error('Error fetching vendors:', err);
        res.status(500).json({ message: 'Failed to fetch vendors.' });
    }
};
export const fetchAllVendorsPublic2 = async (req, res) => {
    try {
        // ✅ Fetch only vendor names
        const sql = `SELECT store_name, image FROM vendors`;

        const vendors = await executeQuery(sql);

        if (!vendors || vendors.length === 0) {
            return res.status(404).json({ message: "No vendors found." });
        }

        console.log("Fetched vendor names:", vendors); // Debugging

        return res.status(200).json(vendors);
    } catch (err) {
        console.error("Error fetching vendor names:", err);
        res.status(500).json({ message: "Failed to fetch vendor names." });
    }
};
export const updateVendorProfile2 = async (req, res) => {
    try {
        const { store_id } = req.user;
        if (!store_id) {
            return res.status(400).json({ message: "Vendor ID is required" });
        }

        console.log("Request body:", req.body);
        console.log("User token data:", req.user);

        const fieldMapping = {
            firstName: "first_name",
            lastName: "last_name",
            phone: "store_phone",
            brand_type: "brand_type",
            store_name: "store_name",
            address1: "address1",
            address2: "address2",
            city: "city",
            state_county: "state_county",
            country: "country",
            postcode: "postcode",
            password: "password",
            description: "description",  // Add this line
        };
        

        const validColumns = Object.values(fieldMapping);
        const updateFields = {};

        // Map request body fields
        Object.entries(req.body).forEach(([key, value]) => {
            const dbField = fieldMapping[key];
            if (dbField && validColumns.includes(dbField)) {
                updateFields[dbField] = value;
            }
        });

        console.log("Update fields after mapping:", updateFields);

        if (Object.keys(updateFields).length === 0 && !req.file) {
            return res.status(400).json({
                message: "No valid fields to update",
                receivedFields: Object.keys(req.body),
                allowedFields: Object.keys(fieldMapping),
            });
        }

        // Check if vendor exists
        const existingVendor = await executeQuery("SELECT * FROM vendors WHERE store_id = ?", [store_id]);

        if (existingVendor.length === 0) {
            return res.status(404).json({ message: "Vendor not found" });
        }

        console.log("Existing vendor data:", existingVendor[0]);

        const updates = [];
        const values = [];

        // Handle password update separately
        if (updateFields.password) {
            const hashedPassword = await bcrypt.hash(updateFields.password, 10);
            updates.push("password = ?");
            values.push(hashedPassword);
        }

        // Handle image upload
        if (req.file) {
            const imagePath = `/${req.file.filename}`;
            updates.push("image = ?");
            values.push(imagePath);
        }

        // Check which fields changed before updating
        // Include description in updates
for (const [key, value] of Object.entries(updateFields)) {
    if (key !== "password") {
        const existingValue = String(existingVendor[0][key] || "");
        const newValue = String(value || "");

        if (existingValue !== newValue) {
            updates.push(`${key} = ?`);
            values.push(value);
        }
    }
}

        if (updates.length === 0) {
            return res.status(400).json({
                message: "No changes detected in the provided data",
                existing: existingVendor[0],
                provided: updateFields,
            });
        }

        values.push(store_id);

        const updateSql = `
            UPDATE vendors 
            SET ${updates.join(", ")}
            WHERE store_id = ?
        `;

        console.log("Update SQL:", updateSql);
        console.log("Update values:", values);

        const result = await executeQuery(updateSql, values);
        console.log("Update result:", result);

        if (result.affectedRows === 0) {
            return res.status(400).json({
                message: "No rows were affected by the update",
            });
        }

        // Fetch updated vendor data
        const updatedVendor = await executeQuery("SELECT * FROM vendors WHERE store_id = ?", [store_id]);

        res.status(200).json({
            message: "Profile updated successfully",
            updatedProfile: {
                store_id,
                first_name: updatedVendor[0].first_name,
                last_name: updatedVendor[0].last_name,
                store_phone: updatedVendor[0].store_phone,
                brand_type: updatedVendor[0].brand_type,
                store_name: updatedVendor[0].store_name,
                image: updatedVendor[0].image,
                address1: updatedVendor[0].address1,
                address2: updatedVendor[0].address2,
                city: updatedVendor[0].city,
                state_county: updatedVendor[0].state_county,
                country: updatedVendor[0].country,
                postcode: updatedVendor[0].postcode,
                description: updatedVendor[0].description, // Add this line
            },
        });        
    } catch (error) {
        console.error("Error updating vendor profile:", error);
        res.status(500).json({
            message: "Failed to update vendor profile",
            error: error.message,
            stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
        });
    }
};