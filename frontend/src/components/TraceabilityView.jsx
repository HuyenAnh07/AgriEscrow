import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { QRCodeCanvas } from "qrcode.react";
import TraceabilityPromptBox from "./TraceabilityPromptBox";

const STATUS_BADGES = {
  0: { text: "Đã khóa tiền ký quỹ (Created)", bg: "#FEF3C7", color: "#92400E" },
  1: { text: "Đang giao - Đã ứng 30% (Shipped)", bg: "#A4F1B2", color: "#24703E" },
  2: { text: "Đã nhận hàng", bg: "#D1FAE5", color: "#065F46" },
  3: { text: "Đã xác thực & Hoàn tất 100% (Verified on-chain)", bg: "#A4F1B2", color: "#24703E" },
  4: { text: "Đang tranh chấp (Disputed)", bg: "#FEE2E2", color: "#991B1B" }
};

export default function TraceabilityView({ contract, initialOrderId = 1, rawOrders = [] }) {
  const [searchId, setSearchId] = useState(initialOrderId);
  const [orderData, setOrderData] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState("");

  const formatTime = (timestamp) => {
    if (!timestamp || Number(timestamp) === 0) return "Đang đồng bộ timestamp";
    return new Date(Number(timestamp) * 1000).toLocaleString("vi-VN");
  };

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 1500);
  };

  const fetchTraceHistory = async (id) => {
    const cleanId = Number(String(id).replace(/\D/g, ""));
    if (!cleanId) return;

    try {
      setLoading(true);

      // 1. Ưu tiên lấy trực tiếp từ rawOrders đã tải sẵn ở App.jsx
      let order = rawOrders.find((o) => Number(o.id) === cleanId);

      // 2. Nếu chưa có trong rawOrders (ví dụ mở trực tiếp qua QR) thì gọi RPC
      if (!order && contract) {
        order = await contract.getOrder(cleanId);
      }

      if (!order || Number(order.id) === 0) {
        setOrderData(null);
        return;
      }
      setOrderData(order);

      const eventsList = [];

      // 3. Quét sự kiện on-chain trong 90 block gần nhất
      try {
        if (!contract) throw new Error("No contract");
        const provider = contract.runner?.provider;
        const currentBlock = provider ? await provider.getBlockNumber() : null;
        const fromBlock = currentBlock ? Math.max(0, currentBlock - 90) : -90;
        const toBlock = currentBlock || "latest";

        const [shippedEvents, deliveredEvents, disputeEvents, resolvedEvents] = await Promise.all([
          contract.queryFilter(contract.filters.ShipmentConfirmed(cleanId), fromBlock, toBlock),
          contract.queryFilter(contract.filters.DeliveryConfirmed(cleanId), fromBlock, toBlock),
          contract.queryFilter(contract.filters.DisputeRaised(cleanId), fromBlock, toBlock),
          contract.queryFilter(contract.filters.DisputeResolved(cleanId), fromBlock, toBlock),
        ]);

        shippedEvents.forEach((e) => {
          eventsList.push({
            blockNumber: e.blockNumber,
            txHash: e.transactionHash,
            timeText: Number(order.shippedAt) > 0 ? formatTime(order.shippedAt) : "Đã xác thực",
            badge: "Ứng trước 30% Đã giải ngân",
            badgeBg: "#A4F1B2",
            badgeColor: "#24703E",
            title: "Nông dân xác nhận xuất kho & Giao hàng",
            detail: `Hàng được niêm phong vận chuyển. Hệ thống tự động giải ngân ứng trước 30% (${ethers.formatEther(e.args.advanceAmount)} AVAX) cho nông dân.`
          });
        });

        deliveredEvents.forEach((e) => {
          const remainVal = order.totalAmount - order.advancePaid;
          eventsList.push({
            blockNumber: e.blockNumber,
            txHash: e.transactionHash,
            timeText: "Đã hoàn tất",
            badge: "Quyết toán 100% Hoàn tất",
            badgeBg: "#A4F1B2",
            badgeColor: "#24703E",
            title: "Người mua xác nhận đã nhận hàng",
            detail: `Kiểm tra phẩm cấp đạt yêu cầu. Hợp đồng tự động thanh toán nốt 70% (${ethers.formatEther(remainVal)} AVAX) còn lại cho nông dân.`
          });
        });

        disputeEvents.forEach((e) => {
          eventsList.push({
            blockNumber: e.blockNumber,
            txHash: e.transactionHash,
            timeText: "Tạm khóa 70%",
            badge: "Phát sinh tranh chấp",
            badgeBg: "#FEE2E2",
            badgeColor: "#991B1B",
            title: "Phát sinh khiếu nại / Tranh chấp lô hàng",
            detail: `Lý do: "${e.args.reason}" (Mở bởi ví: ${e.args.raisedBy.slice(0, 6)}...${e.args.raisedBy.slice(-4)})`
          });
        });

        resolvedEvents.forEach((e) => {
          const isFarmerWin = e.args.winner?.toLowerCase() === order.farmer?.toLowerCase();
          eventsList.push({
            blockNumber: e.blockNumber,
            txHash: e.transactionHash,
            timeText: "Đã phán quyết",
            badge: "Trọng tài đã xử lý",
            badgeBg: "#E2E7FF",
            badgeColor: "#131B2E",
            title: "Hội đồng Trọng tài đã phân xử tranh chấp",
            detail: isFarmerWin
              ? `Xử nông dân thắng — Giải ngân ${ethers.formatEther(e.args.amount)} AVAX cho Nông dân.`
              : `Xử người mua thắng — Hoàn trả ${ethers.formatEther(e.args.amount)} AVAX cho Người mua.`
          });
        });
      } catch (logErr) {
        if (Number(order.shippedAt) > 0 || Number(order.status) >= 1) {
          eventsList.push({
            blockNumber: "On-chain",
            txHash: null,
            timeText: Number(order.shippedAt) > 0 ? formatTime(order.shippedAt) : "Đã xác thực",
            badge: "Ứng trước 30% Đã giải ngân",
            badgeBg: "#A4F1B2",
            badgeColor: "#24703E",
            title: "Nông dân xác nhận xuất kho & Giao hàng",
            detail: `Hàng được niêm phong vận chuyển. Hệ thống tự động giải ngân ứng trước 30% (${ethers.formatEther(order.advancePaid)} AVAX) cho nông dân.`
          });
        }
        if (Number(order.status) === 3) {
          eventsList.push({
            blockNumber: "On-chain",
            txHash: null,
            timeText: "Đã tất toán",
            badge: "Quyết toán 100% Hoàn tất",
            badgeBg: "#A4F1B2",
            badgeColor: "#24703E",
            title: "Người mua xác nhận đã nhận hàng",
            detail: `Hợp đồng tự động thanh toán toàn bộ ${ethers.formatEther(order.totalAmount)} AVAX cho nông dân. Đơn hàng hoàn thành an toàn.`
          });
        }
      }

      eventsList.sort((a, b) => Number(a.blockNumber || 0) - Number(b.blockNumber || 0));
      setTimeline(eventsList);
    } catch (err) {
      console.error(err);
      setOrderData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSearchId(initialOrderId);
    fetchTraceHistory(initialOrderId);
  }, [contract, initialOrderId, rawOrders]);

  const contractAddress = contract?.target || contract?.address || "0xd1C8fDce7B4E97FcF67b7432A53a858d672c5807";

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24, fontFamily: "Inter, system-ui, sans-serif", color: "#131B2E" }}>
      {/* KHUNG TÌM KIẾM PROMPT BOX */}
      <TraceabilityPromptBox
        searchId={searchId}
        onSearchIdChange={setSearchId}
        onTrace={fetchTraceHistory}
        loading={loading}
        orderData={orderData}
        rawOrders={rawOrders}
        hasContract={Boolean(contract) || rawOrders.length > 0}
      />

      {/* KẾT QUẢ TRUY XUẤT NGUỒN GỐC */}
      {!loading && orderData && (() => {
        const statusNum = Number(orderData.status);
        const statusBadge = STATUS_BADGES[statusNum] || STATUS_BADGES[0];
        const totalAvax = Number(ethers.formatEther(orderData.totalAmount));
        const traceUrl = `${window.location.origin}/?traceId=${orderData.id}`;

        return (
          <>
            {/* CARD THÔNG TIN CHỨNG NHẬN LÔ HÀNG & QR */}
            <div style={{ position: "relative", padding: 32, background: "#FFFFFF", borderRadius: 12, boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)", overflow: "hidden" }}>
              <div style={{ position: "absolute", right: -30, top: -30, fontSize: 180, opacity: 0.04, pointerEvents: "none" }}>
                🌿
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 24 }}>
                <div style={{ flex: "1 1 480px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ padding: "4px 12px", background: statusBadge.bg, color: statusBadge.color, borderRadius: 9999, fontSize: 12, fontWeight: 600 }}>
                      ✓ {statusBadge.text}
                    </span>
                    <span style={{ padding: "4px 12px", background: "#EAEDFF", color: "#3F493F", borderRadius: 9999, fontSize: 11, fontWeight: 600 }}>
                      📍 VietGAP • Smart Escrow No. {String(orderData.id).padStart(4, "0")}
                    </span>
                  </div>

                  <div>
                    <h2 style={{ margin: 0, color: "#131B2E", fontSize: 28, fontWeight: 700, lineHeight: 1.25 }}>
                      Nông sản: {orderData.productName} (Lô #{orderData.id.toString()})
                    </h2>
                    <p style={{ margin: "4px 0 0", color: "#6F7A6E", fontSize: 13 }}>
                      Hợp đồng bảo chứng thông minh AgriEscrow • Tiêu chuẩn xuất khẩu chất lượng cao
                    </p>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginTop: 4 }}>
                    <div style={{ padding: 12, background: "#F2F3FF", borderRadius: 8 }}>
                      <div style={{ color: "#6F7A6E", fontSize: 11, fontWeight: 600 }}>Khối lượng</div>
                      <div style={{ color: "#131B2E", fontSize: 16, fontWeight: 700, marginTop: 2 }}>
                        {orderData.quantityKg.toString()} kg
                      </div>
                    </div>

                    <div style={{ padding: 12, background: "#F2F3FF", borderRadius: 8 }}>
                      <div style={{ color: "#6F7A6E", fontSize: 11, fontWeight: 600 }}>Tổng giá trị Escrow</div>
                      <div style={{ color: "#00652C", fontSize: 16, fontFamily: "JetBrains Mono, monospace", fontWeight: 700, marginTop: 2 }}>
                        {totalAvax.toFixed(3)} AVAX
                      </div>
                    </div>

                    <div style={{ padding: 12, background: "#F2F3FF", borderRadius: 8 }}>
                      <div style={{ color: "#6F7A6E", fontSize: 11, fontWeight: 600 }}>Ví Nông dân</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                        <span style={{ color: "#131B2E", fontSize: 12, fontFamily: "JetBrains Mono, monospace", fontWeight: 600 }}>
                          {orderData.farmer.slice(0, 6)}...{orderData.farmer.slice(-4)}
                        </span>
                        <button
                          onClick={() => handleCopy(orderData.farmer, "farmer")}
                          title="Sao chép địa chỉ ví"
                          style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 12, padding: 0 }}
                        >
                          {copiedKey === "farmer" ? "✅" : "📋"}
                        </button>
                      </div>
                    </div>

                    <div style={{ padding: 12, background: "#F2F3FF", borderRadius: 8 }}>
                      <div style={{ color: "#6F7A6E", fontSize: 11, fontWeight: 600 }}>Ví Người mua</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                        <span style={{ color: "#131B2E", fontSize: 12, fontFamily: "JetBrains Mono, monospace", fontWeight: 600 }}>
                          {orderData.buyer.slice(0, 6)}...{orderData.buyer.slice(-4)}
                        </span>
                        <button
                          onClick={() => handleCopy(orderData.buyer, "buyer")}
                          title="Sao chép địa chỉ ví"
                          style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 12, padding: 0 }}
                        >
                          {copiedKey === "buyer" ? "✅" : "📋"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ padding: 16, background: "#F2F3FF", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, margin: "0 auto" }}>
                  <div style={{ padding: 10, background: "#FFFFFF", borderRadius: 8, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                    <QRCodeCanvas value={traceUrl} size={112} fgColor="#131B2E" bgColor="#FFFFFF" />
                  </div>
                  <div style={{ color: "#131B2E", fontSize: 12, fontWeight: 600 }}>Quét để kiểm chứng</div>
                  <div style={{ padding: "2px 8px", background: "#EAEDFF", borderRadius: 4, color: "#6F7A6E", fontSize: 11, fontFamily: "JetBrains Mono, monospace", fontWeight: 500 }}>
                    BATCH #{String(orderData.id).padStart(3, "0")}
                  </div>
                </div>
              </div>
            </div>

            {/* CARD TIMELINE NHẬT KÝ HÀNH TRÌNH TRÊN BLOCKCHAIN */}
            <div style={{ padding: 32, background: "#FFFFFF", borderRadius: 12, boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)", display: "flex", flexDirection: "column", gap: 24 }}>
              <div>
                <div style={{ color: "#00652C", fontSize: 12, fontWeight: 600, letterSpacing: 0.6 }}>
                  🔐 BẰNG CHỨNG MẬT MÃ MINH BẠCH
                </div>
                <h3 style={{ margin: "4px 0", color: "#131B2E", fontSize: 20, fontWeight: 700 }}>
                  Nhật Ký Hành Trình Trên Blockchain
                </h3>
                <p style={{ margin: 0, color: "#3F493F", fontSize: 12 }}>
                  Lịch sử bất biến được ghi nhận thời gian thực trên Avalanche Fuji C-Chain
                </p>
              </div>

              <div style={{ position: "relative", paddingLeft: 32, display: "flex", flexDirection: "column", gap: 28 }}>
                <div style={{ position: "absolute", left: 11, top: 8, bottom: 8, width: 2, background: "#15803D" }} />

                <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div
                    style={{
                      position: "absolute",
                      left: -32,
                      top: 0,
                      width: 24,
                      height: 24,
                      background: "#15803D",
                      borderRadius: "50%",
                      color: "#FFFFFF",
                      fontSize: 12,
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      boxShadow: "0 0 0 4px #FFFFFF"
                    }}
                  >
                    ✓
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ color: "#131B2E", fontSize: 16, fontWeight: 600 }}>
                      Khởi tạo hợp đồng & Khóa tiền ký quỹ
                    </div>
                    <span style={{ padding: "2px 10px", background: "#A4F1B2", color: "#24703E", borderRadius: 9999, fontSize: 11, fontWeight: 600 }}>
                      Giai đoạn 1/3 Hoàn tất
                    </span>
                  </div>

                  <div style={{ color: "#3F493F", fontSize: 14, lineHeight: 1.5 }}>
                    Người mua đã nạp và khóa <strong>{totalAvax.toFixed(3)} AVAX</strong> an toàn vào Smart Contract ký quỹ AgriEscrow.
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                    <span style={metaBadgeStyle}>🕒 {formatTime(orderData.createdAt)}</span>
                    <span style={metaBadgeStyle}>📦 On-chain Escrow</span>
                    <span style={{ ...metaBadgeStyle, color: "#00652C" }}>✓ Đã khóa ký quỹ</span>
                  </div>
                </div>

                {timeline.map((item, idx) => (
                  <div key={idx} style={{ position: "relative", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div
                      style={{
                        position: "absolute",
                        left: -32,
                        top: 0,
                        width: 24,
                        height: 24,
                        background: "#15803D",
                        borderRadius: "50%",
                        color: "#FFFFFF",
                        fontSize: 12,
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        boxShadow: "0 0 0 4px #FFFFFF"
                      }}
                    >
                      ✓
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <div style={{ color: "#131B2E", fontSize: 16, fontWeight: 600 }}>{item.title}</div>
                      <span style={{ padding: "2px 10px", background: item.badgeBg, color: item.badgeColor, borderRadius: 9999, fontSize: 11, fontWeight: 600 }}>
                        {item.badge}
                      </span>
                    </div>

                    <div style={{ color: "#3F493F", fontSize: 14, lineHeight: 1.5 }}>{item.detail}</div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                      <span style={metaBadgeStyle}>🕒 {item.timeText}</span>
                      <span style={metaBadgeStyle}>🧱 Block #{item.blockNumber}</span>
                      {item.txHash && (
                        <a
                          href={`https://testnet.snowtrace.io/tx/${item.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ ...metaBadgeStyle, color: "#00652C", textDecoration: "none" }}
                        >
                          ↗ Tx: {item.txHash.slice(0, 6)}...{item.txHash.slice(-4)}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ padding: 16, background: "#F2F3FF", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#131B2E", fontSize: 12 }}>
                  <span>🛡️</span>
                  <span>Dữ liệu được bảo chứng bởi Avalanche Fuji Testnet Smart Contract:</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <a
                    href={`https://testnet.snowtrace.io/address/${contractAddress}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: "6px 12px",
                      background: "#FFFFFF",
                      color: "#00652C",
                      borderRadius: 6,
                      fontSize: 12,
                      fontFamily: "JetBrains Mono, monospace",
                      fontWeight: 600,
                      textDecoration: "none",
                      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)"
                    }}
                  >
                    {contractAddress.length > 16
                      ? `${contractAddress.slice(0, 6)}...${contractAddress.slice(-4)} ↗`
                      : contractAddress}
                  </a>
                </div>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}

const metaBadgeStyle = {
  padding: "4px 10px",
  background: "#EAEDFF",
  borderRadius: 4,
  color: "#131B2E",
  fontSize: 12,
  fontFamily: "JetBrains Mono, monospace",
  fontWeight: 500
};