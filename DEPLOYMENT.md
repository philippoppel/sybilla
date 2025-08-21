# 🚀 Production Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit with your secure values
nano .env
```

### 2. Required Environment Variables
```env
NODE_ENV=production
SECRET_KEY=generate-32-character-random-string-here
ADMIN_USER=your-chosen-username
ADMIN_PASS=YourSecurePassword2024!@#
GIT_ENABLED=true
PORT=3000
```

### 3. Generate Secure Keys
```bash
# Generate SECRET_KEY (32+ characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or use online generator: https://generate-secret.vercel.app/32
```

## Deployment Options

### Option A: Vercel (Recommended)
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard:
# - NODE_ENV=production
# - SECRET_KEY=your-generated-key
# - ADMIN_USER=your-username
# - ADMIN_PASS=your-password
# - GIT_ENABLED=true
```

### Option B: Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway deploy

# Set environment variables in Railway dashboard
```

### Option C: DigitalOcean App Platform
1. Connect GitHub repository
2. Set environment variables in dashboard
3. Deploy automatically

## Security Checklist

### ✅ Pre-Production
- [ ] Strong SECRET_KEY (32+ characters)
- [ ] Unique ADMIN_USER (not 'admin')  
- [ ] Strong ADMIN_PASS (12+ chars, mixed case, numbers, symbols)
- [ ] NODE_ENV=production
- [ ] HTTPS enabled on hosting platform
- [ ] Git credentials configured

### ✅ Post-Deployment  
- [ ] Test admin login
- [ ] Test content editing
- [ ] Test publishing (check GitHub commits)
- [ ] Verify HTTPS redirect works
- [ ] Check security headers

## Testing Production Setup Locally

```bash
# Create .env file with production values
NODE_ENV=production \
SECRET_KEY=your-secret-key \
ADMIN_USER=your-user \
ADMIN_PASS=your-pass \
npm start
```

## Accessing Admin Panel

Production URL: `https://your-domain.com/admin.html`

Login with your configured ADMIN_USER and ADMIN_PASS.

## Troubleshooting

### Common Issues:
1. **Server won't start**: Check all required env vars are set
2. **Login fails**: Verify ADMIN_USER and ADMIN_PASS
3. **Publishing fails**: Check Git credentials and branch permissions
4. **HTTPS redirect loop**: Check hosting platform SSL settings

### Security Monitoring:
- Monitor failed login attempts
- Check for unusual Git activity
- Regular password rotation (monthly)

## Support

For issues, check server logs or contact support with error details.