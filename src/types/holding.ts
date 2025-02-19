export interface Holding {
  id: string;
  shares: number;
  average_cost: number;
  company: {
    id: string;
    current_price: number;
    name: string;
    ticker: string;
  };
} 