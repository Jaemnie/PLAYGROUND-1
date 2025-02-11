import { create } from 'zustand';
import { createClientBrowser } from '@/lib/supabase/client';

interface StockState {
  prices: Record<string, {
    current_price: number;
    last_closing_price: number;
    previous_price: number;
    timestamp: number;
  }>;
  updatePrice: (ticker: string, data: any) => void;
  updateBatchPrices: (updates: Record<string, any>) => void;
}

export const useStockStore = create<StockState>((set) => ({
  prices: {},
  
  updatePrice: (ticker, data) => {
    set((state) => ({
      prices: {
        ...state.prices,
        [ticker]: {
          ...data,
          timestamp: Date.now()
        }
      }
    }));
  },
  
  updateBatchPrices: (updates) => {
    set((state) => ({
      prices: Object.entries(updates).reduce((acc, [ticker, data]) => ({
        ...acc,
        [ticker]: {
          ...data,
          timestamp: Date.now()
        }
      }), state.prices)
    }));
  }
})); 