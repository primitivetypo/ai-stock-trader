# OAuth Implementation Guide (Recommended Approach)

## Why OAuth is Better Than API Keys

### ❌ Asking for API Keys (Current - Bad UX):
```
User: "Enter your API key"
User: "Wait, what? Where do I get that?"
User: "This seems sketchy..."
User: *leaves*
```

### ✅ OAuth Flow (Professional):
```
User: "Sign up"
User: *clicks "Connect with Alpaca"*
User: *logs into Alpaca (they trust)*
User: *clicks "Authorize"*
User: ✅ Done! Trading immediately
```

---

## Implementation Plan

### 1. Register OAuth App with Alpaca

Go to Alpaca Dashboard:
1. Settings → API Keys → OAuth Apps
2. Create new OAuth app
3. Get:
   - Client ID
   - Client Secret
   - Redirect URI: `https://yourdomain.com/auth/alpaca/callback`

### 2. Update Environment Variables

```env
# Alpaca OAuth
ALPACA_OAUTH_CLIENT_ID=your_client_id
ALPACA_OAUTH_CLIENT_SECRET=your_client_secret
ALPACA_OAUTH_REDIRECT_URI=http://localhost:4000/auth/alpaca/callback
```

### 3. Backend OAuth Routes

```javascript
// backend/src/api/alpaca-oauth.js
const express = require('express');
const router = express.Router();
const axios = require('axios');

// Step 1: Redirect to Alpaca for authorization
router.get('/connect', (req, res) => {
  const authUrl = `https://app.alpaca.markets/oauth/authorize?` +
    `response_type=code&` +
    `client_id=${process.env.ALPACA_OAUTH_CLIENT_ID}&` +
    `redirect_uri=${process.env.ALPACA_OAUTH_REDIRECT_URI}&` +
    `scope=account:write trading data`;

  res.redirect(authUrl);
});

// Step 2: Handle callback from Alpaca
router.get('/callback', async (req, res) => {
  const { code } = req.query;

  try {
    // Exchange code for access token
    const response = await axios.post('https://api.alpaca.markets/oauth/token', {
      grant_type: 'authorization_code',
      code,
      client_id: process.env.ALPACA_OAUTH_CLIENT_ID,
      client_secret: process.env.ALPACA_OAUTH_CLIENT_SECRET,
      redirect_uri: process.env.ALPACA_OAUTH_REDIRECT_URI
    });

    const { access_token, refresh_token } = response.data;

    // Store tokens with user (encrypted in DB)
    // For now, store in session
    req.session.alpacaAccessToken = access_token;
    req.session.alpacaRefreshToken = refresh_token;

    res.redirect('/dashboard?connected=true');
  } catch (error) {
    console.error('OAuth error:', error);
    res.redirect('/?error=connection_failed');
  }
});

// Disconnect
router.post('/disconnect', (req, res) => {
  req.session.alpacaAccessToken = null;
  req.session.alpacaRefreshToken = null;
  res.json({ success: true });
});

