// Types for .env
export interface PreservedEnv {
    SERP_API_KEY: string;
    GEMINI_API_KEY: string;
}

export interface ApiFile {
    name: string;
    buffer: string;
}