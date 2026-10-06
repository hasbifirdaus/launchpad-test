"use client";

import React, { useState, useEffect } from "react";
import { parseUnits, formatUnits, erc20Abi } from "viem";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import BondingCurveABI from "@/abi/BondingCurve.json";
import { TokenDetail } from "@/services/getTokenDetails";

interface SellFormProps {
  selectedToken: TokenDetail;
  onBack: () => void;
}

export default function SellForm({ selectedToken, onBack }: SellFormProps) {
  // Ambil address user dan status koneksi dompet
  const { address: userAddress, isConnected: accountConnected } = useAccount();

  const [tokenInStr, setTokenInStr] = useState<string>("");
  const [slippageBps, setSlippageBps] = useState<number>(100);

  const curveAddr = selectedToken.curveAddress as `0x${string}`;
  const tokenAddr = selectedToken.tokenAddress as `0x${string}`;

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

  let tokenInWei = BigInt(0);
  let hasValidAmount = false;
  let calculationError = "";

  const tokenDecimals = 18;

  try {
    if (tokenInStr && tokenInStr.trim() !== "" && !isNaN(Number(tokenInStr))) {
      const decimalParts = tokenInStr.split(".");
      if (decimalParts[1] && decimalParts[1].length > tokenDecimals) {
        calculationError = `Maksimal ${tokenDecimals} desimal`;
      } else {
        tokenInWei = parseUnits(tokenInStr, tokenDecimals);
        if (tokenInWei > BigInt(0)) {
          hasValidAmount = true;
        }
      }
    }
  } catch {
    calculationError = "Format angka tidak valid";
  }

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddr,
    abi: erc20Abi,
    functionName: "allowance",
    args: userAddress ? [userAddress, curveAddr] : undefined,
    query: {
      enabled: !!userAddress && !!tokenAddr,
    },
  });

  const currentAllowance =
    allowance !== undefined ? BigInt(allowance as bigint) : BigInt(0);

  const needsApproval = hasValidAmount && currentAllowance < tokenInWei;

  let rawQuoteOut = BigInt(0);
  if (tokenReserve + tokenInWei > BigInt(0) && tokenInWei > BigInt(0)) {
    rawQuoteOut = (tokenInWei * quoteReserve) / (tokenReserve + tokenInWei);
  }

  const fBps = feeBps !== undefined ? BigInt(feeBps as number) : BigInt(0);
  const cTaxBps =
    creatorTaxBps !== undefined ? BigInt(creatorTaxBps as number) : BigInt(0);

  const fee = (rawQuoteOut * fBps) / BigInt(10000);
  const creatorTax = (rawQuoteOut * cTaxBps) / BigInt(10000);
  const netQuoteOut = rawQuoteOut - fee - creatorTax;

  const minQuoteOut =
    (netQuoteOut < BigInt(0)
      ? BigInt(0)
      : netQuoteOut * BigInt(10000 - slippageBps)) / BigInt(10000);

  const isPhaseZero = Number(selectedToken.phase) === 0;
  const isButtonDisabled =
    !accountConnected || !isPhaseZero || !hasValidAmount || !!calculationError;

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  useEffect(() => {
    if (isSuccess) {
      refetchAllowance();
    }
  }, [isSuccess, refetchAllowance]);

  const handleApprove = () => {
    if (!tokenInWei) return;
    writeContract({
      address: tokenAddr,
      abi: erc20Abi,
      functionName: "approve",
      args: [curveAddr, tokenInWei],
    });
  };

  const handleSell = () => {
    if (isButtonDisabled) return;

    writeContract({
      address: curveAddr,
      abi: BondingCurveABI,
      functionName: "sell",
      args: [tokenInWei, minQuoteOut],
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
            Jual Token: {selectedToken.symbol}
          </h2>
        </div>
        <span className="text-xs px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
          Phase 0: Trading
        </span>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-slate-400 block">
          Jumlah Token yang Ingin Dijual
        </label>
        <div className="relative">
          <input
            type="number"
            step="any"
            placeholder="0.0"
            value={tokenInStr}
            onChange={(e) => setTokenInStr(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 font-mono"
          />
          <span className="absolute right-4 top-3 text-sm text-slate-400 font-medium">
            {selectedToken.symbol}
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
                  ? "bg-amber-600 border-amber-500 text-white"
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
          <span>Estimasi ETH Diterima:</span>
          <span className="text-emerald-400 font-bold">
            {formatUnits(netQuoteOut > BigInt(0) ? netQuoteOut : BigInt(0), 18)}{" "}
            ETH
          </span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Minimum ETH Diterima (Slippage):</span>
          <span className="text-slate-200">
            {formatUnits(minQuoteOut, 18)} ETH
          </span>
        </div>
      </div>

      {!accountConnected ? (
        <button
          disabled
          className="w-full py-3 rounded-xl font-medium transition text-sm bg-slate-800 text-slate-500 cursor-not-allowed"
        >
          Hubungkan Dompet Terlebih Dahulu
        </button>
      ) : !isPhaseZero ? (
        <button
          disabled
          className="w-full py-3 rounded-xl font-medium transition text-sm bg-slate-800 text-slate-500 cursor-not-allowed"
        >
          Token Tidak dalam Fase Trading
        </button>
      ) : needsApproval ? (
        <button
          onClick={handleApprove}
          disabled={isPending || isConfirming || !hasValidAmount}
          className="w-full py-3 rounded-xl font-medium transition text-sm bg-blue-600 hover:bg-blue-500 text-white"
        >
          {isPending || isConfirming
            ? "Memproses Approve..."
            : `Approve ${selectedToken.symbol}`}
        </button>
      ) : (
        <button
          onClick={handleSell}
          disabled={isButtonDisabled || isPending || isConfirming}
          className={`w-full py-3 rounded-xl font-medium transition text-sm ${
            isButtonDisabled
              ? "bg-slate-800 text-slate-500 cursor-not-allowed"
              : "bg-amber-600 hover:bg-amber-500 text-white"
          }`}
        >
          {isPending || isConfirming ? "Memproses Transaksi..." : "Jual Token"}
        </button>
      )}

      {isSuccess && (
        <p className="text-xs text-emerald-400 text-center">
          Transaksi berhasil dilakukan!
        </p>
      )}
    </div>
  );
}
