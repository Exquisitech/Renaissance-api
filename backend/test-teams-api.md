# Teams API Testing Guide

## Endpoints Created

### 1. GET all teams
```
GET /teams?page=1&limit=10
```
- Returns paginated list of all teams
- Includes team logo URLs
- Response format:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Team Name",
      "shortName": "Short Name",
      "logoUrl": "https://example.com/logo.png",
      "league": "League Name",
      "country": "Country",
      "founded": 1900,
      "stadium": "Stadium Name",
      "capacity": 50000,
      "website": "https://team-website.com"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 10,
  "totalPages": 10
}
```

### 2. GET team by ID
```
GET /teams/:id
```
- Returns detailed information for a specific team
- Includes team logo URL and metadata

### 3. Search teams
```
GET /teams/search?search=united&league=premier&country=england&page=1&limit=10
```
- Partial name matching on team name, short name, and code
- Filter by league and/or country
- Case-insensitive search
- Paginated results

### 4. GET league standings
```
GET /teams/standings/:league?season=2023-2024
```
- Returns sorted league standings
- Includes: played, won, drawn, lost, goals for/against, goal difference, points
- Sorted by: points → goal difference → goals for
- Includes team logo URLs

### 5. Admin endpoints (require authentication)
```
POST /teams - Create new team (Admin only)
PUT /teams/:id - Update team (Admin only)
DELETE /teams/:id - Delete team (Admin only)
```

## Features Implemented

✅ All endpoints functional
✅ Search works with partial names
✅ Standings sorted correctly  
✅ Team logos included
✅ Filter by league functionality
✅ Pagination support
✅ Swagger documentation
✅ Caching support
✅ Input validation
✅ Error handling

## Testing Commands

Start the server:
```bash
npm run start:dev
```

Test endpoints:
```bash
# Get all teams
curl http://localhost:3000/teams

# Search teams
curl "http://localhost:3000/teams/search?search=united"

# Get league standings
curl http://localhost:3000/teams/standings/premier%20league

# Get team by ID (replace with actual UUID)
curl http://localhost:3000/teams/123e4567-e89b-12d3-a456-426614174000
```

## Database Schema

The Team entity includes:
- Basic info: name, shortName, code
- Geographic: league, country
- Stadium: stadium, capacity, founded
- Digital: website, logoUrl
- Relations: homeMatches, awayMatches
- Metadata: flexible JSON field for additional data
