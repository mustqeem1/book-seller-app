require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());  // Add specific origins if needed, e.g., { origin: 'https://yourdomain.com' }
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));  // Serve uploaded images

// Multer config for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });  // 5MB limit

// Rate limiting for contact form
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many contact requests, please try again later.',
});

// Email transporter (FIXED: createTransport, not createTransporter)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to database! Yay!'))
  .catch(err => console.log('Database problem:', err));

// Schemas
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
const User = mongoose.model('User', userSchema);

const bookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  condition: { type: String, required: true },
  type: { type: String, required: true },
  language: { type: String, required: true },
  author: { type: String, required: true },
  originalPrice: { type: Number, required: true, min: 0.01 },
  sellingPrice: { type: Number, required: true, min: 0.01 },
  quantity: { type: String, required: true },
  negotiable: { type: String, required: true },
  name: { type: String, required: true },  // Seller's name
  phone: { type: String, required: true },  // Seller's phone
  city: { type: String, required: true },
  delivery: { type: String, required: true },
  imageUrl: { type: String },  // Path to uploaded image
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isSold: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});
const Book = mongoose.model('Book', bookSchema);

const purchaseSchema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  bookTitle: { type: String, required: true },
  bookAuthor: { type: String, required: true },
  bookPrice: { type: Number, required: true },
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  buyerName: { type: String, required: true },
  buyerEmail: { type: String, required: true },
  buyerPhone: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
const Purchase = mongoose.model('Purchase', purchaseSchema);

const contactSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
});
const Contact = mongoose.model('Contact', contactSchema);

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Routes
app.get('/', (req, res) => {
  res.send('<h1>Server Running!</h1><p><a href="/api/books">View Books</a></p>');
});

// User registration
app.post('/api/register', [
  body('name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('phone').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { name, email, password, phone } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword, phone });
    await newUser.save();
    res.json({ message: 'User registered!' });
  } catch (error) {
    if (error.code === 11000) {  // Duplicate email
      res.status(400).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: 'Registration failed' });
    }
  }
});

// User login
app.post('/api/login', [
  body('email').isEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Forgot password
app.post('/api/forgot-password', [
  body('email').isEmail(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Generate a reset token
    const resetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const resetLink = `https://yourfrontend.com/reset-password?token=${resetToken}`;  // Update with your frontend URL

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset',
      text: `Click here to reset your password: ${resetLink}`,
    });

    res.json({ message: 'Reset link sent to your email!' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user profile
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Profile fetch failed' });
  }
});

// Book routes
app.post('/api/books', authenticateToken, upload.single('image'), [
  body('title').notEmpty(),
  body('condition').notEmpty(),
  body('type').notEmpty(),
  body('language').notEmpty(),
  body('author').notEmpty(),
  body('originalPrice').isFloat({ min: 0.01 }),
  body('sellingPrice').isFloat({ min: 0.01 }),
  body('quantity').notEmpty(),
  body('negotiable').notEmpty(),
  body('name').notEmpty(),
  body('phone').notEmpty(),
  body('city').notEmpty(),
  body('delivery').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { title, condition, type, language, author, originalPrice, sellingPrice, quantity, negotiable, name, phone, city, delivery } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const newBook = new Book({
      title, condition, type, language, author,
      originalPrice: parseFloat(originalPrice),
      sellingPrice: parseFloat(sellingPrice),
      quantity, negotiable, name, phone, city, delivery,
      imageUrl, sellerId: req.user.id
    });
    await newBook.save();
    res.json({ message: 'Book listed successfully!' });
  } catch (error) {
    res.status(500).json({ error: 'Error saving book' });
  }
});

app.get('/api/books', async (req, res) => {
  try {
    const { page = 1, limit = 10, search, minPrice, maxPrice, type, language, condition } = req.query;
    const query = { isSold: false };
    if (search) query.$or = [{ title: new RegExp(search, 'i') }, { author: new RegExp(search, 'i') }];
    if (minPrice) query.sellingPrice = { ...query.sellingPrice, $gte: parseFloat(minPrice) };
    if (maxPrice) query.sellingPrice = { ...query.sellingPrice, $lte: parseFloat(maxPrice) };
    if (type) query.type = type;
    if (language) query.language = language;
    if (condition) query.condition = condition;

    const books = await Book.find(query)
      .populate('sellerId', 'name email')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });
    const total = await Book.countDocuments(query);
    res.json({ books, totalPages: Math.ceil(total / limit), currentPage: parseInt(page) });
  } catch (error) {
    res.status(500).json({ error: 'Fetch error' });
  }
});

app.put('/api/books/:id', authenticateToken, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book || book.sellerId.toString() !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
    const updates = req.body;
    await Book.findByIdAndUpdate(req.params.id, updates);
    res.json({ message: 'Book updated!' });
  } catch (error) {
    res.status(500).json({ error: 'Update error' });
  }
});

app.delete('/api/books/:id', authenticateToken, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book || book.sellerId.toString() !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
    await Book.findByIdAndDelete(req.params.id);
    res.json({ message: 'Book deleted!' });
  } catch (error) {
    res.status(500).json({ error: 'Delete error' });
  }
});

// Purchase routes
app.post('/api/purchases', authenticateToken, [
  body('bookId').isMongoId(),
  body('buyerName').notEmpty(),
  body('buyerEmail').isEmail(),
  body('buyerPhone').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { bookId, buyerName, buyerEmail, buyerPhone } = req.body;
    const book = await Book.findById(bookId);
    if (!book || book.isSold) return res.status(400).json({ error: 'Book not available' });

    const newPurchase = new Purchase({
      bookId,
      bookTitle: book.title,
      bookAuthor: book.author,
      bookPrice: book.sellingPrice,
      buyerId: req.user.id,
      buyerName,
      buyerEmail,
      buyerPhone,
    });
    await newPurchase.save();
    await Book.findByIdAndUpdate(bookId, { isSold: true });
    res.json({ message: 'Purchase saved!' });
  } catch (error) {
    res.status(500).json({ error: 'Purchase error' });
  }
});

// Contact routes
app.post('/api/contact', contactLimiter, [
  body('name').notEmpty().trim(),
  body('email').isEmail(),
  body('message').notEmpty().trim(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { name, email, message } = req.body;
    const newContact = new Contact({ name, email, message });
    await newContact.save();

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: 'oldbooksmarketplace@gmail.com',  // Updated to your email
      subject: 'New Contact Message',
      text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`,
    });

    res.json({ message: 'Contact saved and email sent!' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/contact', async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ error: 'Fetch error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server on port ${PORT}`);
});