import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import FarmerAndPaymentView from "./components/FarmerAndPaymentView";
import BuyerDeliveryAndArbitratorView from "./components/BuyerDeliveryAndArbitratorView";
import TraceabilityView from "./components/TraceabilityView";

const CONTRACT_ADDRESS = "0xd1C8fDce7B4E97FcF67b7432A53a858d672c5807";
const FUJI_CHAIN_ID = "0xa869"; // 43113 in hex

const CONTRACT_ABI = [
  "function orderCounter() view returns (uint256)",
  "function createOrder(address _farmer, address _arbitrator, string _productName, uint256 _quantityKg) payable returns (uint256)",
  "function confirmShipment(uint256 _orderId)",
  "function confirmDelivery(uint256 _orderId)",
  "function raiseDispute(uint256 _orderId, string _reason)",
  "function resolveDispute(uint256 _orderId, bool _favorFarmer)",
  "function getOrder(uint256 _orderId) view returns (tuple(uint256 id, address buyer, address farmer, address arbitrator, string productName, uint256 quantityKg, uint256 totalAmount, uint256 advancePaid, uint8 status, uint256 createdAt, uint256 shippedAt))",
  "event ShipmentConfirmed(uint256 indexed orderId, address indexed farmer, uint256 advanceAmount)",
  "event DeliveryConfirmed(uint256 indexed orderId, address indexed buyer, uint256 remainingAmount)",
  "event DisputeRaised(uint256 indexed orderId, address indexed raisedBy, string reason)",
  "event DisputeResolved(uint256 indexed orderId, address indexed arbitrator, bool favorFarmer, uint256 amount)",
  "event OrderCompleted(uint256 indexed orderId)"
];

const STATUS_LABELS = [
  "Đã khóa tiền (Created)",
  "Đang giao - Đã ứng 30% (Shipped)",
  "Đã nhận hàng",
  "Hoàn tất",
  "Tranh chấp"
];

