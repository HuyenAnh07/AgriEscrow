import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("AgriEscrowModule", (m) => {
  const agriEscrow = m.contract("AgriEscrow");
  return { agriEscrow };
});