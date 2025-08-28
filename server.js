const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Stripe donation endpoint
app.post('/donate', async (req, res) => {
  try {
    const { amount, artistName, artistId } = req.body;
    
    // Validate required fields
    if (!amount || !artistName) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['amount', 'artistName'],
        received: { amount, artistName, artistId }
      });
    }

    // Validate amount
    const amountInCents = Math.round(parseFloat(amount) * 100);
    if (amountInCents < 100) { // Minimum $1.00
      return res.status(400).json({ 
        error: 'Amount must be at least $1.00',
        received: amount,
        minimum: 1.00
      });
    }

    console.log(`Processing Stripe donation: $${amount} to ${artistName}`);

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      metadata: { 
        artist: artistName,
        artistId: artistId || 'unknown',
        platform: 'FairPlay',
        type: 'artist_donation'
      },
      description: `Donation to ${artistName} via FairPlay`,
      receipt_email: req.body.email || undefined, // Optional email for receipt
    });

    console.log(`Stripe Payment Intent created: ${paymentIntent.id}`);

    // Return success with client secret
    res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: amount,
      currency: 'usd',
      artistName: artistName,
      status: 'requires_payment_method',
      message: `Payment intent created for $${amount} donation to ${artistName}`
    });

  } catch (error) {
    console.error('Stripe donation error:', error);
    
    // Handle specific Stripe errors
    if (error.type === 'StripeCardError') {
      return res.status(400).json({ 
        error: 'Card error',
        message: error.message,
        code: error.code
      });
    } else if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({ 
        error: 'Invalid request',
        message: error.message
      });
    } else if (error.type === 'StripeAPIError') {
      return res.status(500).json({ 
        error: 'Stripe API error',
        message: error.message
      });
    }

    // Generic error
    res.status(500).json({ 
      error: 'Payment processing failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get donation status
app.get('/donate/:paymentIntentId', async (req, res) => {
  try {
    const { paymentIntentId } = req.params;
    
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    res.json({
      success: true,
      paymentIntent: {
        id: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        metadata: paymentIntent.metadata,
        created: new Date(paymentIntent.created * 1000).toISOString()
      }
    });

  } catch (error) {
    console.error('Error retrieving payment intent:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve payment status',
      message: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 FairPlay Stripe Server running on port ${PORT}`);
  console.log(`💳 Stripe integration: ${process.env.STRIPE_SECRET_KEY ? 'ENABLED' : 'DISABLED'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`💝 Donation endpoint: http://localhost:${PORT}/donate`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
