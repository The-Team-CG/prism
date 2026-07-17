export type EventFileHubItem = {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  status: string;
  date: string;
  owner: string;
  extension: string;
  kind: "invoice" | "floorplan" | "briefing" | "contract" | "document" | "closeout";
  meta: string;
  amount?: number;
  accent: string;
};

