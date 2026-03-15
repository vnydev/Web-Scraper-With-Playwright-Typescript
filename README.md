# Web Scraper Assessment

A robust web scraper built with **TypeScript** and **Playwright** that extracts product details from **Amazon** and **Walmart** based on SKUs provided in a JSON file.

## Features
- **Concurrent Scraping**: Fetches data for multiple SKUs simultaneously using `Promise.all`.
- **Playwright Automation**: Uses a headless Chromium browser to handle dynamic JavaScript-rendered content.
- **Bot Detection Bypass**: Implements User-Agent spoofing, locale headers, and ad/analytics blocking to reduce detection.
- **Smart Walmart Extraction**: Utilizes SSR JSON data (`__NEXT_DATA__`) for high reliability on Walmart, falling back to DOM selectors if necessary.
- **CSV Export**: Automatically saves results to `product_data.csv` using the `papaparse` library.
- **Error Logging**: Detailed errors are logged with timestamps to `errors.log`.

## Installation

1. **Clone the repository** (if applicable) or navigate to the project directory.
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Install Playwright browsers**:
   ```bash
   npx playwright install chromium
   ```

## Running the Scraper

1. **Configure SKUs**: Edit `skus.json` in the root directory to add/remove SKUs.
2. **Start the server**:
   ```bash
   npm run dev
   ```
3. **Trigger the Scraper**: Open your browser or use `curl` to visit the following endpoint:
   ```bash
   http://localhost:3000/v1/scraper/product
   ```
   *The scraper will process all SKUs and return the results as JSON while also saving to `product_data.csv`.*

## Project Structure
- `src/server.ts`: Entry point setting up the Express server.
- `src/routes/scraper.ts`: API route logic for triggering the scrape.
- `src/Services/scraper.ts`: Core scraping logic with platform-specific strategies.
- `src/Services/csv_creator.ts`: Utility for converting results to CSV.
- `src/Services/logger.ts`: Utility for logging errors to `errors.log`.
- `src/commonInterfaceType.ts`: Shared TypeScript interfaces.

## Assumptions & Design Decisions
- **Esm First**: The project uses ECMAScript Modules (ESM) for modern Node.js support.
- **Singleton Browser**: A single browser instance is shared across concurrent requests to save memory and CPU, while each SKU runs in its own isolated context.
- **Network Strategy**: Uses `domcontentloaded` wait strategy + specific selector waiting to avoid timing out on infinite background network requests (ads/trackers).
- **Walmart JSON Strategy**: Walmart embeds product data in a hidden script tag (`__NEXT_DATA__`). This scraper prioritizes reading that JSON directly as it is far more stable than CSS classes which change frequently.

## Limitations
- **Geolocation & IP**: Amazon determines currency (USD/INR) based on the server's IP address. While browser locale is spoofed to `en-US`, the actual price currency may still reflect the local IP's region.
- **Bot Detection**: High-volume scraping may still trigger CAPTCHAs. Walmart is particularly sensitive to bot traffic.
- **Walmart CSS**: If the JSON strategy fails, DOM fallbacks are used, but these are subject to Walmart's frequent UI updates.

## Evaluation Check
- [x] TypeScript & Playwright used.
- [x] Extracts Price, Title, Description, Reviews/Rating.
- [x] Saves to `product_data.csv`.
- [x] Handles dynamic content.
- [x] Error logging in `errors.log`.
- [x] Clear README documentation.
# Web-Scraper-With-Playwright-Typescript
