"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useBalance,
  useSwitchChain,
  useReadContract,
} from "wagmi";
import { injected } from "wagmi/connectors";
import { formatEther } from "viem";
import { robinhoodTestnet } from "@/config/chain";
import LaunchFactoryABI from "@/abi/LaunchFactory.json";
import { getTokenList } from "@/services/getTokenList";
import { getTokenDetails, TokenDetail } from "@/services/getTokenDetails";

const FACTORY_ADDRESS = "0x533cE670f1372cb402D49866608b92e7bc2b4493";

const getPhaseLabel = (phase: number) => {
  switch (phase) {
    case 0:
      return {
        text: "Trading on Curve",
        color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      };
    case 1:
      return {
        text: "Curve Bought Out",
        color: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      };
    case 2:
      return {
        text: "Graduated to Uniswap v4",
        color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      };
    case 3:
      return {
        text: "Graduation Cancelled",
        color: "bg-red-500/20 text-red-400 border-red-500/30",
      };
    default:
      return {
        text: "Unknown Phase",
        color: "bg-slate-800 text-slate-400 border-slate-700",
      };
  }
};

export default function Home() {
  const { address, isConnected, chainId } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [detailedTokens, setDetailedTokens] = useState<TokenDetail[]>([]);
  const [logoErrors, setLogoErrors] = useState<Record<string, boolean>>({});

  const { data: balance } = useBalance({
    address: address,
  });

  const {
    data: launchFee,
    isLoading: feeLoading,
    error: feeError,
  } = useReadContract({
    address: FACTORY_ADDRESS as `0x${string}`,
    abi: LaunchFactoryABI,
    functionName: "launchFee",
  });

  const loadTokensAndDetails = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const data = await getTokenList();

      if (!data) {
        throw new Error("Gagal mengambil data dari blockchain/server");
      }

      console.log("Daftar token berhasil dimuat", data);

      if (data.length > 0) {
        const details = await getTokenDetails(data);
        console.log("Detail token berhasil dimuat:", details);
        setDetailedTokens(details);
      } else {
        setDetailedTokens([]);
      }
    } catch (error) {
      console.error("Gagal memuat token list atau detail:", error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initFetch() {
      setIsLoading(true);
      setHasError(false);
      try {
        const data = await getTokenList();
        if (!isMounted) return;

        if (!data) {
          throw new Error("Gagal mengambil data dari blockchain/server");
        }

        if (data.length > 0) {
          const details = await getTokenDetails(data);
          if (!isMounted) return;
          setDetailedTokens(details);
        } else {
          setDetailedTokens([]);
        }
      } catch (error) {
        if (!isMounted) return;
        console.error("Gagal memuat token list atau detail:", error);
        setHasError(true);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    initFetch();

    return () => {
      isMounted = false;
    };
  }, [loadTokensAndDetails]);
  const isWrongNetwork = isConnected && chainId !== robinhoodTestnet.id;

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 sm:p-8 flex flex-col items-center justify-center">
      <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Robinhood Launchpad Test</h1>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
          {!isConnected ? (
            <button
              onClick={() => connect({ connector: injected() })}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-medium transition"
            >
              Connect MetaMask
            </button>
          ) : isWrongNetwork ? (
            <div className="space-y-3 text-center">
              <p className="text-amber-400 text-sm">
                Anda berada di jaringan yang salah. Harap pindah ke Robinhood
                Chain Testnet.
              </p>
              <button
                onClick={() => switchChain({ chainId: robinhoodTestnet.id })}
                className="w-full py-3 bg-amber-600 hover:bg-amber-500 rounded-xl font-medium transition"
              >
                Switch ke Robinhood Testnet
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Status:</span>
                <span className="text-emerald-400 font-medium">Connected</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Address:</span>
                <span className="font-mono">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Saldo ETH:</span>
                <span>
                  {balance
                    ? `${Number(formatEther(balance.value)).toFixed(4)} ETH`
                    : "0 ETH"}
                </span>
              </div>
              <button
                onClick={() => disconnect()}
                className="w-full mt-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-xl font-medium transition text-sm"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
          <h2 className="text-sm font-semibold text-slate-300">
            Factory Data (Launch Fee)
          </h2>
          {feeLoading ? (
            <p className="text-sm text-slate-500 animate-pulse">
              Memuat data dari smart contract...
            </p>
          ) : feeError ? (
            <p className="text-sm text-red-400">
              Gagal memuat: Periksa koneksi RPC atau jaringan Anda.
            </p>
          ) : (
            <p className="text-sm text-emerald-400 font-mono">
              Launch Fee:{" "}
              {launchFee ? `${formatEther(launchFee as bigint)} ETH` : "-"}
            </p>
          )}
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
          <h2 className="text-sm font-semibold text-slate-300">
            Token Market List
          </h2>

          {isLoading ? (
            <div className="py-8 text-center space-y-2">
              <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-slate-500 animate-pulse">
                Memuat data dan multicall detail token...
              </p>
            </div>
          ) : hasError ? (
            <div className="py-6 text-center space-y-3 bg-red-950/20 border border-red-900/30 rounded-xl p-4">
              <p className="text-sm text-red-400">
                Gagal memuat daftar token dari jaringan.
              </p>
              <button
                onClick={loadTokensAndDetails}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-medium transition"
              >
                Coba Lagi (Retry)
              </button>
            </div>
          ) : detailedTokens.length === 0 ? (
            <div className="py-8 text-center space-y-1">
              <p className="text-sm text-slate-400">
                Tidak ada token ditemukan.
              </p>
              <p className="text-xs text-slate-600">
                Belum ada token yang dibuat di factory ini.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {detailedTokens.map((token, idx) => {
                const phaseInfo = getPhaseLabel(token.phase);
                const hasLogoError = logoErrors[token.tokenAddress];
                const showPlaceholder =
                  !token.logo || token.logo.trim() === "" || hasLogoError;

                return (
                  <div
                    key={idx}
                    className="p-3.5 bg-slate-900 rounded-xl space-y-3 border border-slate-800 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                          {!showPlaceholder ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={token.logo}
                              alt={token.name}
                              className="w-full h-full object-cover"
                              onError={() =>
                                setLogoErrors((prev) => ({
                                  ...prev,
                                  [token.tokenAddress]: true,
                                }))
                              }
                            />
                          ) : (
                            <span className="text-xs font-bold text-slate-400">
                              {token.symbol
                                ? token.symbol.slice(0, 3).toUpperCase()
                                : "TKN"}
                            </span>
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-sm text-white leading-tight">
                            {token.name}
                          </h3>
                          <span className="text-xs text-slate-400 font-mono">
                            {token.symbol}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">
                          Price
                        </span>
                        <span className="text-emerald-400 font-mono text-xs font-medium">
                          {token.currentPrice} ETH
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full border text-[10px] font-medium w-fit ${phaseInfo.color}`}
                      >
                        {phaseInfo.text}
                      </span>
                      <span className="text-slate-400 font-mono">
                        Progress:{" "}
                        <strong className="text-white">
                          {token.progress.toFixed(2)}%
                        </strong>
                      </span>
                    </div>

                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-linear-to-r from-blue-500 to-emerald-400 h-full transition-all duration-300 rounded-full"
                        style={{ width: `${Math.min(token.progress, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
