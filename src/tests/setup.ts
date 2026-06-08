import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
// Disable IP-based rate limiters in tests — each test file shares an in-memory
// store, so a real limit would fire and cause false 429s in the test suite.
process.env.AUTH_RATE_LIMIT_MAX_REQUESTS = '99999';
process.env.RATE_LIMIT_MAX_REQUESTS = '99999';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-key-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing-only';
process.env.JWT_ACCESS_EXPIRY = '15m';
process.env.JWT_REFRESH_EXPIRY = '7d';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.PORT = '5000';
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-api-key';
process.env.CLOUDINARY_API_SECRET = 'test-api-secret';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  // Start in-memory MongoDB instance
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  // Override the MongoDB URI with the in-memory instance
  process.env.MONGODB_URI = mongoUri;

  // Connect to the in-memory database
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  // Clean up
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongoServer.stop();
});

afterEach(async () => {
  // Clean up after each test
  const collections = mongoose.connection.collections;

  for (const key in collections) {
    const collection = collections[key];
    if (collection) {
      await collection.deleteMany({});
    }
  }
});
