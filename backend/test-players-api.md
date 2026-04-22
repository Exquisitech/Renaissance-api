# Players API Testing Guide

## Overview
Comprehensive player search and statistics API using RapidAPI football database integration with caching, debouncing, and fallback mechanisms.

## Environment Setup
Add to your `.env` file:
```env
RAPIDAPI_FOOTBALL_KEY=your-rapidapi-football-key-here
RAPIDAPI_FOOTBALL_HOST=v3.football.api-sports.io
```

## API Endpoints

### 1. Search Players
```
GET /players/search?query=messi&league=39&season=2023&limit=20
```
- **Debounced**: 300ms delay to prevent excessive API calls
- **Cached**: 5-minute cache for search results
- **Partial matching**: Case-insensitive search on player names
- **Filters**: Optional league ID, season, and result limit

**Response:**
```json
[
  {
    "id": 276,
    "name": "Lionel Messi",
    "firstname": "Lionel",
    "lastname": "Messi",
    "age": 36,
    "birth": {
      "date": "1987-06-24",
      "place": "Rosario",
      "country": "Argentina"
    },
    "nationality": "Argentina",
    "height": "170 cm",
    "weight": "72 kg",
    "injured": false,
    "photo": "https://media.api-sports.io/football/players/276.png"
  }
]
```

### 2. Player Statistics
```
GET /players/276/statistics?league=39&season=2023
```
- **Cached**: 10-minute cache for statistics
- **Comprehensive**: Goals, assists, shots, passes, tackles, cards, etc.
- **Fallback**: Returns empty statistics if API unavailable

**Response:**
```json
[
  {
    "team": {
      "id": 541,
      "name": "Inter Miami",
      "logo": "https://media.api-sports.io/football/teams/541.png"
    },
    "league": {
      "id": 253,
      "name": "MLS",
      "country": "USA",
      "season": 2023
    },
    "games": {
      "appearences": 14,
      "lineups": 14,
      "minutes": 1179,
      "number": 10,
      "position": "A",
      "rating": "7.876923",
      "captain": false
    },
    "goals": {
      "total": 11,
      "assists": 5
    },
    "shots": {
      "total": 52,
      "on": 28
    }
  }
]
```

### 3. Player Team and Position
```
GET /players/276/team
```
- **Cached**: 30-minute cache for team information
- **Current team**: Latest team and position information

**Response:**
```json
[
  {
    "team": {
      "id": 541,
      "name": "Inter Miami",
      "logo": "https://media.api-sports.io/football/teams/541.png"
    },
    "league": "MLS",
    "season": 2023,
    "position": "Attacker",
    "number": 10
  }
]
```

### 4. Player Age and Nationality
```
GET /players/276/age-nationality
```
- **Cached**: 1-hour cache for personal information
- **Birth details**: Date, place, and nationality

**Response:**
```json
{
  "age": 36,
  "nationality": "Argentina",
  "birthDate": "1987-06-24",
  "birthPlace": "Rosario"
}
```

### 5. Player Images
```
GET /players/276/image
```
- **Fallback**: Placeholder image if photo unavailable
- **Direct URL**: Returns image URL for easy display

**Response:**
```json
{
  "imageUrl": "https://media.api-sports.io/football/players/276.png"
}
```

### 6. Popular Searches (Cached)
```
GET /players/popular/messi
```
- **Long-term cache**: 1-hour cache for popular searches
- **Performance**: Faster response for frequently searched players

### 7. Database Players
```
GET /players?page=1&limit=10
GET /players/:id
```
- **Local storage**: Players synced from external API
- **Pagination**: Efficient data retrieval

### 8. Admin Endpoints
```
POST /players/276/sync
```
- **Admin only**: Sync player data from external API to local database
- **Authentication**: Requires JWT with admin role

## Features Implemented

✅ **Player search returns results** - Debounced search with partial matching
✅ **Statistics display correctly** - Comprehensive player statistics
✅ **Images load properly** - Player photos with fallback handling
✅ **Search debounced for performance** - 300ms debounce prevents API spam
✅ **Fallback for unavailable data** - Graceful degradation when API fails
✅ **Caching for popular searches** - Multiple cache layers for performance
✅ **Filter by league and season** - Advanced search filtering
✅ **Age and nationality information** - Complete player profile data
✅ **Team and position details** - Current team information
✅ **Swagger documentation** - Complete API documentation
✅ **Error handling** - Comprehensive error handling and logging

## Performance Optimizations

1. **Debounced Search**: 300ms delay prevents rapid API calls
2. **Multi-level Caching**:
   - Search results: 5 minutes
   - Statistics: 10 minutes  
   - Team info: 30 minutes
   - Personal info: 1 hour
   - Popular searches: 1 hour
3. **Fallback Data**: Returns meaningful data when external API fails
4. **Pagination**: Efficient data retrieval for large datasets

## Testing Commands

```bash
# Search players
curl "http://localhost:3000/players/search?query=messi&limit=5"

# Get player statistics
curl "http://localhost:3000/players/276/statistics?league=39&season=2023"

# Get player team info
curl "http://localhost:3000/players/276/team"

# Get player age and nationality
curl "http://localhost:3000/players/276/age-nationality"

# Get player image
curl "http://localhost:3000/players/276/image"

# Get popular searches
curl "http://localhost:3000/players/popular/messi"

# Sync player (admin only)
curl -X POST "http://localhost:3000/players/276/sync" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Error Handling

- **API Key Missing**: Returns fallback data with warning logs
- **API Rate Limits**: Graceful degradation with cached data
- **Network Errors**: Fallback responses with appropriate error messages
- **Invalid Data**: Type validation and sanitization
- **Cache Failures**: Direct API calls with error handling

## Monitoring

All endpoints include comprehensive logging for:
- API call success/failure rates
- Cache hit/miss ratios
- Response times
- Error details and stack traces
