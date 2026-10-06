"use client";

import React, { useState, useEffect } from "react";
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
import { fetchTokenList } from "@/services/getTokenList";
import { fetchTokenDetails, TokenDetail } from "@/services/getTokenDetails";

const FACTORY_ADDRESS = "0x533cE670f1372cb402D49866608b92e7bc2b4493";

export default function Home() {
  const { address, isConnected, chainId } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const [isFetchingTokens, setIsFetchingTokens] = useState<boolean>(false);
  const [detailedTokens, setDetailedTokens] = useState<TokenDetail[]>([]);
  const [isFetchingDetails, setIsFetchingDetails] = useState<boolean>(false);

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

  useEffect(() => {
    async function loadTokensAndDetails() {
      setIsFetchingTokens(true);
      try {
        const data = await fetchTokenList();
        console.log("Daftar token berhasil dimuat", data);

        if (data && data.length > 0) {
          setIsFetchingDetails(true);
          const details = await fetchTokenDetails(data);
          console.log("Detail token detail berhasil dimuat:", details);
          setDetailedTokens(details);
        }
      } catch (error) {
        console.error("Gagal memuat token list atau detail:", error);
      } finally {
        setIsFetchingTokens(false);
        setIsFetchingDetails(false);
      }
    }

    loadTokensAndDetails();
  }, []);

  const isWrongNetwork = isConnected && chainId !== robinhoodTestnet.id;

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8 flex flex-col items-center justify-center">
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
            Token Details List - Total: {detailedTokens.length}
          </h2>

          {isFetchingTokens || isFetchingDetails ? (
            <p className="text-sm text-slate-500 animate-pulse">
              Memuat data dan multicall detail token...
            </p>
          ) : detailedTokens.length === 0 ? (
            <p className="text-sm text-slate-400">Tidak ada token ditemukan.</p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {detailedTokens.map((token, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-900 rounded-xl text-xs space-y-2 border border-slate-800"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm text-white">
                      {token.name} ({token.symbol})
                    </span>
                    <span className="text-emerald-400 font-mono">
                      Price: {token.currentPrice} ETH
                    </span>
                  </div>

                  <div className="text-slate-400 font-mono truncate">
                    Token: {token.tokenAddress}
                  </div>

                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>Phase: {token.phase}</span>
                    <span>Progress: {token.progress.toFixed(2)}%</span>
                  </div>

                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-500 h-full transition-all duration-300"
                      style={{ width: `${Math.min(token.progress, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
