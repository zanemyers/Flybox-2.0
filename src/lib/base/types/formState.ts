export interface FishTalesFormState {

}

export type ActiveTab = "manual" | "file";

export interface ShopReelFormState {
    file?: File | null;
    apiKey: string;
    searchTerm: string;
    latitude: number;
    longitude: number;
    maxResults: number;
}

export interface SiteScoutFormState {
    shopReelFile: File | null;
    fishTalesFile: File | null;
}