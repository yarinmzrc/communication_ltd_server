const express = require("express");
const mysql = require("mysql");

const PORT = process.env.PORT || 3001;

const app = express();

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'password'
})

db.connect(err => {
  if(err) {
    throw err;
  }

  console.log('MySql connected')
})

app.get('/createdb', (req, res) => {
  let sql = 'CREATE DATABASE communication_ltd';
  db.query(sql, err => {
    if(err) {
      throw err;
    }
    res.send('Database Created')
  })
})

app.get("/api", (req, res) => {
    res.json({ message: "Hello from server!" });
  });
  

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});