# Deployment Guide - Replit

Complete guide to deploy your AI Stock Trader application on Replit.

## Prerequisites

1. A [Replit account](https://replit.com) (free tier works)
2. Alpaca Paper Trading API keys
3. Your application code ready

## Step-by-Step Deployment

### Option A: Import from GitHub (Recommended)

#### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/ai-stock-trader.git
git push -u origin main
```

#### 2. Import to Replit

1. Go to [replit.com](https://replit.com)
2. Click "+ Create Repl"
3. Select "Import from GitHub"
4. Authorize Replit to access your GitHub
5. Select your repository
6. Click "Import from GitHub"

Replit will automatically:
- Detect it's a Node.js project
- Install dependencies
- Configure the environment

### Option B: Direct Upload

#### 1. Create New Repl

1. Go to [replit.com](https://replit.com)
2. Click "+ Create Repl"
3. Select "Node.js" as the template
4. Name your Repl (e.g., "ai-stock-trader")
5. Click "Create Repl"

#### 2. Upload Files

1. Delete the default `index.js` file
2. Click the three-dot menu on "Files"
3. Select "Upload folder" or drag and drop
4. Upload all your project files

Alternatively, use the Replit GitHub integration:
1. Click "Version Control" in left sidebar
2. Connect to GitHub
3. Initialize repository

## Configuration

### 1. Set Environment Variables

Replit uses "Secrets" for environment variables.

1. Click on "Tools" in left sidebar
2. Click "Secrets" (lock icon)
3. Add each variable:

```
ALPACA_API_KEY=your_alpaca_key_here
ALPACA_SECRET_KEY=your_alpaca_secret_here
ALPACA_BASE_URL=https://paper-api.alpaca.markets
ALPACA_DATA_URL=https://data.alpaca.markets
JWT_SECRET=generate_random_string_here
DEFAULT_VOLUME_THRESHOLD=2.5
DEFAULT_PRICE_CHANGE_THRESHOLD=1.5
MAX_POSITION_SIZE=10000
NODE_ENV=production
```

**Important**: Never share these secrets or commit them to Git!

### 2. Generate JWT Secret

Run this in your terminal to generate a secure secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and use it as your `JWT_SECRET`.

### 3. Configure Run Command

Replit should auto-detect the run command from `package.json`.

If not, manually set it:

1. Click ".replit" file
2. Ensure it contains:

```toml
run = "npm run dev"

[env]
PORT = "3001"

[deployment]
run = ["sh", "-c", "npm start"]
```

### 4. Update Frontend URL

After deployment, Replit gives you a URL like:
```
https://ai-stock-trader.username.repl.co
```

Add this to your Secrets:
```
FRONTEND_URL=https://ai-stock-trader.username.repl.co
NEXT_PUBLIC_API_URL=https://ai-stock-trader.username.repl.co
NEXT_PUBLIC_WS_URL=https://ai-stock-trader.username.repl.co
```

## Running the Application

### Development

1. Click the "Run" button at the top
2. Wait for dependencies to install
3. Application will start automatically
4. Click the web view to open

### Production Deployment

For always-on production deployment:

1. Click "Deployments" in left sidebar
2. Click "Create Production Deployment"
3. Configure autoscaling (optional)
4. Click "Deploy"

This creates a permanent URL and keeps your app running 24/7.

## Replit-Specific Considerations

### 1. Port Configuration

Replit expects your app on a specific port. The backend uses:
```javascript
const PORT = process.env.PORT || 3001;
```

This automatically works with Replit's port assignment.

### 2. Database (Future)

If you add a database later:

**Option 1: Replit Database**
```javascript
const Database = require("@replit/database");
const db = new Database();
```

**Option 2: External Database**
- PostgreSQL: Use ElephantSQL (free tier)
- MongoDB: Use MongoDB Atlas (free tier)
- Redis: Use Redis Labs (free tier)

Add connection strings to Secrets.

### 3. File Storage

Replit has ephemeral storage. For persistent files:
- Use external storage (AWS S3, Cloudinary)
- Use Replit's database for small files

### 4. WebSocket Support

Replit fully supports WebSockets. No special configuration needed.

### 5. Always-On

Free Repls sleep after inactivity. For 24/7 uptime:
- Use Replit's "Always On" feature ($7/month)
- Or deploy to production (included in paid plans)

## Testing Your Deployment

### 1. Check Backend Health

Visit: `https://your-repl-name.repl.co/health`

Should return:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 2. Test Frontend

Visit: `https://your-repl-name.repl.co`

You should see the login page.

### 3. Test WebSocket

Open browser console and check for:
```
Connected to WebSocket
```

### 4. Test API Connection

1. Create an account
2. Login
3. Check dashboard loads
4. Verify real-time data updates

## Troubleshooting

### "Module not found" Errors

```bash
# In Replit Shell
npm install
cd frontend && npm install
```

### "Port already in use"

Replit handles this automatically. If issues persist:
1. Stop the Repl
2. Clear cache: Shell → `rm -rf node_modules .next`
3. Reinstall: `npm install && cd frontend && npm install`
4. Restart

### "Cannot connect to Alpaca"

Check:
1. Secrets are set correctly
2. API keys are for Paper Trading
3. No extra spaces in secrets
4. `ALPACA_BASE_URL` is correct

### WebSocket Connection Failed

1. Check backend is running
2. Verify `NEXT_PUBLIC_WS_URL` in secrets
3. Check browser console for specific errors
4. Ensure WebSocket port is not blocked

### Frontend Not Loading

1. Verify frontend build: `cd frontend && npm run build`
2. Check `NEXT_PUBLIC_API_URL` is set
3. Look for errors in Replit console
4. Try hard refresh: Ctrl+Shift+R (or Cmd+Shift+R on Mac)

### Slow Performance

Free Repls have limited resources. For better performance:
1. Upgrade to Replit Hacker plan
2. Use Production Deployment
3. Optimize code (reduce API calls, cache data)

## Monitoring

### Replit Console

View logs in real-time:
1. Click "Console" tab
2. See all `console.log()` output
3. Monitor errors and warnings

### Check System Status

In Shell:
```bash
# Check running processes
ps aux

# Check memory usage
free -h

# Check disk space
df -h
```

## Updating Your Application

### From GitHub

If using GitHub import:
1. Push changes to GitHub
2. In Replit, click "Version Control"
3. Click "Pull" to get latest changes
4. Restart the Repl

### Manual Update

1. Edit files directly in Replit
2. Changes save automatically
3. Repl restarts automatically

## Security Checklist

- [ ] All API keys in Secrets (not in code)
- [ ] Strong JWT_SECRET generated
- [ ] `.env` file not committed
- [ ] Paper trading keys only (never live keys)
- [ ] CORS configured properly
- [ ] Rate limiting enabled (if needed)
- [ ] Input validation on all endpoints

## Cost Optimization

### Free Tier
- Repl sleeps after inactivity
- Shared resources
- Good for development/testing

### Paid Options
- **Hacker Plan** ($7/mo): More resources, faster
- **Always On** ($7/mo): 24/7 uptime
- **Production Deployments**: Autoscaling, custom domains

### Alternatives for Production

For serious production use, consider:
1. **Vercel** (Frontend) + **Railway** (Backend)
2. **Netlify** (Frontend) + **Heroku** (Backend)
3. **AWS** (Full stack with EC2/ECS)
4. **DigitalOcean** (Droplet or App Platform)

## Custom Domain (Optional)

With paid Replit plans:

1. Purchase domain (Namecheap, Google Domains)
2. In Replit Deployment settings
3. Add custom domain
4. Update DNS records as instructed
5. SSL certificate auto-provisioned

## Backup Strategy

### Code Backup
- GitHub: Automatic (if using GitHub import)
- Replit History: 7-day rollback

### Data Backup
- Export trade data periodically
- Use external database with backups
- Download logs regularly

## Performance Optimization

### Frontend
```javascript
// next.config.js
module.exports = {
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
}
```

### Backend
- Enable compression
- Cache API responses
- Use connection pooling
- Implement rate limiting

## Scaling Considerations

When outgrowing Replit:

1. **Containerize**: Add Dockerfile
2. **Database**: Move to dedicated service
3. **CDN**: Use Cloudflare for static assets
4. **Load Balancer**: Distribute traffic
5. **Redis**: Cache frequently accessed data

## Support

- Replit Docs: https://docs.replit.com
- Replit Community: https://ask.replit.com
- Project Issues: Create issue in your repo

---

## Quick Reference

### Essential Secrets
```
ALPACA_API_KEY=...
ALPACA_SECRET_KEY=...
JWT_SECRET=...
FRONTEND_URL=https://your-repl.repl.co
```

### Essential Commands
```bash
# Install dependencies
npm install

# Start development
npm run dev

# Build for production
npm run build

# Start production
npm start

# Clear cache
rm -rf node_modules .next
```

### Essential URLs
- Dashboard: `https://your-repl.repl.co`
- API Health: `https://your-repl.repl.co/health`
- WebSocket: `wss://your-repl.repl.co`

---

**You're all set! Happy deploying! 🚀**
