import { Request, Response, NextFunction } from 'express';
import { catalogService } from '../services/catalog.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export class CatalogController {
  /**
   * GET /api/products
   * Optional query params: search, category, featured, minPrice, maxPrice, inStockOnly, sortBy, page, limit
   */
  public getProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const category = req.query.category as string | undefined;
      const featured = req.query.featured !== undefined ? req.query.featured === 'true' : undefined;
      const search = req.query.search as string | undefined;
      const minPrice = req.query.minPrice ? Number(req.query.minPrice) : undefined;
      const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : undefined;
      const inStockOnly = req.query.inStockOnly === 'true';
      const sortBy = req.query.sortBy as any;
      const page = req.query.page ? Number(req.query.page) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;

      if (page !== undefined || limit !== undefined) {
        const paginated = await catalogService.getPaginatedProducts({
          category,
          featured,
          search,
          minPrice,
          maxPrice,
          inStockOnly,
          sortBy,
          page,
          limit,
        });
        sendSuccess(res, paginated);
        return;
      }

      const products = await catalogService.getProducts({
        category,
        featured,
        search,
        minPrice,
        maxPrice,
        inStockOnly,
        sortBy,
      });
      sendSuccess(res, products);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/products/featured
   */
  public getFeaturedProducts = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const featuredProducts = await catalogService.getFeaturedProducts();
      sendSuccess(res, featuredProducts);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/products/:slug
   */
  public getProductBySlug = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const slug = String(req.params.slug);
      const product = await catalogService.getProductBySlug(slug);

      if (!product) {
        sendError(res, `Product not found: ${slug}`, 404);
        return;
      }

      sendSuccess(res, product);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/categories
   */
  public getCategories = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const categories = await catalogService.getCategories();
      sendSuccess(res, categories);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/categories/:slug/products
   */
  public getProductsByCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const slug = String(req.params.slug);
      const products = await catalogService.getProductsByCategory(slug);
      sendSuccess(res, products);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/search/suggestions?q=...
   */
  public getSearchSuggestions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = String(req.query.q || '');
      const suggestions = await catalogService.getSearchSuggestions(query);
      sendSuccess(res, suggestions);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/sitemap.xml
   */
  public getSitemap = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const host = req.get('host');
      const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const baseUrl = host ? `${protocol}://${host}` : (process.env.APP_URL || 'https://cococraft.vercel.app');
      const xml = await catalogService.generateSitemapXml(baseUrl);
      res.header('Content-Type', 'application/xml');
      res.status(200).send(xml);
    } catch (error) {
      next(error);
    }
  };
}

export const catalogController = new CatalogController();
