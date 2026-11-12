// Legacy URLs share the same validation and transaction implementations.
const router=require('express').Router();
router.use('/orders',require('./orders.routes'));
router.use('/returns',require('./returns.routes'));
module.exports=router;
