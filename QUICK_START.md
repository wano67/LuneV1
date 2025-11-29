# Quick Start Guide - Testing Phase 2 Integration

## In 3 Steps

### Step 1: Start Backend (Terminal 1)
```bash
cd ~/Documents/GitHub/Lune\ v2\ DB\ +\ ORM\ +\ API\ +\ Front
npm run dev
```
✅ Fastify API will start on `http://localhost:3001`

### Step 2: Start Frontend (Terminal 2)
```bash
cd ~/Documents/GitHub/Lune\ v2\ DB\ +\ ORM\ +\ API\ +\ Front/apps/web
npm run dev
```
✅ Next.js will start on `http://localhost:3000`

### Step 3: Visit Dashboard
Open browser and navigate to:
- **Personal Dashboard:** http://localhost:3000/app/personal
- **Business Dashboard:** http://localhost:3000/app/business
- **Performance Dashboard:** http://localhost:3000/app/performance

---

## What You Should See

### Personal Dashboard
- **Total Balances Card** - Shows your account balances from API
- **Monthly Summary** - Current month income, spending, net
- **Budgets** - Your budgets with consumption % bars
- **Recent Transactions** - Last 5 transactions with dates

### Business Dashboard
- **Business Info** - Your business name and details
- **Active Projects** - Count of ongoing projects
- **On-Time Delivery** - Percentage of projects delivered on time
- **Top Clients** - Revenue-ranked client list
- **Portfolio Summary** - Project status breakdown

### Performance Dashboard
- **Personal Monthly** - Your personal income/spending
- **Business Summary** - Project performance metrics
- **Total Wealth** - Your account balances
- **3-Month Trend** - Income trends over last 3 months
- **Financial Health** - Overall status indicator

---

## Verifying Data Sync

### Check Network Requests
1. Open **DevTools** (F12)
2. Go to **Network** tab
3. Reload page (⌘R or Ctrl+R)
4. Look for requests to `http://localhost:3001/`
5. Verify responses contain real data

Expected API calls:
- `GET /personal/insights/overview` → 200 OK
- `GET /personal/accounts` → 200 OK
- `GET /personal/transactions` → 200 OK
- `GET /api/v1/businesses` → 200 OK
- `GET /api/v1/businesses/{id}/projects` → 200 OK
- `GET /api/v1/businesses/{id}/insights/...` → 200 OK

### Check Browser Console
Should show **no errors** (WarningAbout experimental features are OK)

### Verify Formatting
- ✅ Currency shows as `$X,XXX.XX`
- ✅ Dates show as "2 days ago" or similar
- ✅ Numbers have proper decimals
- ✅ Progress bars show consumption %

---

## Theme Switching

Click the **Theme Toggle** button in header to switch between:
- ☀️ **Solar Light** - Light theme with blue accents
- 🌙 **Nebula Dark** - Dark theme with purple accents

Data should remain exactly the same, only visual theme changes.

---

## Error Testing

### Stop Backend (intentionally)
1. In Terminal 1, press Ctrl+C
2. Reload page
3. Should see: `"Error: Failed to fetch from Lune API"`
4. Restart backend, error disappears

### Missing Dev Token
1. Edit `apps/web/.env.local`
2. Remove/clear `NEXT_PUBLIC_LUNE_DEV_TOKEN=` value
3. Rebuild: `npm run build` in apps/web
4. Reload page
5. Should still work (requests sent without auth header)

---

## Environment Variables

### Current Setup
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_LUNE_DEV_TOKEN=
```

### For Production
Before deploying to production, update:
```env
NEXT_PUBLIC_API_BASE_URL=https://your-production-api.com
NEXT_PUBLIC_LUNE_DEV_TOKEN=your-production-token-here
```

---

## Files to Know

### Frontend Structure
```
apps/web/
├── lib/
│   ├── api/
│   │   ├── http.ts          ← HTTP client wrapper
│   │   ├── types.ts         ← TypeScript types
│   │   ├── personal.ts      ← Personal API functions
│   │   └── business.ts      ← Business API functions
│   └── hooks/
│       ├── usePersonalData.ts  ← Personal hooks
│       └── useBusinessData.ts  ← Business hooks
└── app/
    └── app/
        ├── personal/page.tsx    ← Personal dashboard
        ├── business/page.tsx    ← Business dashboard
        └── performance/page.tsx ← Performance dashboard
```

### Backend Structure
```
src/
├── api/
│   ├── routes/
│   │   ├── personal-insights.ts
│   │   ├── business*.ts
│   │   └── ...
│   └── schemas/
│       ├── personal*.ts
│       ├── business*.ts
│       └── ...
└── lib/
    └── prisma.ts
```

---

## Common Issues & Fixes

### Issue: "Cannot GET /app/personal"
**Fix:** Make sure frontend is running (`npm run dev` in apps/web)

### Issue: "API error: 500"
**Fix:** Check backend console for error logs. Database might not be seeded.

### Issue: "Blank cards"
**Fix:** Check that database has data. Review backend database contents.

### Issue: "Slow page loads"
**Fix:** Network tab shows slow API responses. Check backend database performance.

### Issue: "CORS error"
**Fix:** Frontend runs on 3000, backend on 3001. CORS should be configured already.

---

## Testing Checklist

- [ ] Personal page loads and shows balance
- [ ] Business page loads and shows projects
- [ ] Performance page shows combined data
- [ ] Switching theme doesn't break data
- [ ] Reloading page re-fetches data
- [ ] Stopping backend shows error message
- [ ] Restarting backend clears error
- [ ] Numbers format with proper currency
- [ ] Dates show relative format
- [ ] Progress bars show correct percentages
- [ ] All cards have correct data
- [ ] Build succeeds: `npm run build`
- [ ] Lint passes: `npm run lint`

---

## Next: Production Deploy

When ready to deploy:

1. **Build frontend:** `npm run build`
2. **Update env vars:** Set production API URL and token
3. **Deploy to Vercel/similar:** Follow their Next.js deployment guide
4. **Update API CORS:** Allow your production frontend domain
5. **Monitor:** Set up error tracking and performance monitoring

---

## Support

For questions:
- Check `INTEGRATION_COMPLETE.md` for architecture details
- Check `VERIFICATION_CHECKLIST.md` for what was tested
- Check `FILES_MANIFEST.md` for file-by-file changes
- Review backend API documentation at `http://localhost:3001/api/v1/docs`

---

**Ready to test!** 🚀

Start with Step 1 above, then navigate to any dashboard page.
