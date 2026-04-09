export const ERRORS = {
    CANCELED: "CANCELED",
};

/**
 * Keywords commonly found on web pages when access is blocked or forbidden.
 */
export const BLOCKED_OR_FORBIDDEN = [
    "Access Denied",
    "Forbidden",
    "Too Many Requests",
    "Error 403",
    "Access Blocked",
    "You have been rate limited",
];

/**
 * Regular expression pattern to match email addresses in text.
 * Matches standard email formats like "user@example.com".
 */
export const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;

/**
 * Keywords commonly associated with e-commerce or online shops.
 */
export const SHOP_KEYWORDS = ["shop", "store", "buy", "products", "cart", "checkout"];

/**
 * Mapping of known social media domains to human-readable platform names.
 * Includes domain aliases to cover multiple URL variations (e.g., wa.me → WhatsApp, x.com → X/Twitter).
 */
export const SOCIAL_MEDIA_MAP = [
    { domain: "facebook.com", name: "Facebook" },
    { domain: "instagram.com", name: "Instagram" },
    { domain: "linkedin.com", name: "LinkedIn" },
    { domain: "tiktok.com", name: "TikTok" },
    { domain: "vimeo.com", name: "Vimeo" },
    { domain: "whatsapp.com", name: "WhatsApp" },
    { domain: "wa.me", name: "WhatsApp" },
    { domain: "x.com", name: "X (Twitter)" },
    { domain: "twitter.com", name: "X (Twitter)" },
    { domain: "youtube.com", name: "YouTube" },
];

/**
 * Standardized messages used throughout the scraper for consistent error handling and reporting.
 *
 * - Error messages indicate failures during scraping operations, such as timeouts, blocked pages,
 *   or missing data.
 * - "Not found" messages provide default values when expected data is missing on a page.
 */
export const MESSAGES = {
    // ERROR MESSAGES
    ERROR_SCROLL_TIMEOUT: (time: number) =>
        `Scroll Timeout: Reached ${time / 1000} seconds without seeing end-of-list message.`,
    ERROR_BLOCKED_FORBIDDEN: (status: number) => `Blocked or Forbidden link (HTTP ${status})`,
    ERROR_EMAIL: "Errored while checking for an email",
    ERROR_LOAD_FAILED: "Page load failed",
    ERROR_REPORT: "Errored while checking for reports",
    ERROR_SHOP: "Errored while checking for an online shop",
    ERROR_SOCIAL: "Error while checking for social media",

    // NOT FOUND MESSAGES
    NO_CATEGORY: "No Category",
    NO_EMAIL: "No Email",
    NO_PHONE: "No Phone Number",
    NO_REVIEWS: "No Reviews",
    NO_STARS: "No Stars",
    NO_WEB: "No Website",
};

/**
 * Standardized fallback detail objects for shops when data cannot be retrieved.
 * Categories include:
 * - BLOCKED: Site blocked or forbidden (with HTTP status), returns error messages for all fields.
 * - ERROR: General errors encountered during scraping.
 * - NONE: Explicitly empty/default values when no data is found.
 * - TIMEOUT: Page load failures.
 */
export const FALLBACK_DETAILS = {
    BLOCKED: (status: number) => ({
        email: MESSAGES.ERROR_BLOCKED_FORBIDDEN(status),
        sellsOnline: MESSAGES.ERROR_BLOCKED_FORBIDDEN(status),
        fishingReport: MESSAGES.ERROR_BLOCKED_FORBIDDEN(status),
        socialMedia: [MESSAGES.ERROR_BLOCKED_FORBIDDEN(status)],
    }),
    ERROR: {
        email: MESSAGES.ERROR_EMAIL,
        sellsOnline: MESSAGES.ERROR_SHOP,
        fishingReport: MESSAGES.ERROR_REPORT,
        socialMedia: [MESSAGES.ERROR_SOCIAL],
    },
    NONE: {
        email: "",
        sellsOnline: false,
        fishingReport: false,
        socialMedia: [""],
    },
    TIMEOUT: {
        email: MESSAGES.ERROR_LOAD_FAILED,
        sellsOnline: MESSAGES.ERROR_LOAD_FAILED,
        fishingReport: MESSAGES.ERROR_LOAD_FAILED,
        socialMedia: [MESSAGES.ERROR_LOAD_FAILED],
    },
};

/**
 * Divider used between individual reports for improved readability.
 */
export const DIVIDER = "\n" + "-".repeat(50) + "\n";

export const JobStatus = {
    IN_PROGRESS: "IN_PROGRESS",
    COMPLETED: "COMPLETED",
    CANCELED: "CANCELED",
    FAILED: "FAILED",
} as const;

export const JobType = {
    SHOP_REEL: "SHOP_REEL",
    FISH_TALES: "FISH_TALES",
    SITE_SCOUT: "SITE_SCOUT",
} as const;
