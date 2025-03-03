import express from 'express';
import multer from 'multer';
import path from 'path';
import { uploadImages, getAllImages, createProduct, getProducts,getProductImages,getProdcutsByMainCategory,getProductsByCategory, getVendor,getVendorProfile, updateVendorProfile, updateVendor, fetchVendorProducts, updateProduct, deleteProduct, getProductBySlug, fetchVendorDetails, checkoutOrder, getOrdersByVendor, fetchAllVendors, updateVendorAccess,fetchAllVendorsPublic, fetchVendorProductsByStoreId, updateVendorProfile2, fetchAllVendorsPublic2, fetchAllVendors2, fetchVendorDetails2 } from '../controllers/controllers.js';
import { authenticate } from '../middleware/authmiddleware.js';

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images');
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + "_" + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

router.post('/uploadImages', authenticate, upload.array('image', 10), uploadImages);

router.get('/images', authenticate, getAllImages);
// router.get('/image', getAllImages);

router.post('/createproduct', authenticate, createProduct);

router.get('/products', getProducts);
router.get("/vendor/:id", getVendor);
router.put("/:id", updateVendor);

// Fetch a single product by ID
router.get('/products/:slug', getProductBySlug);

// Update a product
router.put('/products/:slug', authenticate, updateProduct);

router.get('/vendor-products', authenticate, fetchVendorProducts);

router.patch('/update-vendor-access', authenticate, updateVendorAccess);
router.get('/vendor-details/:store_id', fetchVendorDetails2);
router.get('/vendor-products/:store_id', fetchVendorProductsByStoreId);
router.get('/products/:slug', getProductBySlug);
router.get('/vendor-details', authenticate, fetchVendorDetails);
router.get('/vendor-details2', fetchVendorDetails2);

router.get('/all-vendors', authenticate, fetchAllVendors);
router.get('/all-vendors2', fetchAllVendors2);

router.get("/fetchAllVendorsPublic", fetchAllVendorsPublic);
router.get("/fetchAllVendorsPublic2", fetchAllVendorsPublic2);

router.put("/profile/update2", authenticate, upload.single("image"), updateVendorProfile2);
router.get("/profile", authenticate, getVendorProfile);

// Update vendor profile
router.put('/profile/update', authenticate,upload.single('image'), updateVendorProfile);
// Delete a product
router.delete('/products/:id', authenticate, deleteProduct);
router.get("/productsby", getProductsByCategory);
router.get("/productsByMainCategory", getProdcutsByMainCategory);
// Public route to place an order (no authentication)
router.post("/checkout", checkoutOrder);
router.get("/product/:id/images", getProductImages);
router.get("/orders", authenticate, getOrdersByVendor);
router.get("/products/:mainCategory", async (req, res) => {
    try {
      const { mainCategory } = req.params;
  
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
  });
  

export default router;