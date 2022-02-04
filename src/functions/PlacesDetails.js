const axios = require("axios");

const placesAutoComplete = async (str) => {
    const resultEn = await axios({
        method: "get",
        url: `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${String(
            str,
        )}&location=13.7451079,100.5320582&radius=30000&components=country:TH&language=en&key=${
            process.env.GOOGLE_API_KEY
        }`,
        headers: {},
    });

    const resultTh = await axios({
        method: "get",
        url: `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${String(
            str,
        )}&location=13.7451079,100.5320582&radius=30000&components=country:TH&language=th&key=${
            process.env.GOOGLE_API_KEY
        }`,
        headers: {},
    });

    return {
        resultEn: resultEn.data.predictions,
        resultTh: resultTh.data.predictions,
    };
};

const placeCoords = async (arr) => {
    let newArr = [];
    for (let x of arr.resultEn) {
        const latitude = await axios({
            method: "get",
            url: `https://maps.googleapis.com/maps/api/place/details/json?input=bar&placeid=${x.place_id}&key=${process.env.GOOGLE_API_KEY}`,
            headers: {},
        });
        const tmpObj = {
            name: {
                en: x.structured_formatting.main_text,
                th: x.structured_formatting.main_text,
            },
            location: {
                coords: latitude.data.result.geometry.location,
            },
            google_plus_code: "-",
            address: {
                en: x.structured_formatting.secondary_text,
            },
        };
        newArr.push(tmpObj);
    }
    for (let [i, value] of arr.resultTh.entries()) {
        newArr[i].address.th = value.structured_formatting.secondary_text;
    }
    return newArr;
};
module.exports = {
    placesAutoComplete,
    placeCoords,
};
