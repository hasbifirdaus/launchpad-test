import { createPublicClient, http, parseAbiItem } from "viem";
import { robinhoodTestnet } from "@/config/chain";

const publicClient = createPublicClient({
  chain: robinhoodTestnet,
  transport: http(),
});

const FACTORY_ADDRESS = "0x533cE670f1372cb402D49866608b92e7bc2b4493";
const DEPLOY_BLOCK = BigInt(129157568);

export async function getTokenList() {
  try {
    const currentBlock = await publicClient.getBlockNumber();
    const CHUNK_SIZE = BigInt(50000);
    const allLogs = [];

    for (
      let fromBlock = DEPLOY_BLOCK;
      fromBlock < currentBlock;
      fromBlock += CHUNK_SIZE + BigInt(1)
    ) {
      const toBlock =
        fromBlock + CHUNK_SIZE > currentBlock
          ? currentBlock
          : fromBlock + CHUNK_SIZE;

      const logs = await publicClient.getLogs({
        address: FACTORY_ADDRESS,
        event: parseAbiItem(
          "event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold)",
        ),
        fromBlock,
        toBlock,
      });
      allLogs.push(...logs);
    }

    const tokens = allLogs.map((log) => {
      const args = (
        log as {
          args: {
            token: string;
            curve: string;
            pairToken: string;
            graduationThreshold: bigint;
          };
        }
      ).args;
      return {
        tokenAddress: args.token,
        curveAddress: args.curve,
        pairToken: args.pairToken,
        graduationThreshold: args.graduationThreshold,
      };
    });

    return tokens;
  } catch (error) {
    console.error("Gagal mengambil daftar token:", error);
    throw error;
  }
}
