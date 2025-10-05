// backend/routes/payment.routes.js - Payment API Routes
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');

// ============================================
// PAYMENT ROUTES
// ============================================

/**
 * POST /api/payment/create-order
 * Create a new Razorpay order
 * 
 * Body: {
 *   amount: number (in rupees),
 *   currency: string (optional, default: 'INR'),
 *   receipt: string (optional),
 *   notes: object (optional)
 * }
 */
router.post('/create-order', paymentController.createOrder);

/**
 * POST /api/payment/verify
 * Verify payment signature after successful payment
 * 
 * Body: {
 *   razorpay_order_id: string,
 *   razorpay_payment_id: string,
 *   razorpay_signature: string,
 *   cycleId: string (optional),
 *   userId: string (optional)
 * }
 */
router.post('/verify', paymentController.verifyPayment);

/**
 * GET /api/payment/:paymentId
 * Fetch payment details
 */
router.get('/:paymentId', paymentController.fetchPayment);

/**
 * POST /api/payment/refund
 * Create a refund for a payment
 * 
 * Body: {
 *   paymentId: string,
 *   amount: number (optional, for partial refund),
 *   notes: object (optional)
 * }
 */
router.post('/refund', paymentController.refundPayment);

/**
 * GET /api/payment/refund/:refundId
 * Fetch refund status
 */
router.get('/refund/:refundId', paymentController.fetchRefund);

/**
 * POST /api/payment/cancel
 * Cancel an authorized payment
 * 
 * Body: {
 *   paymentId: string
 * }
 */
router.post('/cancel', paymentController.cancelPayment);

/**
 * POST /api/payment/webhook
 * Razorpay webhook endpoint
 */
router.post('/webhook', paymentController.webhook);

module.exports = router;