require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
// const nodemailer = require('nodemailer');  // Uncomment for emails later

const app = express();
const PORT = 3000;

// Middlewares
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to database! Yay!'))
  .catch(err => console.log('Database problem:', err));

// Book model
const bookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  price: { type: Number, required: true, min: 0.01 },
  phone: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Book = mongoose.model('Book', bookSchema);

// Purchase model
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

// Contact model
const contactSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now }
});
const Contact = mongoose.model('Contact', contactSchema);

// Root route (fixes "Cannot GET /")
app.get('/', (req, res) => {
  res.send(`
    <h1>Old Books Marketplace Server is Running!</h1>
    <p><a href="/api/books">View Books</a> | <a href="/api/contact">View Contacts</a></p>
    <p>Use sell.html, buy.html, or contact.html for forms.</p>
  `);
});

// POST /api/books (sell)
app.post('/api/books', async (req, res) => {
  try {
    const { title, author, price, phone } = req.body;

    if (!title || !author || !price || !phone) {
      return res.status(400).json({ error: 'All fields required!' });
    }
    if (parseFloat(price) <= 0) {
      return res.status(400).json({ error: 'Price > 0!' });
    }
    const phonePattern = /^\+?[0-9\s\-]{7,15}$/;
    if (!phonePattern.test(phone)) {
      return res.status(400).json({ error: 'Invalid phone!' });
    }

    const cleanData = {
      title: title.trim(),
      author: author.trim(),
      price: parseFloat(price),
      phone: phone.trim()
    };

    const newBook = new Book(cleanData);
    await newBook.save();

    res.status(201).json({ message: 'Book saved!' });
  } catch (error) {
    console.log('Book error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/books (buy)
app.get('/api/books', async (req, res) => {
  try {
    const books = await Book.find().sort({ createdAt: -1 });
    res.json(books);
  } catch (error) {
    console.log('Books fetch error:', error);
    res.status(500).json({ error: 'Fetch error.' });
  }
});

// POST /api/purchases (buy)
app.post('/api/purchases', async (req, res) => {
  try {
    const { bookId, bookTitle, bookAuthor, bookPrice, buyerName, buyerEmail, buyerPhone } = req.body;

    if (!bookId || !bookTitle || !bookAuthor || !bookPrice || !buyerName || !buyerEmail || !buyerPhone) {
      return res.status(400).json({ error: 'Missing info!' });
    }

    const phonePattern = /^\+?[0-9\s\-]{7,15}$/;
    if (!phonePattern.test(buyerPhone)) {
      return res.status(400).json({ error: 'Invalid phone!' });
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

    const newPurchase = new Purchase(cleanData);
    await newPurchase.save();

    res.status(201).json({ message: 'Purchase saved!' });
  } catch (error) {
    console.log('Purchase error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/contact (contact form)
app.post('/api/contact', async (req, res) => {
  console.log('Contact route hit!');  // Debug
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'All fields required!' });
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return res.status(400).json({ error: 'Invalid email!' });
    }

    const cleanData = {
      name: name.trim(),
      email: email.trim(),
      message: message.trim()
    };

    const newContact = new Contact(cleanData);
    await newContact.save();

    // Optional email (uncomment after Nodemailer setup)
    // await sendContactEmail(name, email, message);

    res.status(201).json({ message: 'Message received! Thanks!' });
  } catch (error) {
    console.log('Contact error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/contact (view contacts)
app.get('/api/contact', async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json(contacts);
  } catch (error) {
    console.log('Contacts fetch error:', error);
    res.status(500).json({ error: 'Fetch error.' });
  }
});

// Optional: Email function (add Nodemailer require and uncomment above)
 /*
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendContactEmail(name, email, message) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER,
    subject: `New Contact from ${name}`,
    text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`
  };
  await transporter.sendMail(mailOptions);
}
 */

// Start server
app.listen(PORT, () => {
  console.log(`Server is on! Go to http://localhost:${PORT}`);
});