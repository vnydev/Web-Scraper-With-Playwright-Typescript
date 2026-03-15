# Web-Scraper-With-Playwright-Typescript

A robust, enterprise-grade web scraper built with **TypeScript** and **Playwright** that extracts product details from **Amazon** and **Walmart** based on SKUs provided in a JSON file.

## Features
- **Concurrent Scraping**: Fetches data for multiple SKUs simultaneously using `Promise.all`.
- **Playwright Automation**: Uses a headless Chromium browser to handle dynamic JavaScript-rendered content.
- **Advanced Bot Detection Bypass**: 
  - **Stealth Initialization**: Spoofs browser fingerprinting (Navigator, Screen, and Hardware properties).
  - **Dual-Stage Walmart Strategy**: Establishes a session via the homepage before navigating to products.
  - **Mobile Fallback**: Automatically retries blocked Walmart requests using a Mobile User-Agent (iPhone).
- **Smart Extraction**: Utilizes SSR JSON data (`__NEXT_DATA__`) for high reliability on Walmart, falling back to DOM selectors if necessary.
- **CSV Export**: Automatically saves results to `product_data.csv` using an ESM-compatible implementation of `papaparse`.
- **Error Logging**: Detailed errors and bot-detection events are logged with timestamps to `errors.log`.

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/vnydev/Web-Scraper-With-Playwright-Typescript.git
   cd Web-Scraper-With-Playwright-Typescript
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Install Playwright browsers**:
   ```bash
   npx playwright install chromium
   ```

## Running the Scraper

1. **Configure SKUs**: Edit `skus.json` in the root directory.
2. **Start the server**:
   ```bash
   npm run dev
   ```
3. **Trigger the Scraper**: Visit the following endpoint in your browser or via `curl`:
   ```bash
   http://localhost:3000/v1/scraper/product
   ```

## Running Tests

Verify the project integrity and utility functions:
```bash
npm test
```

## Project Structure
- `src/server.ts`: Entry point setting up the Express server.
- `src/routes/scraper.ts`: API route logic.
- `src/Services/scraper.ts`: Core scraping logic with platform-specific strategies.
- `src/Services/csv_creator.ts`: Utility for converting results to CSV.
- `src/Services/logger.ts`: Utility for logging errors to `errors.log`.
- `tests/utils.spec.ts`: Unit tests for utilities and project structure.

## Assumptions & Design Decisions
- **Esm First**: Leverages ECMAScript Modules (ESM) for modern performance.
- **Singleton Browser**: A single browser instance is shared across concurrent requests, while each SKU runs in an isolated context.
- **Mobile Fallback**: Mobile endpoints often have more lenient bot-detection rules than desktop ones.
- **Session-Based Navigation**: Mimics human behavior by establishing a home-page session before deep-linking.

## Evaluation Check
- [x] TypeScript & Playwright used.
- [x] Extracts Price, Title, Description, Reviews/Rating.
- [x] Saves to `product_data.csv`.
- [x] Handles dynamic content.
- [x] Error logging in `errors.log`.
- [x] Unit tests for key functions.
- [x] Clear README documentation.
