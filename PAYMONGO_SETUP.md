# PayMongo Payment Integration

## Overview

This integration allows employers to pay workers through PayMongo when completing jobs. It supports multiple payment methods while maintaining backward compatibility with manual verification images.

## Payment Methods Supported

1. **GCash** - E-wallet payment
2. **PayMaya** - E-wallet payment  
3. **GrabPay** - E-wallet payment
4. **Card** - Credit/Debit card payment
5. **Manual** - Traditional verification image (legacy method)

## Setup Instructions

### 1. Get PayMongo API Keys

1. Sign up at [PayMongo Dashboard](https://dashboard.paymongo.com/)
2. Get your API keys from Settings > Developers
3. You'll need both:
   - **Secret Key** (sk_test_... for testing, sk_live_... for production)
   - **Public Key** (pk_test_... for testing, pk_live_... for production)

### 2. Configure Environment Variables

Add these to your `.env` file in the backend:

```env
# PayMongo Configuration
PAYMONGO_SECRET_KEY=sk_test_your_secret_key_here
PAYMONGO_PUBLIC_KEY=pk_test_your_public_key_here

# Frontend URL for payment redirects
FRONTEND_URL=http://localhost:5173
```

For production, use:
```env
PAYMONGO_SECRET_KEY=sk_live_your_live_secret_key
PAYMONGO_PUBLIC_KEY=pk_live_your_live_public_key
FRONTEND_URL=https://your-production-domain.com
```

### 3. Install Dependencies

```bash
cd Resi_Backend
npm install axios
```

### 4. Set Up Webhooks

PayMongo uses webhooks to notify your app about payment events.

1. Go to PayMongo Dashboard > Webhooks
2. Create a new webhook with URL: `https://your-backend-url.com/api/payments/webhook`
3. Subscribe to these events:
   - `source.chargeable` (for e-wallet payments)
   - `payment.paid` (when payment succeeds)
   - `payment.failed` (when payment fails)

**For local testing:** Use [ngrok](https://ngrok.com/) to expose your local server:
```bash
ngrok http 5000
# Use the https URL provided by ngrok
```

## API Endpoints

### Initiate Payment
```http
POST /api/payments/initiate
Authorization: Bearer {token}
Content-Type: application/json

{
  "jobId": "64abc123...",
  "paymentMethod": "gcash", // or "paymaya", "grab_pay", "card", "manual"
  "receiptImage": "https://..." // optional, for manual or as backup
}
```

**Response (E-Wallet):**
```json
{
  "message": "Payment initiated",
  "payment": { ... },
  "checkoutUrl": "https://paymongo.com/checkout/...",
  "sourceId": "src_..."
}
```

**Response (Card):**
```json
{
  "message": "Payment intent created",
  "payment": { ... },
  "clientKey": "pi_..._client_...",
  "paymentIntentId": "pi_..."
}
```

**Response (Manual):**
```json
{
  "message": "Payment recorded successfully",
  "payment": { ... }
}
```

### Check Payment Status
```http
GET /api/payments/{paymentId}/status
Authorization: Bearer {token}
```

### Get Job Payments
```http
GET /api/payments/job/{jobId}
Authorization: Bearer {token}
```

### Get My Payments
```http
GET /api/payments/my-payments?type=sent|received|all
Authorization: Bearer {token}
```

## Payment Flow

### E-Wallet Payments (GCash, PayMaya, GrabPay)

1. **Frontend**: User selects payment method and initiates payment
2. **Backend**: Creates PayMongo source and payment record
3. **Frontend**: Redirects user to `checkoutUrl` for payment
4. **User**: Completes payment on PayMongo checkout page
5. **PayMongo**: Sends `source.chargeable` webhook
6. **Backend**: Creates payment from source
7. **PayMongo**: Sends `payment.paid` webhook
8. **Backend**: 
   - Marks payment as succeeded
   - Marks job as completed
   - Adds income to worker's goal
   - Sends notifications to both parties

### Card Payments

1. **Frontend**: User enters card details using PayMongo Elements
2. **Backend**: Creates payment intent
3. **Frontend**: Attaches payment method to intent
4. **PayMongo**: Processes 3D Secure if needed
5. **PayMongo**: Sends `payment.paid` webhook
6. **Backend**: Same completion flow as e-wallet

### Manual Payments (Legacy)

1. **Frontend**: User uploads verification image
2. **Backend**: 
   - Creates payment record immediately as "succeeded"
   - Marks job as completed
   - Processes everything synchronously

## Frontend Integration Example

### Complete Job with PayMongo

```javascript
import apiService from './api';

const completeJobWithPayment = async (jobId, paymentMethod) => {
  try {
    // Initiate payment
    const response = await apiService.initiatePayment(jobId, paymentMethod);
    
    if (paymentMethod === 'manual') {
      // Manual payment completed immediately
      console.log('Job marked as complete');
      return;
    }
    
    // For e-wallet payments, redirect to checkout
    if (response.checkoutUrl) {
      window.location.href = response.checkoutUrl;
      return;
    }
    
    // For card payments, handle with PayMongo Elements
    if (response.clientKey) {
      // Implement card payment UI with PayMongo.js
      // See: https://developers.paymongo.com/docs/accepting-cards
    }
  } catch (error) {
    console.error('Payment error:', error);
  }
};
```

### Payment Success/Failure Pages

Create these routes in your frontend:

```javascript
// /payment/success
const PaymentSuccess = () => {
  const jobId = new URLSearchParams(window.location.search).get('jobId');
  
  useEffect(() => {
    // Poll payment status or show success message
    // User will receive notification when payment processes
  }, []);
  
  return <div>Payment processing...</div>;
};

// /payment/failed
const PaymentFailed = () => {
  return <div>Payment failed. Please try again.</div>;
};
```

## Database Schema

### Payment Model

```javascript
{
  jobId: ObjectId,           // Reference to Job
  employerId: ObjectId,      // Who paid
  workerId: ObjectId,        // Who received
  amount: Number,            // Amount in PHP
  currency: String,          // Default: 'PHP'
  
  // PayMongo IDs
  paymongoPaymentIntentId: String,
  paymongoSourceId: String,
  paymongoPaymentId: String,
  
  paymentMethod: String,     // 'gcash', 'paymaya', 'grab_pay', 'card', 'manual'
  status: String,            // 'pending', 'processing', 'succeeded', 'failed', 'cancelled'
  
  receiptImage: String,      // URL (optional, for manual or backup)
  
  description: String,
  metadata: Object,
  paymongoResponse: Object,
  errorMessage: String,
  
  paidAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

## Testing

### Test Cards (Sandbox Mode)

PayMongo provides test cards for development:

```
Success: 4343 4343 4343 4345
Declined: 4571 7360 0000 0015
Insufficient Funds: 4007 2680 0000 0014

CVC: Any 3 digits
Expiry: Any future date
```

### Test E-Wallets

In test mode, use test account credentials provided by PayMongo.

## Security Considerations

1. **Never expose Secret Key in frontend**
2. **Validate webhook signatures** (optional enhancement)
3. **Verify payment amounts** before marking jobs complete
4. **Store sensitive data encrypted**
5. **Use HTTPS** in production
6. **Implement rate limiting** on payment endpoints

## Backward Compatibility

The system maintains full backward compatibility:

- Existing jobs can still use manual verification images
- Payment method is stored in the Payment model
- Old completion flow still works if `paymentMethod: 'manual'`
- Receipt images can be attached to any payment type as backup

## Troubleshooting

### Webhook Not Receiving Events

1. Check webhook URL is publicly accessible
2. Verify webhook is active in PayMongo Dashboard
3. Check webhook event subscriptions
4. Review webhook logs in PayMongo Dashboard

### Payment Stuck in Pending

1. Check if webhook events are being received
2. Verify PayMongo API keys are correct
3. Review payment status in PayMongo Dashboard
4. Check backend logs for errors

### Amount Mismatch

PayMongo requires amounts in **centavos** (1 PHP = 100 centavos).
Use helper functions:
```javascript
const amountInCentavos = paymongo.phpToCentavos(100); // 10000
const amountInPhp = paymongo.centavosToPhp(10000);    // 100
```

## Resources

- [PayMongo Documentation](https://developers.paymongo.com/)
- [PayMongo API Reference](https://developers.paymongo.com/reference)
- [PayMongo Dashboard](https://dashboard.paymongo.com/)
- [PayMongo Support](https://support.paymongo.com/)

## Support

For integration issues, contact your development team or refer to PayMongo's support documentation.
