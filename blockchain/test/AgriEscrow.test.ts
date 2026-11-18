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

describe("AgriEscrow - Tranh chấp (Thành viên B)", function () {
  async function setupShipped() {
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
    await escrow.connect(farmer).confirmShipment(1); // nông dân đã nhận 3 AVAX
    return { ethers, escrow, buyer, farmer, arbitrator, stranger };
  }

  it("6. Người mua mở tranh chấp -> đơn chuyển sang Disputed và có event", async function () {
    const { escrow, buyer } = await setupShipped();

    await expect(escrow.connect(buyer).raiseDispute(1, "Hang bi hu"))
      .to.emit(escrow, "DisputeRaised");

    const order = await escrow.getOrder(1);
    expect(order.status).to.equal(4n); // Disputed
  });

  it("7. Người lạ không được mở tranh chấp", async function () {
    const { escrow, stranger } = await setupShipped();

    await expect(
      escrow.connect(stranger).raiseDispute(1, "Hack")
    ).to.be.revertedWith("Chi nguoi mua hoac nong dan moi co quyen");
  });

  it("8. Chưa giao hàng (Created) thì không mở tranh chấp được", async function () {
    const { ethers } = await network.connect();
    const [buyer, farmer, arbitrator] = await ethers.getSigners();
    const escrow = await ethers.deployContract("AgriEscrow");
    await escrow.connect(buyer).createOrder(
      farmer.address, arbitrator.address, "Xoài", 100,
      { value: ethers.parseEther("1.0") }
    );

    await expect(
      escrow.connect(buyer).raiseDispute(1, "Som qua")
    ).to.be.revertedWith("Don hang chua o trang thai Shipped");
  });

  it("9. Trọng tài xử nông dân thắng -> nông dân nhận 7 AVAX còn lại", async function () {
    const { ethers, escrow, buyer, farmer, arbitrator } = await setupShipped();
    await escrow.connect(buyer).raiseDispute(1, "Hang bi hu");

    const before = await ethers.provider.getBalance(farmer.address);
    await escrow.connect(arbitrator).resolveDispute(1, true); // trọng tài trả gas
    const after = await ethers.provider.getBalance(farmer.address);

    expect(after - before).to.equal(ethers.parseEther("7.0"));

    const order = await escrow.getOrder(1);
    expect(order.status).to.equal(3n); // Completed

    const escrowBalance = await ethers.provider.getBalance(await escrow.getAddress());
    expect(escrowBalance).to.equal(0n);
  });

  it("10. Trọng tài xử người mua thắng -> người mua được hoàn 7 AVAX", async function () {
    const { ethers, escrow, buyer, farmer, arbitrator } = await setupShipped();
    await escrow.connect(farmer).raiseDispute(1, "Nguoi mua khong chiu nhan"); // nông dân mở

    const before = await ethers.provider.getBalance(buyer.address);
    await escrow.connect(arbitrator).resolveDispute(1, false);
    const after = await ethers.provider.getBalance(buyer.address);

    expect(after - before).to.equal(ethers.parseEther("7.0"));

    const order = await escrow.getOrder(1);
    expect(order.status).to.equal(3n); // Completed
  });

  it("11. Người không phải trọng tài không được xử tranh chấp", async function () {
    const { escrow, buyer } = await setupShipped();
    await escrow.connect(buyer).raiseDispute(1, "Hang bi hu");

    await expect(
      escrow.connect(buyer).resolveDispute(1, false)
    ).to.be.revertedWith("Chi trong tai moi co quyen");
  });

  it("12. Không xử được khi chưa có tranh chấp, và không xử được hai lần", async function () {
    const { escrow, buyer, arbitrator } = await setupShipped();

    // Chưa có tranh chấp
    await expect(
      escrow.connect(arbitrator).resolveDispute(1, true)
    ).to.be.revertedWith("Don hang khong o trang thai Disputed");

    // Xử lần 1 xong thì lần 2 bị chặn
    await escrow.connect(buyer).raiseDispute(1, "Hang bi hu");
    await escrow.connect(arbitrator).resolveDispute(1, true);

    await expect(
      escrow.connect(arbitrator).resolveDispute(1, true)
    ).to.be.revertedWith("Don hang khong o trang thai Disputed");
  });
});