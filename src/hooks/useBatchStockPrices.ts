import { useEffect, useMemo } from 'react';
import { useStockStore } from '@/stores/stockStore';
import { createClientBrowser } from '@/lib/supabase/client';
import debounce from 'lodash/debounce';

export function useBatchStockPrices(tickers: string[]) {
  const { prices, updateBatchPrices } = useStockStore();
  
  const fetchPrices = async () => {
    const response = await fetch(`/api/stock/batch?tickers=${tickers.join(',')}`);
    const data = await response.json();
    
    const newPrices = Object.entries(data.companies).reduce(
      (acc, [ticker, company]: [string, any]) => ({
        ...acc,
        [ticker]: company.current_price
      }),
      {}
    );
    
    updateBatchPrices(newPrices);
  };

  const debouncedFetchPrices = useMemo(
    () => debounce(fetchPrices, 1000),
    []
  );

  useEffect(() => {
    debouncedFetchPrices();

    const supabase = createClientBrowser();
    const channel = supabase
      .channel('batch-stock-prices')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'companies',
          filter: `ticker=in.(${tickers.join(',')})`
        },
        (payload) => {
          updateBatchPrices({ [payload.new.ticker]: payload.new.current_price });
        }
      )
      .subscribe();

    return () => {
      debouncedFetchPrices.cancel();
      supabase.removeChannel(channel);
    };
  }, [JSON.stringify(tickers)]);

  return useMemo(() => {
    return tickers.reduce((acc, ticker) => ({
      ...acc,
      [ticker]: prices[ticker] || 0
    }), {});
  }, [prices, tickers]);
} 