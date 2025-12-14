import mongoose from 'mongoose';
import { databaseConfig } from './env';
import { User } from '../models/User';

/**
 * Connect to MongoDB database
 * @returns Promise that resolves when connection is established
 */
export const connectDatabase = async (): Promise<void> => {
  try {
    // Configure Mongoose connection options
    const options = {
      maxPoolSize: 10,
      minPoolSize: 5,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 5000,
      family: 4, // Use IPv4, skip trying IPv6
    };

    // Connect to MongoDB
    await mongoose.connect(databaseConfig.mongoUri, options);

    console.log('✅ MongoDB connected successfully');

    // Migrate User index from sparse to partial if needed
    try {
      const userCollection = User.collection;
      const indexes = await userCollection.indexes();
      const oldIndex = indexes.find(idx => {
        const key = idx.key as Record<string, number | string>;
        return (
          key.provider === 1 &&
          key.providerId === 1 &&
          idx.sparse === true &&
          !idx.partialFilterExpression
        );
      });

      if (oldIndex) {
        console.log('🔄 Migrating User index from sparse to partial...');
        await userCollection.dropIndex('provider_1_providerId_1').catch(() => {
          // Index might not exist, ignore error
        });
        // Recreate with correct configuration
        await userCollection.createIndex(
          { provider: 1, providerId: 1 },
          {
            unique: true,
            partialFilterExpression: { providerId: { $exists: true } },
          }
        );
        console.log('✅ User index migrated successfully');
      }
    } catch (error) {
      console.warn('⚠️  Index migration warning (this is usually safe to ignore):', error);
    }

    // Handle connection events
    mongoose.connection.on('error', error => {
      console.error('❌ MongoDB connection error:', error);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

    // Handle process termination
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed due to application termination');
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    throw error;
  }
};

/**
 * Disconnect from MongoDB database
 * @returns Promise that resolves when disconnection is complete
 */
export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  } catch (error) {
    console.error('Error closing MongoDB connection:', error);
    throw error;
  }
};
