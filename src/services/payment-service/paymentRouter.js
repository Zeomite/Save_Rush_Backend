const express = require('express');
const paymentRouter = express.Router();
const paymentController = require('./paymentController');
const { auth } = require('../../middlewares/auth');


module.exports = paymentRouter;
