import { ShopReelAPI } from "@/lib/api/shopApi";

const api = new ShopReelAPI();

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return api.cancelJob(id);
}