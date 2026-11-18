import React, { useState } from "react";
import { ethers } from "ethers";

// Thay bằng địa chỉ sau khi deploy lên Avalanche Fuji
const CONTRACT_ADDRESS = "0xYourDeployedContractAddressOnFuji";
const FUJI_CHAIN_ID = "0xa869"; // 43113 in hex

const CONTRACT_ABI = [
  "function orderCounter() view returns (uint256)",
  "function createOrder(address _farmer, address _arbitrator, string _productName, uint256 _quantityKg) payable returns (uint256)",
  "function confirmShipment(uint256 _orderId)",
  "function getOrder(uint256 _orderId) view returns (tuple(uint256 id, address buyer, address farmer, address arbitrator, string productName, uint256 quantityKg, uint256 totalAmount, uint256 advancePaid, uint8 status, uint256 createdAt, uint256 shippedAt))"
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
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState(false);

  // Form tạo đơn
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

      // Chuyển sang Fuji Testnet
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
  const loadOrders = async (escrowContract) => {
    try {
      const count = await escrowContract.orderCounter();
      const list = [];
      for (let i = Number(count); i >= 1; i--) {
        const o = await escrowContract.getOrder(i);
        list.push({
          id: Number(o.id),
          buyer: o.buyer,
          farmer: o.farmer,
          productName: o.productName,
          quantityKg: Number(o.quantityKg),
          totalAmount: ethers.formatEther(o.totalAmount),
          advancePaid: ethers.formatEther(o.advancePaid),
          status: Number(o.status)
        });
      }
      setOrders(list);
      if (list.length > 0) setSelectedOrder(list[0]);
    } catch (err) {
      console.error("Lỗi tải đơn hàng:", err);
    }
  };

  // 2. Tạo đơn & khóa tiền AVAX vào Escrow
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

  // 3. Xác nhận giao hàng & Giải ngân 30% ứng trước
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

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "24px", fontFamily: "sans-serif" }}>
      {/* Header & Kết nối ví */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #ddd", paddingBottom: "16px" }}>
        <h2>AgriEscrow — Cổng Đơn Hàng & Thanh Toán (Avalanche Fuji)</h2>
        <button onClick={connectWallet} style={{ padding: "10px 18px", background: "#E84142", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}>
          {account ? `Ví: ${account.slice(0, 6)}...${account.slice(-4)}` : "Kết nối Ví Avalanche"}
        </button>
      </header>

      {/* Thông báo Transaction Hash trên Explorer */}
      {txHash && (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", padding: "12px", borderRadius: "8px", marginTop: "16px" }}>
          <strong>Giao dịch đã gửi lên Fuji Testnet:</strong>{" "}
          <a href={`https://testnet.snowtrace.io/tx/${txHash}`} target="_blank" rel="noreferrer">
            Xem trên Avalanche Explorer ({txHash.slice(0, 12)}...)
          </a>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginTop: "24px" }}>
        {/* Cột trái: Form tạo đơn hàng */}
        <section style={{ border: "1px solid #e5e7eb", padding: "20px", borderRadius: "12px" }}>
          <h3>1. Tạo Đơn Hàng & Khóa Tiền</h3>
          <form onSubmit={handleCreateOrder} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <input placeholder="Tên nông sản (VD: Sầu riêng Ri6)" value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} required style={inputStyle} />
            <input type="number" placeholder="Khối lượng (kg)" value={form.quantityKg} onChange={(e) => setForm({ ...form, quantityKg: e.target.value })} required style={inputStyle} />
            <input placeholder="Địa chỉ ví Nông dân (0x...)" value={form.farmerAddress} onChange={(e) => setForm({ ...form, farmerAddress: e.target.value })} required style={inputStyle} />
            <input placeholder="Địa chỉ ví Trọng tài (0x...)" value={form.arbitratorAddress} onChange={(e) => setForm({ ...form, arbitratorAddress: e.target.value })} required style={inputStyle} />
            <input type="number" step="0.001" placeholder="Số tiền khóa Escrow (AVAX)" value={form.avaxAmount} onChange={(e) => setForm({ ...form, avaxAmount: e.target.value })} required style={inputStyle} />
            <button type="submit" disabled={loading} style={{ padding: "12px", background: "#16a34a", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>
              {loading ? "Đang xử lý Blockchain..." : "Tạo Đơn & Khóa AVAX"}
            </button>
          </form>
        </section>

        {/* Cột phải: Dashboard & Chi tiết đơn hàng */}
        <section style={{ border: "1px solid #e5e7eb", padding: "20px", borderRadius: "12px" }}>
          <h3>2. Chi Tiết Đơn Hàng & Giải Ngân</h3>
          {selectedOrder ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div><strong>Mã đơn:</strong> #{selectedOrder.id} — {selectedOrder.productName} ({selectedOrder.quantityKg} kg)</div>
              <div><strong>Trạng thái:</strong> <span style={{ color: "#2563eb", fontWeight: "bold" }}>{STATUS_LABELS[selectedOrder.status]}</span></div>
              <div><strong>Tổng tiền khóa:</strong> {selectedOrder.totalAmount} AVAX</div>
              <div style={{ background: "#fefce8", padding: "12px", borderRadius: "8px", border: "1px solid #fde047" }}>
                <div><strong>Tiền ứng trước (30%):</strong> {selectedOrder.advancePaid} AVAX {selectedOrder.status >= 1 ? "✅ Đã giải ngân" : "⏳ Chờ giao hàng"}</div>
                <div><strong>Tiền còn lại (70%):</strong> {(Number(selectedOrder.totalAmount) * 0.7).toFixed(4)} AVAX (Giữ trong Escrow)</div>
              </div>

              {selectedOrder.status === 0 && (
                <button
                  onClick={() => handleConfirmShipment(selectedOrder.id)}
                  disabled={loading}
                  style={{ marginTop: "8px", padding: "10px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}
                >
                  Xác Nhận Đã Giao Hàng (Giải Ngân 30%)
                </button>
              )}
            </div>
          ) : (
            <p>Chưa có đơn hàng nào. Hãy kết nối ví hoặc tạo đơn mới.</p>
          )}

          {/* Danh sách chọn nhanh đơn hàng */}
          <h4 style={{ marginTop: "20px", borderTop: "1px solid #eee", paddingTop: "12px" }}>Danh sách đơn ({orders.length})</h4>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {orders.map((o) => (
              <li
                key={o.id}
                onClick={() => setSelectedOrder(o)}
                style={{ padding: "8px", borderBottom: "1px solid #f3f4f6", cursor: "pointer", background: selectedOrder?.id === o.id ? "#eff6ff" : "transparent" }}
              >
                <strong>#{o.id}</strong> - {o.productName} ({o.totalAmount} AVAX) — <em>{STATUS_LABELS[o.status]}</em>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

const inputStyle = { padding: "10px", borderRadius: "6px", border: "1px solid #d1d5db" };