# Events Platform Backend

A robust RESTful API service for managing events and registrations. Built with Node.js, Express, TypeScript, and MongoDB, this platform enables users to create, discover, and register for events with secure JWT-based authentication and comprehensive event management capabilities.

## Features

### Authentication & Authorization
- **User Registration & Login**: Secure credential-based authentication with bcrypt password hashing
- **JWT Token Management**: Access tokens (15min) and refresh tokens (7 days) for secure session management
- **Token Refresh**: Seamless session renewal without re-authentication
- **Protected Routes**: Middleware-based authentication and authorization

### Event Management
- **Create Events**: Authenticated users can create events with detailed information
- **Browse Events**: Public access to event listings with search and filtering
- **Search & Filter**: Full-text search on title/description, filter by date range and location
- **Update/Delete Events**: Event organizers can modify or remove their events
- **Capacity Management**: Automatic tracking of available spots

### Registration System
- **Event Registration**: Users can register for events with capacity validation
- **Registration Cancellation**: Cancel registrations and free up spots
- **Registration Tracking**: View personal registrations and registration status
- **Organizer Dashboard**: Event organizers can view attendee lists
- **Transaction Safety**: MongoDB transactions ensure data consistency

### Security & Performance
- **Rate Limiting**: Protection against abuse (100 req/15min general, 5 req/15min auth)
- **Input Validation**: Comprehensive validation using Zod schemas
- **Security Headers**: Helmet middleware for security best practices
- **CORS Configuration**: Configurable cross-origin resource sharing
- **Error Handling**: Consistent error responses with detailed logging

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (jsonwebtoken) + bcrypt
- **Validation**: Zod
- **Security**: Helmet, CORS, express-rate-limit
- **Logging**: Winston
- **Documentation**: Swagger/OpenAPI

## Prerequisites

Before running this project, ensure you have the following installed:

- **Node.js**: v18.x or higher
- **npm**: v9.x or higher
- **MongoDB**: v6.x or higher (running locally or remote instance)

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd events-platform-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` file with your configuration (see Environment Variables section below)

4. **Ensure MongoDB is running**
   ```bash
   # If using local MongoDB
   mongod
   ```

## Environment Variables

Create a `.env` file in the root directory with the following variables:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment mode | `development` | Yes |
| `PORT` | Server port | `5000` | Yes |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/events-platform` | Yes |
| `JWT_ACCESS_SECRET` | Secret key for access tokens | - | Yes |
| `JWT_REFRESH_SECRET` | Secret key for refresh tokens | - | Yes |
| `JWT_ACCESS_EXPIRY` | Access token expiration | `15m` | Yes |
| `JWT_REFRESH_EXPIRY` | Refresh token expiration | `7d` | Yes |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:3000` | Yes |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in ms | `900000` | No |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` | No |
| `AUTH_RATE_LIMIT_MAX_REQUESTS` | Max auth requests per window | `5` | No |
| `BCRYPT_SALT_ROUNDS` | Bcrypt salt rounds | `10` | No |
| `LOG_LEVEL` | Winston log level | `info` | No |

**Security Note**: Never commit your `.env` file. Always use strong, unique secrets for JWT tokens in production.

## Running the Application

### Development Mode
```bash
npm run dev
```
Starts the server with hot-reload using nodemon and ts-node.

### Production Mode
```bash
# Build TypeScript to JavaScript
npm run build

# Start the production server
npm start
```

The server will start on the port specified in your `.env` file (default: 5000).

## API Documentation

Once the server is running, access the interactive API documentation at:

```
http://localhost:5000/api-docs
```

The Swagger UI provides detailed information about all endpoints, request/response schemas, and allows you to test the API directly from the browser.

## API Endpoints Summary

### Authentication (`/api/auth`)
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login with credentials
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout and invalidate refresh token
- `GET /api/auth/me` - Get current user profile (protected)

### Events (`/api/events`)
- `GET /api/events` - Get all events (public, with search/filter)
- `GET /api/events/:id` - Get event by ID (public)
- `POST /api/events` - Create new event (protected)
- `PUT /api/events/:id` - Update event (protected, organizer only)
- `DELETE /api/events/:id` - Delete event (protected, organizer only)
- `GET /api/events/my` - Get user's created events (protected)
- `GET /api/events/:id/check-registration` - Check registration status (protected)

