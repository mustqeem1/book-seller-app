require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to database! Yay!'))
  .catch(err => console.log('Database problem:', err));

const bookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  price: { type: Number, required: true, min: 0.01 },
  phone: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Book = mongoose.model('Book', bookSchema);

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

const contactSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now }
});
const Contact = mongoose.model('Contact', contactSchema);

app.get('/', (req, res) => {
  res.send('<h1>Server Running!</h1><p><a href="/api/contact">Test API</a></p>');
});

app.post('/api/books', async (req, res) => {
  try {
    const { title, author, price, phone } = req.body;
    if (!title || !author || !price || !phone) return res.status(400).json({ error: 'Missing fields' });
    const newBook = new Book({ title, author, price: parseFloat(price), phone });
    await newBook.save();
    res.json({ message: 'Book saved!' });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

app.get('/api/books', async (req, res) => {
  try {
    const books = await Book.find();
    res.json(books);
  } catch (error) {
    res.status(500).json({ error: 'Fetch error.' });
  }
});

app.post('/api/purchases', async (req, res) => {
  try {
    const { bookId, bookTitle, bookAuthor, bookPrice, buyerName, buyerEmail, buyerPhone } = req.body;
    if (!bookId || !buyerName || !buyerEmail || !buyerPhone) return res.status(400).json({ error: 'Missing fields' });
    const newPurchase = new Purchase({ bookId, bookTitle, bookAuthor, bookPrice: parseFloat(bookPrice), buyerName, buyerEmail, buyerPhone });
    await newPurchase.save();
    res.json({ message: 'Purchase saved!' });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

app.post('/api/contact', async (req, res) => {
  console.log('Contact hit!');
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) return res.status(400).json({ error: 'Missing fields' });
    const newContact = new Contact({ name, email, message });
    await newContact.save();
    res.json({ message: 'Contact saved!' });
  } catch (error) {
    console.log('Contact error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

app.get('/api/contact', async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json(contacts);
  } catch (error) {
    console.log('Contacts fetch error:', error);
    res.status(500).json({ error: 'Fetch error.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server on port ${PORT}`);
});