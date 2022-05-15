const express = require("express");
const cors = require('cors')
const mysql = require("mysql");
const bcrypt = require("bcryptjs/dist/bcrypt");
const CryptoJS = require("crypto-js");
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const config = require('./config.json');
require('dotenv').config();
const https = require("https");
const fs = require("fs");
const { constants } = require('crypto');
const res = require("express/lib/response");
const path = require ('path');
const {readFileSync} = require('fs');


const options = {
  key: fs.readFileSync(path.resolve("./privateKey.key")),
  cert: fs.readFileSync(path.resolve("./certificate.crt")),
  secureOptions: constants.SSL_OP_NO_TLSv1_0| constants.SSL_OP_NO_SSLv3 | constants.SSL_OP_NO_TLSv1_1 | constants.SSL_OP_NO_TLSv1_1,
  requestCert: true,
  rejectUnauthorized: false,
};

const PORT = process.env.PORT || 3001;

let countNumOfPassword = 0;

const app = express();
app.use(express.json());
app.use(cors())

const checkIfContainsSync = (str) => {
  const contents = readFileSync(path.resolve("./passwords_dict.txt"), 'utf-8');

  const result = contents.includes(str);

  return result;
}

const genRand = (len) => {
  return Math.random().toString(36).substring(2,len+2);
}

const validateEmail = (email) => {
  return String(email)
    .toLowerCase()
    .match(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    );
};

const generateToken = (id) => {
  return jwt.sign({id}, process.env.JWT_SECRET, {
    expiresIn: '30d'
  })
}

var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'comltdhit@gmail.com',
    pass: process.env.PASSWORD_MAIL
  }
});





const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'communication_ltd',
  multipleStatements: true,
})

db.connect(err => {
  if(err) {
    throw err;

  }

  console.log('MySql connected')
  createTables();
})

app.post('/create-user', async(req, res) => {
  try { 
    const {email, password} = req.body.userDetails;
    const checkPassword = validator.isStrongPassword(password, config);

    
    let sql = `SELECT * from users WHERE email=?`;
    db.query(sql, email, async (err, result) => {
      if(err) {
        throw err;
      }
      if(result.length) {
        res.send("user already registered")
    } else {
      if(!validateEmail(email)) {
        res.send("Not Authenticated");
        return;
      }
  
      if(checkIfContainsSync(password)) {
        res.send("Password in dictionary");
        return;
      }
  
      if(!checkPassword) {
        res.send("Password is Not Valid");
        return;
      };

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const arrayOfPasswords = [hashedPassword];
      
      db.query(`INSERT INTO users(email,password,customers,old_passwords,salt, is_blocked) VALUES (?,?,?,?,?,?)`, [email, hashedPassword,"[]",JSON.stringify(arrayOfPasswords),salt, false], (err, result)=>{
        if(err) throw err;
        db.query(`SELECT * FROM users WHERE email=?`, email, (err, result) => {
          if(err) throw err;
          if(result){
            const user = {...result[0], token: generateToken(result[0].id)};
            res.send(user)
          }
        })
      })
    }
  })
} catch (err) {
  console.log(err.message);
  res.send(err.message);
  return;
}
})

app.post('/block-user', async(req,res) => {
  try {
    const {email} = req.body.userDetails;
    let sql = `UPDATE users SET is_blocked = TRUE WHERE email=?`;
    db.query(sql, email, async (err, result) => {
      if(err) throw err;
      res.send("User Blocked")
    })
  } catch (err) {
    res.send(err.message);
  }
})

app.post('/free-user', async(req,res) => {
  try {
    const {email} = req.body.userDetails;
    let sql = `UPDATE users SET is_blocked = FALSE WHERE email=?`;
    db.query(sql, email, async (err, result) => {
      if(err) throw err;
      res.send("User Free")
    })
  } catch (err) {
    res.send(err.message);
  }
})

app.post('/login-user', async(req, res) => {
  try {
    const {email, password} = req.body.userDetails;
    const checkPassword = validator.isStrongPassword(password, config);
    let sql = `SELECT * from users WHERE email=?`;
    db.query(sql,email, async(err, result) => {
      if(err) throw err;
      if(result.length === 0) {
      res.send("Not Authenticated");
      return;
    }
    if(result.length) {
      const userFound=JSON.parse(JSON.stringify(result[0]));
      if(!checkPassword) {
        res.send("Password is Not Valid");
        return;
      };
      if(userFound.is_blocked === 1) {
        res.send("User Blocked");
        return;
      }else if( await bcrypt.compare(password, userFound.password)) {
        const newCustomers = JSON.parse(userFound.customers);
        countNumOfPassword = 0;
        const user = {...userFound, token: generateToken(userFound.id), customers: newCustomers};
        res.send(user)
      } else {
        countNumOfPassword ++;
        if(countNumOfPassword === config.passwordHistory) {
          res.send("You Reached the top of the attempts");
          return;
        }
        res.send("Not Authenticated");
      }
    }
  })
} catch(err) {
  res.send(err.message);
  return;
}
})

