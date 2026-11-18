import React, { useState } from "react";
import { ethers } from "ethers";
import { QRCodeCanvas } from "qrcode.react";

const STATUS_MAP = {
  0: { text: "Đã khóa tiền (Created)", color: "#2563eb", bg: "#dbeafe" },
  1: { text: "Đang giao - Đã ứng 30% (Shipped)", color: "#d97706", bg: "#fef3c7" },
  2: { text: "Đã nhận hàng", color: "#059669", bg: "#d1fae5" },
  3: { text: "Hoàn tất (Đã thanh toán 100%)", color: "#16a34a", bg: "#dcfce7" },
  4: { text: "Đang tranh chấp", color: "#dc2626", bg: "#fee2e2" }
};

export default function FarmerAndPaymentView({ rawOrders, account, contract, onRefresh, onSelectTrace }) {
  const [disputeModalId, setDisputeModalId] = useState(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const myFarmerOrders = rawOrders.filter(
    (o) => o.farmer.toLowerCase() === account?.toLowerCase()
  );

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

  return (
    <div style={{ padding: "10px 0" }}>
      <h3>🌾 Dashboard Nông Dân & Theo Dõi Thanh Toán</h3>

      <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
        <div style={cardStatStyle("#ecfdf5", "#059669")}>
          <div>Tổng tiền đã ứng trước (30%)</div>
          <strong style={{ fontSize: "22px" }}>{totalAdvanceReceived.toFixed(4)} AVAX</strong>
        </div>
        <div style={cardStatStyle("#fffbeb", "#d97706")}>
          <div>Tiền chờ giải ngân khi giao xong (70%)</div>
          <strong style={{ fontSize: "22px" }}>{totalPending70.toFixed(4)} AVAX</strong>
        </div>
      </div>

      {myFarmerOrders.length === 0 ? (
        <p style={{ color: "#666" }}>Ví hiện tại của bạn chưa có lô hàng nông sản nào.</p>
      ) : (
        <div style={{ display: "grid", gap: "16px" }}>
          {myFarmerOrders.map((order) => {
            const statusInfo = STATUS_MAP[Number(order.status)];
            const totalAvax = ethers.formatEther(order.totalAmount);
            const advanceAvax = ethers.formatEther(order.advancePaid);
            const remainAvax = ethers.formatEther(order.totalAmount - order.advancePaid);
            const traceUrl = `${window.location.origin}/?traceId=${order.id}`;

            return (
              <div key={order.id.toString()} style={orderCardStyle}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <h4 style={{ margin: 0 }}>Lô #{order.id.toString()} - {order.productName}</h4>
                    <span style={{
                      padding: "4px 10px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: "bold",
                      color: statusInfo.color,
                      backgroundColor: statusInfo.bg
                    }}>
                      {statusInfo.text}
                    </span>
                  </div>

                  <p style={{ margin: "8px 0" }}><strong>Khối lượng:</strong> {order.quantityKg.toString()} kg</p>
                  <p style={{ margin: "4px 0", fontSize: "13px" }}><strong>Người mua:</strong> {order.buyer}</p>

                  <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", marginTop: "8px", fontSize: "14px" }}>
                    <div>💰 Tổng giá trị khóa: <strong>{totalAvax} AVAX</strong></div>
                    <div>✅ Đợt 1 (Ứng trước 30%): <strong>{advanceAvax} AVAX</strong> {Number(order.status) >= 1 ? "(Đã về ví)" : "(Chờ giao hàng)"}</div>
                    <div>⏳ Đợt 2 (Còn lại 70%): <strong>{remainAvax} AVAX</strong> {Number(order.status) === 3 ? "(Đã thanh toán đủ)" : "(Chờ người mua xác nhận)"}</div>
                  </div>

                  {Number(order.status) === 1 && (
                    <div style={{ marginTop: "12px" }}>
                      <button onClick={() => setDisputeModalId(order.id)} style={btnDangerStyle}>
                        ⚠️ Mở tranh chấp (Khách không nhận hàng)
                      </button>
                    </div>
                  )}

                  {disputeModalId === order.id && (
                    <div style={{ marginTop: "10px", display: "flex", gap: "8px" }}>
                      <input
                        type="text"
                        placeholder="Nhập lý do tranh chấp..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
                      />
                      <button disabled={loading} onClick={() => handleFarmerDispute(order.id)} style={btnPrimaryStyle}>
                        {loading ? "Đang gửi..." : "Gửi Trọng Tài"}
                      </button>
                      <button onClick={() => setDisputeModalId(null)}>Hủy</button>
                    </div>
                  )}
                </div>

                <div style={{ textAlign: "center", padding: "10px", borderLeft: "1px solid #eee" }}>
                  <QRCodeCanvas value={traceUrl} size={110} />
                  <div style={{ fontSize: "12px", marginTop: "6px", color: "#555" }}>QR Lô #{order.id.toString()}</div>
                  <button
                    onClick={() => onSelectTrace(Number(order.id))}
                    style={{ marginTop: "6px", fontSize: "12px", cursor: "pointer", color: "#2563eb", background: "none", border: "none", textDecoration: "underline" }}
                  >
                    Xem truy xuất →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const cardStatStyle = (bg, color) => ({
  flex: 1, padding: "16px", borderRadius: "10px", backgroundColor: bg, color: color, border: `1px solid ${color}33`
});
const orderCardStyle = {
  display: "flex", justifyContent: "space-between", gap: "20px", padding: "16px", border: "1px solid #e2e8f0", borderRadius: "12px", backgroundColor: "#fff"
};
const btnPrimaryStyle = {
  padding: "8px 14px", backgroundColor: "#16a34a", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer"
};
const btnDangerStyle = {
  padding: "8px 14px", backgroundColor: "#dc2626", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer"
};