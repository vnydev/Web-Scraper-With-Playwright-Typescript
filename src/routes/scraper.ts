import type { Request, Response } from 'express';
import express from 'express';
import skus from '../../skus.json' with { type: 'json' };
import type { ProductDetails } from '../commonInterfaceType.js';
import { getProductDetails } from '../Services/scraper.js';
import { createCSV } from '../Services/csv_creator.js';


const router = express.Router();

router.get('/product', async (req: Request, res: Response): Promise<void> => {
    const allReq = skus.skus.map((sku: { Type: string, SKU: string }) => getProductDetails({ skuId: sku.SKU, type: sku.Type }));
    const results: ProductDetails[] = await Promise.all(allReq) as ProductDetails[];
    await createCSV(results);
    res.json(results);
});

export default router;