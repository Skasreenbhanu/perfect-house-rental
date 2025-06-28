const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const otpgenerator = require('otp-generator');

const url = 'mongodb://localhost:27017';
const secret_key = 'qwertyuiop';

const app = express();
app.use(cors());
app.use(express.json());

let cluster;
let database;
let users;
let properties;

async function initMongo() {
  cluster = new MongoClient(url);
  await cluster.connect();
  database = cluster.db('property');
  users = database.collection('users');
  properties = database.collection('properties');
}
initMongo().catch(console.error); // MongoDB connect once at start

// Nodemailer setup
const client = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'kr4785543@gmail.com',
    pass: 'lbrb ercs mxjq oevr',
  },
});

// OTP generator
const generateOTP = () =>
  otpgenerator.generate(6, {
    upperCaseAlphabets: false,
    specialChars: false,
    lowerCaseAlphabets: false,
  });

// Test GET route
app.get('/', (req, res) => {
  res.send('Backend server running on port 4000.');
});

// User Registration
app.post('/userregister', async (req, res) => {
  try {
    const { name, mobile, email, gender, password, rpassword, dob } = req.body;

    if (password !== rpassword) return res.json({ response: '0' });

    const response = await users.findOne({ email });

    if (!response) {
      await users.insertOne({ name, mobile, email, gender, password, dob });

      client.sendMail({
        from: 'Guestbook',
        to: email,
        subject: 'Registration confirmation',
        text: `Congratulations ${name} on successful registration in guestbook.`,
      });

      return res.json({ response: '1' });
    } else {
      return res.json({ response: '2' }); // user already exists
    }
  } catch (err) {
    return res.json({ response: err.message });
  }
});

// User Login
app.post('/userlogin', async (req, res) => {
  try {
    const { email, password } = req.body;
    const response = await users.findOne({ email });

    if (!response) return res.json({ response: '0' }); // no user

    if (response.password === password) {
      const token = jwt.sign({ data: { useremail: email, usertype: 'users' } }, secret_key);
      return res.json({ response: '1', token });
    } else {
      return res.json({ response: '2' }); // wrong password
    }
  } catch (err) {
    return res.json({ response: err.message });
  }
});

// Send OTP
app.post('/sendotp', async (req, res) => {
  try {
    const { email } = req.body;
    const user1 = await users.findOne({ email });
    const otp = generateOTP();

    if (user1) {
      const data = {
        from: 'Guest book',
        to: email,
        subject: 'OTP to reset password',
        text: `Your OTP to reset your password is ${otp}`,
      };

      client.sendMail(data, () => console.log('OTP sent to:', email));
      return res.json({ response: '1', email, otp });
    } else {
      return res.json({ response: '0' });
    }
  } catch (err) {
    return res.json({ response: err.message });
  }
});

// Verify OTP
app.post('/verifyotp', (req, res) => {
  const { otp, localotp } = req.body;
  return res.json({ response: otp === localotp ? '1' : '0' });
});

// Reset Password
app.post('/resetpassword', async (req, res) => {
  try {
    const { newpassword, rnewpassword, email } = req.body;
    if (newpassword !== rnewpassword) return res.json({ response: '0' });

    await users.updateOne({ email }, { $set: { password: newpassword } });
    return res.json({ response: '1' });
  } catch (err) {
    return res.json({ response: err.message });
  }
});

// Sell House
app.post('/sellhouse', async (req, res) => {
  try {
    const { year, area, housetype, address, img1, img2, cost, token } = req.body;
    const decoded = jwt.verify(token, secret_key);

    if (!decoded.data.useremail) return res.json({ response: '0' });

    await properties.insertOne({
      year,
      area,
      housetype,
      address,
      img1,
      img2,
      cost,
      category: 'house',
      owner: decoded.data.useremail,
    });

    return res.json({ response: '1' });
  } catch (err) {
    return res.json({ response: err.message });
  }
});

// Sell Apartment
app.post('/sellapartment', async (req, res) => {
  try {
    const { year, area, roomstype, address, floors, parking, img1, img2, cost, token } = req.body;
    const decoded = jwt.verify(token, secret_key);

    await properties.insertOne({
      year,
      area,
      roomstype,
      address,
      floors,
      parking,
      img1,
      img2,
      cost,
      category: 'apartment',
      owner: decoded.data.useremail,
    });

    return res.json({ response: '1' });
  } catch (err) {
    return res.json({ response: err.message });
  }
});

// Sell Land
app.post('/sellland', async (req, res) => {
  try {
    const { year, area, landtype, address, img1, img2, cost, token } = req.body;
    const decoded = jwt.verify(token, secret_key);

    await properties.insertOne({
      year,
      area,
      landtype,
      address,
      img1,
      img2,
      cost,
      category: 'land',
      owner: decoded.data.useremail,
    });

    return res.json({ response: '1' });
  } catch (err) {
    return res.json({ response: err.message });
  }
});

// Get Apartments
app.get('/getapartments', async (req, res) => {
  try {
    const propData = await properties.find({ category: 'apartment' }).toArray();
    return res.status(200).json(propData);
  } catch (err) {
    return res.json({ response: err.message });
  }
});

// Get Lands
app.get('/getlands', async (req, res) => {
  try {
    const propData = await properties.find({ category: 'land' }).toArray();
    return res.status(200).json(propData);
  } catch (err) {
    return res.json({ response: err.message });
  }
});

// Get Houses
app.get('/gethouses', async (req, res) => {
  try {
    const propData = await properties.find({ category: 'house' }).toArray();
    return res.status(200).json(propData);
  } catch (err) {
    return res.json({ response: err.message });
  }
});

// Get Owner Details
app.post('/getownerdetails', async (req, res) => {
  try {
    const { token } = req.body;
    const decoded = jwt.verify(token, secret_key);
    const owner = await users.findOne({ email: decoded.data.useremail });

    return res.json({ response: '1', owner });
  } catch (err) {
    return res.json({ response: err.message });
  }
});

// Start server
app.listen(4000, () => {
  console.log('✅ Server started on http://localhost:4000');
});
