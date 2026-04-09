import type { Page } from "playwright"
import { getAttByLocator, hasElementWithKeyword } from "@/lib/base/scrapingUtils";
import { EMAIL_REGEX, MESSAGES, SHOP_KEYWORDS, SOCIAL_MEDIA_MAP } from "@/lib/base/constants";
import { BasicShop, Shop, ShopCache, ShopDetails } from "@/lib/base/types/taskTypes";

/**
 * Checks if the page contains a hyperlink (`<a>`) with the keyword "report" (case-insensitive).
 *
 * @param page - The playwright instance
 * @returns `true` if found, `false` if not, or an error message on failure.
 */
async function publishesFishingReport(page: Page): Promise<boolean|string> {
    try {
        return await hasElementWithKeyword(page, "a", "report");
    } catch {
        return MESSAGES.ERROR_REPORT;
    }
}

/**
 * Detects linked social media platforms by scanning all `<a>` tags for domains listed in `SOCIAL_MEDIA_MAP`.
 *
 * @param page - The playwright instance
 * @returns A comma-separated list of platforms found, an empty string if none found, or an error message on failure.
 */
async function getSocialMedia(page: Page): Promise<string[]> {
    try {
        const hrefs = await page.$$eval("a", (links) => links.map((link) => link.href.toLowerCase()));

        const foundSocials: string[] = [];
        for (const { domain, name } of SOCIAL_MEDIA_MAP) {
            if (hrefs.some((href) => href.includes(domain)) && !foundSocials.includes(name)) {
                foundSocials.push(name);
            }
        }

        return foundSocials;
    } catch {
        return [MESSAGES.ERROR_SOCIAL];
    }
}

/**
 * Finds the first `<a>` element whose `href` contains "contact" and returns its absolute URL.
 *
 * @param page - The playwright instance
 * @returns The contact page URL or `null` if not found.
 */
async function getContactLink(page: Page): Promise<string|null> {
    try {
        const href = await getAttByLocator(page,'a[href*="contact"]', "href");
        if (!href) return null;

        return new URL(href, page.url()).toString();
    } catch {
        return null;
    }
}

/**
 * Extracts the email address from the first `mailto:` link found in an `<a>` tag.
 *
 * @param page - The playwright instance
 * @returns The email address, or `null` if none found.
 */
async function getEmailFromHref(page: Page): Promise<string|null> {
    try {
        const email = await getAttByLocator(page,'a[href^="mailto:"]', "href");
        return email ? email.replace("mailto:", "").split("?")[0] : null;
    } catch {
        return null;
    }
}

/**
 * Searches the page body text for an email address using `EMAIL_REGEX`.
 *
 * @param page - The playwright instance
 * @returns The email if found, otherwise `null`.
 */
async function getEmailFromText(page: Page): Promise<string|null> {
    try {
        const fullText = await page.locator("body").innerText();
        const match = fullText.match(EMAIL_REGEX);
        return match ? match[0] : null;
    } catch {
        return null;
    }
}

type LoadFn = (url: string) => Promise<unknown>;

/**
 * Retrieves an email address using a tiered approach:
 * 1. Check for a `mailto:` link.
 * 2. Search page text.
 * 3. If still not found, navigate to the contact page (if available) and retry.
 *
 * @param page - The playwright instance
 * @param load - A function to load the contact page
 * @param onContactPage=false - Prevents infinite recursion when already on contact page.
 * @returns Email address found, or a predefined "no email" or error message.
 */
async function getEmail(page: Page, load: LoadFn, onContactPage = false): Promise<string> {
    try {
        const emailFromHref = await getEmailFromHref(page);
        if (emailFromHref) return emailFromHref;

        const emailFromText = await getEmailFromText(page);
        if (emailFromText) return emailFromText;

        if (!onContactPage) {
            const contactLink = await getContactLink(page);
            if (contactLink) {
                await load(contactLink);
                return await getEmail(page, load, true);
            }
        }

        return MESSAGES.NO_EMAIL;
    } catch {
        return MESSAGES.ERROR_EMAIL;
    }
}

/**
 * Checks if the page contains keywords related to an online shop in either `<a>` or `<button>` elements.
 *
 * @returns`true` if found, `false` if not, or an error message on failure.
 */
async function hasOnlineShop(page: Page): Promise<boolean|string> {
    try {
        for (const keyword of SHOP_KEYWORDS) {
            const hasLink = await hasElementWithKeyword(page,"a", keyword);
            const hasButton = await hasElementWithKeyword(page, "button", keyword);

            if (hasLink || hasButton) return true;
        }
        return false;
    } catch {
        return MESSAGES.ERROR_SHOP;
    }
}


/**
 * Combines base shop data with scraped details to create a list of export-ready row objects.
 *
 * @param shops - The base shop data, each containing title, type, phone, etc.
 * @param shopDetails - The scraped or cached details for each shop.
 * @returns A new array of objects formatted for export (e.g., to CSV or Excel).
 *
 * @throws {Error} If `shops` and `shopDetails` have mismatched lengths.
 */
function buildShopRows(shops: BasicShop[], shopDetails: ShopDetails[]): Shop[] {
    if (shops.length !== shopDetails.length)
        // ensure both arrays are the same length
        throw new Error(`Shop count - ${shops.length} ≠ details count - ${shopDetails.length}`);

    return shops.map((shop, i: number) => {
        return {
            Name: shop.title || "",
            Category: shop.type || "",
            Phone: shop.phone || "",
            Address: shop.address || "",
            Email: shopDetails[i]?.email || "",
            "Has Website": !!shop.website,
            Website: shop.website || MESSAGES.NO_WEB,
            "Sells Online": shopDetails[i]?.sellsOnline || "",
            Rating: shop.rating != null ? `${shop.rating}/5` : "N/A",
            Reviews: shop.reviews || 0,
            "Has Report": shopDetails[i]?.fishingReport || "",
            Socials: shopDetails[i]?.socialMedia || [],
        };
    });
}

/**
 * Formats a list of shop objects into simplified row data for the intermediate file.
 *
 * @param shops - The list of shop objects to format.
 * @returns A new array of objects formatted for export (e.g., to CSV or Excel).
 */
function buildCacheFileRows(shops: BasicShop[]): ShopCache[] {
    if (shops.length === 0) return [];

    return shops.map((shop) => {
        return {
            Name: shop.title || "",
            Category: shop.type || "",
            Phone: shop.phone || "",
            Address: shop.address || "",
            "Has Website": !!shop.website,
            Website: shop.website || MESSAGES.NO_WEB,
            Rating: shop.rating != null ? `${shop.rating}/5` : "N/A",
            Reviews: shop.reviews || 0,
        };
    });
}

export { buildCacheFileRows, buildShopRows, getEmail, hasOnlineShop, getSocialMedia, publishesFishingReport };
