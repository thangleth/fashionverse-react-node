const { Order, OrderDetail, ProductDetail, User, Size, Color, ProductImage } = require('../models');
const nodemailer = require('nodemailer');

const orderController = {
    async createOrder(req, res) {
        console.log('--- [START] Create Order ---');

        const { id: user_id } = req.user; // Lấy user_id từ token hoặc middleware
        console.log('User ID from token:', user_id);

        if (!user_id) {
            console.log('Error: user_id is missing');
            return res.status(400).json({ message: 'user_id is required' });
        }

        const {
            total_price,
            code,
            order_status,
            payment_method,
            order_details,
            shipping_address,
            city_id // Thêm trường shipping_address vào dữ liệu nhận được từ frontend
        } = req.body;

        console.log('Request body received:', {
            total_price,
            code,
            order_status,
            payment_method,
            order_details,
            shipping_address,
            city_id // In ra shipping_address
        });

        // Kiểm tra dữ liệu đầu vào
        if (!total_price || !code || !payment_method || !Array.isArray(order_details) || order_details.length === 0 || !shipping_address || !city_id) {
            console.log('Error: Invalid data in request body');
            return res.status(400).json({
                message: 'Dữ liệu không hợp lệ. Cần có total_price, payment_method, order_details, và shipping_address.',
            });
        }

        try {
            console.log('Creating new order...');
            const newOrder = await Order.create({
                user_id,
                code,
                total_price,
                order_status: order_status || 'Chờ xử lý',
                payment_method,
                shipping_address,
                city_id
            });

            console.log('New order created:', newOrder);

            console.log('Creating order details...');
            const orderDetailPromises = order_details.map(async (item) => {
                console.log('Processing order detail:', item);
                return await OrderDetail.create({
                    quantity: item.quantity,
                    total_amount: item.total_amount,
                    orders_id: newOrder.orders_id,
                    product_detail_id: item.product_detail_id,
                });
            });

            await Promise.all(orderDetailPromises);
            console.log('Order details created successfully.');

            res.status(201).json({
                message: 'Đơn hàng đã được tạo thành công!',
                order: newOrder,
            });
        } catch (error) {
            console.error('Error occurred during order creation:', error.message);

            res.status(500).json({
                message: 'Đã có lỗi xảy ra khi tạo đơn hàng.',
                error: error.message,
            });
        }

        console.log('--- [END] Create Order ---');
    },
    async getAllOrders(req, res) {
        try {
            const orders = await Order.findAll({
                include: [
                    {
                        model: OrderDetail,
                        as: 'orderDetail',
                        include: [
                            {
                                model: ProductDetail, as: 'productDetail',
                                include: [
                                    { model: Size, as: 'size' },
                                    { model: Color, as: 'color' },
                                    { model: ProductImage, as: "productImage" },
                                ]
                            },
                        ],
                    },
                ],
                order: [['orders_id', 'DESC']],
            });
            console.log(`Found ${orders.length} orders.`);

            res.status(200).json({
                message: 'Lấy danh sách đơn hàng thành công!',
                orders,
            });
        } catch (error) {
            console.error('Error occurred while retrieving orders:', error.message);
            res.status(500).json({
                message: 'Đã có lỗi xảy ra khi lấy danh sách đơn hàng.',
                error: error.message,
            });
        }
    },
    async confirmOrder(req, res) {
        try {
            const { id } = req.params;
            const order = await Order.findByPk(id);
            if (!order) {
                return res.status(404).json({ message: "Đơn hàng không tồn tại" });
            }
            order.order_status = "Đã xác nhận";
            await order.save();

            res.json(order);
        } catch (error) {
            console.error("Lỗi khi xác nhận đơn hàng:", error);
            res.status(500).json({ message: "Đã xảy ra lỗi khi xác nhận đơn hàng" });
        }
    },
    async sendCancelOrderEmail(userEmail, orderId) {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: userEmail,
            subject: `Thông báo hủy đơn hàng #${orderId}`,
            text: `Đơn hàng #${orderId} của bạn đã bị hủy. Nếu bạn có thắc mắc, vui lòng liên hệ với chúng tôi.`
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log('Email gửi thành công!');
        } catch (error) {
            console.error('Lỗi khi gửi email:', error);
        }
    },
    async cancelOrder(req, res) {
        const { id } = req.params;

        try {
            const order = await Order.findByPk(id, {
                include: [{
                    model: User, as: 'user'
                }]
            })

            if (!order) {
                return res.status(404).json({ message: 'Đơn hàng không tồn tại.' });
            }

            if (order.order_status !== 'Chờ xử lý') {
                return res.status(400).json({ message: 'Chỉ có thể hủy đơn hàng ở trạng thái "Chờ xử lý".' });
            }

            order.order_status = 'Đã hủy bởi cửa hàng';
            await order.save();
            const userEmail = order.user.email;
            const orderId = order.orders_id;

            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: userEmail,
                subject: `Thông báo hủy đơn hàng #${orderId}`,
                html: `<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
                        <h2 style="color: #e74c3c; text-align: center;">Thông báo hủy đơn hàng</h2>
                        <p>Đơn hàng <strong>#${orderId}</strong> của bạn đã bị hủy. Chúng tôi rất tiếc về sự bất tiện này.</p>
                        <p>Nếu bạn có bất kỳ thắc mắc nào, vui lòng liên hệ với chúng tôi qua hotline: <span style="font-size: 16px; font-weight: bold;">028 3456 7894</span></p>
                        <p>Trân trọng,</p>
                        <p>Đội ngũ hỗ trợ khách hàng Fashionverse</p>
                       </div>`,
            };


            transporter.sendMail(mailOptions, (error) => {
                if (error) {
                    console.error("Lỗi khi gửi email:", error);
                    return res.status(500).json({ message: 'Không thể gửi email xác nhận' });
                } else {
                    console.log("Email đã được gửi thành công:");
                    return res.status(201).json({ message: 'Hủy đơn thành công' });
                }
            });

            return res.status(200).json({ message: 'Đơn hàng đã được hủy thành công.' });
        } catch (error) {
            console.error('Lỗi khi hủy đơn hàng:', error.message);
            return res.status(500).json({ message: 'Đã xảy ra lỗi khi hủy đơn hàng.' });
        }
    },
    async cancelOrder_User(req, res) {
        const { id } = req.params;

        try {
            const order = await Order.findByPk(id);

            if (!order) {
                return res.status(404).json({ message: 'Đơn hàng không tồn tại.' });
            }

            if (order.order_status !== 'Chờ xử lý') {
                return res.status(400).json({ message: 'Chỉ có thể hủy đơn hàng ở trạng thái "Chờ xử lý".' });
            }

            order.order_status = 'Đã hủy bởi khách hàng';
            await order.save();

            return res.status(200).json({ message: 'Đơn hàng đã được hủy thành công.' });
        } catch (error) {
            console.error('Lỗi khi hủy đơn hàng:', error.message);
            return res.status(500).json({ message: 'Đã xảy ra lỗi khi hủy đơn hàng.' });
        }
    },
    async getOrderByIdUser(req, res) {
        const { id } = req.params;
        try {
            console.log('Start finding order...');
            const order = await Order.findAll({
                where: { user_id: id },
                include: [
                    {
                        model: OrderDetail,
                        as: 'orderDetail',
                        include: [
                            {
                                model: ProductDetail, as: 'productDetail',
                                include: [
                                    { model: Size, as: 'size' },
                                    { model: Color, as: 'color' },
                                    { model: ProductImage, as: "productImage" },
                                ]
                            },
                        ],
                    },
                ],
            });
            if (!order) {
                console.log('Order is null or not found');
                return res.status(404).json({
                    message: 'Đơn hàng không tồn tại.',
                });
            }
            console.log(`Found order with ID ${id}.`);
            res.status(200).json({
                message: 'Lấy thông tin đơn hàng thành công!',
                order,
            });
        } catch (error) {
            console.error('Error occurred:', error.message);
        }

    },
    async getOrderById(req, res) {
        const { id } = req.params;
        try {
            console.log('Start finding order...');
            const order = await Order.findAll({
                where: { orders_id: id },
            });
            if (!order) {
                console.log('Order is null or not found');
                return res.status(404).json({
                    message: 'Đơn hàng không tồn tại.',
                });
            }
            console.log(`Found order with ID ${id}.`);
            res.status(200).json({
                message: 'Lấy thông tin đơn hàng thành công!',
                order,
            });
        } catch (error) {
            console.error('Error occurred:', error.message);
        }

    },
    async updateStatus(req, res) {
        const { id } = req.params;
        const { order_status } = req.body;

        try {
            const order = await Order.findByPk(id);

            if (!order) {
                return res.status(404).json({ message: 'Order not found' });
            }

            order.order_status = order_status;
            await order.save();

            res.status(200).json({ message: 'Order status updated successfully', order });
        } catch (error) {
            console.error('Error updating order status:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },
    async getTotalOrders(req, res) {
        try {
            console.log('Fetching total number of orders...');

            // Thử truy vấn cụ thể
            const totalOrders = await Order.count({}); // Sử dụng object rỗng nếu không có điều kiện

            console.log('Total orders:', totalOrders);

            res.status(200).json({
                message: 'Lấy tổng số đơn hàng thành công!',
                totalOrders,
            });
        } catch (error) {
            console.error('Error details:', error); // In lỗi chi tiết hơn
            res.status(500).json({
                message: 'Đã xảy ra lỗi khi lấy tổng số đơn hàng.',
                error: error.message,
            });
        }
    },
    async getTotalRevenue(req, res) {
        try {
            console.log('Fetching total revenue from all orders...');

            // Sử dụng Sequelize để tính tổng total_price của tất cả các đơn hàng
            const totalRevenue = await Order.sum('total_price');

            console.log('Total revenue:', totalRevenue);

            // Kiểm tra nếu không có doanh thu
            if (!totalRevenue || totalRevenue === 0) {
                return res.status(200).json({
                    message: 'Không có doanh thu nào được ghi nhận.',
                    totalRevenue: 0,
                });
            }

            // Trả về kết quả
            return res.status(200).json({
                message: 'Tính tổng doanh thu thành công!',
                totalRevenue,
            });
        } catch (error) {
            console.error('Error while calculating total revenue:', error.message);

            // Trả về lỗi với thông tin chi tiết
            return res.status(500).json({
                message: 'Đã xảy ra lỗi khi tính tổng doanh thu.',
                error: error.message,
            });
        }
    },
};

module.exports = orderController;
