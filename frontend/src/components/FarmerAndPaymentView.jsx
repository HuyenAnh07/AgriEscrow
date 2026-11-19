import React, { useState } from "react";
import { ethers } from "ethers";
import { QRCodeCanvas } from "qrcode.react";

const STATUS_MAP = {
  0: { text: "Chờ xuất kho (Created)", color: "#78350F", dot: "#D97706", bg: "#FEF3C7" },
  1: { text: "Đang giao (Đã ứng 30%)", color: "#24703E", dot: "#00652C", bg: "#A4F1B2" },
  2: { text: "Đã nhận hàng", color: "#065F46", dot: "#059669", bg: "#D1FAE5" },
  3: { text: "Hoàn tất (Đã thanh toán 100%)", color: "#00652C", dot: "#15803D", bg: "#A4F1B2" },
  4: { text: "Đang tranh chấp", color: "#991B1B", dot: "#DC2626", bg: "#FEE2E2" }
};

export default function FarmerAndPaymentView({ rawOrders, account, contract, onRefresh, onSelectTrace }) {
  const [disputeModalId, setDisputeModalId] = useState(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");

  const myFarmerOrders = rawOrders.filter(
    (o) => o.farmer.toLowerCase() === account?.toLowerCase()
  );

  const filteredOrders = myFarmerOrders.filter((o) => {
    if (statusFilter === "ALL") return true;
    return Number(o.status) === Number(statusFilter);
  });

  const totalAdvanceReceived = myFarmerOrders.reduce(
    (sum, o) => sum + Number(ethers.formatEther(o.advancePaid)),
    0
  );

  const totalPending70 = myFarmerOrders
    .filter((o) => Number(o.status) === 1 || Number(o.status) === 4)
    .reduce(
      (sum, o) => sum + Number(ethers.formatEther(o.totalAmount - o.advancePaid)),
      0
    );

  const actionableCount = myFarmerOrders.filter(
    (o) => Number(o.status) === 0 || Number(o.status) === 1
  ).length;

  const handleFarmerDispute = async (orderId) => {
    if (!reason.trim()) return alert("Vui lòng nhập lý do tranh chấp!");
    try {
      setLoading(true);
      const tx = await contract.raiseDispute(orderId, reason);
      await tx.wait();
      alert("Đã gửi yêu cầu tranh chấp lên Avalanche Fuji!");
      setDisputeModalId(null);
      setReason("");
      onRefresh();
    } catch (err) {
      alert("Lỗi: " + (err.reason || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmShipment = async (orderId) => {
    if (!contract) return;
    try {
      setLoading(true);
      const tx = await contract.confirmShipment(orderId);
      await tx.wait();
      alert("Đã xác nhận xuất kho! 30% tiền ứng trước đã chuyển về ví Nông dân.");
      onRefresh();
    } catch (err) {
      alert("Lỗi xác nhận xuất kho: " + (err.reason || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadQR = (orderId) => {
    const canvas = document.getElementById(`qr-canvas-${orderId}`);
    if (!canvas) return;
    const pngUrl = canvas.toDataURL("image/png");
    const downloadLink = document.createElement("a");
    downloadLink.href = pngUrl;
    downloadLink.download = `AGRI-FUJI-BATCH-${String(orderId).padStart(3, "0")}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, fontFamily: "Inter, system-ui, sans-serif", color: "#131B2E" }}>
      {/* HEADER CARD DASHBOARD NÔNG DÂN */}
      <div style={{ padding: 24, background: "#FFFFFF", borderRadius: 12, boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, background: "#15803D", borderRadius: 8, display: "flex", justifyContent: "center", alignItems: "center", color: "#FFFFFF", fontSize: 18 }}>
              🌾
            </div>
            <h2 style={{ margin: 0, color: "#131B2E", fontSize: 24, fontWeight: 700 }}>
              Quản Lý Lô Hàng & Tem QR Nông Sản
            </h2>
          </div>
          <p style={{ margin: 0, color: "#3F493F", fontSize: 13, lineHeight: 1.5, maxWidth: 640 }}>
            Theo dõi tiến độ xuất kho, nhận tiền ứng trước 30% và in tem QR gắn lên bao bì đạt chuẩn smart escrow Avalanche C-Chain.
          </p>
        </div>

        {/* Badge Ví Nông Dân */}
        <div style={{ padding: "10px 16px", background: "#F2F3FF", borderRadius: 12, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingRight: 16, borderRight: "1px solid rgba(190, 202, 188, 0.5)" }}>
            <span style={{ width: 10, height: 10, background: account ? "#00652C" : "#D97706", borderRadius: "50%" }} />
            <div>
              <div style={{ color: "#3F493F", fontSize: 11, fontWeight: 600 }}>Ví Nông Dân</div>
              <div style={{ color: "#131B2E", fontSize: 12, fontFamily: "JetBrains Mono, monospace", fontWeight: 600 }}>
                {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Chưa kết nối"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>💰</span>
            <div>
              <div style={{ color: "#3F493F", fontSize: 11, fontWeight: 600 }}>Tổng ứng trước</div>
              <div style={{ color: "#00652C", fontSize: 12, fontFamily: "JetBrains Mono, monospace", fontWeight: 600 }}>
                {totalAdvanceReceived.toFixed(3)} AVAX
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 THẺ THỐNG KÊ TỔNG QUAN */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        <div style={statCardStyle}>
          <div>
            <div style={statLabelStyle}>TỔNG LÔ HÀNG</div>
            <div style={{ color: "#131B2E", fontSize: 26, fontWeight: 700, marginTop: 4 }}>{myFarmerOrders.length} lô</div>
            <div style={{ color: "#1F6C3A", fontSize: 11, fontWeight: 500, marginTop: 4 }}>✓ 100% On-chain Verified</div>
          </div>
          <div style={{ width: 46, height: 46, background: "#EAEDFF", borderRadius: 12, display: "flex", justifyContent: "center", alignItems: "center", fontSize: 20 }}>
            📦
          </div>
        </div>

        <div style={statCardStyle}>
          <div>
            <div style={statLabelStyle}>ĐÃ GIẢI NGÂN (ỨNG 30%)</div>
            <div style={{ color: "#00652C", fontSize: 26, fontWeight: 700, marginTop: 4 }}>{totalAdvanceReceived.toFixed(3)} AVAX</div>
            <div style={{ color: "#3F493F", fontSize: 11, fontFamily: "JetBrains Mono, monospace", fontWeight: 500, marginTop: 4 }}>
              Đã chuyển trực tiếp về ví
            </div>
          </div>
          <div style={{ width: 46, height: 46, background: "rgba(164, 241, 178, 0.45)", borderRadius: 12, display: "flex", justifyContent: "center", alignItems: "center", fontSize: 20 }}>
            💵
          </div>
        </div>

        <div style={statCardStyle}>
          <div>
            <div style={statLabelStyle}>CHỜ TẤT TOÁN (70%)</div>
            <div style={{ color: "#131B2E", fontSize: 26, fontWeight: 700, marginTop: 4 }}>{totalPending70.toFixed(3)} AVAX</div>
            <div style={{ color: "#6F7A6E", fontSize: 11, fontWeight: 500, marginTop: 4 }}>Khóa trong Smart Escrow</div>
          </div>
          <div style={{ width: 46, height: 46, background: "#E2E7FF", borderRadius: 12, display: "flex", justifyContent: "center", alignItems: "center", fontSize: 20 }}>
            🔒
          </div>
        </div>

        <div style={statCardStyle}>
          <div>
            <div style={statLabelStyle}>TRẠNG THÁI KHO BÃI</div>
            <div style={{ color: "#1F6C3A", fontSize: 20, fontWeight: 700, marginTop: 6 }}>Sẵn sàng xuất</div>
            <div style={{ color: "#3F493F", fontSize: 11, fontWeight: 500, marginTop: 4 }}>Đồng bộ Avalanche Fuji</div>
          </div>
          <div style={{ width: 46, height: 46, background: "rgba(164, 241, 178, 0.5)", borderRadius: 12, display: "flex", justifyContent: "center", alignItems: "center", fontSize: 20 }}>
            🚛
          </div>
        </div>
      </div>

      {/* DANH SÁCH LÔ HÀNG KHỞI TẠO */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h3 style={{ margin: 0, color: "#131B2E", fontSize: 18, fontWeight: 700 }}>Danh Sách Lô Hàng Khởi Tạo</h3>
            <span style={{ padding: "3px 10px", background: "#EAEDFF", borderRadius: 9999, color: "#3F493F", fontSize: 12, fontFamily: "JetBrains Mono, monospace", fontWeight: 500 }}>
              {actionableCount} đơn cần xử lý
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: "7px 12px", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#131B2E", cursor: "pointer" }}
            >
              <option value="ALL">Tất cả trạng thái ({myFarmerOrders.length})</option>
              <option value="0">Chờ xuất kho (Created)</option>
              <option value="1">Đang giao - Đã ứng 30%</option>
              <option value="3">Đã hoàn tất</option>
              <option value="4">Đang tranh chấp</option>
            </select>
            <button
              onClick={onRefresh}
              style={{ padding: "7px 12px", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              ↻ Làm mới
            </button>
          </div>
        </div>

        {!account ? (
          <div style={{ padding: 40, background: "#FFFFFF", borderRadius: 12, textAlign: "center", color: "#3F493F", fontSize: 14, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
            Vui lòng bấm <strong>Kết nối Ví Avalanche</strong> (chọn tài khoản ví Nông dân) ở góc trên để xem các lô hàng được giao.
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ padding: 40, background: "#FFFFFF", borderRadius: 12, textAlign: "center", color: "#3F493F", fontSize: 14, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
            Ví hiện tại (<strong>{account.slice(0, 6)}...{account.slice(-4)}</strong>) chưa có lô hàng nông sản nào phù hợp bộ lọc.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(520px, 1fr))", gap: 20 }}>
            {filteredOrders.map((order) => {
              const statusNum = Number(order.status);
              const statusInfo = STATUS_MAP[statusNum] || STATUS_MAP[0];
              const totalAvax = ethers.formatEther(order.totalAmount);
              const expectedAdvance = (Number(totalAvax) * 0.3).toFixed(3);
              const remainAvax = (Number(totalAvax) * 0.7).toFixed(3);
              const batchCode = `AGRI-FUJI-BATCH-${String(order.id).padStart(3, "0")}`;
              const traceUrl = `${window.location.origin}/?traceId=${order.id}`;

              return (
                <div
                  key={order.id.toString()}
                  style={{
                    padding: 22,
                    background: "#FFFFFF",
                    borderRadius: 12,
                    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 18,
                    flexWrap: "wrap"
                  }}
                >
                  <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 14 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ color: "#6F7A6E", fontSize: 12, fontFamily: "JetBrains Mono, monospace", fontWeight: 600 }}>
                          BATCH #{String(order.id).padStart(3, "0")}
                        </span>
                        <span
                          style={{
                            padding: "4px 10px",
                            background: statusInfo.bg,
                            color: statusInfo.color,
                            borderRadius: 9999,
                            fontSize: 11,
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            whiteSpace: "nowrap"
                          }}
                        >
                          <span style={{ width: 6, height: 6, background: statusInfo.dot, borderRadius: "50%" }} />
                          {statusInfo.text}
                        </span>
                      </div>

                      <h4 style={{ margin: 0, color: "#131B2E", fontSize: 19, fontWeight: 700 }}>
                        Lô #{order.id.toString()} — {order.productName}
                      </h4>
                      <div style={{ color: "#3F493F", fontSize: 12 }}>
                        🌿 Tiêu chuẩn VietGAP / GlobalGAP • Smart Escrow Avalanche
                      </div>
                    </div>

                    <div style={{ padding: 12, background: "#F2F3FF", borderRadius: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <div style={{ color: "#3F493F", fontSize: 11, fontWeight: 600 }}>Khối lượng</div>
                        <div style={{ color: "#131B2E", fontSize: 14, fontWeight: 600, marginTop: 2 }}>
                          {order.quantityKg.toString()} kg
                        </div>
                      </div>

                      <div>
                        <div style={{ color: "#3F493F", fontSize: 11, fontWeight: 600 }}>Người mua</div>
                        <div style={{ color: "#131B2E", fontSize: 12, fontFamily: "JetBrains Mono, monospace", fontWeight: 600, marginTop: 3 }}>
                          {order.buyer.slice(0, 6)}...{order.buyer.slice(-4)}
                        </div>
                      </div>

                      <div style={{ paddingTop: 8, borderTop: "1px solid rgba(190, 202, 188, 0.4)" }}>
                        <div style={{ color: "#3F493F", fontSize: 11, fontWeight: 600 }}>Tiền ứng (30%)</div>
                        <div style={{ color: statusNum >= 1 ? "#00652C" : "#92400E", fontSize: 13, fontFamily: "JetBrains Mono, monospace", fontWeight: 600, marginTop: 2 }}>
                          {expectedAdvance} AVAX{" "}
                          <span style={{ fontSize: 11, fontWeight: 500 }}>
                            {statusNum >= 1 ? "✓ Đã nhận" : "(Chờ xuất kho)"}
                          </span>
                        </div>
                      </div>

                      <div style={{ paddingTop: 8, borderTop: "1px solid rgba(190, 202, 188, 0.4)" }}>
                        <div style={{ color: "#3F493F", fontSize: 11, fontWeight: 600 }}>Khóa Escrow (70%)</div>
                        <div style={{ color: "#131B2E", fontSize: 13, fontFamily: "JetBrains Mono, monospace", fontWeight: 600, marginTop: 2 }}>
                          {remainAvax} AVAX
                        </div>
                      </div>
                    </div>

                    <div style={{ padding: "8px 12px", background: "rgba(242, 243, 255, 0.6)", borderRadius: 8, display: "flex", justifyContent: "space-between", fontSize: 12, flexWrap: "wrap", gap: 8 }}>
                      <span style={{ color: "#3F493F" }}>
                        Tổng hợp đồng: <strong style={{ color: "#131B2E" }}>{Number(totalAvax).toFixed(3)} AVAX</strong>
                      </span>
                      <span style={{ color: "#1F6C3A", fontWeight: 600 }}>
                        {statusNum === 0 ? "⏳ Sẵn sàng xuất kho" : statusNum === 1 ? "🚚 Đang vận chuyển" : statusNum === 3 ? "✅ Đã tất toán 100%" : "⚠️ Đang xử lý"}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {statusNum === 0 && (
                        <button
                          disabled={loading}
                          onClick={() => handleConfirmShipment(order.id)}
                          style={{ flex: 1, padding: "10px 14px", background: "#00652C", color: "#FFFFFF", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >
                          {loading ? "⏳ Đang xử lý..." : "🚚 Xác nhận xuất kho & Nhận 30%"}
                        </button>
                      )}

                      {statusNum === 1 && (
                        <button
                          onClick={() => setDisputeModalId(order.id)}
                          style={{ flex: 1, padding: "10px 14px", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >
                          ⚠️ Mở tranh chấp (Khách không nhận hàng)
                        </button>
                      )}

                      <button
                        onClick={() => onSelectTrace(Number(order.id))}
                        style={{ padding: "10px 14px", background: "#EAEDFF", color: "#131B2E", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                      >
                        🔍 Truy xuất
                      </button>
                    </div>

                    {disputeModalId === order.id && (
                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <input
                          type="text"
                          placeholder="Nhập lý do tranh chấp..."
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12 }}
                        />
                        <button
                          disabled={loading}
                          onClick={() => handleFarmerDispute(order.id)}
                          style={{ padding: "8px 12px", background: "#DC2626", color: "#FFFFFF", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >
                          {loading ? "Đang gửi..." : "Gửi Trọng Tài"}
                        </button>
                        <button
                          onClick={() => setDisputeModalId(null)}
                          style={{ padding: "8px 10px", background: "#F1F5F9", border: "none", borderRadius: 8, fontSize: 12, cursor: "pointer" }}
                        >
                          Hủy
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ width: 176, padding: 12, background: "#F2F3FF", borderRadius: 12, display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "center", gap: 10, margin: "0 auto" }}>
                    <div style={{ color: "#3F493F", fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>
                      TEM QR ĐỊNH DANH
                    </div>

                    <div style={{ padding: 10, background: "#FFFFFF", borderRadius: 12, boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)" }}>
                      <QRCodeCanvas
                        id={`qr-canvas-${order.id}`}
                        value={traceUrl}
                        size={112}
                        fgColor="#131B2E"
                        bgColor="#FFFFFF"
                      />
                    </div>

                    <div style={{ textAlign: "center" }}>
                      <div style={{ color: "#131B2E", fontSize: 11, fontFamily: "JetBrains Mono, monospace", fontWeight: 600 }}>
                        {batchCode}
                      </div>
                      <div style={{ color: "#6F7A6E", fontSize: 10, fontWeight: 600, marginTop: 2 }}>
                        Avalanche Fuji C-Chain
                      </div>
                    </div>

                    <button
                      onClick={() => handleDownloadQR(order.id)}
                      style={{ width: "100%", padding: "7px 10px", background: "#FFFFFF", color: "#00652C", border: "1px solid rgba(0, 101, 44, 0.2)", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
                    >
                      ⬇ Tải tem QR
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

{/* KHUNG NHẬT KÝ THỰC ĐỊA & IPFS */}
      <div style={{ padding: 24, background: "#FFFFFF", borderRadius: 12, boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h4 style={{ margin: 0, color: "#131B2E", fontSize: 16, fontWeight: 700 }}>
              Nhật Ký Thực Địa & Kiểm Định Chất Lượng
            </h4>
            <p style={{ margin: "4px 0 0", color: "#3F493F", fontSize: 12 }}>
              Ảnh chụp minh chứng vườn trồng và quy trình đóng gói được hash lưu trữ trực tiếp trên IPFS
            </p>
          </div>
          <span style={{ padding: "5px 12px", background: "#EAEDFF", borderRadius: 8, color: "#1F6C3A", fontSize: 12, fontFamily: "JetBrains Mono, monospace", fontWeight: 600 }}>
            IPFS Cluster: Đã đồng bộ
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {[
            {
              title: "Vườn Ri6 Krông Pắc",
              hash: "Hash: QmZ9...7x2k (Thu hoạch)",
              img: "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=800&q=80"
            },
            {
              title: "Kiểm tra phân loại & đóng thùng",
              hash: "Hash: QmF4...1a8m (Kiểm phẩm)",
              img: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80"
            },
            {
              title: "Niêm phong tem QR định danh",
              hash: "Hash: QmC2...9p4r (Gắn tem)",
              img: "https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=800&q=80"
            }
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                position: "relative",
                height: 176,
                borderRadius: 12,
                overflow: "hidden",
                background: "#EAEDFF",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)"
              }}
            >
              <img
                src={item.img}
                alt={item.title}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block"
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  padding: "24px 12px 10px 12px",
                  background: "linear-gradient(0deg, rgba(19, 27, 46, 0.92) 0%, rgba(19, 27, 46, 0.55) 55%, rgba(19, 27, 46, 0) 100%)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2
                }}
              >
                <div style={{ color: "#EEF0FF", fontSize: 12, fontWeight: 700, letterSpacing: 0.3 }}>
                  {item.title}
                </div>
                <div style={{ color: "#79DB8D", fontSize: 12, fontFamily: "JetBrains Mono, monospace", fontWeight: 500 }}>
                  {item.hash}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
   </div>
  );
}

const statCardStyle = {
  padding: 18,
  background: "#FFFFFF",
  borderRadius: 12,
  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center"
};

const statLabelStyle = {
  color: "#3F493F",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.5
};