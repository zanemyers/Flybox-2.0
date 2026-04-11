import type { Page } from "playwright"

// Extends a Playwright Page instance with custom helper methods for scraping and element inspection.
//
// This function adds convenient methods to a page to:
// - Retrieve attributes by selector or `aria-label`.
// - Retrieve text content of elements.
// - Check for the existence of elements containing specific keywords.
//
// These helpers simplify common scraping tasks and provide consistent error handling.

/**
 * Retrieves the value of a specified attribute from the first matching element located by the given selector.
 *
 * @param page - The playwright page
 * @param locator - The CSS selector to locate the element.
 * @param attribute - The attribute name to retrieve (e.g., "href", "src").
 * @param filter={} - Optional filter options to further narrow down matches.
 * @returns The attribute value, or null if not found.
 */
async function getAttByLocator(page: Page, locator: string, attribute: string, filter: Object = {}): Promise<string|null> {
    const value = page
        .locator(locator)
        .filter(filter)
        .first()
        .getAttribute(attribute, { timeout: 1000 });
    return value || null;
}

/**
 * Retrieves the value of a specified attribute from the first element whose `aria-label` contains the given text.
 *
 * @param page - The playwright page
 * @param label - Partial or full `aria-label` value to match.
 * @param attribute - The attribute name to retrieve (e.g., "href", "src").
 * @param filter Optional filter options to further narrow down matches.
 * @returns The attribute value, or null if not found.
 */
async function getAttByLabel(page: Page, label: string, attribute: string, filter: Object = {}): Promise<string|null> {
    return await getAttByLocator(page, `[aria-label*="${label}"]`, attribute, filter);
}

/**
 * Retrieves the text content of the first element matching the given selector.
 *
 * @param page - The playwright page
 * @param locator - The CSS selector to locate the element.
 * @param filter={} - Optional filter options to further narrow down matches.
 * @returns The element's text content, or null if not found.
 */
async function getTextContent(page: Page, locator: string, filter: Object = {}): Promise<string|null> {
    return await page.locator(locator).filter(filter).first().textContent();
}

/**
 * Checks if an element of a given type contains the specified keyword text.
 *
 * @param page - The playwright page
 * @param element - The type of element to search for (e.g., 'a', 'button').
 * @param keyword - The text to search for inside the element.
 * @returns True if at least one matching element is found; false otherwise.
 */
async function hasElementWithKeyword(page: Page, element: string, keyword: string): Promise<boolean> {
    return await page
        .locator(`${element}:has-text("${keyword}")`)
        .count()
        .then((count) => count > 0)
        .catch(() => false);
}

/**
 * Normalizes a URL to a consistent format for comparison or deduplication.
 * If the URL is invalid or cannot be parsed, the original input is returned.
 *
 * @param url - The URL string to normalize.
 * @returns The normalized URL, suitable for comparison or storage.
 */
function normalizeUrl(url: string): string {
    try {
        const u = new URL(url);

        // Remove hash and query string for a clean, comparable URL
        u.hash = "";
        u.search = "";

        // Convert root path '/' to empty string
        if (u.pathname === "/") u.pathname = "";

        // Remove trailing slash from pathname
        if (u.pathname.endsWith("/")) {
            u.pathname = u.pathname.slice(0, -1);
        }

        return u.href; // Return absolute normalized URL
    } catch {
        return url; // Return original URL if parsing fails
    }
}

/**
 * Determines whether two URLs belong to the same domain, ignoring the 'www.' prefix.
 *
 * @param urlA - The first URL to compare.
 * @param urlB - The second URL to compare.
 * @returns `true` if both URLs resolve to the same domain (case-insensitive), `false` otherwise.
 */
function sameDomain(urlA: string, urlB: string): boolean {
    try {
        const domainA = new URL(normalizeUrl(urlA)).hostname.replace(/^www\./, "").toLowerCase();
        const domainB = new URL(normalizeUrl(urlB)).hostname.replace(/^www\./, "").toLowerCase();
        return domainA === domainB;
    } catch {
        return false; // Treat invalid URLs as non-matching
    }
}

export { getAttByLocator, getAttByLabel, getTextContent, hasElementWithKeyword, normalizeUrl, sameDomain };
