import CreateEscrowForm from './components/CreateEscrowForm';
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

  const [activeTab, setActiveTab] = useState("portalA");
  const [traceId, setTraceId] = useState(1);

  // Tự động mở Landing Page (welcome.html) nếu vào thẳng "/" mà chưa bấm vào app hoặc chưa quét QR
  const searchParams = new URLSearchParams(window.location.search);
  const isEnteringApp = searchParams.get("app") === "true" || searchParams.has("traceId");

  useEffect(() => {
    if (!isEnteringApp) {
      window.location.replace("/welcome.html");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const qrId = params.get("traceId");
    if (qrId) {
      setTraceId(Number(qrId));
      setActiveTab("traceB");
    }
  }, [isEnteringApp]);

  if (!isEnteringApp) {
    return null;
  }

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

  const handleCreateOrder = async (formData) => {
    if (!contract) return alert("Hãy kết nối ví trước!");
    setLoading(true);
    setTxHash("");
    try {
      const tx = await contract.createOrder(
        formData.farmerAddress,
        formData.arbiterAddress,
        formData.productName,
        formData.weight,
        { value: ethers.parseEther(formData.amountAvax) }
      );
      setTxHash(tx.hash);
      await tx.wait();
      alert("Tạo đơn hàng và khóa tiền AVAX thành công!");
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

  // Style kính mờ dùng chung
  const glassLightStyle = {
    background: "rgba(246, 248, 245, 0.82)",
    backdropFilter: "blur(20px) saturate(1.2)",
    WebkitBackdropFilter: "blur(20px) saturate(1.2)",
    borderRadius: 16,
    border: "1px solid rgba(255, 255, 255, 0.75)",
    boxShadow: "0 20px 40px rgba(10, 25, 15, 0.16)"
  };

  const glassDarkStyle = {
    background: "rgba(24, 39, 29, 0.68)",
    backdropFilter: "blur(20px) saturate(1.2)",
    WebkitBackdropFilter: "blur(20px) saturate(1.2)",
    color: "#ffffff",
    borderRadius: 16,
    border: "1px solid rgba(255, 255, 255, 0.25)",
    boxShadow: "0 20px 40px rgba(10, 25, 15, 0.25)"
  };

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        color: "#10291a",
        fontFamily: '"Inter Tight", "Helvetica Neue", Arial, sans-serif',
        backgroundColor: "#d9dddd",
        backgroundImage: `linear-gradient(180deg, rgba(231, 235, 232, 0.85) 0%, rgba(231, 235, 232, 0.45) 35%, rgba(16, 41, 26, 0.35) 100%), url('https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261106_025630_9a37a1e0-2547-4973-8160-c75205993914.png&w=1400&q=82')`,
        backgroundSize: "cover",
        backgroundPosition: "center 65%",
        backgroundAttachment: "fixed"
      }}
    >
      {/* HEADER KÍNH MỜ MOSSLINE */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(231, 235, 232, 0.78)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.6)"
        }}
      >
        <div
          style={{
            maxWidth: 1320,
            margin: "0 auto",
            height: 68,
            padding: "0 32px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          {/* Logo Hexagon + Leaf chuẩn Mossline (Bấm để quay lại Landing Page) */}
          <div
            onClick={() => (window.location.href = "/welcome.html")}
            title="Quay lại trang giới thiệu"
            style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
          >
            <svg width="28" height="28" viewBox="0 0 32 32" style={{ color: "#10291a" }}>
              <path fill="currentColor" d="M16 2l12 7v14l-12 7-12-7V9z" opacity="0.15" />
              <path fill="none" stroke="currentColor" strokeWidth="1.6" d="M16 2l12 7v14l-12 7-12-7V9z" />
              <path fill="#c6f35c" d="M16 8c-4 4-5 9-1 16 1-5 4-9 8-11-3 0-5 1-7 3 0-3 0-5 0-8z" />
            </svg>
            <span style={{ color: "#10291a", fontSize: 21, fontWeight: 600, letterSpacing: "-0.02em" }}>
              AgriEscrow
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                padding: "6px 12px",
                background: "rgba(255, 255, 255, 0.85)",
                border: "1px solid rgba(16, 41, 26, 0.15)",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                fontFamily: '"JetBrains Mono", monospace',
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "#10291a",
                fontWeight: 600
              }}
            >
              <span style={{ width: 7, height: 7, background: "#ef4444", borderRadius: "50%" }} />
              Avalanche Fuji
            </div>

            <button
              onClick={connectWallet}
              style={{
                padding: "8px 16px",
                background: account ? "#ffffff" : "#10291a",
                color: account ? "#10291a" : "#c6f35c",
                border: "1px solid #10291a",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 11.5,
                fontFamily: '"JetBrains Mono", monospace',
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(16, 41, 26, 0.15)"
              }}
            >
              <span style={{ width: 7, height: 7, background: account ? "#16a34a" : "#c6f35c", borderRadius: "50%" }} />
              {account ? `Ví: ${account.slice(0, 6)}...${account.slice(-4)}` : "Kết nối Ví Avalanche"}
            </button>
          </div>
        </div>
      </header>

      {/* NỘI DUNG CHÍNH */}
      <main
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 1320,
          margin: "0 auto",
          padding: "28px 32px 64px",
          display: "flex",
          flexDirection: "column",
          gap: 28
        }}
      >
        {/* THANH 4 TABS DẠNG KÍNH MỜ */}
        <div
          style={{
            display: "inline-flex",
            alignSelf: "flex-start",
            flexWrap: "wrap",
            gap: 6,
            padding: 6,
            background: "rgba(255, 255, 255, 0.72)",
            backdropFilter: "blur(14px)",
            borderRadius: 10,
            border: "1px solid rgba(255, 255, 255, 0.8)",
            boxShadow: "0 4px 16px rgba(16, 41, 26, 0.08)"
          }}
        >
          {navTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 7,
                  border: "none",
                  background: isActive ? "#10291a" : "transparent",
                  color: isActive ? "#c6f35c" : "#2c4434",
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.2s ease"
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Thông báo Transaction Hash */}
        {txHash && (
          <div
            style={{
              ...glassLightStyle,
              padding: "14px 20px",
              borderRadius: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 13.5,
              borderLeft: "4px solid #a9dd3a"
            }}
          >
            <span>
              <strong> Giao dịch đã gửi lên Fuji Testnet:</strong>{" "}
              <a
                href={`https://testnet.snowtrace.io/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#15803D", fontWeight: 600, textDecoration: "underline" }}
              >
                Xem trên Avalanche Explorer ({txHash.slice(0, 14)}...)
              </a>
            </span>
            <button
              onClick={() => setTxHash("")}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: "#10291a", fontSize: 16 }}
            >
              ✕
            </button>
          </div>
        )}

        {/* TAB 1: TẠO ĐƠN & GIAO HÀNG */}
        {activeTab === "portalA" && (
          <>
            {/* Banner Smart Contract */}
            <div
              style={{
                ...glassLightStyle,
                padding: "24px 28px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 16
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
                  <h1
                    style={{
                      margin: 0,
                      color: "#10291a",
                      fontSize: "clamp(22px, 2.5vw, 28px)",
                      fontWeight: 600,
                      letterSpacing: "-0.03em"
                    }}
                  >
                    🛡️ Khởi Tạo & Ký Quỹ Đơn Nông Sản
                  </h1>
                  <span
                    style={{
                      padding: "3px 10px",
                      background: "#c6f35c",
                      borderRadius: 4,
                      color: "#10291a",
                      fontSize: 10.5,
                      fontFamily: '"JetBrains Mono", monospace',
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      fontWeight: 600
                    }}
                  >
                    EVM v0.8.24 Verified
                  </span>
                </div>
                <p style={{ margin: 0, color: "#2c4434", fontSize: 14.5 }}>
                  Phân rã thanh toán 2 kỳ (30/70) đảm bảo rủi ro tối thiểu qua Multi-sig Escrow Vault
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 14px",
                  background: "rgba(255, 255, 255, 0.9)",
                  borderRadius: 8,
                  border: "1px solid rgba(16, 41, 26, 0.1)",
                  fontSize: 11.5,
                  fontFamily: '"JetBrains Mono", monospace'
                }}
              >
                <span style={{ color: "#2c4434" }}>Contract:</span>
                <strong style={{ color: "#10291a" }}>0xd1C8...5807</strong>
                <span style={{ opacity: 0.3 }}>|</span>
                <span style={{ color: "#16a34a", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 7, height: 7, background: "#16a34a", borderRadius: "50%" }} />
                  Fuji C-Chain
                </span>
              </div>
            </div>

            {/* Lưới 2 cột: Form Tạo Đơn (Trái) & Danh Sách Đơn Hàng (Phải) */}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(380px, 460px) 1fr", gap: 28, alignItems: "start" }}>
              {/* CỘT TRÁI: Component Form được bọc lớp kính mờ */}
              <div style={{ ...glassLightStyle, overflow: "hidden" }}>
                <CreateEscrowForm isSubmitting={loading} onCreateOrder={handleCreateOrder} />
              </div>

              {/* CỘT PHẢI: DANH SÁCH ĐƠN HÀNG (Kính mờ tối giống thẻ Carbon Mossline) */}
              <div style={{ ...glassDarkStyle, padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingBottom: 16,
                    borderBottom: "1px solid rgba(255, 255, 255, 0.15)"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <h2 style={{ margin: 0, color: "#FFFFFF", fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em" }}>
                      Danh Sách Đơn Hàng & Giải Ngân
                    </h2>
                    <span
                      style={{
                        padding: "3px 10px",
                        background: "#c6f35c",
                        borderRadius: 4,
                        color: "#10291a",
                        fontSize: 11,
                        fontFamily: '"JetBrains Mono", monospace',
                        fontWeight: 600
                      }}
                    >
                      {orders.length} ĐƠN
                    </span>
                  </div>
                  <button
                    onClick={() => loadOrders(contract)}
                    style={{
                      padding: "7px 14px",
                      background: "rgba(255, 255, 255, 0.15)",
                      border: "1px solid rgba(255, 255, 255, 0.3)",
                      borderRadius: 6,
                      color: "#FFFFFF",
                      fontSize: 11,
                      fontFamily: '"JetBrains Mono", monospace',
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      cursor: "pointer"
                    }}
                  >
                    ↻ Làm mới
                  </button>
                </div>

                {orders.length === 0 ? (
                  <div
                    style={{
                      padding: "56px 24px",
                      background: "rgba(16, 41, 26, 0.35)",
                      border: "1px dashed rgba(255, 255, 255, 0.3)",
                      borderRadius: 12,
                      textAlign: "center",
                      color: "rgba(255, 255, 255, 0.9)",
                      fontSize: 14.5
                    }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.9 }}>📦</div>
                    <p style={{ margin: "0 0 6px", fontWeight: 500 }}>Chưa có đơn hàng nào.</p>
                    <p style={{ margin: 0, fontSize: 13.5, opacity: 0.8 }}>
                      Hãy bấm <strong style={{ color: "#c6f35c" }}>Kết nối Ví Avalanche</strong> ở góc trên hoặc tạo đơn mới bên cột trái.
                    </p>
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
                          background: "rgba(255, 255, 255, 0.95)",
                          color: "#10291a",
                          borderRadius: 12,
                          border: selectedOrder?.id === order.id ? "2px solid #c6f35c" : "1px solid rgba(255, 255, 255, 0.3)",
                          overflow: "hidden",
                          cursor: "pointer"
                        }}
                      >
                        {/* Card Header */}
                        <div
                          style={{
                            padding: "16px 22px",
                            background: "rgba(231, 235, 232, 0.7)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 10
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <span style={{ color: "#10291a", fontSize: 16, fontWeight: 600 }}>
                              Lô #{order.id} — {order.productName} ({order.quantityKg} kg)
                            </span>
                            <span
                              style={{
                                padding: "3px 10px",
                                background: isCompleted ? "#c6f35c" : order.status === 4 ? "#FEE2E2" : "#FEF3C7",
                                color: isCompleted ? "#10291a" : order.status === 4 ? "#B91C1C" : "#B45309",
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 600
                              }}
                            >
                              • {STATUS_LABELS[order.status]}
                            </span>
                          </div>
                          <span
                            style={{
                              padding: "4px 10px",
                              background: "#10291a",
                              borderRadius: 4,
                              color: "#c6f35c",
                              fontSize: 11,
                              fontFamily: '"JetBrains Mono", monospace',
                              fontWeight: 600
                            }}
                          >
                            Fuji Escrow #{String(order.id).padStart(3, "0")}
                          </span>
                        </div>

                        {/* Card Body */}
                        <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                            <div style={{ padding: 14, background: "#f6f7f4", borderRadius: 8 }}>
                              <div style={{ fontSize: 10.5, fontFamily: '"JetBrains Mono", monospace', color: "#2c4434" }}>
                                TỔNG KÝ QUỸ
                              </div>
                              <div
                                style={{
                                  fontSize: 15,
                                  fontFamily: '"JetBrains Mono", monospace',
                                  fontWeight: 600,
                                  color: "#10291a",
                                  marginTop: 4
                                }}
                              >
                                {Number(order.totalAmount).toFixed(3)} AVAX
                              </div>
                            </div>
                            <div style={{ padding: 14, background: "rgba(198, 243, 92, 0.28)", borderRadius: 8 }}>
                              <div style={{ fontSize: 10.5, fontFamily: '"JetBrains Mono", monospace', color: "#10291a" }}>
                                ỨNG TRƯỚC 30%
                              </div>
                              <div
                                style={{
                                  fontSize: 15,
                                  fontFamily: '"JetBrains Mono", monospace',
                                  fontWeight: 600,
                                  color: "#15803D",
                                  marginTop: 4
                                }}
                              >
                                {(Number(order.totalAmount) * 0.3).toFixed(3)} AVAX
                              </div>
                              <div style={{ fontSize: 11, color: "#2c4434", marginTop: 2 }}>
                                {order.status >= 1 ? "Đã giải ngân" : "Chưa giải ngân"}
                              </div>
                            </div>
                            <div style={{ padding: 14, background: "#f6f7f4", borderRadius: 8 }}>
                              <div style={{ fontSize: 10.5, fontFamily: '"JetBrains Mono", monospace', color: "#2c4434" }}>
                                CÒN LẠI 70%
                              </div>
                              <div
                                style={{
                                  fontSize: 15,
                                  fontFamily: '"JetBrains Mono", monospace',
                                  fontWeight: 600,
                                  color: "#10291a",
                                  marginTop: 4
                                }}
                              >
                                {remainEth} AVAX
                              </div>
                              <div style={{ fontSize: 11, color: "#2c4434", marginTop: 2 }}>
                                {isCompleted ? "Đã tất toán" : "Giữ trong Escrow"}
                              </div>
                            </div>
                          </div>

                          {/* Multi-sig */}
                          <div
                            style={{
                              padding: 14,
                              background: "#e7ebe8",
                              borderRadius: 8,
                              display: "flex",
                              flexDirection: "column",
                              gap: 8
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                              <span style={{ fontWeight: 600, color: "#10291a" }}>Các bên tham gia Multi-sig Escrow</span>
                              <span style={{ fontFamily: '"JetBrains Mono", monospace', color: "#15803D", fontWeight: 600 }}>
                                Quorum: 2/3 Signatures
                              </span>
                            </div>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                                gap: 8,
                                fontSize: 12,
                                fontFamily: '"JetBrains Mono", monospace'
                              }}
                            >
                              <div
                                style={{
                                  padding: "8px 10px",
                                  background: "#FFFFFF",
                                  borderRadius: 4,
                                  display: "flex",
                                  justifyContent: "space-between"
                                }}
                              >
                                <span style={{ color: "#2c4434" }}>Người mua:</span>
                                <strong>
                                  {order.buyer.slice(0, 6)}...{order.buyer.slice(-4)}
                                </strong>
                              </div>
                              <div
                                style={{
                                  padding: "8px 10px",
                                  background: "#FFFFFF",
                                  borderRadius: 4,
                                  display: "flex",
                                  justifyContent: "space-between"
                                }}
                              >
                                <span style={{ color: "#2c4434" }}>Nông dân:</span>
                                <strong>
                                  {order.farmer.slice(0, 6)}...{order.farmer.slice(-4)}
                                </strong>
                              </div>
                              {order.arbitrator && (
                                <div
                                  style={{
                                    padding: "8px 10px",
                                    background: "#FFFFFF",
                                    borderRadius: 4,
                                    display: "flex",
                                    justifyContent: "space-between"
                                  }}
                                >
                                  <span style={{ color: "#2c4434" }}>Trọng tài:</span>
                                  <strong>
                                    {order.arbitrator.slice(0, 6)}...{order.arbitrator.slice(-4)}
                                  </strong>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Thanh tiến độ */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600 }}>
                              <span>Tiến độ thanh toán 2 pha</span>
                              <span style={{ color: "#15803D" }}>
                                {order.status === 0 ? "Giai đoạn 1/2" : "Giai đoạn 2/2"}
                              </span>
                            </div>
                            <div style={{ height: 8, background: "#e7ebe8", borderRadius: 9999, overflow: "hidden" }}>
                              <div style={{ width: progressPercent, height: "100%", background: "#10291a", borderRadius: 9999 }} />
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#2c4434" }}>
                              <span>Đã khóa Vault</span>
                              <span>Xuất kho (30%)</span>
                              <span>Nghiệm thu (70%)</span>
                            </div>
                          </div>

                          {order.status === 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleConfirmShipment(order.id);
                                }}
                                disabled={loading}
                                style={{
                                  height: 44,
                                  background: "#10291a",
                                  color: "#c6f35c",
                                  border: "none",
                                  borderRadius: 8,
                                  fontSize: 12,
                                  fontFamily: '"JetBrains Mono", monospace',
                                  textTransform: "uppercase",
                                  letterSpacing: "0.1em",
                                  fontWeight: 600,
                                  cursor: "pointer"
                                }}
                              >
                                Xác Nhận Đã Giao Hàng (Giải Ngân 30%)
                              </button>
                              <div
                                style={{
                                  textAlign: "center",
                                  fontSize: 11,
                                  fontFamily: '"JetBrains Mono", monospace',
                                  color: "#2c4434"
                                }}
                              >
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

        {/* TAB 2, 3, 4: BỌC TRONG KHUNG KÍNH MỜ ĐỂ ĐỒNG BỘ GIAO DIỆN */}
        {activeTab === "farmerB" && (
          <div style={{ ...glassLightStyle, padding: 28 }}>
            <FarmerAndPaymentView
              rawOrders={rawOrders}
              account={account}
              contract={contract}
              onRefresh={loadOrders}
              onSelectTrace={handleOpenTrace}
            />
          </div>
        )}

        {activeTab === "deliveryArbB" && (
          <div style={{ ...glassLightStyle, padding: 28 }}>
            <BuyerDeliveryAndArbitratorView
              rawOrders={rawOrders}
              account={account}
              contract={contract}
              onRefresh={loadOrders}
            />
          </div>
        )}

        {activeTab === "traceB" && (
          <div style={{ ...glassLightStyle, padding: 28 }}>
            <TraceabilityView contract={contract} initialOrderId={traceId} />
          </div>
        )}
      </main>

      {/* FOOTER 4 CỘT ĐẦY ĐỦ THÔNG TIN */}
      <footer
        style={{
          background: "rgba(246, 248, 245, 0.94)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(16, 41, 26, 0.12)",
          color: "#10291a",
          marginTop: 48
        }}
      >
        <div
          style={{
            maxWidth: 1320,
            margin: "0 auto",
            padding: "56px 32px 44px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
            gap: 40
          }}
        >
          {/* Cột 1: Thương hiệu & Mạng xã hội */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <svg width="26" height="26" viewBox="0 0 32 32" style={{ color: "#15803D" }}>
                <path fill="none" stroke="currentColor" strokeWidth="2" d="M16 2l12 7v14l-12 7-12-7V9z" />
                <path fill="#15803D" d="M16 8c-4 4-5 9-1 16 1-5 4-9 8-11-3 0-5 1-7 3 0-3 0-5 0-8z" />
              </svg>
              <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: "#10291a" }}>
                AgriEscrow
              </span>
            </div>

            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: "#2c4434" }}>
              Minh bạch nguồn gốc nông sản. <br />
              Ký quỹ an tâm trên blockchain. <br />
              Kết nối nông hộ cùng đối tác.
            </p>

            {/* 4 Nút tròn GH, X, D, ↗ */}
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              {[
                { label: "GH", title: "GitHub", url: "https://github.com" },
                { label: "X", title: "X (Twitter)", url: "https://x.com" },
                { label: "D", title: "Docs", url: "#" },
                { label: "↗", title: "Explorer", url: "https://testnet.snowtrace.io/address/0xd1C8fDce7B4E97FcF67b7432A53a858d672c5807" }
              ].map((item, idx) => (
                <a
                  key={idx}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  title={item.title}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "#ffffff",
                    border: "1px solid rgba(16, 41, 26, 0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: '"JetBrains Mono", monospace',
                    color: "#10291a",
                    boxShadow: "0 2px 6px rgba(16, 41, 26, 0.05)",
                    textDecoration: "none"
                  }}
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>

          {/* Cột 2: Liên kết nhanh (Bấm chuyển tab trực tiếp) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#15803D" }}>Liên kết nhanh</h4>
              <div style={{ width: 28, height: 2.5, background: "#15803D", marginTop: 6, borderRadius: 2 }} />
            </div>

            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, fontSize: 13.5, color: "#2c4434" }}>
              {[
                { text: "Trang giới thiệu", url: "/welcome.html" },
                { text: "Tạo đơn ký quỹ", tab: "portalA" },
                { text: "Danh mục lô hàng", tab: "farmerB" },
                { text: "Xác nhận nhận hàng", tab: "deliveryArbB" },
                { text: "Truy xuất nguồn gốc", tab: "traceB" }
              ].map((link, idx) => (
                <li
                  key={idx}
                  onClick={() => {
                    if (link.url) {
                      window.location.href = link.url;
                    } else {
                      setActiveTab(link.tab);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  }}
                  style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                >
                  <span style={{ color: "#15803D", fontWeight: 700 }}>›</span> {link.text}
                </li>
              ))}
            </ul>
          </div>

          {/* Cột 3: Thông tin mạng lưới */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#15803D" }}>Thông tin mạng lưới</h4>
              <div style={{ width: 28, height: 2.5, background: "#15803D", marginTop: 6, borderRadius: 2 }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 13, color: "#2c4434" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: 16 }}></span>
                <div>
                  <strong style={{ color: "#10291a", display: "block" }}>Địa chỉ mạng lưới & hợp đồng</strong>
                  <span>Avalanche Fuji Testnet · Chain ID 43113</span>
                  <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11.5, color: "#15803D", marginTop: 2, fontWeight: 600 }}>
                    0xd1C8...5807
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: 16 }}></span>
                <div>
                  <strong style={{ color: "#10291a", display: "block" }}>Hỗ trợ nông dân & đối tác</strong>
                  <a href="#support" onClick={(e) => e.preventDefault()} style={{ color: "#15803D", fontWeight: 600, textDecoration: "underline" }}>
                    Gửi yêu cầu hỗ trợ
                  </a>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: 16 }}></span>
                <div>
                  <strong style={{ color: "#9a3412", display: "block" }}>Thời gian hoạt động</strong>
                  <span>Smart Contract vận hành 24/7</span>
                </div>
              </div>
            </div>
          </div>

          {/* Cột 4: Nông sản & đối tác (Lưới 6 ảnh) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#15803D" }}>Nông sản & đối tác</h4>
              <div style={{ width: 28, height: 2.5, background: "#15803D", marginTop: 6, borderRadius: 2 }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {[
                "https://images.unsplash.com/photo-1553279768-865429fa0078?w=200&q=80",
                "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=200&q=80",
                "https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=200&q=80",
                "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=200&q=80",
                "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=200&q=80",
                "https://images.unsplash.com/photo-1596591606975-97ee5cef3a1e?w=200&q=80"
              ].map((imgUrl, idx) => (
                <div
                  key={idx}
                  style={{
                    aspectRatio: "1/1",
                    borderRadius: 8,
                    overflow: "hidden",
                    border: "1px solid rgba(16, 41, 26, 0.1)",
                    background: "#e7ebe8"
                  }}
                >
                  <img
                    src={imgUrl}
                    alt={`Nông sản ${idx + 1}`}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Đường viền xanh đậm đặc trưng ở dưới cùng */}
        <div style={{ height: 6, width: "100%", background: "linear-gradient(90deg, #15803D 0%, #166534 50%, #15803D 100%)" }} />

        {/* Thanh bản quyền & Badges dưới cùng */}
        <div
          style={{
            maxWidth: 1320,
            margin: "0 auto",
            padding: "16px 32px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            fontSize: 12,
            color: "#2c4434"
          }}
        >
          <span>© 2026 AgriEscrow — Blockchain Agricultural Traceability. All rights reserved.</span>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {["Avalanche · AVAX", "MetaMask", "Smart Escrow", "QR Traceability"].map((badge, idx) => (
              <span
                key={idx}
                style={{
                  padding: "4px 10px",
                  background: "#ffffff",
                  border: "1px solid rgba(16, 41, 26, 0.1)",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#10291a"
                }}
              >
                {badge}
              </span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}