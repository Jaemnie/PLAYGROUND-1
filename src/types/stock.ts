export interface StockData {
  id: string;
  ticker: string;
  name: string;
  current_price: number;
  last_closing_price: number;
  market_cap: number;
  industry: string;
  is_delisted?: boolean;
} 