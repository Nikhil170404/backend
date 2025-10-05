// backend/controllers/payment.controller.js - Payment Operations Controller
const razorpay = require('../config/razorpay');
const { db } = require('../config/firebase');
const crypto = require('crypto');
const { validatePaymentVerification } = require('razorpay/dist/utils/razorpay-utils');

// ============================================
// CREATE RAZORPAY ORDER
// ============================================
exports.createOrder = async (req, res) => {
  try {
    const { amount, currency, receipt, notes } = req.body;

    // Validation
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount'
      });
    }

    // Create Razorpay order
    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: currency || 'INR',
      receipt: receipt || `rcpt_${Date.now()}`,
      notes: notes || {}
    };

    const order = await razorpay.orders.create(options);

    console.log('✅ Razorpay order created:', order.id);

    // Save order to Firestore
    await db.collection('razorpayOrders').doc(order.id).set({
      orderId: order.id,
      amount: order.amount,
      amountInRupees: amount,
      currency: order.currency,
      receipt: order.receipt,
      status: order.status,
      notes: notes || {},
      createdAt: new Date(),
      updatedAt: new Date()
    });

    res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        amountInRupees: amount,
        currency: order.currency,
        receipt: order.receipt
      }
    });

  } catch (error) {
    console.error('❌ Create order error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create order'
    });
  }
};

// ============================================
// VERIFY PAYMENT SIGNATURE
// ============================================
exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      cycleId,
      userId
    } = req.body;

    // Validation
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing required payment parameters'
      });
    }

    // Verify signature
    const isValid = validatePaymentVerification(
      {
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id
      },
      razorpay_signature,
      process.env.RAZORPAY_KEY_SECRET
    );

    if (!isValid) {
      console.error('❌ Invalid payment signature');
      return res.status(400).json({
        success: false,
        error: 'Payment verification failed'
      });
    }

    console.log('✅ Payment signature verified:', razorpay_payment_id);

    // Fetch payment details from Razorpay
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    // Save payment to Firestore
    const paymentData = {
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      cycleId: cycleId || null,
      userId: userId || null,
      amount: payment.amount,
      amountInRupees: payment.amount / 100,
      currency: payment.currency,
      status: payment.status,
      method: payment.method,
      email: payment.email,
      contact: payment.contact,
      verified: true,
      createdAt: new Date(payment.created_at * 1000),
      verifiedAt: new Date()
    };

    await db.collection('payments').add(paymentData);

    // Update order cycle if cycleId provided
    if (cycleId && userId) {
      const cycleRef = db.collection('orderCycles').doc(cycleId);
      const cycleDoc = await cycleRef.get();

      if (cycleDoc.exists) {
        const cycleData = cycleDoc.data();
        const participants = cycleData.participants || [];

        const updatedParticipants = participants.map(p =>
          p.userId === userId
            ? {
                ...p,
                paymentStatus: 'paid',
                razorpayPaymentId: razorpay_payment_id,
                paidAt: new Date()
              }
            : p
        );

        await cycleRef.update({
          participants: updatedParticipants,
          updatedAt: new Date()
        });

        console.log('✅ Order cycle updated with payment');
      }
    }

    res.json({
      success: true,
      verified: true,
      payment: {
        id: razorpay_payment_id,
        orderId: razorpay_order_id,
        amount: payment.amount / 100,
        currency: payment.currency,
        status: payment.status,
        method: payment.method
      }
    });

  } catch (error) {
    console.error('❌ Verify payment error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Payment verification failed'
    });
  }
};

// ============================================
// FETCH PAYMENT DETAILS
// ============================================
exports.fetchPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        error: 'Payment ID is required'
      });
    }

    const payment = await razorpay.payments.fetch(paymentId);

    res.json({
      success: true,
      payment: {
        id: payment.id,
        orderId: payment.order_id,
        amount: payment.amount / 100,
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        email: payment.email,
        contact: payment.contact,
        createdAt: new Date(payment.created_at * 1000)
      }
    });

  } catch (error) {
    console.error('❌ Fetch payment error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch payment'
    });
  }
};

// ============================================
// REFUND PAYMENT
// ============================================
exports.refundPayment = async (req, res) => {
  try {
    const { paymentId, amount, notes } = req.body;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        error: 'Payment ID is required'
      });
    }

    // Fetch payment to get total amount
    const payment = await razorpay.payments.fetch(paymentId);

    const refundOptions = {
      payment_id: paymentId,
      ...(amount && { amount: Math.round(amount * 100) }), // Partial refund
      notes: notes || {}
    };

    const refund = await razorpay.payments.refund(paymentId, refundOptions);

    console.log('✅ Refund created:', refund.id);

    // Save refund to Firestore
    await db.collection('refunds').add({
      refundId: refund.id,
      paymentId: paymentId,
      amount: refund.amount,
      amountInRupees: refund.amount / 100,
      currency: refund.currency,
      status: refund.status,
      notes: notes || {},
      createdAt: new Date(refund.created_at * 1000)
    });

    res.json({
      success: true,
      refund: {
        id: refund.id,
        paymentId: refund.payment_id,
        amount: refund.amount / 100,
        currency: refund.currency,
        status: refund.status
      }
    });

  } catch (error) {
    console.error('❌ Refund error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Refund failed'
    });
  }
};

