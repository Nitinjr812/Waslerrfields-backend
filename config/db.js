import mongoose from 'mongoose';

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(
            'mongodb+srv://nitin:Oio3pg0yQy4UQR8W@cluster0.lgmyvk0.mongodb.net/Waslerrfields?retryWrites=true&w=majority',
            {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            }
        );
        console.log(`MongoDB Connected to database: ${conn.connection.name}`);
    } catch (error) {
        console.error(`Connection error: ${error.message}`);
        process.exit(1);
    }
};

export default connectDB;