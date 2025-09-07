export type Stats = {
  totalSOLClaimed: number;
  totalTokensBought: string;
  totalTokensBurned: string;
  lastRun?: string;
  activity: Array<{ title:string; desc?:string; tx?:string }>;
};

export function emptyStats(): Stats {
  return { totalSOLClaimed: 0, totalTokensBought: "0", totalTokensBurned: "0", activity: [] };
}
