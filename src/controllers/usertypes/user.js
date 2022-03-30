const User = require('../../models/User')
exports.getUserTokens = async function (req, res) {
    try {
        if(!req.body.type || !req.body.password){
           return res.send({error:'please provide user type and password'})
        }
        const user = await User.findOne(({ type: req.body.type,password:req.body.password }))
        if(!user){
            return res.send({error:'no user found'})
        }
        const token = await user.generateAuthToken()
        return res.send({token})
    } catch (error) {
        return res.send(error)
    }
}