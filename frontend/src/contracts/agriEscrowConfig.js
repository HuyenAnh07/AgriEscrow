// 1. Địa chỉ Smart Contract (Sau này deploy lên mạng Fuji hoặc Localhost thì dán địa chỉ vào đây)
export const CONTRACT_ADDRESS = "0x0c6dcF294F49Bc8cCa8a2BEF7b42533e38beABdE";

// 2. Danh sách các hàm & sự kiện của Thành viên B
export const AGRI_ESCROW_ABI = [
  "function orderCount() view returns (uint256)",
  "function getOrder(uint256 _orderId) view returns (tuple(uint256 id, address buyer, address farmer, address arbitrator, string productName, uint256 quantity, uint256 totalAmount, uint256 advancePaid, uint8 status, string disputeReason))",
  "function confirmDelivery(uint256 _orderId)",
  "function raiseDispute(uint256 _orderId, string _reason)",
  "function resolveDispute(uint256 _orderId, bool _favorFarmer)",
  "event ShipmentConfirmed(uint256 indexed orderId, address indexed farmer, uint256 advanceAmount)",
  "event DeliveryConfirmed(uint256 indexed orderId, address indexed buyer, uint256 remainingAmount)",
  "event DisputeRaised(uint256 indexed orderId, address indexed raisedBy, string reason)",
  "event DisputeResolved(uint256 indexed orderId, address indexed arbitrator, bool favorFarmer, uint256 amount)",
  "event OrderCompleted(uint256 indexed orderId)"
];

// 3. Bảng quy đổi trạng thái đơn hàng
export const STATUS_MAP = {
  0: { text: "Chờ giao hàng (Đã khóa 100%)", color: "#2563eb", bg: "#dbeafe" },
  1: { text: "Đang vận chuyển (Đã ứng 30%)", color: "#d97706", bg: "#fef3c7" },
  2: { text: "Đã giao tới nơi", color: "#059669", bg: "#d1fae5" },
  3: { text: "Hoàn tất (Đã thanh toán 100%)", color: "#16a34a", bg: "#dcfce7" },
  4: { text: "Đang tranh chấp", color: "#dc2626", bg: "#fee2e2" }
};