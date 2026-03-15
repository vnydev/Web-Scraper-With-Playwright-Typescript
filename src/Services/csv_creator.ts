import PP from "papaparse";
import fs from 'fs';
import type { ProductDetails } from "../commonInterfaceType.js";
import { logError } from "./logger.js";


export const createCSV = async (data: ProductDetails[]) => {
    try {
        const csvString = PP.unparse(data);
        await fs.promises.writeFile('product_data.csv', csvString);
        console.log('CSV string saved to file!');
    } catch (error) {
        logError('Failed to write CSV file', error);
    }
};