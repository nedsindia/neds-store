# NEDS SUPER STORE — Production Deployment

## Backend
- Deploy `backend/` as a Render Web Service.
- Build: `pip install -r requirements.txt`
- Start: `uvicorn server:app --host 0.0.0.0 --port $PORT`
- Required secrets: `MONGO_URL`, `JWT_SECRET`.
- Set `NEDS_SEED_DEMO_PAYMENTS=0` in production.

## Database
Use MongoDB Atlas. Create a dedicated production database/user and restrict network access appropriately.

## Android
The Expo app is branded NEDS SUPER STORE with package `com.nedsindia.superstore`. EAS production builds generate Android App Bundles (`.aab`).

## Important pre-launch configuration
1. Set the Render API URL in the mobile/web environment.
2. Set a strong random JWT secret.
3. Configure production CORS origins.
4. Configure real payment credentials only in Render secrets; never commit them.
5. Configure Google Maps/location credentials where required.
6. Verify privacy policy, data safety, support contact, and store listing before Play submission.
7. Run backend tests and an end-to-end staging test before production launch.
