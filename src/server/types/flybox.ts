export interface FlyboxPayload {
  serpApiKey: string;
  geminiApiKey: string;
  searchTerm: string;
  latitude: number;
  longitude: number;
  rivers: string[];
  summaryPrompt: string;
}

export interface FetchResult {
  html: string | null;
  status: number;
  blocked: boolean;
  jsRendered: boolean;
  error?: string;
}

export interface Anchor {
  href: string;
  text: string;
}

export interface BasicShop {
  name: string;
  website: string;
  address: string;
  phone: string;
  stars: string;
  reviews: string;
  category: string;
}

export interface ShopDetails {
  email: string;
  sellsOnline: boolean | string;
  fishingReport: boolean | string;
  socialMedia: string[];
  contactLink?: string;
}

export type SiteInfo = BasicShop & ShopDetails;