// ============================================
// FETCH REFUND STATUS
// ============================================
exports.fetchRefund = async (req, res) => {
  try {
    const { refundId } = req.params;

    if (!refundId) {
      return res.status(400).json({
        success: false,
        error: 'Refund ID is required'
      });
    }

    // Fetch refund from Razorpay
    const refund = await razorpay.refunds.fetch(refundId);

    res.json({
      success: true,
      refund: {
        id: refund.id,
        paymentId: refund.payment_id,
        amount: refund.amount / 100,
        currency: refund.currency,
        status: refund.status,
        createdAt: new Date(refund.created_at * 1000)
      }
    });

  } catch (error) {
    console.error('❌ Fetch refund error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch refund'
    });
  }
};

// ============================================
// CANCEL PAYMENT (for pending/authorized)
// ============================================
exports.cancelPayment = async (req, res) => {
  try {
    const { paymentId } = req.body;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        error: 'Payment ID is required'
      });
    }

    // Fetch payment
    const payment = await razorpay.payments.fetch(paymentId);

    if (payment.status !== 'authorized') {
      return res.status(400).json({
        success: false,
        error: `Cannot cancel payment with status: ${payment.status}`
      });
    }

    // Cancel the payment
    const cancelledPayment = await razorpay.payments.cancel(paymentId);

    console.log('✅ Payment cancelled:', paymentId);

    // Update in Firestore
    const paymentsRef = db.collection('payments');
    const snapshot = await paymentsRef
      .where('razorpayPaymentId', '==', paymentId)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      await snapshot.docs[0].ref.update({
        status: 'cancelled',
        cancelledAt: new Date()
      });
    }

    res.json({
      success: true,
      payment: {
        id: cancelledPayment.id,
        status: cancelledPayment.status
      }
    });

  } catch (error) {
    console.error('❌ Cancel payment error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel payment'
    });
  }
};

// ============================================
// WEBHOOK HANDLER
// ============================================
exports.webhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];
    const body = JSON.stringify(req.body);

    // Verify webhook signature
    if (webhookSecret) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');

      if (signature !== expectedSignature) {
        console.error('❌ Invalid webhook signature');
        return res.status(400).json({
          success: false,
          error: 'Invalid signature'
        });
      }
    }

    const event = req.body;
    console.log('📨 Webhook event received:', event.event);

    // Handle different webhook events
    switch (event.event) {
      case 'payment.captured':
        await handlePaymentCaptured(event.payload.payment.entity);
        break;

      case 'payment.failed':
        await handlePaymentFailed(event.payload.payment.entity);
        break;

      case 'refund.created':
        await handleRefundCreated(event.payload.refund.entity);
        break;

      case 'refund.processed':
        await handleRefundProcessed(event.payload.refund.entity);
        break;

      default:
        console.log('ℹ️ Unhandled event type:', event.event);
    }

    res.json({ success: true });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ============================================
// WEBHOOK EVENT HANDLERS
// ============================================

async function handlePaymentCaptured(payment) {
  console.log('✅ Payment captured:', payment.id);

  await db.collection('webhookEvents').add({
    event: 'payment.captured',
    paymentId: payment.id,
    amount: payment.amount / 100,
    status: payment.status,
    receivedAt: new Date()
  });

  // Update payment status in database
  const paymentsRef = db.collection('payments');
  const snapshot = await paymentsRef
    .where('razorpayPaymentId', '==', payment.id)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    await snapshot.docs[0].ref.update({
      status: 'captured',
      capturedAt: new Date()
    });
  }
}

async function handlePaymentFailed(payment) {
  console.log('❌ Payment failed:', payment.id);

  await db.collection('webhookEvents').add({
    event: 'payment.failed',
    paymentId: payment.id,
    errorCode: payment.error_code,
    errorDescription: payment.error_description,
    receivedAt: new Date()
  });
}

async function handleRefundCreated(refund) {
  console.log('💰 Refund created:', refund.id);

  await db.collection('webhookEvents').add({
    event: 'refund.created',
    refundId: refund.id,
    paymentId: refund.payment_id,
    amount: refund.amount / 100,
    receivedAt: new Date()
  });
}

async function handleRefundProcessed(refund) {
  console.log('✅ Refund processed:', refund.id);

  await db.collection('webhookEvents').add({
    event: 'refund.processed',
    refundId: refund.id,
    paymentId: refund.payment_id,
    status: refund.status,
    receivedAt: new Date()
  });

  // Update refund status in database
  const refundsRef = db.collection('refunds');
  const snapshot = await refundsRef
    .where('refundId', '==', refund.id)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    await snapshot.docs[0].ref.update({
      status: 'processed',
      processedAt: new Date()
    });
  }
}