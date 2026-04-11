import { ShopReelAPI } from "@/lib/api/shopApi";

const api = new ShopReelAPI();

export async function POST(req: Request) {
  return api.handleCreateJob(req);
}