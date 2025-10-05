// backend/config/razorpay.js - Razorpay Configuration
const Razorpay = require('razorpay');

// Validate environment variables
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.error('❌ ERROR: Razorpay credentials not found in environment variables');
  console.error('Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env file');
  process.exit(1);
}

// Initialize Razorpay instance
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

console.log('✅ Razorpay initialized successfully');
console.log(`📌 Key ID: ${process.env.RAZORPAY_KEY_ID.substring(0, 15)}...`);

module.exports = razorpayInstance;