import {
  Aptos,
  AptosConfig,
  InputViewFunctionData,
  Network,
} from "@aptos-labs/ts-sdk";
import { useState } from "react";
interface FormattedMarket {
  description: string;
  end_time: string;
  id: string;
  outcome: number;
  question: string;
  status: number;
  total_no_amount: string;
  total_yes_amount: string;
}
export default function useGetAllMarket() {
  const [markets, setMarkets] = useState<FormattedMarket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function useGetAllMarketData() {
    try {
      const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));
      const payload: InputViewFunctionData = {
        function: `0x7b32fe02523c311724de5e267ee56b6cca31f2ee04f15bfc10dbf1b23f95c6cb::prediction_market::get_all_markets_data`,
        typeArguments: [],
        functionArguments: [],
      };

      const response = await aptos.view({ payload });
      const getMarkets: any = response[0];
      setMarkets(getMarkets);
      console.log(" markets response:", getMarkets);
      return getMarkets;
    } catch (error) {
      console.error("Error fetching markets:", error);
      setError("Failed to fetch markets");

      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  return { markets, isLoading, error, useGetAllMarketData };
}
