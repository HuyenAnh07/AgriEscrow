import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { QRCodeCanvas } from "qrcode.react";

const STATUS_LABELS = [
  "Đã khóa tiền (Created)",
  "Đang giao - Đã ứng 30% (Shipped)",
  "Đã nhận hàng",
  "Hoàn tất",
  "Tranh chấp"
];

export default function TraceabilityView({ contract, initialOrderId = 1 }) {
  const [searchId, setSearchId] = useState(initialOrderId);
  const [orderData, setOrderData] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(false);

  const formatTime = (timestamp) => {
    if (!timestamp || Number(timestamp) === 0) return "";
    return new Date(Number(timestamp) * 1000).toLocaleString("vi-VN");
  };

  const fetchTraceHistory = async (id) => {
    if (!contract || !id) return;
    try {
      setLoading(true);
      const order = await contract.getOrder(id);
      if (Number(order.id) === 0) {
        setOrderData(null);
        return;
      }
      setOrderData(order);

      const eventsList = [];

      // Giới hạn quét trong 90 block gần nhất để không vượt ngưỡng 100 block của Avalanche Fuji RPC
      try {
        const provider = contract.runner?.provider;
        const currentBlock = provider ? await provider.getBlockNumber() : null;
        const fromBlock = currentBlock ? Math.max(0, currentBlock - 90) : -90;
        const toBlock = currentBlock || "latest";

        const [shippedEvents, deliveredEvents, disputeEvents, resolvedEvents] = await Promise.all([
          contract.queryFilter(contract.filters.ShipmentConfirmed(id), fromBlock, toBlock),
          contract.queryFilter(contract.filters.DeliveryConfirmed(id), fromBlock, toBlock),
          contract.queryFilter(contract.filters.DisputeRaised(id), fromBlock, toBlock),
          contract.queryFilter(contract.filters.DisputeResolved(id), fromBlock, toBlock),
        ]);

        shippedEvents.forEach((e) => {
          eventsList.push({
            blockNumber: e.blockNumber,
            title: "🚚 Nông dân xác nhận xuất kho & giao hàng",
            detail: `Đã tự động giải ngân ứng trước 30% (${ethers.formatEther(e.args.advanceAmount)} AVAX) ${Number(order.shippedAt) > 0 ? `- Lúc: ${formatTime(order.shippedAt)}` : ""}`
          });
        });

        deliveredEvents.forEach((e) => {
          eventsList.push({
            blockNumber: e.blockNumber,
            title: "📦 Người mua xác nhận đã nhận hàng",
            detail: `Đã giải ngân nốt 70% (${ethers.formatEther(e.args.remainingAmount)} AVAX) cho nông dân`
          });
        });

        disputeEvents.forEach((e) => {
          eventsList.push({
            blockNumber: e.blockNumber,
            title: "⚠️ Phát sinh tranh chấp lô hàng",
            detail: `Lý do: "${e.args.reason}" (Mở bởi: ${e.args.raisedBy.slice(0, 8)}...)`
          });
        });

        resolvedEvents.forEach((e) => {
          eventsList.push({
            blockNumber: e.blockNumber,
            title: "⚖️ Trọng tài đã phân xử tranh chấp",
            detail: e.args.favorFarmer
              ? `Xử nông dân thắng - Chuyển ${ethers.formatEther(e.args.amount)} AVAX`
              : `Xử người mua thắng - Hoàn ${ethers.formatEther(e.args.amount)} AVAX`
          });
        });
      } catch (logErr) {
        console.warn("Không thể tải log chi tiết (do giới hạn block RPC):", logErr);
        // Dự phòng: Hiển thị mốc giao hàng từ timestamp lưu trực tiếp trên struct Order nếu log vượt quá 90 block
        if (Number(order.shippedAt) > 0) {
          eventsList.push({
            blockNumber: "On-chain",
            title: "🚚 Nông dân xác nhận xuất kho & giao hàng",
            detail: `Đã giải ngân ứng trước 30% (${ethers.formatEther(order.advancePaid)} AVAX) - Lúc: ${formatTime(order.shippedAt)}`
          });
        }
        if (Number(order.status) === 3) {
          eventsList.push({
            blockNumber: "On-chain",
            title: "📦 Hoàn tất giao dịch & Thanh toán 100%",
            detail: `Đã giải ngân toàn bộ ${ethers.formatEther(order.totalAmount)} AVAX`
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
    fetchTraceHistory(searchId);
  }, [contract, initialOrderId]);

  return (
    <div style={{ padding: "10px 0", maxWidth: "800px", margin: "0 auto" }}>
      <h3>🔍 Truy Xuất Nguồn Gốc & Lịch Sử Lô Hàng</h3>

      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <input
          type="number"
          min="1"
          value={searchId}
          onChange={(e) => setSearchId(e.target.value)}
          placeholder="Nhập mã lô hàng (VD: 1)"
          style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc", width: "220px" }}
        />
        <button
          onClick={() => fetchTraceHistory(searchId)}
          style={{ padding: "10px 18px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}
        >
          Truy xuất Blockchain
        </button>
      </div>

      {loading && <p>Đang tải dữ liệu từ Avalanche Fuji...</p>}

      {!loading && !orderData && (
        <p style={{ color: "#dc2626" }}>Không tìm thấy dữ liệu cho lô hàng #{searchId} (hoặc hãy bấm Kết nối Ví Avalanche trước).</p>
      )}

      {!loading && orderData && (
        <div style={{ border: "1px solid #cbd5e1", borderRadius: "12px", padding: "20px", background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eee", paddingBottom: "16px" }}>
            <div>
              <h4 style={{ margin: "0 0 8px 0" }}>Nông sản: {orderData.productName} (Lô #{orderData.id.toString()})</h4>
              <p style={{ margin: "4px 0" }}><strong>Khối lượng:</strong> {orderData.quantityKg.toString()} kg</p>
              <p style={{ margin: "4px 0" }}><strong>Trạng thái hiện tại:</strong> {STATUS_LABELS[Number(orderData.status)]}</p>
              <p style={{ margin: "4px 0", fontSize: "13px", color: "#555" }}><strong>Ví Nông dân:</strong> {orderData.farmer}</p>
              <p style={{ margin: "4px 0", fontSize: "13px", color: "#555" }}><strong>Ví Người mua:</strong> {orderData.buyer}</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <QRCodeCanvas value={`${window.location.origin}/?traceId=${orderData.id}`} size={100} />
              <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>Quét để kiểm chứng</div>
            </div>
          </div>

          <h4 style={{ marginTop: "20px" }}>📜 Nhật ký hành trình trên Blockchain</h4>
          <div style={{ borderLeft: "3px solid #16a34a", paddingLeft: "16px", marginLeft: "8px", display: "grid", gap: "16px" }}>
            <div>
              <strong>🌱 Khởi tạo hợp đồng & Khóa tiền ký quỹ</strong>
              <div style={{ fontSize: "14px", color: "#444" }}>
                Người mua đã khóa {ethers.formatEther(orderData.totalAmount)} AVAX vào Smart Contract.{" "}
                {Number(orderData.createdAt) > 0 && `(Lúc: ${formatTime(orderData.createdAt)})`}
              </div>
            </div>

            {timeline.map((item, idx) => (
              <div key={idx}>
                <strong>{item.title}</strong> <span style={{ fontSize: "12px", color: "#888" }}>(Block #{item.blockNumber})</span>
                <div style={{ fontSize: "14px", color: "#444" }}>{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}