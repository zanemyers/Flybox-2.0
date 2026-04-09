// Types for .env
export interface PreservedEnv {
    SERP_API_KEY: string;
    GEMINI_API_KEY: string;
}

// Types for FishTales
export interface SiteInfo {
    url: string;
    keywords: string[]; // Array of relevant keywords indicating valuable content
    junkWords: string[]; // Array of terms indicating irrelevant or low-value content
    clickPhrases: string[]; // Array of phrases that encourage following the link (e.g., "read more")
    [key: string]: any; // Allow any other extra properties
}

export interface CrawlSiteItem {
    url: string;
    priority: number;
}

export interface Anchor {
    href: string;
    text: string;
}

// Types for ShopReel
export interface BasicShop {
    title: string;
    type: string;
    phone: string;
    address: string;
    website: string;
    rating: number;
    reviews: number;
}

export interface ShopDetails {
    email: string;
    sellsOnline: boolean | string;
    fishingReport: boolean | string;
    socialMedia: string[];
}

export interface ShopCache {
    Name: string;
    Category: string;
    Phone: string;
    Address: string;
    "Has Website": boolean;
    Website: string;
    Rating: string;
    Reviews: number;
}

export interface Shop {
    Name: string;
    Category: string;
    Phone: string;
    Address: string;
    Email: string;
    "Has Website": boolean;
    Website: string;
    "Sells Online": boolean | string;
    Rating: string;
    Reviews: number;
    "Has Report": boolean | string;
    Socials: string[];
}

// Types for API Endpoints
export interface ShopReelPayload {
    apiKey: string | null,
    query: string | null,
    lat: number | null,
    lng: number | null,
    maxResults: number | null,
    file?: File | null;
}

export interface FishTalesPayload {
    apiKey: string;
    maxAge: number;
    filterByRivers: boolean;
    riverList: string[];
    file: File;
    includeSiteList: boolean;
    tokenLimit: number;
    crawlDepth: number;
    model: string;
    summaryPrompt: string;
    mergePrompt: string;
}

export interface SiteScoutPayload {
    shopReelFile: File;
    fishTalesFile: File;
}

export interface ApiFile {
    name: string;
    buffer: string;
}