module.exports = router;
```

### 4. Frontend OAuth Button

```javascript
// frontend/src/components/auth/ConnectAlpaca.js
export default function ConnectAlpaca() {
  const handleConnect = () => {
    // Redirect to backend OAuth route
    window.location.href = 'http://localhost:4001/api/oauth/connect';
  };

  return (
    <button
      onClick={handleConnect}
      className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
    >
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10 0C4.477 0 0 4.477 0 10s4.477 10 10 10 10-4.477 10-10S15.523 0 10 0z"/>
      </svg>
      Connect with Alpaca
    </button>
  );
}
```

### 5. User Database Schema

```javascript
// Add to user model
{
  id: string,
  email: string,
  password: string (hashed),
  alpacaAccessToken: string (encrypted),
  alpacaRefreshToken: string (encrypted),
  alpacaAccountId: string,
  alpacaConnectedAt: Date,
  accountType: 'demo' | 'oauth' | 'pro'
}
```

---

## Three-Tier User System

### 🆓 **Tier 1: Demo (No Alpaca)**
```javascript
User signs up → Gets simulated account → Trades with fake data
```
**Benefits:**
- Instant access
- No barriers
- Learn the platform
- Compete on leaderboards

### 📊 **Tier 2: Connected (OAuth)**
```javascript
User connects Alpaca → Real paper trading → Full features
```
**Benefits:**
- Real paper trading ($100k)
- Real market data
- Full automation
- Portfolio tracking

### 💎 **Tier 3: Pro (Paid)**
```javascript
Pay $9/month → Real money trading → Premium features
```
**Benefits:**
- Live trading (real money)
- Advanced analytics
- Priority support
- Custom strategies

---

## Updated Sign-Up Flow

### Landing Page
```
┌────────────────────────────────────┐
│   AI Stock Trader                  │
│   Automated Volume Trading         │
│                                    │
│   [Try Demo] ← Instant access     │
│   [Connect Alpaca] ← OAuth        │
│   [Learn More]                     │
└────────────────────────────────────┘
```

### Demo Flow (Fastest)
```
1. Enter email/password
2. ✅ Start trading immediately
3. Virtual portfolio
4. Optional: Connect Alpaca later
```

### OAuth Flow (Real Trading)
```
1. Click "Connect Alpaca"
2. Redirected to Alpaca
3. Login to Alpaca
4. Authorize app
5. ✅ Connected! Real paper trading
```

---

## Security Benefits of OAuth

| Aspect | API Keys | OAuth |
|--------|----------|-------|
| User gives you | Full access keys | Temporary token |
| User trust | Low (scary) | High (familiar) |
| Revocable | No | Yes (one click) |
| Secure | Keys in database | Token expires |
| UX | Complex | Simple |
| Industry standard | No | Yes |

---

## Implementation Checklist

- [ ] Register OAuth app with Alpaca
- [ ] Add OAuth routes to backend
- [ ] Add OAuth button to frontend
- [ ] Store tokens encrypted in DB
- [ ] Handle token refresh
- [ ] Add disconnect functionality
- [ ] Add demo mode (no Alpaca)
- [ ] Update signup flow
- [ ] Add tier indicators
- [ ] Test OAuth flow

---

## Demo Mode Implementation

For users who don't want to connect Alpaca:

```javascript
// backend/src/services/demoTradingService.js
class DemoTradingService {
  constructor() {
    this.accounts = new Map(); // userId -> portfolio
  }

  createAccount(userId) {
    this.accounts.set(userId, {
      cash: 100000,
      positions: [],
      orders: [],
      performance: 0
    });
  }

  async placeOrder(userId, order) {
    // Simulate order execution
    const account = this.accounts.get(userId);

    // Get current price from Alpaca market data (free tier)
    const price = await this.getCurrentPrice(order.symbol);

    // Execute simulated trade
    if (order.side === 'buy') {
      account.cash -= order.qty * price;
      account.positions.push({
        symbol: order.symbol,
        qty: order.qty,
        avgPrice: price
      });
    }

    return { success: true, price };
  }
}
```

---

## Monetization Strategy

### Free Features
- ✅ Demo trading
- ✅ Basic volume detection
- ✅ Up to 5 watchlist symbols
- ✅ Daily performance reports

### OAuth Features (Free)
- ✅ Real paper trading
- ✅ Full volume detection
- ✅ Unlimited watchlist
- ✅ Real-time alerts
- ✅ Historical data

### Pro Features ($9/mo)
- ✅ Real money trading
- ✅ Advanced strategies
- ✅ Backtesting engine
- ✅ Custom algorithms
- ✅ API access
- ✅ Priority support

---

## Next Steps

1. **Immediate (Demo Mode)**
   - Remove API key requirement
   - Add demo trading service
   - Users trade with simulated portfolio

2. **Short-term (OAuth)**
   - Register with Alpaca
   - Implement OAuth flow
   - Test with beta users

3. **Long-term (Monetization)**
   - Add Pro tier
   - Payment integration (Stripe)
   - Real money trading

---

Would you like me to implement **Demo Mode first** (fastest) or **OAuth integration** (best long-term)?
