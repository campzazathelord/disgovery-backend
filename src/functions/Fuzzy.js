const Fuse = require("fuse.js");
const Fuzzy = (arr, str) => {
    let list = [];
    arr.forEach((x) => {
        list.push(x.stop_name);
    });
    const options = {
        includeScore: true,
    };

    const fuse = new Fuse(list, options);

    const result = fuse.search(str);
    return result;
};
module.exports = Fuzzy;
