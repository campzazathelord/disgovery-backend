const APIStatus = {
    OK: {
        status: 200,
        message: "OK",
    },
    BAD_REQUEST: {
        status: 400,
        message: "Bad Request",
    },
    UNAUTHORIZED: {
        status: 401,
        message: "Unauthorized",
    },
    INTERNAL: {
        SERVER_ERROR: {
            status: 500,
            message: "Unspecified Internal Server Error",
        },
    },
};

module.exports = APIStatus;
