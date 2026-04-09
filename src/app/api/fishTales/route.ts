import { FishTalesAPI } from "@/lib/api/fishApi";

const api = new FishTalesAPI();

export async function POST(req: Request) {
  return api.handleCreateJob(req);
}