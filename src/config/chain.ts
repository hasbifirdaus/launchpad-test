import { defineChain } from "viem";

export const robinhoodTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["https://robinhood-sepolia-rpc.publicnode.com"],
    },
  },
  blockExplorers: {
    default: {
      name: "Explorer",
      url: "https://explorer.testnet.chain.robinhood.com",
    },
  },
  contracts: {
    multicall3: {
      address: "0xca11bde05977b3631167028862be2a173976ca11",
      blockCreated: 0,
    },
  },
  testnet: true,
});