app.get('/get-user', async(req,res) => {
  try {

    const token = req.headers.authorization;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const sql = `SELECT * from users WHERE id=?`;
    db.query(sql, decoded.id, (err, result) => {
      if(err) throw err;
      const userFound=JSON.parse(JSON.stringify(result[0]));
      const newCustomers = JSON.parse(userFound.customers);
      const user = {...userFound, token: generateToken(userFound.id), customers: newCustomers};
      res.send(user);
    })
  } catch (err) {
    res.send(err.message);
    return;
  }
  })
  
app.post('/forgot-password', async(req,res) => {
  try {

    const {email} = req.body;
    let sql = `SELECT * from users WHERE email=?`;
    const string = genRand(12);
    const hash = CryptoJS.SHA1(string);
    const result = CryptoJS.enc.Hex.stringify(hash);
    db.query(sql, email, async(err, result) => {
      if(err) throw err;
      if(result.length === 0) {
        res.send("Email Not Found!");
        return;
      }
    })
    var mailOptions = {
      from: 'comltdhit@gmail.com',
      to: email,
      subject: 'Your New Password Is Here!',
      text: result
    };
    
    transporter.sendMail(mailOptions, function(error, info){
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
        CheckPassword = result;
        res.send(result)
      }
    });
    
  } catch (err) {
    res.send(err.message);
    return;
  }
  })
  
  app.post('/change-password', async (req,res) => {
    try {
      const {email, password} = req.body;
      const checkPassword = validator.isStrongPassword(password, config);

      if(!checkPassword) {
        res.send("Password is not strong")
      }

      if(checkIfContainsSync(password)) {
        res.send("Password in dictionary");
        return;
      }

      let oldPasswords, salt;
      db.query(`SELECT * from users WHERE email=?`, email, async (err, result) => {
        if(err) throw err;
        if(result.length === 0) {
          res.send("Email is not registered")
          return;
        } 
        const resOldPasswords = JSON.parse(JSON.stringify(result[0].old_passwords));
        salt = JSON.parse(JSON.stringify(result[0].salt));
        const hashedPassword = await bcrypt.hash(password, salt);
        oldPasswords = JSON.parse(resOldPasswords);
        oldPasswords = oldPasswords.slice(-config.passwordHistory);
        const index = oldPasswords.findIndex((pass) => pass === hashedPassword);
          if(index > -1) {
            res.send("Password Already Used Before");
            return;
          } else {
            oldPasswords = [...oldPasswords, hashedPassword];
          }
          let sql = `UPDATE users SET password=?, old_passwords=? WHERE email=?`;
          db.query(sql, [hashedPassword,JSON.stringify(oldPasswords),email], async(err, result) => {
            if(err) throw err;
            if(result.affectedRows === 1) {
              db.query(`SELECT * FROM users WHERE email=?`, email, (err, result) => {
                if(err) throw err;
                if(result){
                  res.send(result[0])
                }
              })
            }
          })
      })

    
  } catch (err) {
    res.send(err.message);
    return;
  }
})

app.post('/add-customer', async(req,res) => {
  try {

    const {customerData, email} = req.body;
    const customers = JSON.stringify(customerData);
    let sql = `UPDATE users SET customers=? WHERE email=?`;
    db.query(sql, [customers,email], async(err,result) =>{
      if(err) throw err;
      if(result) {
        res.send(result);
      }
    })
    
  } catch (err) {
    res.send(err.message);
    return;
  }
  })
  
  https.createServer(options, app).listen(PORT, () => {
    console.log(`Server listening on ${PORT}`);
  });
  
  
  // app.listen(PORT, () => {
//   console.log(`Server listening on ${PORT}`);
// });

const createTables = () => {
  try {

    let sql = 'CREATE TABLE IF NOT EXISTS users (id INT(11) NOT NULL AUTO_INCREMENT, email VARCHAR(50), password TEXT, customers JSON, old_passwords JSON, salt TEXT, is_blocked BOOLEAN, primary key(id))';
    db.query(sql, (err, result) => {
      if(err){
        throw err;
      }
      console.log('Create users table success')
    })
  } catch (err) {
    res.send(err.message);
    return;
  }
}