### Registrations (`/api/registrations`)
- `GET /api/registrations` - Get all registrations (protected)
- `GET /api/registrations/my` - Get user's registrations (protected)
- `GET /api/events/:eventId/registrations` - Get event registrations (protected, organizer only)
- `POST /api/registrations` - Register for event (protected)
- `DELETE /api/registrations/:id` - Cancel registration (protected)

### Health Check
- `GET /api/health` - Health check endpoint

## Project Structure

```
events-platform-backend/
├── src/
│   ├── config/           # Configuration files
│   │   ├── database.ts   # MongoDB connection
│   │   ├── env.ts        # Environment variables
│   │   ├── logger.ts     # Winston logger
│   │   └── swagger.ts    # Swagger/OpenAPI config
│   ├── controllers/      # Request handlers
│   │   ├── auth.controller.ts
│   │   ├── events.controller.ts
│   │   └── registrations.controller.ts
│   ├── middleware/       # Express middleware
│   │   ├── auth.middleware.ts
│   │   ├── authorization.middleware.ts
│   │   ├── error.middleware.ts
│   │   ├── notFound.middleware.ts
│   │   ├── rateLimiter.middleware.ts
│   │   └── validation.middleware.ts
│   ├── models/           # Mongoose models
│   │   ├── Event.ts
│   │   ├── RefreshToken.ts
│   │   ├── Registration.ts
│   │   └── User.ts
│   ├── routes/           # Route definitions
│   │   ├── auth.routes.ts
│   │   ├── events.routes.ts
│   │   └── registrations.routes.ts
│   ├── services/         # Business logic
│   │   ├── auth.service.ts
│   │   ├── events.service.ts
│   │   └── registrations.service.ts
│   ├── types/            # TypeScript types
│   │   └── errors.ts
│   ├── utils/            # Utility functions
│   │   ├── asyncHandler.ts
│   │   ├── jwt.util.ts
│   │   ├── pagination.util.ts
│   │   └── password.util.ts
│   ├── validators/       # Zod validation schemas
│   │   ├── auth.validator.ts
│   │   ├── events.validator.ts
│   │   └── registrations.validator.ts
│   ├── app.ts           # Express app setup
│   └── server.ts        # Server entry point
├── dist/                # Compiled JavaScript (generated)
├── .env                 # Environment variables (not in git)
├── .env.example         # Environment variables template
├── .gitignore          # Git ignore rules
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
└── README.md           # This file
```

## Error Handling

The API uses consistent error responses across all endpoints:

```json
{
  "error": "ErrorType",
  "message": "Human-readable error message",
  "statusCode": 400,
  "errors": {
    "fieldName": ["Validation error message"]
  }
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `204` - No Content
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate registration, capacity full)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

## Development Guidelines

### Code Style
- Use TypeScript strict mode
- Follow ESLint rules (if configured)
- Use async/await for asynchronous operations
- Implement proper error handling with custom error classes

### Database
- Use Mongoose for MongoDB interactions
- Implement proper indexes for query optimization
- Use transactions for operations affecting multiple documents
- Validate data at both schema and application levels

### Security
- Never commit `.env` files or secrets
- Use strong JWT secrets in production
- Implement rate limiting on all endpoints
- Validate and sanitize all user inputs
- Use HTTPS in production

## Troubleshooting

### MongoDB Connection Issues
```bash
# Check if MongoDB is running
mongosh

# If using MongoDB Atlas, verify connection string and network access
```

### Port Already in Use
```bash
# Change PORT in .env file or kill the process using the port
lsof -ti:5000 | xargs kill -9
```

### JWT Token Errors
- Ensure `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are set in `.env`
- Verify token expiry settings are valid (e.g., '15m', '7d')

### Rate Limit Issues
- Adjust `RATE_LIMIT_MAX_REQUESTS` in `.env` for development
- Clear rate limit by restarting the server

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License.

## Support

For issues, questions, or contributions, please open an issue in the repository.

---

**Built with ❤️ using Node.js, Express, TypeScript, and MongoDB**
