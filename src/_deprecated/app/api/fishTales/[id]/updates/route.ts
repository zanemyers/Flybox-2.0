import { FishTalesAPI } from "@/lib/api/fishApi";

const api = new FishTalesAPI();

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return api.getJobUpdates(id);
}
