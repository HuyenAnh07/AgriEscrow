import React, { useState, useEffect } from "react";
import { ethers } from "ethers";

export default function BuyerDeliveryAndArbitratorView({ rawOrders = [], account, contract, onRefresh }) {
  const [disputeId, setDisputeId] = useState(null);
  const [reason, setReason] = useState("");
  const [loadingId, setLoadingId] = useState(null);
  const [disputeReasonsMap, setDisputeReasonsMap] = useState({});

  const safeOrders = Array.isArray(rawOrders) ? rawOrders : [];

  const buyerShippedOrders = safeOrders.filter(
    (o) => o?.buyer?.toLowerCase() === account?.toLowerCase() && Number(o.status) === 1
  );

  const arbitratorDisputedOrders = safeOrders.filter(
    (o) => o?.arbitrator?.toLowerCase() === account?.toLowerCase() && Number(o.status) === 4
  );

  useEffect(() => {
    const fetchDisputeReasons = async () => {
      if (!contract || arbitratorDisputedOrders.length === 0) return;
      try {
        const events = await contract.queryFilter(contract.filters.DisputeRaised());
        const map = {};
        events.forEach((e) => {
          map[Number(e.args.orderId)] = e.args.reason;
        });
        setDisputeReasonsMap(map);
      } catch (err) {
        console.error("Lỗi đọc event tranh chấp:", err);
      }
    };
    fetchDisputeReasons();
  }, [contract, safeOrders.length]);

  const handleConfirmDelivery = async (orderId) => {
    try {
      setLoadingId(orderId);
      const tx = await contract.confirmDelivery(orderId);
      await tx.wait();
      alert("Xác nhận nhận hàng thành công! Đã giải ngân 70% còn lại cho nông dân.");
      onRefresh();
    } catch (err) {
      alert("Lỗi: " + (err.reason || err.message));
    } finally {
      setLoadingId(null);
    }
  };

  const handleRaiseDispute = async (orderId) => {
    if (!reason.trim()) return alert("Vui lòng nhập lý do khiếu nại!");
    try {
      setLoadingId(orderId);
      const tx = await contract.raiseDispute(orderId, reason);
      await tx.wait();
      alert("Đã mở tranh chấp! Tiền 70% đang được khóa chờ Trọng tài phân xử.");
      setDisputeId(null);
      setReason("");
      onRefresh();
    } catch (err) {
      alert("Lỗi: " + (err.reason || err.message));
    } finally {
      setLoadingId(null);
    }
  };

  const handleResolveDispute = async (orderId, favorFarmer) => {
    const confirmMsg = favorFarmer
      ? "Xác nhận chuyển 70% còn lại cho NÔNG DÂN?"
      : "Xác nhận hoàn trả 70% còn lại cho NGƯỜI MUA?";
    if (!window.confirm(confirmMsg)) return;

    try {
      setLoadingId(orderId);
      const tx = await contract.resolveDispute(orderId, favorFarmer);
      await tx.wait();
      alert("Đã phân xử tranh chấp hoàn tất!");
      onRefresh();
    } catch (err) {
      alert("Lỗi: " + (err.reason || err.message));
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div style={{ padding: "10px 0", display: "grid", gap: "32px" }}>
      {/* KHU VỰC 1: XÁC NHẬN NHẬN HÀNG (NGƯỜI MUA) */}
      <section style={{ border: "1px solid #e5e7eb", padding: "20px", borderRadius: "12px", backgroundColor: "#fff" }}>
        <h3 style={{ marginTop: 0 }}>📦 Xác Nhận Nhận Hàng (Người Mua)</h3>
        {!account ? (
          <p style={{ color: "#d97706" }}>⚠️ Vui lòng bấm nút <strong>"Kết nối Ví Avalanche"</strong> ở góc trên bên phải để tải đơn hàng.</p>
        ) : buyerShippedOrders.length === 0 ? (
          <p style={{ color: "#666" }}>Không có đơn hàng nào đang giao chờ ví của bạn xác nhận.</p>
        ) : (
          buyerShippedOrders.map((order) => {
            const remainAvax = ethers.formatEther(order.totalAmount - order.advancePaid);
            return (
              <div key={order.id.toString()} style={boxStyle}>
                <h4 style={{ margin: "0 0 8px 0" }}>Đơn #{order.id.toString()} - {order.productName} ({order.quantityKg.toString()} kg)</h4>
                <p style={{ margin: "4px 0" }}>Nông dân: {order.farmer}</p>
                <p style={{ margin: "4px 0" }}>Số tiền sẽ giải ngân khi bấm nhận hàng (70%): <strong>{remainAvax} AVAX</strong></p>

                <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                  <button
                    disabled={loadingId === order.id}
                    onClick={() => handleConfirmDelivery(order.id)}
                    style={{ padding: "10px 16px", background: "#16a34a", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
                  >
                    {loadingId === order.id ? "Đang xử lý..." : "✅ Xác nhận đã nhận đủ hàng"}
                  </button>

                  <button
                    onClick={() => setDisputeId(order.id)}
                    style={{ padding: "10px 16px", background: "#dc2626", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}
                  >
                    ⚠️ Khiếu nại / Mở tranh chấp
                  </button>
                </div>

                {disputeId === order.id && (
                  <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
                    <input
                      type="text"
                      placeholder="Nhập lý do (VD: Hàng hư hỏng, giao thiếu cân)..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
                    />
                    <button onClick={() => handleRaiseDispute(order.id)} style={{ padding: "8px 14px", background: "#dc2626", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>
                      Gửi khiếu nại
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>

      {/* KHU VỰC 2: GIAO DIỆN TRỌNG TÀI */}
      <section style={{ border: "1px solid #e5e7eb", padding: "20px", borderRadius: "12px", backgroundColor: "#fff" }}>
        <h3 style={{ marginTop: 0 }}>⚖️ Bảng Điều Khiển Trọng Tài (Phân Xử Tranh Chấp)</h3>
        {!account ? (
          <p style={{ color: "#d97706" }}>⚠️ Vui lòng kết nối ví Trọng tài để xem các vụ tranh chấp cần phân xử.</p>
        ) : arbitratorDisputedOrders.length === 0 ? (
          <p style={{ color: "#666" }}>Hiện không có vụ tranh chấp nào cần ví của bạn phân xử.</p>
        ) : (
          arbitratorDisputedOrders.map((order) => {
            const remainAvax = ethers.formatEther(order.totalAmount - order.advancePaid);
            const reasonText = disputeReasonsMap[Number(order.id)] || "Đang tải lý do từ sự kiện...";
            return (
              <div key={order.id.toString()} style={{ ...boxStyle, borderColor: "#fca5a5", backgroundColor: "#fef2f2" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <h4 style={{ margin: 0 }}>Tranh chấp Đơn #{order.id.toString()} - {order.productName}</h4>
                  <span style={{ color: "#dc2626", fontWeight: "bold" }}>Đang tranh chấp</span>
                </div>
                <p style={{ margin: "6px 0", fontSize: "13px" }}><strong>Người mua:</strong> {order.buyer}</p>
                <p style={{ margin: "6px 0", fontSize: "13px" }}><strong>Nông dân:</strong> {order.farmer}</p>
                <p style={{ margin: "6px 0" }}><strong>Lý do tranh chấp:</strong> <span style={{ color: "#b91c1c", fontWeight: "bold" }}>"{reasonText}"</span></p>
                <p style={{ margin: "6px 0" }}><strong>Số tiền tạm giữ chờ phân xử (70%):</strong> {remainAvax} AVAX</p>

                <div style={{ display: "flex", gap: "12px", marginTop: "14px" }}>
                  <button
                    disabled={loadingId === order.id}
                    onClick={() => handleResolveDispute(order.id, true)}
                    style={{ padding: "10px 16px", background: "#059669", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}
                  >
                    👨‍🌾 Xử Nông dân thắng (Chuyển {remainAvax} AVAX cho Farmer)
                  </button>

                  <button
                    disabled={loadingId === order.id}
                    onClick={() => handleResolveDispute(order.id, false)}
                    style={{ padding: "10px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}
                  >
                    🛒 Xử Người mua thắng (Hoàn {remainAvax} AVAX cho Buyer)
                  </button>
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}

const boxStyle = {
  padding: "16px", border: "1px solid #cbd5e1", borderRadius: "10px", backgroundColor: "#f8fafc", marginBottom: "12px"
};