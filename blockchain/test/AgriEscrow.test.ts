import { expect } from "chai";
import { network } from "hardhat";

describe("AgriEscrow - Phần việc Thành viên A", function () {
  it("1. Tạo đơn, khóa 10 AVAX và tự động giải ngân 30% (3 AVAX) khi giao hàng", async function () {
    const { ethers } = await network.connect();
    const [buyer, farmer, arbitrator, stranger] = await ethers.getSigners();

    const escrow = await ethers.deployContract("AgriEscrow");
    const lockAmount = ethers.parseEther("10.0");

    // 1. Người mua tạo đơn & khóa 10 AVAX
    await escrow.connect(buyer).createOrder(
      farmer.address,
      arbitrator.address,
      "Sầu riêng Ri6",
      500,
      { value: lockAmount }
    );

    let order = await escrow.getOrder(1);
    expect(order.totalAmount).to.equal(lockAmount);
    expect(order.status).to.equal(0n); // Created

    // 2. Chặn người lạ xác nhận giao hàng
    await expect(
      escrow.connect(stranger).confirmShipment(1)
    ).to.be.revertedWith("Chi nong dan moi co quyen");

    // 3. Nông dân xác nhận giao -> nhận ngay 3 AVAX (30%)
    const farmerBalanceBefore = await ethers.provider.getBalance(farmer.address);
    const tx = await escrow.connect(farmer).confirmShipment(1);
    const receipt = await tx.wait();
    const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
    const farmerBalanceAfter = await ethers.provider.getBalance(farmer.address);

    expect(farmerBalanceAfter - farmerBalanceBefore + gasUsed).to.equal(
      ethers.parseEther("3.0")
    );

    order = await escrow.getOrder(1);
    expect(order.status).to.equal(1n); // Shipped
    expect(order.advancePaid).to.equal(ethers.parseEther("3.0"));
  });
});