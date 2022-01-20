const express = require('express')
const Stationbts = require('../models/stationbts')
const router = new express.Router()
const axios = require('axios')

const formUrlEncoded = x =>
Object.keys(x).reduce((p, c) => p + `&${c}=${encodeURIComponent(x[c])}`, '')
router.get('/healthcheck',async(req,res)=>{
    res.status(200).send({
        status:'running'
    })
})
router.get('/getroutes/:id1/:id2',async(req,res)=>{
   try {
    const data = await axios.post('https://btsapp1.bts.co.th/webservice/api/getRoute', formUrlEncoded({
        Origin: req.params.id1,
        Destination: req.params.id2
      }))
      const payload = {
        StartingStation:data.data.OriginName,
        DestinationStation:data.data.DestinationName,
        TotalKm:data.data.TotalKm,
        ExpectedTrainWaitingTime :'2 min',
        TotalTime:data.data.TotalTime
      }
      res.send({data:payload})
   } catch (error) {
       res.status(500).send(error)
   }
})

router.get('/getfarerates/:id1/:id2',async(req,res)=>{
    try {
        const data = await axios.post('https://btsapp1.bts.co.th/webservice/api/gatFareRate', formUrlEncoded({
            Origin: req.params.id1,
            Destination: req.params.id2
          }))
          const rateFares = {
              fareRates:data.data.FareRate
          }
          res.status(200).send({data:rateFares})
    } catch (error) {
        res.status(500).send(error)
    }
})

module.exports = router