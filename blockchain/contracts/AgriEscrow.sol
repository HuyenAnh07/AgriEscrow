// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AgriEscrow {
    enum OrderStatus {
        Created,    // Đã tạo đơn & khóa tiền
        Shipped,    // Đã giao hàng & ứng trước 30%
        Delivered,  // Đã nhận hàng
        Completed,  // Đã thanh toán đủ 100%
        Disputed    // Đang tranh chấp
    }

    struct Order {
        uint256 id;
        address payable buyer;
        address payable farmer;
        address arbitrator;
        string productName;
        uint256 quantityKg;
        uint256 totalAmount;
        uint256 advancePaid;
        OrderStatus status;
        uint256 createdAt;
        uint256 shippedAt;
    }

    uint256 public orderCounter;
    mapping(uint256 => Order) public orders;

    event OrderCreated(
        uint256 indexed orderId,
        address indexed buyer,
        address indexed farmer,
        string productName,
        uint256 totalAmount
    );

    event ShipmentConfirmed(
        uint256 indexed orderId,
        uint256 advanceAmount,
        uint256 timestamp
    );

    event DeliveryConfirmed(uint256 indexed orderId, uint256 timestamp);

    event PaymentReleased(
        uint256 indexed orderId,
        address indexed farmer,
        uint256 amount
    );

    modifier onlyBuyer(uint256 _orderId) {
        require(msg.sender == orders[_orderId].buyer, "Chi nguoi mua moi co quyen");
        _;
    }

    modifier onlyFarmer(uint256 _orderId) {
        require(msg.sender == orders[_orderId].farmer, "Chi nong dan moi co quyen");
        _;
    }

    function createOrder(
        address payable _farmer,
        address _arbitrator,
        string memory _productName,
        uint256 _quantityKg
    ) external payable returns (uint256) {
        require(_farmer != address(0) && _farmer != msg.sender, "Dia chi nong dan khong hop le");
        require(_arbitrator != address(0), "Dia chi trong tai khong hop le");
        require(msg.value > 0, "So tien khoa phai lon hon 0 AVAX");
        require(_quantityKg > 0, "Khoi luong phai lon hon 0");

        orderCounter++;
        uint256 newOrderId = orderCounter;

        orders[newOrderId] = Order({
            id: newOrderId,
            buyer: payable(msg.sender),
            farmer: _farmer,
            arbitrator: _arbitrator,
            productName: _productName,
            quantityKg: _quantityKg,
            totalAmount: msg.value,
            advancePaid: 0,
            status: OrderStatus.Created,
            createdAt: block.timestamp,
            shippedAt: 0
        });

        emit OrderCreated(newOrderId, msg.sender, _farmer, _productName, msg.value);
        return newOrderId;
    }

    function confirmShipment(uint256 _orderId) external onlyFarmer(_orderId) {
        Order storage order = orders[_orderId];
        require(order.status == OrderStatus.Created, "Don hang khong o trang thai Created");

        uint256 advanceAmount = (order.totalAmount * 30) / 100;
        
        order.status = OrderStatus.Shipped;
        order.advancePaid = advanceAmount;
        order.shippedAt = block.timestamp;

        (bool success, ) = order.farmer.call{value: advanceAmount}("");
        require(success, "Giai ngan 30% that bai");

        emit ShipmentConfirmed(_orderId, advanceAmount, block.timestamp);
    }

    function confirmDelivery(uint256 _orderId) external onlyBuyer(_orderId) {
        Order storage order = orders[_orderId];
        require(order.status == OrderStatus.Shipped, "Don hang chua o trang thai Shipped");

        uint256 remaining = order.totalAmount - order.advancePaid; // 70% con lai

        // Cap nhat trang thai TRUOC khi chuyen tien
        order.status = OrderStatus.Completed;

        emit DeliveryConfirmed(_orderId, block.timestamp);

        (bool success, ) = order.farmer.call{value: remaining}("");
        require(success, "Giai ngan 70% that bai");

        emit PaymentReleased(_orderId, order.farmer, remaining);
    }

    function getOrder(uint256 _orderId) external view returns (Order memory) {
        require(_orderId > 0 && _orderId <= orderCounter, "Don hang khong ton tai");
        return orders[_orderId];
    }
}