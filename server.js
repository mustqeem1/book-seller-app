require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
// const nodemailer = require('nodemailer');  // Uncomment for emails (Step 4)

const app = express();
const PORT = 3000;

// Middlewares (required for forms/API)
app.use(cors());  // Allows browser to connect
app.use(bodyParser.urlencoded({ extended: true }));  // Parses form data
app.use(bodyParser.json());  // For JSON

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to database! Yay!'))
  .catch(err => console.log('Database problem:', err));

// Book model (for sell)
const bookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  price: { type: Number, required: true, min: 0.01 },
  phone: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Book = mongoose.model('Book', bookSchema);

// Purchase model (for buy)
const purchaseSchema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  bookTitle: { type: String, required: true },
  bookAuthor: { type: String, required: true },
  bookPrice: { type: Number, required: true },
  buyerName: { type: String, required: true },
  buyerEmail: { type: String, required: true },
  buyerPhone: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Purchase = mongoose.model('Purchase', purchaseSchema);

// NEW: Contact model (for form)
const contactSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now }
});
const Contact = mongoose.model('Contact', contactSchema);

// NEW: Root route (fixes "Cannot GET /")
app.get('/', (req, res) => {
  res.send(`
    <h1>Old Books Marketplace Server is Running!</h1>
    <p><a href="/api/books">View Books (JSON)</a> | <a href="/api/contact">View Contacts (JSON)</a></p>
    <p>Use sell.html or buy.html for forms.</p>
  `);
});

// Existing: POST /api/books (sell form)
app.post('/api/books', async (req, res) => {
  try {
    let title = req.body.title;
    let author = req.body.author;
    let price = req.body.price;
    let phone = req.body.phone;

    if (!title || !author || !price || !phone) {
      return res.status(400).json({ error: 'Fill all boxes!' });
    }
    if (parseFloat(price) <= 0) {
      return res.status(400).json({ error: 'Price must be more than 0!' });
    }
    let phoneCheck = /^\+?[0-9\s\-]{7,15}$/;
    if (!phoneCheck.test(phone)) {
      return res.status(400).json({ error: 'Bad phone number!' });
    }

    title = title.trim();
    author = author.trim();
    phone = phone.trim();
    price = parseFloat(price);

    let newBook = new Book({ title, author, price, phone });
    await newBook.save();

    res.status(201).json({ message: 'Book saved! Thanks!' });
  } catch (error) {
    console.log('Save error:', error);
    res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
});

// Existing: GET /api/books (buy page)
app.get('/api/books', async (req, res) => {
  try {
    const books = await Book.find().sort({ createdAt: -1 });
    res.json(books);
  } catch (error) {
    console.log('Fetch books error:', error);
    res.status(500).json({ error: 'Error getting books.' });
  }
});

// Existing: POST /api/purchases (buy form)
app.post('/api/purchases', async (req, res) => {
  try {
    const { bookId, bookTitle, bookAuthor, bookPrice, buyerName, buyerEmail, buyerPhone } = req.body;

    if (!bookId || !bookTitle || !bookAuthor || !bookPrice || !buyerName || !buyerEmail || !buyerPhone) {
      return res.status(400).json({ error: 'Missing info!' });
    }

    let phoneCheck = /^\+?[0-9\s\-]{7,15}$/;
    if (!phoneCheck.test(buyerPhone)) {
      return res.status(400).json({ error: 'Bad phone number!' });
    }

    const cleanData = {
      bookId,
      bookTitle: bookTitle.trim(),
      bookAuthor: bookAuthor.trim(),
      bookPrice: parseFloat(bookPrice),
      buyerName: buyerName.trim(),
      buyerEmail: buyerEmail.trim(),
      buyerPhone: buyerPhone.trim()
    };

    let newPurchase = new Purchase(cleanData);
    await newPurchase.save();
