export interface HistoryEntry {
  id: string;
  title: string;
  url: string;
  timestamp: number;
  status: "success" | "error";
}
