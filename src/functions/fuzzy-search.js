const Fuse = require("fuse.js");

const Fuzzy = (arr, str, max_result) => {
    const options = {
        includeScore: true,
    };

    const fuse = new Fuse(arr, options);

    const result = fuse.search(str, { limit: max_result });
    return result;
};

module.exports = Fuzzy;
