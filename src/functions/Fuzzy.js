const Fuse = require("fuse.js");

const Fuzzy = (arr, str, max_result) => {
    let list = [];
    arr.forEach((x) => {
        list.push(x.stop_name);
    });

    const options = {
        includeScore: true,
    };

    const fuse = new Fuse(list, options);

    const result = fuse.search(str, { limit: max_result });
    return result;
};

module.exports = Fuzzy;
