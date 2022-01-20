const express = require('express')
const Stationbts = require('../models/stationbts')
const router = new express.Router()

router.get('/healthcheck',async(req,res)=>{
    res.status(200).send({
        status:'running'
    })
})

module.exports = router