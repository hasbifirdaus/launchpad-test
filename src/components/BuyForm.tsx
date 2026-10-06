"use client";

import React, { useState, useEffect } from "react";
import { parseEther, formatUnits, erc20Abi } from "viem";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import BondingCurveABI from "@/abi/BondingCurve.json";
import { TokenDetail } from "@/services/getTokenDetails";

interface BuyFormProps {
  selectedToken: TokenDetail;
  onSuccess: () => void;
  onBack: () => void;
}

export default function BuyForm({
  selectedToken,
  onSuccess,
  onBack,
}: BuyFormProps) {
  const { address: userAddress, isConnected: accountConnected } = useAccount();

  const [quoteInStr, setQuoteInStr] = useState<string>("");
  const [slippageBps, setSlippageBps] = useState<number>(100);

  const curveAddr = selectedToken.curveAddress as `0x${string}`;
  const tokenAddr = selectedToken.tokenAddress as `0x${string}`;

  // Membaca saldo token user yang sedang dibeli
  const { data: tokenBalance, refetch: refetchTokenBalance } = useReadContract({
    address: tokenAddr,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress && !!tokenAddr,
    },
  });

  const { data: feeBps } = useReadContract({
    address: curveAddr,
    abi: BondingCurveABI,
    functionName: "feeBps",
  });

  const { data: creatorTaxBps } = useReadContract({
    address: curveAddr,
    abi: BondingCurveABI,
    functionName: "creatorTaxBps",
  });

  const tokenReserve = selectedToken.tokenReserve
    ? BigInt(selectedToken.tokenReserve)
    : BigInt(0);
  const quoteReserve = selectedToken.quoteReserve
    ? BigInt(selectedToken.quoteReserve)
    : BigInt(0);

  let quoteInWei = BigInt(0);
  let hasValidAmount = false;
  let calculationError = "";

  try {
    if (quoteInStr && quoteInStr.trim() !== "" && !isNaN(Number(quoteInStr))) {
      const decimalParts = quoteInStr.split(".");
      if (decimalParts[1] && decimalParts[1].length > 18) {
        calculationError = "Maksimal 18 desimal";
      } else {
        quoteInWei = parseEther(quoteInStr);
        if (quoteInWei > BigInt(0)) {
          hasValidAmount = true;
        }
      }
    }
  } catch {
    calculationError = "Format angka tidak valid";
  }

  const fBps = feeBps !== undefined ? BigInt(feeBps as number) : BigInt(0);
  const cTaxBps =
    creatorTaxBps !== undefined ? BigInt(creatorTaxBps as number) : BigInt(0);

  const fee = (quoteInWei * fBps) / BigInt(10000);
  const creatorTax = (quoteInWei * cTaxBps) / BigInt(10000);
  const net = quoteInWei - fee - creatorTax;

  let tokensOut = BigInt(0);
  if (quoteReserve + net > BigInt(0) && net > BigInt(0)) {
    tokensOut = (net * tokenReserve) / (quoteReserve + net);
  }

  const minTokensOut =
    (tokensOut * BigInt(10000 - slippageBps)) / BigInt(10000);

  const isPhaseZero = selectedToken.phase === 0;
  const isButtonDisabled =
    !accountConnected || !isPhaseZero || !hasValidAmount || !!calculationError;

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Menggunakan useEffect yang aman untuk memicu tindakan luar saat transaksi sukses
  useEffect(() => {
    if (isSuccess) {
      refetchTokenBalance();
      onSuccess();
    }
  }, [isSuccess, refetchTokenBalance, onSuccess]);

  const handleBuy = () => {
    if (isButtonDisabled) return;

    // Reset input langsung saat tombol beli diklik
    setQuoteInStr("");

    writeContract({
      address: curveAddr,
      abi: BondingCurveABI,
      functionName: "buy",
      args: [quoteInWei, minTokensOut, userAddress as `0x${string}`],
      value: quoteInWei,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="text-sm text-slate-400 hover:text-white transition"
          >
            ← Kembali
          </button>
          <h2 className="text-lg font-bold">
            Beli Token: {selectedToken.symbol}
          </h2>
        </div>
        <span className="text-xs px-2.5 py-1 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
          Phase 0: Trading
        </span>
      </div>

      {/* Informasi Saldo Token Pengguna */}
      {accountConnected && (
        <div className="bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800 flex justify-between text-xs font-mono">
          <span className="text-slate-400">Saldo Anda saat ini:</span>
          <span className="text-emerald-400 font-bold">
            {tokenBalance ? formatUnits(tokenBalance as bigint, 18) : "0"}{" "}
            {selectedToken.symbol}
          </span>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs text-slate-400 block">
          Jumlah ETH yang Ingin Dibeli (Quote In)
        </label>
        <div className="relative">
          <input
            type="number"
            step="any"
            placeholder="0.0"
            value={quoteInStr}
            onChange={(e) => setQuoteInStr(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 font-mono"
          />
          <span className="absolute right-4 top-3 text-sm text-slate-400 font-medium">
            ETH
          </span>
        </div>
        {calculationError && (
          <p className="text-xs text-red-400">{calculationError}</p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-xs text-slate-400 block">
          Slippage Tolerance
        </label>
        <div className="flex gap-2">
          {[50, 100, 500].map((bps) => (
            <button
              key={bps}
              type="button"
              onClick={() => setSlippageBps(bps)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                slippageBps === bps
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              {bps / 100}%
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
        <div className="flex justify-between text-slate-400">
          <span>Estimasi Token Diterima:</span>
          <span className="text-emerald-400 font-bold">
            {formatUnits(tokensOut, 18)} {selectedToken.symbol}
          </span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Minimum Diterima (Slippage):</span>
          <span className="text-slate-200">
            {formatUnits(minTokensOut, 18)} {selectedToken.symbol}
          </span>
        </div>
      </div>

      <button
        onClick={handleBuy}
        disabled={isButtonDisabled || isPending || isConfirming}
        className={`w-full py-3 rounded-xl font-medium transition text-sm ${
          isButtonDisabled
            ? "bg-slate-800 text-slate-500 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-500 text-white"
        }`}
      >
        {!accountConnected
          ? "Hubungkan Dompet Terlebih Dahulu"
          : !isPhaseZero
            ? "Token Tidak dalam Fase Trading"
            : isPending || isConfirming
              ? "Memproses Transaksi..."
              : "Beli Token"}
      </button>

      {isSuccess && (
        <p className="text-xs text-emerald-400 text-center">
          Pembelian berhasil dilakukan!
        </p>
      )}
    </div>
  );
}
