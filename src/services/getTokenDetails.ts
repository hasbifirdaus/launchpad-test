import { createPublicClient, http, formatEther } from "viem";
import { robinhoodTestnet } from "@/config/chain";
import LauncherTokenABI from "@/abi/LauncherToken.json";
import BondingCurveABI from "@/abi/BondingCurve.json";
import LaunchFactoryABI from "@/abi/LaunchFactory.json";

const FACTORY_ADDRESS = "0x533cE670f1372cb402D49866608b92e7bc2b4493";

const client = createPublicClient({
  chain: robinhoodTestnet,
  transport: http(),
});

export interface TokenDetail {
  tokenAddress: string;
  curveAddress: string;
  name: string;
  symbol: string;
  logo: string;
  quoteReserve: bigint;
  tokenReserve: bigint;
  realQuoteReserve: bigint;
  graduationThreshold: bigint;
  phase: number;
  currentPrice: string;
  progress: number;
}

function formatTinyPrice(price: number): string {
  if (price === 0) return "0";
  if (price >= 0.0001) return price.toFixed(4);
  return price.toExponential(4);
}

export async function fetchTokenDetails(
  tokensList: { tokenAddress: string; curveAddress: string }[],
) {
  if (!tokensList || tokensList.length === 0) return [];

  const calls = tokensList.flatMap((t) => [
    {
      address: t.tokenAddress as `0x${string}`,
      abi: LauncherTokenABI,
      functionName: "name",
    },
    {
      address: t.tokenAddress as `0x${string}`,
      abi: LauncherTokenABI,
      functionName: "symbol",
    },
    {
      address: t.tokenAddress as `0x${string}`,
      abi: LauncherTokenABI,
      functionName: "logo",
    },
    {
      address: t.curveAddress as `0x${string}`,
      abi: BondingCurveABI,
      functionName: "getReserves",
    },
    {
      address: t.curveAddress as `0x${string}`,
      abi: BondingCurveABI,
      functionName: "realQuoteReserve",
    },
    {
      address: t.curveAddress as `0x${string}`,
      abi: BondingCurveABI,
      functionName: "graduationThreshold",
    },
    {
      address: FACTORY_ADDRESS as `0x${string}`,
      abi: LaunchFactoryABI,
      functionName: "getLaunchedToken",
      args: [t.tokenAddress],
    },
  ]);

  try {
    const results = await client.multicall({
      contracts: calls as Parameters<typeof client.multicall>[0]["contracts"],
      allowFailure: true,
    });

    const detailedTokens: TokenDetail[] = [];
    const ITEMS_PER_TOKEN = 7;

    for (let i = 0; i < tokensList.length; i++) {
      const baseIndex = i * ITEMS_PER_TOKEN;
      const t = tokensList[i];

      const nameRes = results[baseIndex];
      const symbolRes = results[baseIndex + 1];
      const logoRes = results[baseIndex + 2];
      const reservesRes = results[baseIndex + 3];
      const realQuoteRes = results[baseIndex + 4];
      const gradThresholdRes = results[baseIndex + 5];
      const launchedTokenRes = results[baseIndex + 6];

      const name =
        nameRes.status === "success" && typeof nameRes.result === "string"
          ? nameRes.result
          : "Unknown";
      const symbol =
        symbolRes.status === "success" && typeof symbolRes.result === "string"
          ? symbolRes.result
          : "TKN";
      const logo =
        logoRes.status === "success" && typeof logoRes.result === "string"
          ? logoRes.result
          : "";

      const reserves =
        reservesRes.status === "success" && Array.isArray(reservesRes.result)
          ? (reservesRes.result as [bigint, bigint])
          : [BigInt(0), BigInt(0)];
      const quoteReserve = reserves[0] || BigInt(0);
      const tokenReserve = reserves[1] || BigInt(0);

      const realQuoteReserve =
        realQuoteRes.status === "success" &&
        typeof realQuoteRes.result === "bigint"
          ? realQuoteRes.result
          : BigInt(0);
      const graduationThreshold =
        gradThresholdRes.status === "success" &&
        typeof gradThresholdRes.result === "bigint"
          ? gradThresholdRes.result
          : BigInt(1);

      let phase = 0;
      if (launchedTokenRes.status === "success" && launchedTokenRes.result) {
        const resData = launchedTokenRes.result;
        if (typeof resData === "object" && resData !== null) {
          phase =
            "phase" in resData
              ? Number((resData as Record<string, unknown>).phase)
              : Number(Object.values(resData)[0] || 0);
        }
      }

      let currentPriceNum = 0;
      if (tokenReserve > BigInt(0)) {
        const quoteFloat = parseFloat(formatEther(quoteReserve));
        const tokenFloat = parseFloat(formatEther(tokenReserve));
        currentPriceNum = tokenFloat > 0 ? quoteFloat / tokenFloat : 0;
      }
      const currentPrice = formatTinyPrice(currentPriceNum);

      let progress = 0;
      if (graduationThreshold > BigInt(0)) {
        const bps = (realQuoteReserve * BigInt(10000)) / graduationThreshold;
        const bpsNumber = Number(bps);
        progress = Math.min(bpsNumber / 100, 100);
      }

      detailedTokens.push({
        tokenAddress: t.tokenAddress,
        curveAddress: t.curveAddress,
        name,
        symbol,
        logo,
        quoteReserve,
        tokenReserve,
        realQuoteReserve,
        graduationThreshold,
        phase,
        currentPrice,
        progress,
      });
    }

    return detailedTokens;
  } catch (error) {
    console.error("Gagal menjalankan multicall token details:", error);
    return [];
  }
}
