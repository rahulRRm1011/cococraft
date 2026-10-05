import { Router } from 'express';
import { catalogController } from '../controllers/catalog.controller.js';

const router = Router();

// Category endpoints
router.get('/categories', catalogController.getCategories);
router.get('/categories/:slug/products', catalogController.getProductsByCategory);

// Search & Discovery endpoints
router.get('/search/suggestions', catalogController.getSearchSuggestions);
router.get('/sitemap.xml', catalogController.getSitemap);

// Product endpoints (featured route defined before parameterized :slug route)
router.get('/products', catalogController.getProducts);
router.get('/products/featured', catalogController.getFeaturedProducts);
router.get('/products/:slug', catalogController.getProductBySlug);

export default router;
