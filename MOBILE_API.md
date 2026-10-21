# ES 24/7 Android API contract

Base URL: the deployed HTTPS URL of the ES 24/7 web service. Do not hard-code development or Railway preview URLs into the Android release.

## Client login

`POST /api/mobile/auth/login`

```json
{"email":"client@example.com","password":"temporary-password"}
```

Returns a bearer access token and a user object. Store tokens using Android's secure storage. Access tokens expire after 8 hours. Only client-role accounts may use this endpoint.

## Change temporary password

The web session endpoint is `POST /api/auth/change-password`. Mobile integration should use an authenticated mobile password-change endpoint before enabling panic actions; the current bearer-token API should be extended and tested for that flow before production rollout. Accounts marked `must_change_password=true` must not be treated as fully activated.

## Submit panic

`POST /api/client/panic`

Header: `Authorization: Bearer <access_token>`

```json
{
  "incident_type": "Emergency Service",
  "latitude": -26.12345,
  "longitude": 28.12345,
  "location_text": "Street address or landmark"
}
```

Valid `incident_type` values: `Emergency Service`, `Accident`, `Fire Panic`, `Other`. Coordinates and location text are optional, but location permission should be requested clearly in the Android app. The incident is routed to the company assigned to that client account.

## Client incident history

`GET /api/client/incidents`

Header: `Authorization: Bearer <access_token>`

Returns only incidents linked to the authenticated client.

## Production note

Mobile API requests must be tested against the real production database, including wrong-company isolation, expired token handling, repeated panic submissions, offline retries and location permission denial. Push notifications and dispatch integrations are not configured by this API alone.
