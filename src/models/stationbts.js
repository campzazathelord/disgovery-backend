const db = require('../db/database')

module.exports = class Stationbts {
    constructor(name,uid,code,lines){
        this.name = name;
        this.uid = uid;
        this.code= code;
        this.lines = lines;
    }


save() {

}

static deleteByUid(uid){

}

static fetchAll() {

}

static findByUid(uid){
    
}
}