export default function BuyerPortal() {
  const [account, setAccount] = useState("");
  const [contract, setContract] = useState(null);
  const [orders, setOrders] = useState([]);
  const [rawOrders, setRawOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState(false);

  const [activeTab, setActiveTab] = useState("portalA"); // 'portalA' | 'farmerB' | 'deliveryArbB' | 'traceB'
  const [traceId, setTraceId] = useState(1);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qrId = params.get("traceId");
    if (qrId) {
      setTraceId(Number(qrId));
      setActiveTab("traceB");
    }
  }, []);

  const [form, setForm] = useState({
    farmerAddress: "",
    arbitratorAddress: "",
    productName: "",
    quantityKg: "",
    avaxAmount: ""
  });

  // 1. Kết nối ví & tự động chuyển sang mạng Avalanche Fuji
  const connectWallet = async () => {
    if (!window.ethereum) return alert("Vui lòng cài đặt MetaMask hoặc Core Wallet!");
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);

      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: FUJI_CHAIN_ID }],
        });
      } catch (switchError) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: FUJI_CHAIN_ID,
              chainName: "Avalanche Fuji C-Chain",
              nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
              rpcUrls: ["https://api.avax-test.network/ext/bc/C/rpc"],
              blockExplorerUrls: ["https://testnet.snowtrace.io/"]
            }]
          });
        }
      }

      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const escrowContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      setAccount(address);
      setContract(escrowContract);
      loadOrders(escrowContract);
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối ví: " + err.message);
    }
  };

  // Tải danh sách đơn hàng từ Smart Contract
  const loadOrders = async (escrowContract = contract) => {
    if (!escrowContract) return;
    try {
      const count = await escrowContract.orderCounter();
      const list = [];
      const rawList = [];
      for (let i = Number(count); i >= 1; i--) {
        const o = await escrowContract.getOrder(i);
        rawList.push(o);
        list.push({
          id: Number(o.id),
          buyer: o.buyer,
          farmer: o.farmer,
          arbitrator: o.arbitrator,
          productName: o.productName,
          quantityKg: Number(o.quantityKg),
          totalAmount: ethers.formatEther(o.totalAmount),
          advancePaid: ethers.formatEther(o.advancePaid),
          status: Number(o.status)
        });
      }
      setRawOrders(rawList);
      setOrders(list);
      if (list.length > 0) setSelectedOrder(list[0]);
    } catch (err) {
      console.error("Lỗi tải đơn hàng:", err);
    }
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!contract) return alert("Hãy kết nối ví trước!");
    setLoading(true);
    setTxHash("");
    try {
      const tx = await contract.createOrder(
        form.farmerAddress,
        form.arbitratorAddress,
        form.productName,
        form.quantityKg,
        { value: ethers.parseEther(form.avaxAmount) }
      );
      setTxHash(tx.hash);
      await tx.wait();
      alert("Tạo đơn hàng và khóa tiền AVAX thành công!");
      setForm({ farmerAddress: "", arbitratorAddress: "", productName: "", quantityKg: "", avaxAmount: "" });
      loadOrders(contract);
    } catch (err) {
      alert("Giao dịch thất bại: " + (err.reason || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmShipment = async (orderId) => {
    if (!contract) return;
    setLoading(true);
    setTxHash("");
    try {
      const tx = await contract.confirmShipment(orderId);
      setTxHash(tx.hash);
      await tx.wait();
      alert("Đã xác nhận giao hàng! 30% tiền ứng trước đã chuyển tới ví Nông dân.");
      loadOrders(contract);
    } catch (err) {
      alert("Lỗi xác nhận giao hàng: " + (err.reason || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenTrace = (id) => {
    setTraceId(id);
    setActiveTab("traceB");
  };

  const navTabs = [
    { id: "portalA", label: "1. Tạo Đơn & Giao Hàng" },
    { id: "farmerB", label: "2. Dashboard Nông Dân & QR" },
    { id: "deliveryArbB", label: "3. Nhận Hàng & Trọng Tài" },
    { id: "traceB", label: "4. Truy Xuất Nguồn Gốc" }
  ];

  return (
    <div style={{ width: "100%", minHeight: "100vh", background: "#FAF8FF", fontFamily: "Inter, system-ui, sans-serif", display: "flex", flexDirection: "column", color: "#131B2E" }}>
      {/* HEADER 2 TẦNG CỐ ĐỊNH TRÊN CÙNG */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255, 255, 255, 0.92)", backdropFilter: "blur(16px)", borderBottom: "1px solid #E2E8F0" }}>
        {/* Tầng 1: Logo & Ví */}
        <div style={{ maxWidth: 1360, margin: "0 auto", height: 64, padding: "0 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, background: "#A4F1B2", borderRadius: 8, display: "flex", justifyContent: "center", alignItems: "center", fontSize: 18 }}>
              🌿
            </div>
            <span style={{ color: "#00652C", fontSize: 18, fontWeight: 700 }}>AgriEscrow</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ padding: "6px 12px", background: "#F2F3FF", borderRadius: 9999, display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontFamily: "JetBrains Mono, monospace", color: "#3F493F", fontWeight: 500 }}>
              <span style={{ width: 8, height: 8, background: "#AE121F", borderRadius: "50%" }} />
              Avalanche Fuji
            </div>

            <button
              onClick={connectWallet}
              style={{
                padding: "7px 14px",
                background: account ? "#FFFFFF" : "#15803D",
                color: account ? "#131B2E" : "#FFFFFF",
                border: account ? "1px solid #CBD5E1" : "none",
                borderRadius: 9999,
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                fontFamily: "JetBrains Mono, monospace",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)"
              }}
            >
              <span style={{ width: 8, height: 8, background: account ? "#15803D" : "#FACC15", borderRadius: "50%" }} />
              {account ? `Ví: ${account.slice(0, 6)}...${account.slice(-4)}` : "Kết nối Ví Avalanche"}
            </button>
          </div>
        </div>

        {/* Tầng 2: 4 Tab điều hướng */}
        <nav style={{ background: "rgba(242, 243, 255, 0.65)", borderTop: "1px solid #E2E8F0", padding: "10px 0" }}>
          <div style={{ maxWidth: 1360, margin: "0 auto", padding: "0 32px", display: "flex", alignItems: "center", gap: 8, overflowX: "auto" }}>
            {navTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: isActive ? "#15803D" : "transparent",
                    color: isActive ? "#FFFFFF" : "#3F493F",
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 500,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    boxShadow: isActive ? "0 1px 2px rgba(0,0,0,0.08)" : "none"
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* NỘI DUNG CHÍNH */}
      <main style={{ flex: 1, width: "100%", maxWidth: 1360, margin: "0 auto", padding: "24px 32px", display: "flex", flexDirection: "column", gap: 24, boxSizing: "border-box" }}>
        {/* Thông báo Transaction Hash trên Explorer */}
        {txHash && (
          <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", padding: "12px 16px", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
            <span>
              <strong>✅ Giao dịch đã gửi lên Fuji Testnet:</strong>{" "}
              <a href={`https://testnet.snowtrace.io/tx/${txHash}`} target="_blank" rel="noreferrer" style={{ color: "#15803D", fontWeight: 600 }}>
                Xem trên Avalanche Explorer ({txHash.slice(0, 14)}...)
              </a>
            </span>
            <button onClick={() => setTxHash("")} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#3F493F" }}>✕</button>
          </div>
        )}

        {/* TAB 1: TẠO ĐƠN & GIAO HÀNG */}
        {activeTab === "portalA" && (
          <>
            {/* Banner thông tin Smart Contract */}
            <div style={{ padding: 20, background: "#FFFFFF", borderRadius: 12, boxShadow: "0 1px 2px rgba(0,0,0,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 48, height: 48, background: "rgba(164, 241, 178, 0.6)", borderRadius: 12, display: "flex", justifyContent: "center", alignItems: "center", fontSize: 22 }}>
                  🛡️
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ color: "#131B2E", fontSize: 16, fontWeight: 700 }}>Khởi Tạo & Ký Quỹ Đơn Nông Sản</span>
                    <span style={{ padding: "2px 10px", background: "rgba(164, 241, 178, 0.7)", borderRadius: 9999, color: "#1F6C3A", fontSize: 11, fontWeight: 600 }}>
                      EVM v0.8.24 Verified
                    </span>
                  </div>
                  <p style={{ margin: "4px 0 0", color: "#3F493F", fontSize: 12 }}>
                    Phân rã thanh toán 2 kỳ (30/70) đảm bảo rủi ro tối thiểu qua Multi-sig Escrow Vault
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ padding: "6px 12px", background: "#F2F3FF", borderRadius: 8, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "#3F493F", fontWeight: 500 }}>Contract:</span>
                  <span style={{ color: "#131B2E", fontFamily: "JetBrains Mono, monospace", fontWeight: 600 }}>0xd1C8...5807</span>
                </div>
                <div style={{ padding: "6px 12px", background: "#F2F3FF", borderRadius: 8, fontSize: 12, fontFamily: "JetBrains Mono, monospace", color: "#3F493F", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, background: "#15803D", borderRadius: "50%" }} />
                  Fuji C-Chain
                </div>
              </div>
            </div>

            {/* Lưới 2 cột: Form Tạo Đơn (Trái) & Danh Sách Đơn Hàng (Phải) */}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(360px, 420px) 1fr", gap: 24, alignItems: "start" }}>
              {/* CỘT TRÁI: FORM TẠO ĐƠN */}
              <form onSubmit={handleCreateOrder} style={{ padding: 24, background: "#FFFFFF", borderRadius: 12, boxShadow: "0 1px 2px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <h3 style={{ margin: 0, color: "#131B2E", fontSize: 16, fontWeight: 700 }}>🌱 Tạo Đơn Hàng Ký Quỹ Mới</h3>
                  <p style={{ margin: "4px 0 0", color: "#3F493F", fontSize: 12 }}>Khởi tạo Smart Contract và ký quỹ AVAX an toàn</p>
                </div>

                {/* Tên nông sản */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: "#131B2E" }}>Tên nông sản</label>
                    <span style={{ padding: "2px 8px", background: "rgba(164, 241, 178, 0.4)", borderRadius: 4, color: "#1F6C3A", fontSize: 11, fontWeight: 600 }}>
                      VietGAP / GlobalGAP
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    value={form.productName}
                    onChange={(e) => setForm({ ...form, productName: e.target.value })}
                    placeholder="VD: Sầu riêng Ri6"
                    style={inputStyle}
                  />
                </div>

                {/* Khối lượng */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#131B2E" }}>Khối lượng thương phẩm</label>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <input
                      type="number"
                      required
                      value={form.quantityKg}
                      onChange={(e) => setForm({ ...form, quantityKg: e.target.value })}
                      placeholder="100"
                      style={{ ...inputStyle, width: "100%", paddingRight: 52 }}
                    />
                    <span style={{ position: "absolute", right: 10, padding: "2px 8px", background: "#EAEDFF", borderRadius: 4, color: "#3F493F", fontSize: 12, fontFamily: "JetBrains Mono, monospace", fontWeight: 600 }}>
                      KG
                    </span>
                  </div>
                </div>

                {/* Ví Nông dân */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: "#131B2E" }}>Địa chỉ ví Nông dân</label>
                    <span style={{ color: "#00652C", fontSize: 11, fontWeight: 600 }}>✓ Hợp tác xã xác thực</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={form.farmerAddress}
                    onChange={(e) => setForm({ ...form, farmerAddress: e.target.value })}
                    placeholder="0x8196..."
                    style={{ ...inputStyle, fontSize: 12, fontFamily: "JetBrains Mono, monospace" }}
                  />
                </div>

                {/* Ví Trọng tài */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: "#131B2E" }}>Địa chỉ ví Trọng tài / Giám định</label>
                    <span style={{ padding: "2px 8px", background: "rgba(226, 231, 255, 0.6)", borderRadius: 4, color: "#3F493F", fontSize: 11 }}>
                      Kiểm định độc lập
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    value={form.arbitratorAddress}
                    onChange={(e) => setForm({ ...form, arbitratorAddress: e.target.value })}
                    placeholder="0x1E6c..."
                    style={{ ...inputStyle, fontSize: 12, fontFamily: "JetBrains Mono, monospace" }}
                  />
                </div>

                {/* Tổng tiền AVAX */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#131B2E" }}>Tổng tiền khóa Escrow (AVAX)</label>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <input
                      type="number"
                      step="0.001"
                      required
                      value={form.avaxAmount}
                      onChange={(e) => setForm({ ...form, avaxAmount: e.target.value })}
                      placeholder="0.1"
                      style={{ ...inputStyle, width: "100%", paddingRight: 68, fontFamily: "JetBrains Mono, monospace" }}
                    />
                    <span style={{ position: "absolute", right: 8, padding: "4px 10px", background: "#AE121F", borderRadius: 6, color: "#FFFFFF", fontSize: 12, fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                      AVAX
                    </span>
                  </div>
                </div>

                {/* Khung tính tự động 30% / 70% */}
                <div style={{ padding: 14, background: "#F2F3FF", borderRadius: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "#131B2E", fontWeight: 500 }}>• Giai đoạn 1 (30% Xuất kho):</span>
                    <span style={{ color: "#1F6C3A", fontFamily: "JetBrains Mono, monospace", fontWeight: 600 }}>
                      {(Number(form.avaxAmount || 0) * 0.3).toFixed(3)} AVAX
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "#131B2E", fontWeight: 500 }}>• Giai đoạn 2 (70% Nhận hàng):</span>
                    <span style={{ color: "#00652C", fontFamily: "JetBrains Mono, monospace", fontWeight: 600 }}>
                      {(Number(form.avaxAmount || 0) * 0.7).toFixed(3)} AVAX
                    </span>
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "#3F493F", lineHeight: 1.4 }}>
                    ℹ️ Tiền ký quỹ sẽ được khóa trong hợp đồng Escrow cho tới khi các bên kích hoạt chữ ký.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{ height: 44, background: "#15803D", color: "#FFFFFF", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }}
                >
                  {loading ? "⏳ Đang xử lý Blockchain..." : "🔒 Tạo Đơn & Khóa AVAX"}
                </button>

                <div style={{ padding: 12, background: "rgba(164, 241, 178, 0.4)", borderRadius: 8 }}>
                  <div style={{ color: "#24703E", fontSize: 12, fontWeight: 700 }}>Cơ chế Bảo chứng Nông hộ</div>
                  <div style={{ color: "#3F493F", fontSize: 12, marginTop: 2 }}>
                    Nông dân nhận ngay 30% kinh phí thu hái & vận tải khi container xuất phát.
                  </div>
                </div>
              </form>

              {/* CỘT PHẢI: DANH SÁCH ĐƠN HÀNG & GIẢI NGÂN */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <h2 style={{ margin: 0, color: "#131B2E", fontSize: 20, fontWeight: 700 }}>Danh Sách Đơn Hàng & Giải Ngân</h2>
                    <span style={{ padding: "2px 10px", background: "#A4F1B2", borderRadius: 9999, color: "#1F6C3A", fontSize: 12, fontFamily: "JetBrains Mono, monospace", fontWeight: 600 }}>
                      {orders.length} Đơn
                    </span>
                  </div>
                  <button
                    onClick={() => loadOrders(contract)}
                    style={{ padding: "6px 12px", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}
                  >
                    ↻ Làm mới
                  </button>
                </div>

                {orders.length === 0 ? (
                  <div style={{ padding: 48, background: "#FFFFFF", borderRadius: 12, textAlign: "center", color: "#3F493F", fontSize: 14, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                    Chưa có đơn hàng nào. Hãy bấm <strong>Kết nối Ví Avalanche</strong> ở góc trên hoặc tạo đơn mới bên cột trái.
                  </div>
                ) : (
                  orders.map((order) => {
                    const remainEth = (Number(order.totalAmount) * 0.7).toFixed(3);
                    const isCompleted = order.status === 3;
                    const progressPercent = order.status === 0 ? "33%" : order.status === 1 ? "66%" : "100%";

                    return (
                      <div
                        key={order.id}
                        onClick={() => setSelectedOrder(order)}
                        style={{
                          background: "#FFFFFF",
                          borderRadius: 12,
                          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                          border: selectedOrder?.id === order.id ? "1.5px solid #15803D" : "1px solid transparent",
                          overflow: "hidden",
                          cursor: "pointer"
                        }}
                      >
                        {/* Card Header */}
                        <div style={{ padding: "18px 24px", background: "rgba(242, 243, 255, 0.5)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <span style={{ color: "#131B2E", fontSize: 16, fontWeight: 700 }}>
                              Lô #{order.id} — {order.productName} ({order.quantityKg} kg)
                            </span>
                            <span
                              style={{
                                padding: "3px 10px",
                                background: isCompleted ? "#A4F1B2" : order.status === 4 ? "#FEE2E2" : "#FEF3C7",
                                color: isCompleted ? "#00652C" : order.status === 4 ? "#B91C1C" : "#B45309",
                                borderRadius: 9999,
                                fontSize: 11,
                                fontWeight: 600
                              }}
                            >
                              • {STATUS_LABELS[order.status]}
                            </span>
                          </div>
                          <span style={{ padding: "4px 10px", background: "#FFFFFF", borderRadius: 4, color: "#00652C", fontSize: 12, fontFamily: "JetBrains Mono, monospace", fontWeight: 600, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                            Fuji Escrow #{String(order.id).padStart(3, "0")}
                          </span>
                        </div>

                        {/* Card Body */}
                        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                          {/* 3 cột tiền */}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                            <div style={{ padding: 14, background: "#F2F3FF", borderRadius: 8 }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: "#3F493F" }}>TỔNG KÝ QUỸ</div>
                              <div style={{ fontSize: 15, fontFamily: "JetBrains Mono, monospace", fontWeight: 600, color: "#131B2E", marginTop: 4 }}>
                                {Number(order.totalAmount).toFixed(3)} AVAX
                              </div>
                            </div>
                            <div style={{ padding: 14, background: "rgba(164, 241, 178, 0.3)", borderRadius: 8 }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: "#1F6C3A" }}>ỨNG TRƯỚC 30%</div>
                              <div style={{ fontSize: 15, fontFamily: "JetBrains Mono, monospace", fontWeight: 600, color: "#1F6C3A", marginTop: 4 }}>
                                {(Number(order.totalAmount) * 0.3).toFixed(3)} AVAX
                              </div>
                              <div style={{ fontSize: 11, color: "#3F493F", marginTop: 2 }}>
                                {order.status >= 1 ? "Đã giải ngân" : "Chưa giải ngân"}
                              </div>
                            </div>
                            <div style={{ padding: 14, background: "#F2F3FF", borderRadius: 8 }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: "#3F493F" }}>CÒN LẠI 70%</div>
                              <div style={{ fontSize: 15, fontFamily: "JetBrains Mono, monospace", fontWeight: 600, color: "#131B2E", marginTop: 4 }}>
                                {remainEth} AVAX
                              </div>
                              <div style={{ fontSize: 11, color: "#3F493F", marginTop: 2 }}>
                                {isCompleted ? "Đã tất toán" : "Giữ trong Escrow"}
                              </div>
                            </div>
                          </div>

                          {/* Các bên tham gia Multi-sig */}
                          <div style={{ padding: 14, background: "rgba(242, 243, 255, 0.6)", borderRadius: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                              <span style={{ fontWeight: 600, color: "#131B2E" }}>Các bên tham gia Multi-sig Escrow</span>
                              <span style={{ fontFamily: "JetBrains Mono, monospace", color: "#1F6C3A", fontWeight: 500 }}>Quorum: 2/3 Signatures</span>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8, fontSize: 12, fontFamily: "JetBrains Mono, monospace" }}>
                              <div style={{ padding: "8px 10px", background: "#FFFFFF", borderRadius: 4, display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "#3F493F" }}>Người mua:</span>
                                <strong>{order.buyer.slice(0, 6)}...{order.buyer.slice(-4)}</strong>
                              </div>
                              <div style={{ padding: "8px 10px", background: "#FFFFFF", borderRadius: 4, display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "#3F493F" }}>Nông dân:</span>
                                <strong>{order.farmer.slice(0, 6)}...{order.farmer.slice(-4)}</strong>
                              </div>
                              {order.arbitrator && (
                                <div style={{ padding: "8px 10px", background: "#FFFFFF", borderRadius: 4, display: "flex", justifyContent: "space-between" }}>
                                  <span style={{ color: "#3F493F" }}>Trọng tài:</span>
                                  <strong>{order.arbitrator.slice(0, 6)}...{order.arbitrator.slice(-4)}</strong>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Thanh tiến độ thanh toán 2 pha */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600 }}>
                              <span>Tiến độ thanh toán 2 pha</span>
                              <span style={{ color: "#00652C" }}>{order.status === 0 ? "Giai đoạn 1/2" : "Giai đoạn 2/2"}</span>
                            </div>
                            <div style={{ height: 8, background: "#E2E7FF", borderRadius: 9999, overflow: "hidden" }}>
                              <div style={{ width: progressPercent, height: "100%", background: "#15803D", borderRadius: 9999 }} />
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#3F493F" }}>
                              <span>Đã khóa Vault</span>
                              <span>Xuất kho (30%)</span>
                              <span>Nghiệm thu (70%)</span>
                            </div>
                          </div>

                          {/* Nút hành động */}
                          {order.status === 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleConfirmShipment(order.id);
                                }}
                                disabled={loading}
                                style={{ height: 44, background: "#15803D", color: "#FFFFFF", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer" }}
                              >
                                🚚 Xác Nhận Đã Giao Hàng (Giải Ngân 30%)
                              </button>
                              <div style={{ textAlign: "center", fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: "#3F493F" }}>
                                Kích hoạt chuyển ngay {(Number(order.totalAmount) * 0.3).toFixed(3)} AVAX vào ví nông dân
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}

        {/* TAB 2, 3, 4: GIAO DIỆN CỦA THÀNH VIÊN B */}
        {activeTab === "farmerB" && (
          <FarmerAndPaymentView
            rawOrders={rawOrders}
            account={account}
            contract={contract}
            onRefresh={loadOrders}
            onSelectTrace={handleOpenTrace}
          />
        )}

        {activeTab === "deliveryArbB" && (
          <BuyerDeliveryAndArbitratorView
            rawOrders={rawOrders}
            account={account}
            contract={contract}
            onRefresh={loadOrders}
          />
        )}

        {activeTab === "traceB" && (
          <TraceabilityView contract={contract} initialOrderId={traceId} />
        )}
      </main>

      {/* FOOTER */}
      <footer style={{ background: "#FFFFFF", borderTop: "1px solid #E2E8F0", padding: "16px 32px" }}>
        <div style={{ maxWidth: 1360, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#3F493F", flexWrap: "wrap", gap: 12 }}>
          <span>🛡️ © 2026 AgriEscrow Decentralized Supply Chain & Escrow Engine. Avalanche Fuji Testnet.</span>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontFamily: "JetBrains Mono, monospace" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, background: "#00652C", borderRadius: "50%" }} />
              Contract: 0xd1C8...5807
            </span>
            <span>⚡ Finality: ~1.2s</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

const inputStyle = {
  height: 40,
  padding: "0 12px",
  borderRadius: 8,
  border: "1px solid #CBD5E1",
  fontSize: 14,
  color: "#131B2E",
  outline: "none",
  boxSizing: "border-box"
};