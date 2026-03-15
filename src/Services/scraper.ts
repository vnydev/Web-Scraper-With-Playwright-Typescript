import { chromium, type Browser } from 'playwright';
import type { ProductDetails, SKU } from '../commonInterfaceType.js';
import { logError } from './logger.js';

const platformUrlBuilders: Record<string, (skuId: string) => string> = {
    Amazon: (skuId) => `https://www.amazon.com/dp/${skuId}`,
    Walmart: (skuId) => `https://www.walmart.com/ip/${skuId}`,
};

// Shared browser instance — reused across requests for performance
let browser: Browser | null = null;

const getBrowser = async (): Promise<Browser> => {
    if (!browser || !browser.isConnected()) {
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
        });
    }
    return browser;
};

const newPage = async (configOverride?: { userAgent?: string; viewport?: { width: number; height: number } }) => {
    const b = await getBrowser();
    const context = await b.newContext({
        userAgent: configOverride?.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        viewport: configOverride?.viewport || { width: 1280, height: 800 },
        locale: 'en-US',
        extraHTTPHeaders: {
            'Accept-Language': 'en-US,en;q=0.9',
            'Upgrade-Insecure-Requests': '1',
        },
        geolocation: { latitude: 37.7749, longitude: -122.4194 },
        permissions: ['geolocation'],
    });
    const page = await context.newPage();

    // Advanced Stealth Init Script
    await page.addInitScript(() => {
        // Hide webdriver
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

        // Mock languages
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

        // Mock plugins
        Object.defineProperty(navigator, 'plugins', { get: () => ({ length: 3 }) });

        // Mock platform
        Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });

        // Mock hardware concurrency and memory
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
        (navigator as any).deviceMemory = 8;

        // Mock chrome object
        (window as any).chrome = { runtime: {} };

        // Mock screen properties to match viewport
        Object.defineProperty(screen, 'width', { get: () => 1280 });
        Object.defineProperty(screen, 'height', { get: () => 800 });
        Object.defineProperty(screen, 'availWidth', { get: () => 1280 });
        Object.defineProperty(screen, 'availHeight', { get: () => 800 });

        // Mock permissions
        const originalQuery = window.navigator.permissions.query;
        (window.navigator.permissions as any).query = (parameters: any) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );
    });

    await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf,mp4,avi}', route => route.abort());
    await page.route('**/{ads,analytics,tracking,doubleclick,googletagmanager,googlesyndication,amazon-adsystem}**', route => route.abort());
    return { page, context };
};

// --- Amazon scraping strategy ---
const scrapeAmazon = async (targetUrl: string, config?: any) => {
    const { page, context } = await newPage(config);
    try {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Wait for title — 8s is plenty after domcontentloaded
        await page.waitForSelector('#productTitle', { timeout: 8000 }).catch(() => null);

        // page.evaluate() is used here because locator().textContent() is unreliable on Amazon
        const title = await page.evaluate(() =>
            document.querySelector('#productTitle')?.textContent?.trim() ??
            document.querySelector('meta[name="title"]')?.getAttribute('content') ?? ''
        ).catch(() => '');

        const description = await page.evaluate(() =>
            document.querySelector('#productDescription p')?.textContent?.trim() ??
            document.querySelector('#feature-bullets .a-list-item')?.textContent?.trim() ?? ''
        ).catch(() => '');

        const price = await page.evaluate(() =>
            (document.querySelector('span.a-price span.a-offscreen') as HTMLElement)?.innerText?.trim() ??
            (document.querySelector('#corePrice_feature_div span.a-offscreen') as HTMLElement)?.innerText?.trim() ?? ''
        ).catch(() => '');

        const numberOfReviews = await page.evaluate(() =>
            document.querySelector('#acrCustomerReviewText')?.textContent?.trim() ?? ''
        ).catch(() => '');

        const rating = await page.evaluate(() =>
            document.querySelector('i[data-hook="average-star-rating"] span.a-icon-alt')?.textContent?.trim() ??
            document.querySelector('#acrPopupLink span.a-icon-alt')?.textContent?.trim() ?? ''
        ).catch(() => '');

        return { Title: title, Description: description, Price: price, NumberOfReviews: numberOfReviews, Rating: rating };
    } finally {
        await context.close();
    }
};

