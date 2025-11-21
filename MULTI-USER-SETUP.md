# Multi-User Setup Guide

## How User Accounts Work

### ✅ Each User Has Their OWN Trading Account

When users create an account, they provide:
1. **Email & Password** - for authentication
2. **Their own Alpaca API keys** - for their personal paper trading account

This means:
- ✅ Each user has their own $100,000 paper trading portfolio
- ✅ Trades from one user don't affect others
- ✅ Each user sees only their own positions and performance
- ✅ Completely isolated accounts

## For Demo/Testing (Your Current Setup)

### Demo Account
- Email: `demo@demo.com`
- Password: `demo123`
- Uses YOUR Alpaca keys from `.env`
- Perfect for demonstration

## For Production/Public Deployment

### Option 1: Each User Brings Their Own Keys (Current Implementation)

**Registration Flow:**
1. User signs up at alpaca.markets (free)
2. User gets their own paper trading API keys
3. User creates account on your platform
4. User enters their Alpaca keys during registration
5. System stores keys securely (encrypted in production DB)

**Pros:**
- ✅ No shared accounts
- ✅ Users control their own data
- ✅ No liability for you
- ✅ Users can use their keys elsewhere too

**Cons:**
- ❌ Extra step for users (getting Alpaca keys)
- ❌ Slightly more complex signup

### Option 2: Central Alpaca Account with Subaccounts (Advanced)

This would require:
- Alpaca Enterprise plan
- Backend manages all user portfolios
- More complex infrastructure

**Not recommended for MVP**

## Security Best Practices

### Current (Development)
- Keys stored in memory (Map)
- Lost when server restarts
- **NOT suitable for production**

### For Production

1. **Database Storage:**
```javascript
// Encrypt keys before storing
const encryptedApiKey = encrypt(alpacaApiKey, ENCRYPTION_KEY);
const encryptedSecretKey = encrypt(alpacaSecretKey, ENCRYPTION_KEY);

await db.users.create({
  email,
  password: hashedPassword,
  alpacaApiKey: encryptedApiKey,
  alpacaSecretKey: encryptedSecretKey
});
```

2. **Environment Variables:**
```env
DATABASE_URL=postgresql://...
ENCRYPTION_KEY=your-32-character-encryption-key
```

3. **Decrypt on Use:**
```javascript
const apiKey = decrypt(user.alpacaApiKey, ENCRYPTION_KEY);
const secretKey = decrypt(user.alpacaSecretKey, ENCRYPTION_KEY);

const alpaca = new Alpaca({
  keyId: apiKey,
  secretKey: secretKey,
  paper: true
});
```

## How to Test Multi-User Setup

### Test User 1:
1. Go to https://alpaca.markets
2. Create Account A
3. Get API keys
4. Register on your platform with those keys
5. Make some trades

### Test User 2:
1. Create different Alpaca Account B
2. Get different API keys
3. Register with different email
4. Make different trades

### Verify:
- User 1 sees only their trades
- User 2 sees only their trades
- Portfolios are completely separate

## Migration Path

### Current State (Development):
```
Demo User → Your Alpaca Account
```

### Production State:
```
User A → Their own Alpaca Account A
User B → Their own Alpaca Account B
User C → Their own Alpaca Account C
```

## Important Notes

1. **Paper Trading is Free**: Unlimited paper trading accounts on Alpaca
2. **No Real Money**: Always use paper trading keys (PK... not AK...)
3. **API Limits**: Alpaca has rate limits per account
4. **Data Isolation**: Each user's data stays separate

## FAQ

**Q: What if I want to demo the app without users creating Alpaca accounts?**
A: Keep the demo account with your keys. Users can test with that before creating their own.

**Q: Can users share one Alpaca account?**
A: Not recommended. Would cause conflicts and mixed portfolios.

**Q: How do I add database persistence?**
A: Add PostgreSQL, encrypt keys, see DEPLOYMENT.md for details.

**Q: Is it safe to store API keys?**
A: With proper encryption + HTTPS + secure database, yes. Same as how trading platforms work.

## Next Steps

1. ✅ Basic multi-user (current implementation)
2. Add PostgreSQL database
3. Add key encryption
4. Add email verification
5. Add password reset
6. Deploy to production

---

**Your app is now multi-user ready!** 🎉

Each user brings their own Alpaca account, ensuring complete isolation and security.
