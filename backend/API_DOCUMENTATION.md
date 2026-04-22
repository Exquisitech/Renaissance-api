# Renaissance API Documentation

Welcome to the Renaissance API documentation. This document provides a comprehensive overview of all available endpoints, request/response schemas, authentication, error codes, and rate limits. For interactive exploration, visit the [Swagger UI](http://localhost:3000/api/docs) after running the backend.

---

## Table of Contents
- [Authentication](#authentication)
- [Endpoints](#endpoints)
- [Schemas](#schemas)
- [Error Codes](#error-codes)
- [Rate Limits](#rate-limits)
- [Swagger UI](#swagger-ui)

---

## Authentication
- **Type:** Bearer JWT
- **Header:** `Authorization: Bearer <token>`
- Obtain a token via `/api/auth/login` or `/api/auth/register`.
- Some endpoints require authentication and specific roles (see Swagger UI for details).

---

## Endpoints
All endpoints are versioned under `/api/v1/`.

For a full list of endpoints, request/response schemas, and examples, please refer to the [Swagger UI](http://localhost:3000/api/docs).

### Example Endpoints
- `POST /api/v1/auth/register` — Register a new user
- `POST /api/v1/auth/login` — Login and receive JWT
- `GET /api/v1/auth/profile` — Get current user profile (requires JWT)
- `GET /api/v1/leaderboards/stakers` — Get top stakers leaderboard
- `GET /api/v1/admin/rate-limit` — Get rate-limit config (admin only)

---

## Schemas
All request and response schemas are documented and available in Swagger UI. DTOs are annotated with `@ApiProperty` for accurate schema generation.

### Example: RegisterDto
```
{
  "email": "john.doe@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "username": "johndoe123"
}
```

### Example: AuthResponseDto
```
{
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "john.doe@example.com",
    "username": "johndoe123",
    "firstName": "John",
    "lastName": "Doe",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-20T15:45:00Z"
  },
  "accessToken": "<jwt-token>"
}
```

---

## Error Codes
- `400 Bad Request` — Validation failed
- `401 Unauthorized` — Missing or invalid JWT
- `403 Forbidden` — Insufficient permissions
- `404 Not Found` — Resource not found
- `409 Conflict` — Duplicate or conflicting resource
- `429 Too Many Requests` — Rate limit exceeded
- `500 Internal Server Error` — Unexpected error

Error responses follow this format:
```
{
  "statusCode": 400,
  "message": ["email must be a valid email"],
  "error": "Bad Request"
}
```

---

## Rate Limits
- **Default:** 10 requests/minute (guest), 50 requests/minute (user), 200 requests/minute (admin)
- **Custom:** Some endpoints (e.g., spin/stake) have additional cooldowns (see `/api/v1/admin/rate-limit`)
- Exceeding limits returns `429 Too Many Requests`

---

## Swagger UI
- **URL:** [http://localhost:3000/api/docs](http://localhost:3000/api/docs)
- Interactive API explorer with schemas, examples, and authentication support.
- All endpoints, request/response schemas, and error codes are documented and kept up to date with the codebase.

---

For further details, always refer to the live Swagger UI, as it reflects the latest API state.
