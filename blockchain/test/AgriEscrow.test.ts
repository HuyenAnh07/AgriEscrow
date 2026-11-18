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

describe("AgriEscrow - confirmDelivery (Thành viên B)", function () {
  async function setup() {
    const { ethers } = await network.connect();
    const [buyer, farmer, arbitrator, stranger] = await ethers.getSigners();
    const escrow = await ethers.deployContract("AgriEscrow");

    await escrow.connect(buyer).createOrder(
      farmer.address,
      arbitrator.address,
      "Sầu riêng Ri6",
      500,
      { value: ethers.parseEther("10.0") }
    );
    return { ethers, escrow, buyer, farmer, arbitrator, stranger };
  }

  it("2. Người mua xác nhận nhận hàng -> nông dân nhận nốt 7 AVAX, đơn Completed", async function () {
    const { ethers, escrow, buyer, farmer } = await setup();

    await escrow.connect(farmer).confirmShipment(1);

    const before = await ethers.provider.getBalance(farmer.address);
    await escrow.connect(buyer).confirmDelivery(1); // buyer trả gas, farmer không mất gas
    const after = await ethers.provider.getBalance(farmer.address);

    expect(after - before).to.equal(ethers.parseEther("7.0"));

    const order = await escrow.getOrder(1);
    expect(order.status).to.equal(3n); // Completed

    // Contract không còn giữ AVAX nào
    const escrowBalance = await ethers.provider.getBalance(await escrow.getAddress());
    expect(escrowBalance).to.equal(0n);
  });

  it("3. Người lạ không được xác nhận nhận hàng", async function () {
    const { escrow, farmer, stranger } = await setup();
    await escrow.connect(farmer).confirmShipment(1);

    await expect(
      escrow.connect(stranger).confirmDelivery(1)
    ).to.be.revertedWith("Chi nguoi mua moi co quyen");
  });

  it("4. Chưa giao hàng (Created) thì không xác nhận nhận hàng được", async function () {
    const { escrow, buyer } = await setup();

    await expect(
      escrow.connect(buyer).confirmDelivery(1)
    ).to.be.revertedWith("Don hang chua o trang thai Shipped");
  });

  it("5. Không thể xác nhận nhận hàng hai lần (chống rút tiền 2 lần)", async function () {
    const { escrow, buyer, farmer } = await setup();
    await escrow.connect(farmer).confirmShipment(1);
    await escrow.connect(buyer).confirmDelivery(1);

    await expect(
      escrow.connect(buyer).confirmDelivery(1)
    ).to.be.revertedWith("Don hang chua o trang thai Shipped");
  });
});