// --- Walmart scraping strategy ---
const scrapeWalmart = async (targetUrl: string, config?: any) => {
    const { page, context } = await newPage(config);
    try {
        // Establishing session via homepage helps bypass direct deep-link blocks
        await page.goto('https://www.walmart.com', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
        await page.waitForTimeout(Math.floor(Math.random() * 2000) + 1000);

        await page.goto(targetUrl, { waitUntil: 'load', timeout: 45000 });

        // Anti-bot check
        const currentUrl = page.url();
        if (currentUrl.includes('blocked') || currentUrl.includes('captcha')) {
            logError(`Walmart blocked the request (PerimeterX triggered). URL: ${currentUrl}`);
            return { Title: '', Description: '', Price: '', NumberOfReviews: '', Rating: '' };
        }

        await page.waitForSelector('h1', { timeout: 10000 }).catch(() => null);
        await page.evaluate(() => window.scrollTo(0, 500));
        await page.waitForTimeout(1000);

        // ── Strategy 1: Extract from __NEXT_DATA__ JSON (most reliable) ───────
        // Walmart embeds ALL product data in a <script id="__NEXT_DATA__"> tag
        // This is SSR data — always present before JS hydration, never selector-dependent
        try {
            const nextData = await page.evaluate(() => {
                const el = document.getElementById('__NEXT_DATA__');
                return el ? JSON.parse(el.textContent ?? '{}') : null;
            });

            if (nextData) {
                // Navigate the Next.js data tree to the product node
                const product =
                    nextData?.props?.pageProps?.initialData?.data?.product ??
                    nextData?.props?.pageProps?.initialData?.data?.idmlData ??
                    null;

                if (product) {
                    const title: string = product.name ?? '';

                    // Description: prefer shortDescription → long modules → features
                    const description: string =
                        product.shortDescription ??
                        product.longDescription ??
                        product.idmlContent?.modules
                            ?.find((m: any) => m.type === 'ProductDescriptionModule')
                            ?.descriptions?.[0]?.value ??
                        '';

                    // Price: priceInfo is the canonical price node
                    const priceInfo = product.priceInfo ?? product.price ?? {};
                    const price: string =
                        priceInfo?.currentPrice?.priceString ??       // e.g. "$199.95"
                        String(priceInfo?.currentPrice?.price ?? '') ?? // raw number fallback
                        priceInfo?.priceString ?? '';

                    // Reviews
                    const reviewData = product.reviews ?? product.ratingsReviews ?? {};
                    const numberOfReviews: string =
                        String(reviewData?.totalReviewCount ?? reviewData?.reviewCount ?? '');
                    const rating: string =
                        String(reviewData?.averageOverallRating ?? reviewData?.roundedAverageOverallRating ?? '');

                    // If we got at least a title, trust this data
                    if (title) {
                        console.log(`✅ Walmart __NEXT_DATA__ extraction succeeded: "${title}"`);
                        return {
                            Title: title,
                            Description: description,
                            Price: price,
                            NumberOfReviews: numberOfReviews,
                            Rating: rating,
                        };
                    }
                }
            }
        } catch (err) {
            console.warn('Walmart __NEXT_DATA__ parse failed, falling back to DOM:', err);
        }

        // ── Strategy 2: DOM selectors fallback ───────────────────────────────
        // Only reached if __NEXT_DATA__ is absent or malformed
        console.warn('Walmart: falling back to DOM selectors');

        await page.waitForSelector(
            'h1[itemprop="name"], [data-testid="product-title"], h1.f3, [data-automation-id="product-title"]',
            { timeout: 10000 }
        ).catch(() => console.warn('Walmart DOM: title selector timed out'));

        await page.waitForSelector(
            '[itemprop="price"], [data-testid="price-wrap"], [data-automation-id="product-price"]',
            { timeout: 10000 }
        ).catch(() => console.warn('Walmart DOM: price selector timed out'));

        // Title
        const titleSelectors = [
            'h1[itemprop="name"]',
            '[data-testid="product-title"]',
            '[data-automation-id="product-title"]',
            '#main-title',
            'h1.f3',
        ];
        let title = '';
        for (const sel of titleSelectors) {
            try {
                title = (await page.locator(sel).first().textContent({ timeout: 3000 }))?.trim() ?? '';
                if (title) break;
            } catch {
                // Selector failed
            }
        }

        // Description
        const descriptionSelectors = [
            'div[itemprop="description"]',
            '[data-testid="product-description-content"] p',
            '[data-testid="item-details-description"]',
            '[data-automation-id="product-description"]',
        ];
        let description = '';
        for (const sel of descriptionSelectors) {
            try {
                description = (await page.locator(sel).first().textContent({ timeout: 3000 }))?.trim() ?? '';
                if (description) break;
            } catch {
                // Selector failed
            }
        }

        // Price
        const priceSelectors: Array<{ sel: string; attr?: string }> = [
            { sel: '[itemprop="price"]', attr: 'content' },
            { sel: '[data-automation-id="product-price"] span' },
            { sel: 'span[data-automation="buybox-price"]' },
            { sel: '[data-testid="price-wrap"] span.f2' },
        ];
        let price = '';
        for (const { sel, attr } of priceSelectors) {
            try {
                price = attr
                    ? (await page.locator(sel).first().getAttribute(attr, { timeout: 3000 }))?.trim() ?? ''
                    : (await page.locator(sel).first().textContent({ timeout: 3000 }))?.trim() ?? '';
                if (price) break;
            } catch {
                // Selector failed
            }
        }

        // Number of Reviews
        const reviewSelectors = [
            'span[itemprop="reviewCount"]',
            '[data-testid="reviews-and-ratings"] [data-testid="ratings-count"]',
            '[data-automation-id="reviews-count"]',
        ];
        let numberOfReviews = '';
        for (const sel of reviewSelectors) {
            try {
                numberOfReviews = (await page.locator(sel).first().textContent({ timeout: 3000 }))?.trim() ?? '';
                if (numberOfReviews) break;
            } catch {
                // Selector failed
            }
        }

        // Rating
        const ratingSelectors = [
            'span[itemprop="ratingValue"]',
            '[data-testid="reviews-and-ratings"] [data-testid="average-rating"]',
            '[data-automation-id="average-rating"]',
        ];
        let rating = '';
        for (const sel of ratingSelectors) {
            try {
                rating = (await page.locator(sel).first().textContent({ timeout: 3000 }))?.trim() ?? '';
                if (rating) break;
            } catch {
                // Selector failed
            }
        }

        return { Title: title, Description: description, Price: price, NumberOfReviews: numberOfReviews, Rating: rating };

    } finally {
        await context.close();
    }
};

const scrapers: Record<string, (url: string, config?: any) => Promise<Omit<ProductDetails, 'SKU' | 'Source'>>> = {
    Amazon: scrapeAmazon,
    Walmart: scrapeWalmart,
};

export const getProductDetails = async ({ skuId, type }: SKU): Promise<ProductDetails | null> => {
    const urlBuilder = platformUrlBuilders[type];
    const scraper = scrapers[type];

    if (!urlBuilder || !scraper) {
        logError(`Unsupported platform type: ${type}`);
        return null;
    }

    const targetUrl = urlBuilder(skuId);
    let attempts = 0;
    const maxAttempts = type === 'Walmart' ? 2 : 1;

    while (attempts < maxAttempts) {
        try {
            let config: any = undefined;
            if (type === 'Walmart' && attempts === 1) {
                console.log('Walmart: Attempting fallback with Mobile User Agent...');
                config = {
                    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1',
                    viewport: { width: 390, height: 844 },
                };
            }

            const data = await scraper(targetUrl, config);

            // If Walmart returned empty but didn't throw, it might be a silent block
            if (type === 'Walmart' && !data.Title && attempts < maxAttempts - 1) {
                attempts++;
                console.log(`Walmart empty result (block suspected), retrying attempt ${attempts + 1}...`);
                await new Promise(r => setTimeout(r, 2000));
                continue;
            }

            console.log(`✅ Done: ${type} SKU ${skuId} — Title: "${data.Title}"`);
            return { SKU: skuId, Source: type, ...data };
        } catch (error) {
            attempts++;
            if (attempts >= maxAttempts) {
                logError(`Error fetching ${type} SKU ${skuId} at ${targetUrl} after ${attempts} attempts`, error);
                return null;
            }
            console.log(`Retrying ${type} SKU ${skuId} (Attempt ${attempts + 1}) due to error:`, (error as Error).message);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    return null;
};
