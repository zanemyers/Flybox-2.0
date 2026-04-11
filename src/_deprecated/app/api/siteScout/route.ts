import { SiteScoutAPI } from "@/lib/api/siteApi";

const api = new SiteScoutAPI();

export async function POST(req: Request) {
  return api.handleCreateJob(req);
}
