import { SiteScoutAPI } from "@/lib/api/siteApi";

const api = new SiteScoutAPI();

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return api.getJobUpdates(id);
}
