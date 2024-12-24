const orderRoutes = require('express').Router();
const orderController = require('../controllers/orderController');
const authenticateToken = require('../middleware/index');

orderRoutes.post('/', authenticateToken, orderController.createOrder);
orderRoutes.get('/', orderController.getAllOrders);
orderRoutes.get('/:id', orderController.getOrderByIdUser);
orderRoutes.get('detail/:id', orderController.getOrderById);
orderRoutes.put('/:id/confirm', orderController.confirmOrder);
orderRoutes.put('/:id/cancel', orderController.cancelOrder);
orderRoutes.put('/:id/cancel_user', orderController.cancelOrder_User);
orderRoutes.put('/:id/status', orderController.updateStatus);
orderRoutes.get('/orders/total', orderController.getTotalOrders);
orderRoutes.get('/sum/total-revenue', orderController.getTotalRevenue);

module.exports = orderRoutes;