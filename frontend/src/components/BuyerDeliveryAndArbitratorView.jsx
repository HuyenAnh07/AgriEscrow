import React, { useState, useEffect } from "react";
import { ethers } from "ethers";

export default function BuyerDeliveryAndArbitratorView({ rawOrders = [], account, contract, onRefresh }) {
  const [reasonsByOrder, setReasonsByOrder] = useState({});
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
    const reasonText = (reasonsByOrder[orderId.toString()] || "").trim();
    if (!reasonText) return alert("Vui lòng nhập mô tả lý do khiếu nại trước khi gửi!");
    try {
      setLoadingId(orderId);
      const tx = await contract.raiseDispute(orderId, reasonText);
      await tx.wait();
      alert("Đã mở tranh chấp! Tiền 70% đang được khóa chờ Trọng tài phân xử.");
      setReasonsByOrder((prev) => ({ ...prev, [orderId.toString()]: "" }));
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
    <div style={{ display: "flex", flexDirection: "column", gap: 32, fontFamily: "Inter, system-ui, sans-serif", color: "#131B2E" }}>
      {/* THANH BANNER TRẠNG THÁI GIAI ĐOẠN 3 */}
      <div style={{ padding: 16, background: "#FFFFFF", borderRadius: 12, boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, background: "#A4F1B2", borderRadius: "50%", display: "flex", justifyContent: "center", alignItems: "center", fontSize: 18 }}>
            🛡️
          </div>
          <div>
            <div style={{ color: "#131B2E", fontSize: 16, fontWeight: 600 }}>
              Giai Đoạn 3: Quyết Toán & Giải Quyết Tranh Chấp
            </div>
            <div style={{ color: "#3F493F", fontSize: 12, marginTop: 2 }}>
              Smart Contract Escrow v2.4 • Mạng thử nghiệm Avalanche Fuji C-Chain
            </div>
          </div>
        </div>

        <div style={{ padding: "6px 14px", background: "#EAEDFF", borderRadius: 9999, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, background: "#00652C", borderRadius: "50%" }} />
          <span style={{ color: "#131B2E", fontSize: 12, fontFamily: "JetBrains Mono, monospace", fontWeight: 500 }}>
            Avalanche Fuji C-Chain Active
          </span>
        </div>
      </div>

      {/* =====================================================================
          KHU VỰC 1: CỔNG THANH TOÁN NGƯỜI MUA (XÁC NHẬN NHẬN HÀNG / KHIẾU NẠI)
      ====================================================================== */}
      <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#00652C", fontSize: 12, fontWeight: 600, letterSpacing: 0.6 }}>
              <span>💳</span> CỔNG THANH TOÁN NGƯỜI MUA
            </div>
            <h2 style={{ margin: "4px 0", color: "#131B2E", fontSize: 26, fontWeight: 700 }}>
              Xác Nhận Nhận Hàng — Dành Cho Người Mua
            </h2>
            <p style={{ margin: 0, color: "#3F493F", fontSize: 14 }}>
              Kiểm tra chất lượng nông sản khi nhận và hoàn tất giải ngân nốt 70% số tiền.
            </p>
          </div>

          <div style={{ padding: "6px 14px", background: "#E2E7FF", borderRadius: 9999, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, background: account ? "#00652C" : "#D97706", borderRadius: "50%" }} />
            <span style={{ color: "#131B2E", fontSize: 12, fontFamily: "JetBrains Mono, monospace", fontWeight: 500 }}>
              Ví người mua: {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Chưa kết nối"}
            </span>
          </div>
        </div>

        {!account ? (
          <div style={{ padding: 36, background: "#FFFFFF", borderRadius: 12, textAlign: "center", color: "#3F493F", fontSize: 14, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
              Vui lòng bấm <strong>Kết nối Ví Avalanche</strong> ở góc trên bên phải để tải các đơn hàng đang giao tới ví của bạn.
          </div>
        ) : buyerShippedOrders.length === 0 ? (
          <div style={{ padding: 36, background: "#FFFFFF", borderRadius: 12, textAlign: "center", color: "#3F493F", fontSize: 14, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
            Không có đơn hàng nào đang ở trạng thái <strong>Đang giao (Shipped)</strong> chờ ví <strong>{account.slice(0, 6)}...{account.slice(-4)}</strong> nghiệm thu.
          </div>
        ) : (
          buyerShippedOrders.map((order) => {
            const totalAvax = Number(ethers.formatEther(order.totalAmount));
            const advanceAvax = Number(ethers.formatEther(order.advancePaid));
            const remainAvax = Number(ethers.formatEther(order.totalAmount - order.advancePaid));
            const isLoading = loadingId === order.id;

            return (
              <div
                key={order.id.toString()}
                style={{
                  padding: 24,
                  background: "#FFFFFF",
                  borderRadius: 12,
                  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 20
                }}
              >
                {/* Header thông tin lô hàng */}
                <div style={{ paddingBottom: 16, borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <img
                      src="https://images.unsplash.com/photo-1595855759920-86582396756a?auto=format&fit=crop&w=200&q=80"
                      alt={order.productName}
                      style={{ width: 60, height: 60, borderRadius: 12, objectFit: "cover", boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }}
                    />
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <h3 style={{ margin: 0, color: "#131B2E", fontSize: 20, fontWeight: 700 }}>
                          Lô #{order.id.toString()} — {order.productName} ({order.quantityKg.toString()} kg)
                        </h3>
                        <span style={{ padding: "3px 10px", background: "#A4F1B2", color: "#24703E", borderRadius: 9999, fontSize: 11, fontWeight: 600 }}>
                          Đang chờ nghiệm thu
                        </span>
                      </div>
                      <div style={{ color: "#3F493F", fontSize: 12, marginTop: 4 }}>
                        🌱 Nông dân: <strong style={{ color: "#131B2E", fontFamily: "JetBrains Mono, monospace" }}>{order.farmer.slice(0, 6)}...{order.farmer.slice(-4)}</strong> • Chuẩn VietGAP / Smart Escrow
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "#3F493F", fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>
                      TỔNG GIÁ TRỊ HỢP ĐỒNG
                    </div>
                    <div style={{ color: "#00652C", fontSize: 18, fontFamily: "JetBrains Mono, monospace", fontWeight: 700, marginTop: 2 }}>
                      {totalAvax.toFixed(3)} AVAX
                    </div>
                  </div>
                </div>

                {/* Thanh tiến trình khóa tiền 30% / 70% */}
                <div style={{ padding: 16, background: "#F2F3FF", borderRadius: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ color: "#131B2E", fontSize: 12, fontWeight: 700 }}>
                        Cơ Chế Khóa Tiền Smart Escrow: Tổng ký quỹ {totalAvax.toFixed(3)} AVAX
                    </div>
                    <div style={{ color: "#3F493F", fontSize: 12, fontFamily: "JetBrains Mono, monospace", fontWeight: 500 }}>
                      Giải ngân giai đoạn: 30% / 70%
                    </div>
                  </div>

                  {/* Thanh progress bar 30% - 70% */}
                  <div style={{ height: 12, background: "#E2E7FF", borderRadius: 9999, overflow: "hidden", display: "flex", gap: 2 }}>
                    <div style={{ width: "30%", background: "#15803D" }} />
                    <div style={{ width: "70%", background: "rgba(121, 219, 141, 0.85)" }} />
                  </div>

                  {/* 2 thẻ chi tiết 30% và 70% */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10, marginTop: 4 }}>
                    <div style={{ padding: 10, background: "#FFFFFF", borderRadius: 8, boxShadow: "0 1px 2px rgba(0,0,0,0.04)", display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 16 }}>✅</span>
                      <div>
                        <div style={{ color: "#131B2E", fontSize: 12, fontWeight: 700 }}>
                          {advanceAvax.toFixed(3)} AVAX (30%) Đã Ứng Xuất Kho
                        </div>
                        <div style={{ color: "#3F493F", fontSize: 12 }}>
                          Đã chuyển ví nông dân khi xe rời vựa
                        </div>
                      </div>
                    </div>

                    <div style={{ padding: 10, background: "#FFFFFF", borderRadius: 8, boxShadow: "0 1px 2px rgba(0,0,0,0.04)", display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 16 }}>⏳</span>
                      <div>
                        <div style={{ color: "#131B2E", fontSize: 12, fontWeight: 700 }}>
                          {remainAvax.toFixed(3)} AVAX (70%) Đang Giữ Ký Quỹ
                        </div>
                        <div style={{ color: "#3F493F", fontSize: 12 }}>
                          Đang giữ an toàn trong hợp đồng, chờ người mua duyệt
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2 Cột Hành Động: Đạt Tiêu Chuẩn (Trái) & Khiếu Nại (Phải) */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
                  {/* CỘT TRÁI: HÀNG ĐẠT TIÊU CHUẨN */}
                  <div style={{ padding: 22, background: "rgba(164, 241, 178, 0.22)", borderRadius: 12, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 18 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ color: "#00652C", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                        <span>✓</span> Hàng Đạt Tiêu Chuẩn & Đủ Số Lượng
                      </div>
                      <p style={{ margin: 0, color: "#3F493F", fontSize: 13.5, lineHeight: 1.55 }}>
                        Xác nhận hàng tươi ngon, đúng quy cách và đủ khối lượng cam kết <strong>{order.quantityKg.toString()} kg</strong>. Hệ thống sẽ tự động kích hoạt smart contract giải ngân tức thời{" "}
                        <strong style={{ color: "#131B2E" }}>{remainAvax.toFixed(3)} AVAX</strong> còn lại cho Nông dân.
                      </p>

                      <div style={{ padding: "8px 12px", background: "#FFFFFF", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                        <span style={{ color: "#3F493F" }}>Trạng thái kiểm tra:</span>
                        <span style={{ color: "#00652C", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 6, height: 6, background: "#00652C", borderRadius: "50%" }} />
                          Sẵn sàng giải ngân
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <button
                        disabled={isLoading}
                        onClick={() => handleConfirmDelivery(order.id)}
                        style={{
                          width: "100%",
                          padding: "12px 16px",
                          background: "#00652C",
                          color: "#FFFFFF",
                          border: "none",
                          borderRadius: 8,
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: isLoading ? "not-allowed" : "pointer",
                          boxShadow: "0 2px 4px rgba(0, 101, 44, 0.2)"
                        }}
                      >
                        {isLoading ? " Đang gửi giao dịch..." : "✓ Xác nhận đã nhận đủ hàng (Giải ngân 70%)"}
                      </button>
                      <div style={{ textAlign: "center", color: "#6F7A6E", fontSize: 11, fontWeight: 600 }}>
                        Giao dịch được ký trực tiếp trên ví Avalanche Web3
                      </div>
                    </div>
                  </div>

                  {/* CỘT PHẢI: HÀNG BỊ HƯ HẠI HOẶC THIẾU HỤT */}
                  <div style={{ padding: 22, background: "rgba(255, 218, 214, 0.25)", borderRadius: 12, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 18 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ color: "#D13034", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                        <span></span> Hàng Bị Hư Hại Hoặc Thiếu Hụt
                      </div>
                      <p style={{ margin: 0, color: "#3F493F", fontSize: 13.5, lineHeight: 1.55 }}>
                        Nếu nông sản có vấn đề về phẩm cấp hoặc thiếu số lượng, mở khiếu nại để tạm giữ{" "}
                        <strong style={{ color: "#131B2E" }}>{remainAvax.toFixed(3)} AVAX</strong> và đưa vào phiên phân xử của Hội đồng Trọng tài nông nghiệp.
                      </p>

                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <label style={{ color: "#131B2E", fontSize: 12, fontWeight: 600 }}>
                          Mô tả lý do khiếu nại:
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Nhập lý do khiếu nại (VD: Giao thiếu 15kg, trái dập nát 20% khi tháo thùng kiểm hàng)..."
                          value={reasonsByOrder[order.id.toString()] || ""}
                          onChange={(e) =>
                            setReasonsByOrder((prev) => ({
                              ...prev,
                              [order.id.toString()]: e.target.value
                            }))
                          }
                          style={{
                            width: "100%",
                            boxSizing: "border-box",
                            padding: 10,
                            background: "#FFFFFF",
                            border: "1px solid #FECACA",
                            borderRadius: 8,
                            fontSize: 13,
                            fontFamily: "Inter, sans-serif",
                            resize: "vertical"
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <button
                        disabled={isLoading}
                        onClick={() => handleRaiseDispute(order.id)}
                        style={{
                          width: "100%",
                          padding: "12px 16px",
                          background: "#FFFFFF",
                          color: "#D13034",
                          border: "1px solid #FECACA",
                          borderRadius: 8,
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: isLoading ? "not-allowed" : "pointer",
                          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)"
                        }}
                      >
                        {isLoading ? " Đang gửi khiếu nại..." : " Khiếu nại / Mở tranh chấp"}
                      </button>
                      <div style={{ textAlign: "center", color: "#6F7A6E", fontSize: 11, fontWeight: 600 }}>
                        Smart Contract sẽ tự động chuyển sang trạng thái Tranh Chấp
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* =====================================================================
          KHU VỰC 2: HỘI ĐỒNG GIÁM SÁT PHÂN QUYỀN (BẢNG ĐIỀU KHIỂN TRỌNG TÀI)
      ====================================================================== */}
      <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#AE121F", fontSize: 12, fontWeight: 600, letterSpacing: 0.6 }}>
              <span></span> HỘI ĐỒNG GIÁM SÁT PHÂN QUYỀN
            </div>
            <h2 style={{ margin: "4px 0", color: "#131B2E", fontSize: 26, fontWeight: 700 }}>
              Bảng Điều Khiển Trọng Tài Phân Xử
            </h2>
            <p style={{ margin: 0, color: "#3F493F", fontSize: 14 }}>
              Phán quyết minh bạch dựa trên dữ liệu hành trình IoT và biên bản thẩm định thực địa.
            </p>
          </div>

          <div style={{ padding: "6px 14px", background: "#E2E7FF", borderRadius: 9999, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, background: "#AE121F", borderRadius: "50%" }} />
            <span style={{ color: "#131B2E", fontSize: 12, fontFamily: "JetBrains Mono, monospace", fontWeight: 500 }}>
              Trọng Tài Phân Quyền: {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Chưa kết nối"}
            </span>
          </div>
        </div>

        {!account ? (
          <div style={{ padding: 36, background: "#FFFFFF", borderRadius: 12, textAlign: "center", color: "#3F493F", fontSize: 14, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
             Vui lòng kết nối ví <strong>Trọng Tài (Arbitrator)</strong> để xem và phân xử các vụ tranh chấp đang mở.
          </div>
        ) : arbitratorDisputedOrders.length === 0 ? (
          <div style={{ padding: 36, background: "#FFFFFF", borderRadius: 12, textAlign: "center", color: "#3F493F", fontSize: 14, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
            Hiện không có vụ tranh chấp nào cần ví <strong>{account.slice(0, 6)}...{account.slice(-4)}</strong> phân xử.
          </div>
        ) : (
          arbitratorDisputedOrders.map((order) => {
            const remainAvax = Number(ethers.formatEther(order.totalAmount - order.advancePaid));
            const reasonText = disputeReasonsMap[Number(order.id)] || "Đang tải lý do từ sự kiện DisputeRaised...";
            const isLoading = loadingId === order.id;

            return (
              <div
                key={order.id.toString()}
                style={{
                  position: "relative",
                  padding: "32px 24px 24px 24px",
                  background: "#FFFFFF",
                  borderRadius: 12,
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.08)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  gap: 20
                }}
              >
                {/* Viền gradient đỏ-xanh trên cùng */}
                <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 6, background: "linear-gradient(90deg, #AE121F 0%, #D13034 50%, #A4F1B2 100%)" }} />

                {/* Header vụ tranh chấp */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 48, height: 48, background: "rgba(209, 48, 52, 0.10)", borderRadius: 12, display: "flex", justifyContent: "center", alignItems: "center", fontSize: 22 }}>
                      🚨
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <h3 style={{ margin: 0, color: "#131B2E", fontSize: 20, fontWeight: 700 }}>
                          Phán Quyết Tranh Chấp Đang Mở
                        </h3>
                        <span style={{ padding: "3px 10px", background: "#FFDAD6", color: "#93000A", borderRadius: 9999, fontSize: 11, fontWeight: 600 }}>
                          Cần Xử Lý
                        </span>
                      </div>
                      <div style={{ color: "#131B2E", fontSize: 15, fontWeight: 600, marginTop: 2 }}>
                        Lô #{order.id.toString()} — {order.productName} ({order.quantityKg.toString()} kg)
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ padding: "5px 10px", background: "#EAEDFF", color: "#131B2E", borderRadius: 6, fontSize: 12, fontFamily: "JetBrains Mono, monospace", fontWeight: 500 }}>
                      EscrowID: #AVAX-AGRI-{String(order.id).padStart(4, "0")}
                    </span>
                    <span style={{ padding: "5px 10px", background: "#D13034", color: "#FFFFFF", borderRadius: 6, fontSize: 12, fontFamily: "JetBrains Mono, monospace", fontWeight: 600 }}>
                      Ký quỹ giữ lại: {remainAvax.toFixed(3)} AVAX
                    </span>
                  </div>
                </div>

                {/* Bảng thông tin 3 bên & Lý do khiếu nại */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ padding: 12, background: "#F2F3FF", borderRadius: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                    <div>
                      <div style={{ color: "#3F493F", fontSize: 11, fontWeight: 600 }}>NGƯỜI MUA</div>
                      <div style={{ color: "#131B2E", fontSize: 13, fontFamily: "JetBrains Mono, monospace", fontWeight: 600, marginTop: 2 }}>
                        {order.buyer.slice(0, 6)}...{order.buyer.slice(-4)}
                      </div>
                    </div>

                    <div>
                      <div style={{ color: "#3F493F", fontSize: 11, fontWeight: 600 }}>NÔNG DÂN VƯỜN</div>
                      <div style={{ color: "#131B2E", fontSize: 13, fontFamily: "JetBrains Mono, monospace", fontWeight: 600, marginTop: 2 }}>
                        {order.farmer.slice(0, 6)}...{order.farmer.slice(-4)}
                      </div>
                    </div>

                    <div>
                      <div style={{ color: "#3F493F", fontSize: 11, fontWeight: 600 }}>TIỀN TRANH CHẤP (70%)</div>
                      <div style={{ color: "#AE121F", fontSize: 13, fontFamily: "JetBrains Mono, monospace", fontWeight: 700, marginTop: 2 }}>
                        {remainAvax.toFixed(3)} AVAX
                      </div>
                    </div>
                  </div>

                  {/* Khung lý do khiếu nại & Bằng chứng */}
                  <div style={{ padding: 16, background: "rgba(255, 218, 214, 0.30)", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <span style={{ fontSize: 18 }}></span>
                      <div>
                        <div style={{ color: "#131B2E", fontSize: 15, fontWeight: 700 }}>
                          Lý do khiếu nại: "{reasonText}"
                        </div>
                        <div style={{ color: "#3F493F", fontSize: 12, marginTop: 4 }}>
                          Dữ liệu đối soát từ sự kiện on-chain DisputeRaised • Hợp đồng thông minh đã tạm khóa khoản 70%.
                        </div>
                      </div>
                    </div>

                    <a
                      href={`https://testnet.snowtrace.io/address/${order.farmer}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ padding: "6px 12px", background: "#FFFFFF", color: "#00652C", borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: "none", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}
                    >
                       Kiểm tra lịch sử trên Snowtrace
                    </a>
                  </div>
                </div>

                {/* 2 Nút Phương Án Phán Quyết Trọng Tài */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ color: "#131B2E", fontSize: 12, fontWeight: 600 }}>
                     Chọn Phương Án Phán Quyết Trọng Tài:
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                    {/* Phương án 1: Hoàn cho Người Mua */}
                    <button
                      disabled={isLoading}
                      onClick={() => handleResolveDispute(order.id, false)}
                      style={{
                        padding: 16,
                        background: "#F2F3FF",
                        border: "1px solid #FECACA",
                        borderRadius: 12,
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        textAlign: "left",
                        cursor: isLoading ? "not-allowed" : "pointer",
                        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)"
                      }}
                    >
                      <div style={{ width: 42, height: 42, background: "#FFFFFF", borderRadius: 8, display: "flex", justifyContent: "center", alignItems: "center", fontSize: 18, flexShrink: 0 }}>
                        🛒
                      </div>
                      <div>
                        <div style={{ color: "#AE121F", fontSize: 15, fontWeight: 700 }}>
                          Hoàn {remainAvax.toFixed(3)} AVAX cho Người Mua
                        </div>
                        <div style={{ color: "#3F493F", fontSize: 12, marginTop: 2 }}>
                          Chấp thuận khiếu nại — Nông dân vi phạm cam kết hợp đồng.
                        </div>
                      </div>
                    </button>

                    {/* Phương án 2: Thanh toán cho Nông Dân */}
                    <button
                      disabled={isLoading}
                      onClick={() => handleResolveDispute(order.id, true)}
                      style={{
                        padding: 16,
                        background: "#F2F3FF",
                        border: "1px solid #BBF7D0",
                        borderRadius: 12,
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        textAlign: "left",
                        cursor: isLoading ? "not-allowed" : "pointer",
                        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)"
                      }}
                    >
                      <div style={{ width: 42, height: 42, background: "#FFFFFF", borderRadius: 8, display: "flex", justifyContent: "center", alignItems: "center", fontSize: 18, flexShrink: 0 }}>
                        👨‍🌾
                      </div>
                      <div>
                        <div style={{ color: "#00652C", fontSize: 15, fontWeight: 700 }}>
                          Thanh toán {remainAvax.toFixed(3)} AVAX cho Nông Dân
                        </div>
                        <div style={{ color: "#3F493F", fontSize: 12, marginTop: 2 }}>
                          Bác bỏ khiếu nại — Hàng đạt chuẩn hoặc hao hụt trong định mức.
                        </div>
                      </div>
                    </button>
                  </div>

                  <div style={{ padding: "8px 12px", background: "#F8FAFC", borderRadius: 8, color: "#6F7A6E", fontSize: 11, fontWeight: 600 }}>
                      Quyết định của Trọng tài được ký mật mã qua Avalanche Smart Contract và giải phóng ký quỹ tức thời sau 1 Block confirmation.
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}