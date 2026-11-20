import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.34",
      },
      production: {
        version: "0.8.34",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
  hardhatMainnet: { type: "edr-simulated", chainType: "l1" },
  hardhatOp: { type: "edr-simulated", chainType: "op" },
  localhost: {
    type: "http",
    chainType: "l1",
    url: "http://127.0.0.1:8545",
  },
  fuji: {
    type: "http",
    chainType: "l1",
    url: "https://api.avax-test.network/ext/bc/C/rpc",
    chainId: 43113,
    accounts: [configVariable("FUJI_PRIVATE_KEY")],
  },
 },
});
