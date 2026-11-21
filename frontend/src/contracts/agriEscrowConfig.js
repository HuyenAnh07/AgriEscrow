// 1. Địa chỉ Smart Contract (Tự động ưu tiên biến môi trường .env nếu có)
export const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS || "0xd1C8fDce7B4E97FcF67b7432A53a858d672c5807";

// 2. Danh sách các hàm & sự kiện khớp 100% với AgriEscrow.sol
export const AGRI_ESCROW_ABI = [
  "function orderCounter() view returns (uint256)",
  "function getOrder(uint256 _orderId) view returns (tuple(uint256 id, address buyer, address farmer, address arbitrator, string productName, uint256 quantityKg, uint256 totalAmount, uint256 advancePaid, uint8 status, uint256 createdAt, uint256 shippedAt))",
  "function createOrder(address _farmer, address _arbitrator, string _productName, uint256 _quantityKg) payable returns (uint256)",
  "function confirmShipment(uint256 _orderId)",
  "function confirmDelivery(uint256 _orderId)",
  "function raiseDispute(uint256 _orderId, string _reason)",
  "function resolveDispute(uint256 _orderId, bool _favorFarmer)",
  "event OrderCreated(uint256 indexed orderId, address indexed buyer, address indexed farmer, string productName, uint256 totalAmount)",
  "event ShipmentConfirmed(uint256 indexed orderId, uint256 advanceAmount, uint256 timestamp)",
  "event DeliveryConfirmed(uint256 indexed orderId, uint256 timestamp)",
  "event PaymentReleased(uint256 indexed orderId, address indexed farmer, uint256 amount)",
  "event DisputeRaised(uint256 indexed orderId, address indexed raisedBy, string reason, uint256 timestamp)",
  "event DisputeResolved(uint256 indexed orderId, address indexed arbitrator, address indexed winner, uint256 amount, uint256 timestamp)"
];

// 3. Bảng quy đổi trạng thái đơn hàng (Khớp enum OrderStatus 0..4 trong AgriEscrow.sol)
export const STATUS_MAP = {
  0: { text: "Chờ giao hàng (Đã khóa 100%)", color: "#2563eb", bg: "#dbeafe" },
  1: { text: "Đang vận chuyển (Đã ứng 30%)", color: "#d97706", bg: "#fef3c7" },
  2: { text: "Đã giao tới nơi", color: "#059669", bg: "#d1fae5" },
  3: { text: "Hoàn tất (Đã thanh toán 100%)", color: "#16a34a", bg: "#dcfce7" },
  4: { text: "Đang tranh chấp", color: "#dc2626", bg: "#fee2e2" }
};