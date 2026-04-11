import { SiteScoutAPI } from "@/lib/api/siteApi";

const api = new SiteScoutAPI();

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return api.cancelJob(id);
}