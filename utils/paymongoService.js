const axios = require('axios');

// PayMongo API configuration
const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;
const PAYMONGO_PUBLIC_KEY = process.env.PAYMONGO_PUBLIC_KEY;
const PAYMONGO_API_BASE = 'https://api.paymongo.com/v1';

/**
 * Create a PayMongo payment intent
 * @param {Object} paymentData - Payment data
 * @param {number} paymentData.amount - Amount in centavos (e.g., 10000 = ₱100.00)
 * @param {string} paymentData.description - Payment description
 * @param {Object} paymentData.metadata - Additional metadata
 * @returns {Promise<Object>} Payment intent object
 */
exports.createPaymentIntent = async (paymentData) => {
  try {
    const { amount, description, metadata } = paymentData;

    // Amount must be in centavos and at least 100 (₱1.00)
    if (amount < 100) {
      throw new Error('Amount must be at least ₱1.00 (100 centavos)');
    }

    const response = await axios.post(
      `${PAYMONGO_API_BASE}/payment_intents`,
      {
        data: {
          attributes: {
            amount: Math.round(amount), // Ensure it's an integer
            payment_method_allowed: [
              'gcash',
              'paymaya',
              'grab_pay',
              'card'
            ],
            payment_method_options: {
              card: {
                request_three_d_secure: 'automatic'
              }
            },
            currency: 'PHP',
            description: description,
            statement_descriptor: 'ResiLinked Job Payment',
            metadata: metadata || {}
          }
        }
      },
      {
        auth: {
          username: PAYMONGO_SECRET_KEY,
          password: ''
        },
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('PayMongo createPaymentIntent error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.errors?.[0]?.detail || 'Failed to create payment intent');
  }
};

/**
 * Create a PayMongo payment method
 * @param {Object} paymentMethodData - Payment method data
 * @param {string} paymentMethodData.type - Payment type (card, gcash, paymaya, grab_pay)
 * @param {Object} paymentMethodData.details - Payment method details
 * @returns {Promise<Object>} Payment method object
 */
exports.createPaymentMethod = async (paymentMethodData) => {
  try {
    const { type, details } = paymentMethodData;

    const response = await axios.post(
      `${PAYMONGO_API_BASE}/payment_methods`,
      {
        data: {
          attributes: {
            type: type,
            details: details
          }
        }
      },
      {
        auth: {
          username: PAYMONGO_PUBLIC_KEY,
          password: ''
        },
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('PayMongo createPaymentMethod error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.errors?.[0]?.detail || 'Failed to create payment method');
  }
};

/**
 * Attach payment method to payment intent
 * @param {string} paymentIntentId - Payment intent ID
 * @param {string} paymentMethodId - Payment method ID
 * @param {string} returnUrl - URL to return to after payment
 * @returns {Promise<Object>} Payment intent object
 */
exports.attachPaymentIntent = async (paymentIntentId, paymentMethodId, returnUrl) => {
  try {
    const response = await axios.post(
      `${PAYMONGO_API_BASE}/payment_intents/${paymentIntentId}/attach`,
      {
        data: {
          attributes: {
            payment_method: paymentMethodId,
            return_url: returnUrl
          }
        }
      },
      {
        auth: {
          username: PAYMONGO_SECRET_KEY,
          password: ''
        },
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('PayMongo attachPaymentIntent error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.errors?.[0]?.detail || 'Failed to attach payment method');
  }
};

/**
 * Retrieve payment intent details
 * @param {string} paymentIntentId - Payment intent ID
 * @returns {Promise<Object>} Payment intent object
 */
exports.getPaymentIntent = async (paymentIntentId) => {
  try {
    const response = await axios.get(
      `${PAYMONGO_API_BASE}/payment_intents/${paymentIntentId}`,
      {
        auth: {
          username: PAYMONGO_SECRET_KEY,
          password: ''
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('PayMongo getPaymentIntent error:', error.response?.data || error.message);
    throw new Error('Failed to retrieve payment intent');
  }
};

/**
 * Create a source (for GCash, GrabPay, etc.)
 * @param {Object} sourceData - Source data
 * @param {number} sourceData.amount - Amount in centavos
 * @param {string} sourceData.type - Source type (gcash, grab_pay)
 * @param {string} sourceData.redirectUrl - Redirect URL after payment
 * @param {Object} sourceData.metadata - Additional metadata
 * @returns {Promise<Object>} Source object
 */
exports.createSource = async (sourceData) => {
  try {
    const { amount, type, redirectUrl, metadata } = sourceData;

    const response = await axios.post(
      `${PAYMONGO_API_BASE}/sources`,
      {
        data: {
          attributes: {
            amount: Math.round(amount),
            redirect: {
              success: redirectUrl.success,
              failed: redirectUrl.failed
            },
            type: type,
            currency: 'PHP',
            metadata: metadata || {}
          }
        }
      },
      {
        auth: {
          username: PAYMONGO_SECRET_KEY,
          password: ''
        },
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('PayMongo createSource error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.errors?.[0]?.detail || 'Failed to create payment source');
  }
};

/**
 * Create a payment (after source is chargeable)
 * @param {string} sourceId - Source ID
 * @param {number} amount - Amount in centavos
 * @param {string} description - Payment description
 * @returns {Promise<Object>} Payment object
 */
exports.createPayment = async (sourceId, amount, description) => {
  try {
    const response = await axios.post(
      `${PAYMONGO_API_BASE}/payments`,
      {
        data: {
          attributes: {
            amount: Math.round(amount),
            source: {
              id: sourceId,
              type: 'source'
            },
            currency: 'PHP',
            description: description
          }
        }
      },
      {
        auth: {
          username: PAYMONGO_SECRET_KEY,
          password: ''
        },
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('PayMongo createPayment error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.errors?.[0]?.detail || 'Failed to create payment');
  }
};

/**
 * Retrieve source details
 * @param {string} sourceId - Source ID
 * @returns {Promise<Object>} Source object
 */
exports.getSource = async (sourceId) => {
  try {
    const response = await axios.get(
      `${PAYMONGO_API_BASE}/sources/${sourceId}`,
      {
        auth: {
          username: PAYMONGO_SECRET_KEY,
          password: ''
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('PayMongo getSource error:', error.response?.data || error.message);
    throw new Error('Failed to retrieve source');
  }
};

/**
 * Create a webhook
 * @param {Object} webhookData - Webhook data
 * @param {string} webhookData.url - Webhook URL
 * @param {Array<string>} webhookData.events - Events to listen to
 * @returns {Promise<Object>} Webhook object
 */
exports.createWebhook = async (webhookData) => {
  try {
    const { url, events } = webhookData;

    const response = await axios.post(
      `${PAYMONGO_API_BASE}/webhooks`,
      {
        data: {
          attributes: {
            url: url,
            events: events
          }
        }
      },
      {
        auth: {
          username: PAYMONGO_SECRET_KEY,
          password: ''
        },
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('PayMongo createWebhook error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.errors?.[0]?.detail || 'Failed to create webhook');
  }
};

/**
 * Helper: Convert PHP amount to centavos
 * @param {number} phpAmount - Amount in PHP
 * @returns {number} Amount in centavos
 */
exports.phpToCentavos = (phpAmount) => {
  return Math.round(phpAmount * 100);
};

/**
 * Helper: Convert centavos to PHP
 * @param {number} centavos - Amount in centavos
 * @returns {number} Amount in PHP
 */
exports.centavosToPhp = (centavos) => {
  return centavos / 100;
};
