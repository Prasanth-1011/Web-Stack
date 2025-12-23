const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { accessTokenSecret, refreshTokenSecret } = require('./tokenSecrets');

const app = express();
const Port = process.env.PORT;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.URL || 'mongodb+srv://User:User@mongoose.xczces4.mongodb.net/Nexus-Loom')
    .then(() => console.log('Database connected'))
    .catch(err => console.error('Database connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const User = mongoose.model('Users', userSchema);

// Links Schema
const linksSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: true
    },
    folders: {
        type: Array,
        default: []
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

const Links = mongoose.model('Links', linksSchema);

// Middleware to verify token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    jwt.verify(token, accessTokenSecret, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Routes

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validation
        if (!username || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        if (username.length < 3) {
            return res.status(400).json({ message: 'Username must be at least 3 characters' });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        // Check if user exists
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            if (existingUser.email === email) {
                return res.status(400).json({ message: 'Email already registered' });
            }
            return res.status(400).json({ message: 'Username already taken' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = new User({
            username,
            email,
            password: hashedPassword
        });

        await user.save();

        // Create empty links collection for user
        const links = new Links({
            userId: user._id,
            folders: []
        });

        await links.save();

        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Generate tokens
        const accessToken = jwt.sign(
            { userId: user._id, username: user.username },
            accessTokenSecret,
            { expiresIn: '15m' }
        );

        const refreshToken = jwt.sign(
            { userId: user._id },
            refreshTokenSecret,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Login successful',
            accessToken,
            refreshToken,
            username: user.username
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Refresh Token
app.post('/api/auth/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(401).json({ message: 'Refresh token required' });
        }

        jwt.verify(refreshToken, refreshTokenSecret, async (err, decoded) => {
            if (err) {
                return res.status(403).json({ message: 'Invalid refresh token' });
            }

            const user = await User.findById(decoded.userId);
            if (!user) {
                return res.status(403).json({ message: 'User not found' });
            }

            const accessToken = jwt.sign(
                { userId: user._id, username: user.username },
                accessTokenSecret,
                { expiresIn: '15m' }
            );

            res.json({ accessToken });
        });
    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get Links
app.get('/api/links', authenticateToken, async (req, res) => {
    try {
        let links = await Links.findOne({ userId: req.user.userId });

        if (!links) {
            // Create empty links collection if not exists
            links = new Links({
                userId: req.user.userId,
                folders: []
            });
            await links.save();
        }

        res.json(links.folders);
    } catch (error) {
        console.error('Get links error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update Links
app.put('/api/links', authenticateToken, async (req, res) => {
    try {
        const { folders } = req.body;

        if (!Array.isArray(folders)) {
            return res.status(400).json({ message: 'Invalid data format' });
        }

        let links = await Links.findOne({ userId: req.user.userId });

        if (!links) {
            links = new Links({
                userId: req.user.userId,
                folders: folders
            });
        } else {
            links.folders = folders;
            links.updatedAt = Date.now();
        }

        await links.save();

        res.json({ message: 'Links updated successfully', folders: links.folders });
    } catch (error) {
        console.error('Update links error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete Links (optional - delete all)
app.delete('/api/links', authenticateToken, async (req, res) => {
    try {
        await Links.findOneAndUpdate(
            { userId: req.user.userId },
            { folders: [], updatedAt: Date.now() }
        );

        res.json({ message: 'All links deleted successfully' });
    } catch (error) {
        console.error('Delete links error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Start Server
app.listen(Port, () => {
    if (Port === 3000)
        console.log(`Server running on http://localhost:${Port}`);
    else
        console.log(`Server started listening`);

});

