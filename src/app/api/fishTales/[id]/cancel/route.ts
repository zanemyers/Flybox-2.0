import { FishTalesAPI } from "@/lib/api/fishApi";

const api = new FishTalesAPI();

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return api.cancelJob(id);
}